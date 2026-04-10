import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle, Loader2, X, Check, ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { upsertProduct, addQuote, getProducts, deleteProductsBySupplier } from '@/src/lib/api';

interface UploadFile {
  file?: File;
  text?: string;
  supplier: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
  data?: any[];
  error?: string;
}

const STORAGE_KEY = 'perfume_settings';

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export default function UploadQuote() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [allParsedData, setAllParsedData] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [textInput, setTextInput] = useState('');
  const [textSupplier, setTextSupplier] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const localSettings = loadSettings();
    if (localSettings) {
      setSettings(localSettings);
    }
    loadExistingProducts();
  }, []);

  const loadExistingProducts = async () => {
    try {
      const products = await getProducts();
      setExistingProducts(products || []);
    } catch (e) {
      console.log('Failed to load existing products:', e);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      supplier: file.name.replace(/\.[^/.]+$/, ''),
      status: 'pending'
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleTextParse = async () => {
    if (!textInput.trim()) {
      alert('請輸入文字內容');
      return;
    }
    if (!textSupplier.trim()) {
      alert('請輸入供應商名稱');
      return;
    }
    
    setIsParsingText(true);
    try {
      const res = await fetch('/api/parse-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput,
          mimeType: 'text/plain'
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Parsing failed');
      }
      
      const data = await res.json();
      
      const textEntry: UploadFile = {
        text: textInput,
        supplier: textSupplier,
        status: 'done',
        data
      };
      
      setFiles(prev => [...prev, textEntry]);
      setTextInput('');
      setTextSupplier('');
    } catch (error: any) {
      console.error(error);
      alert(`文字解析失敗: ${error.message}`);
    } finally {
      setIsParsingText(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Process files sequentially
  useEffect(() => {
    if (files.length > 0 && currentIndex < files.length) {
      const currentFile = files[currentIndex];
      if (currentFile.status === 'pending') {
        processFile(currentIndex);
      }
    }
  }, [files, currentIndex]);

  const processFile = async (index: number) => {
    if (index >= files.length) return;
    
    const uploadFile = files[index];
    if (uploadFile.status !== 'pending') return;

    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'parsing' } : f));
    setIsParsing(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile.file);
      });

      const res = await fetch('/api/parse-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          mimeType: uploadFile.file.type
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Parsing failed');
      }
      
      const data = await res.json();
      
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'done', data } : f
      ));
    } catch (error: any) {
      console.error(error);
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'error', error: error.message } : f
      ));
    } finally {
      setIsParsing(false);
      // Move to next file
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleImport = async () => {
    const allData = files
      .filter(f => f.status === 'done' && f.data)
      .flatMap(f => f.data!);
    
    if (allData.length === 0) return;
    
    setIsImporting(true);
    try {
      // Group data by file
      const fileDataMap = new Map<string, any[]>();
      for (const uf of files.filter(f => f.status === 'done')) {
        const supplierName = uf.supplier || '未知供應商';
        const key = uf.file?.name || `文字_${uf.supplier}`;
        const items = uf.data || [];
        items.forEach((item: any) => {
          item._supplier = supplierName;
        });
        fileDataMap.set(key, items);
      }

      // Import all products - use file name as supplier
      // Deduplicate by barcode: prefer product with Chinese name
      const parseMoq = (v: any): number => {
        if (typeof v === 'number') return Math.floor(v);
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed.includes('/')) {
            const parts = trimmed.split('/');
            const num = parseFloat(parts[0]);
            return isNaN(num) ? 1 : Math.floor(num);
          }
          const num = parseFloat(trimmed);
          return isNaN(num) ? 1 : Math.floor(num);
        }
        return 1;
      };

      const barcodeMap = new Map<string, any>();
      for (const uf of files.filter(f => f.status === 'done')) {
        const supplierName = uf.supplier || '未知供應商';
        for (const item of (uf.data || [])) {
          const barcode = item.barcode || item.条形码 || item.条码 || '';
          const name = item.name || item.品名 || item.商品名称 || '';
          const hasChinese = /[\u4e00-\u9fa5]/.test(name);
          if (barcode) {
            const mapKey = `${barcode}|||${supplierName}`;
            const existing = barcodeMap.get(mapKey);
            if (!existing) {
              barcodeMap.set(mapKey, {
                barcode,
                name,
                size: item.size || item.规格 || item.capacity || '',
                spec: item.spec || '',
                price: item.price || item.unit_price || item.unitPrice || 0,
                currency: item.currency || 'HKD',
                moq: parseMoq(item.moq),
                status: item.status || '現貨',
                batch_number: item.batch_number || item.批号 || '',
                supplier: supplierName,
                notes: item.notes || ''
              });
            } else if (hasChinese && !/[\u4e00-\u9fa5]/.test(existing.name)) {
              barcodeMap.set(mapKey, {
                barcode,
                name,
                size: item.size || item.规格 || item.capacity || '',
                spec: item.spec || '',
                price: item.price || item.unit_price || item.unitPrice || 0,
                currency: item.currency || 'HKD',
                moq: parseMoq(item.moq),
                status: item.status || '現貨',
                batch_number: item.batch_number || item.批号 || '',
                supplier: supplierName,
                notes: item.notes || ''
              });
            }
          } else {
            await upsertProduct({
              barcode: '',
              name,
              size: item.size || item.规格 || item.capacity || '',
              spec: item.spec || '',
              price: item.price || item.unit_price || item.unitPrice || 0,
              currency: item.currency || 'HKD',
              moq: parseMoq(item.moq),
              status: item.status || '現貨',
              batch_number: item.batch_number || item.批号 || '',
              supplier: supplierName,
              notes: item.notes || ''
            });
          }
        }
      }
      // Insert/update deduplicated products
      for (const product of barcodeMap.values()) {
        await upsertProduct(product);
      }
      
      // Add quote records
      for (const uf of files.filter(f => f.status === 'done')) {
        const supplierName = uf.supplier || '未知供應商';
        await addQuote({
          supplier: supplierName,
          name: uf.file?.name || `文字輸入_${new Date().toISOString().split('T')[0]}`,
          item_count: uf.data?.length || 0
        });
      }

      alert(`成功匯入 ${allData.length} 筆資料到主檔資料庫！`);
      setFiles([]);
      setAllParsedData([]);
      setCurrentIndex(0);
      localStorage.setItem('data_updated', Date.now().toString());
    } catch (error: any) {
      console.error('Error importing:', error);
      alert(`匯入失敗: ${error?.message || error?.code || '未知錯誤'}。請查看瀏覽器控制台了解詳情。`);
    } finally {
      setIsImporting(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (currentIndex > index) setCurrentIndex(prev => prev - 1);
  };

  const handleDeleteAllProducts = async () => {
    setIsDeleting(true);
    try {
      const uniqueSuppliers = [...new Set(existingProducts.map(p => p.supplier).filter(Boolean))];
      for (const supplier of uniqueSuppliers) {
        await deleteProductsBySupplier(supplier);
      }
      setExistingProducts([]);
      setDeleteAllModalOpen(false);
      localStorage.setItem('data_updated', Date.now().toString());
      alert('已清除資料庫中的全部產品');
    } catch (error) {
      console.error('Error deleting all products:', error);
      alert('刪除失敗');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalParsed = files.filter(f => f.status === 'done').reduce((sum, f) => sum + (f.data?.length || 0), 0);
  const completedCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">報單上傳區</h2>
        {existingProducts.length > 0 && (
          <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => setDeleteAllModalOpen(true)}>
            清除全部產品 ({existingProducts.length})
          </Button>
        )}
      </div>
      
      {settings?.company_name && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
          <span className="font-medium">{settings.company_name}</span>
          {settings.company_phone && <span className="ml-3">📞 {settings.company_phone}</span>}
          {settings.company_wechat && <span className="ml-3">💬 {settings.company_wechat}</span>}
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">文字輸入上傳</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input 
              placeholder="供應商名稱" 
              value={textSupplier}
              onChange={(e) => setTextSupplier(e.target.value)}
              className="w-1/4"
            />
            <Button onClick={handleTextParse} disabled={isParsingText} className="w-1/6">
              {isParsingText ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 解析中</> : '解析文字'}
            </Button>
          </div>
          <textarea
            className="w-full border rounded-md p-3 text-sm h-32 resize-none"
            placeholder="在此粘貼報單文字內容（支援微信截圖文字、Excel複製內容等）..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'}`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700">點擊或拖拽上傳報單（可同時上傳多份）</p>
            <p className="text-sm text-gray-500 mt-2">支援 PDF, Excel, 圖片, 微信截圖</p>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">已選擇檔案：({completedCount}/{files.length} 完成)</h4>
                {isParsing && <span className="text-sm text-teal-600">正在解析...</span>}
              </div>
              
              <ul className="space-y-2">
                {files.map((uf, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm bg-gray-50 p-3 rounded-md border">
                    {uf.file ? <FileText className="w-4 h-4 text-teal-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
                    <span className="flex-1">{uf.file?.name || `文字輸入 (${uf.supplier})`}</span>
                    {uf.file && <span className="text-gray-500">{(uf.file.size / 1024 / 1024).toFixed(2)} MB</span>}
                    {uf.status === 'pending' && <span className="text-gray-400 text-xs">等待中</span>}
                    {uf.status === 'parsing' && <Loader2 className="w-4 h-4 animate-spin text-teal-600" />}
                    {uf.status === 'done' && <Check className="w-4 h-4 text-green-600" />}
                    {uf.status === 'error' && <span className="text-red-500 text-xs" title={uf.error}>失敗</span>}
                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>

              {completedCount === files.length && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">所有檔案解析完成！共 {totalParsed} 筆資料</p>
                </div>
              )}

              {errorCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-700">有 {errorCount} 個檔案解析失敗，請檢查檔案格式</p>
                </div>
              )}

              {completedCount > 0 && completedCount === files.length && (
                <Button onClick={handleImport} disabled={isImporting} className="w-full mt-4">
                  {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 匯入中...</> : `確認並匯入 ${totalParsed} 筆資料到主檔資料庫`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {totalParsed > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              解析結果預覽 (共 {totalParsed} 筆)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>來源</TableHead>
                  <TableHead>供應商</TableHead>
                  <TableHead>條碼</TableHead>
                  <TableHead>品名</TableHead>
                  <TableHead>規格</TableHead>
                  <TableHead>價格</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>比價</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.filter(f => f.status === 'done' && f.data).flatMap((uf, fileIdx) => 
                  uf.data!.map((item, i) => {
                    const existingProduct = existingProducts.find(p => 
                      p.barcode === (item.barcode || item.条形码 || item.条码) || 
                      p.name === item.name
                    );
                    const existingPrice = existingProduct?.price;
                    const currency = item.currency || 'HKD';
                    const newPrice = item.price || item.unit_price || item.unitPrice;
                    const isHkd = currency.toUpperCase() === 'HKD';
                    const priceDiff = existingPrice && newPrice ? newPrice - existingPrice : null;
                    const isLower = priceDiff !== null && priceDiff < 0;
                    const isHigher = priceDiff !== null && priceDiff > 0;
                    
                    return (
                      <TableRow key={`${fileIdx}-${i}`}>
                        <TableCell className="text-xs text-gray-500">{uf.file?.name || '文字'}</TableCell>
                        <TableCell className="font-medium text-teal-700">{uf.supplier}</TableCell>
                        <TableCell className="font-mono text-xs">{item.barcode || '-'}</TableCell>
                        <TableCell className="font-medium">
                          <div>{item.name}</div>
                          {item.name_en && <div className="text-gray-400 text-xs">{item.name_en}</div>}
                        </TableCell>
                        <TableCell>{item.size} {item.spec}</TableCell>
                        <TableCell>
                          {isHkd ? (
                            <span className="font-medium">HKD {newPrice || '-'}</span>
                          ) : (
                            <span className="text-gray-400">{currency} {newPrice || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">{item.status || '未知'}</span>
                        </TableCell>
                        <TableCell>
                          {existingPrice ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">vs {existingPrice}</span>
                              {isLower && <ArrowDown className="w-3 h-3 text-green-600" />}
                              {isHigher && <ArrowUp className="w-3 h-3 text-red-600" />}
                              {priceDiff !== 0 && (
                                <span className={`text-xs ${isLower ? 'text-green-600' : 'text-red-600'}`}>
                                  {isLower ? '' : '+'}{priceDiff.toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-orange-500">新產品</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 清除全部確認 Dialog */}
      <Dialog open={deleteAllModalOpen} onOpenChange={setDeleteAllModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認清除全部產品
            </DialogTitle>
          </DialogHeader>
          <p>確定要清除資料庫中的全部 {existingProducts.length} 項產品嗎？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllModalOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteAllProducts} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 刪除中...</> : '確認清除全部'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
