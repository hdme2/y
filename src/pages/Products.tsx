import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Search, Download, Loader2, FileText, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { getProducts, getQuotes, updateProduct, deleteProduct, deleteProductsBySupplier } from '@/src/lib/api';

const BRANDS = ['VERSACE', 'GUCCI', 'CHANEL', 'DIOR', 'YSL', 'TOM FORD', 'JO MALONE', 'HERMES', 'BURBERRY', 'PRADA', 'LANCOME', 'ARMANI', 'DOLCE & GABBANA', 'COACH', 'MICHAEL KORS', 'MARC JACOBS', 'CHLOE', '其他'];

const extractBrand = (name: string): string => {
  const upper = name.toUpperCase();
  for (const brand of BRANDS) {
    if (upper.includes(brand)) return brand;
  }
  return '其他';
};

const normalizeChinese = (str: string): string => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const convertToSimplified = (str: string): string => {
  if (!str) return '';
  const simpMap: Record<string, string> = {
    '餘': '余', '單': '单', '雲': '云', '電': '电', '國': '国', '門': '门',
    '間': '间', '開': '开', '關': '关', '長': '长', '業': '业', '員': '员',
    '網': '网', '聲': '声', '號': '号', '園': '园', '塊': '块', '場': '场',
    '環': '环', '產': '产', '報': '报', '線': '线', '車': '车', '葉': '叶',
    '見': '见', '記': '记', '認': '认', '設計': '设计', '盡': '尽', '異': '异',
    '聽': '听', '韻': '韵', '顯': '显', '鹽': '盐', '顧': '顾', '館': '馆',
    '麵': '面', '麗': '丽', '寶': '宝', '護': '护', '費': '费', '鄉': '乡',
    '錶': '表', '錯': '错', '頭': '头', '題': '题', '懸': '悬', '影響': '影响',
    '憶': '忆', '學習': '学习', '質': '质', '興': '兴', '衛': '卫', '點': '点',
    '嚴': '严', '廳': '厅', '歡': '欢', '準': '准', '灑': '洒', '輸': '输',
    '濟': '济', '證': '证', '處': '处', '療': '疗', '蟲': '虫', '鐘': '钟', '蘭': '兰'
  };
  let result = str;
  for (const [trad, simp] of Object.entries(simpMap)) {
    result = result.replace(new RegExp(trad, 'g'), simp);
  }
  return result;
};

const convertToTraditional = (str: string): string => {
  if (!str) return '';
  const tradMap: Record<string, string> = {
    '余': '餘', '单': '單', '云': '雲', '电': '電', '国': '國', '门': '門',
    '间': '間', '开': '開', '关': '關', '长': '長', '业': '業', '员': '員',
    '网': '網', '声': '聲', '号': '號', '园': '園', '块': '塊', '场': '場',
    '环': '環', '产': '產', '报': '報', '线': '線', '车': '車', '叶': '葉',
    '见': '見', '记': '記', '认': '認', '设': '設', '尽': '盡', '异': '異',
    '听': '聽', '显': '顯', '盐': '鹽', '顾': '顧', '馆': '館', '面': '麵',
    '丽': '麗', '宝': '寶', '护': '護', '费': '費', '乡': '鄉', '表': '錶',
    '错': '錯', '头': '頭', '题': '題', '悬': '懸', '影响': '影響', '忆': '憶',
    '学习': '學習', '质': '質', '兴': '興', '卫': '衛', '点': '點', '严': '嚴',
    '厅': '聽', '欢': '歡', '准': '準', '洒': '灑', '输': '輸', '济': '濟',
    '证': '證', '处': '處', '疗': '療', '虫': '蟲', '钟': '鐘', '兰': '蘭'
  };
  let result = str;
  for (const [simp, trad] of Object.entries(tradMap)) {
    result = result.replace(new RegExp(simp, 'g'), trad);
  }
  return result;
};

const fuzzyMatch = (text: string, keyword: string): boolean => {
  if (!text || !keyword) return false;
  const textLower = text.toLowerCase();
  const kwLower = keyword.toLowerCase();
  if (textLower.includes(kwLower)) return true;
  const textSimplified = convertToSimplified(textLower);
  const textTraditional = convertToTraditional(textLower);
  const kwSimplified = convertToSimplified(kwLower);
  const kwTraditional = convertToTraditional(kwLower);
  return textSimplified.includes(kwSimplified) || 
         textSimplified.includes(kwTraditional) ||
         textTraditional.includes(kwSimplified) ||
         textTraditional.includes(kwTraditional);
};

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('全部');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [selectedQuoteProducts, setSelectedQuoteProducts] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'products' | 'quotes' | 'compare'>('products');
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchData();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'data_updated') {
        fetchData();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsData, quotesData] = await Promise.all([
        getProducts(),
        getQuotes()
      ]);
      
      if (productsData) {
        setProducts(productsData.map((p: any) => ({ 
          ...p, 
          brand: extractBrand(p.name),
          price: p.price || 0
        })));
      }
      
      if (quotesData) {
        setQuotes(quotesData.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 智能搜索 - 支持多关键词模糊匹配
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products.filter(p => selectedBrand === '全部' || p.brand === selectedBrand);
    }
    
    const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k);
    
    return products.filter(p => {
      const matchBrand = selectedBrand === '全部' || p.brand === selectedBrand;
      const matchSearch = keywords.length === 0 || keywords.some(keyword => {
        const searchFields = [
          p.name, p.barcode, p.brand, p.supplier, p.size, p.spec, 
          p.batch_number, p.status, p.notes
        ];
        
        return searchFields.some(field => fuzzyMatch(field || '', keyword));
      });
      
      return matchBrand && matchSearch;
    });
  }, [products, searchTerm, selectedBrand]);

  // 按品牌统计
  const brandStats = useMemo(() => {
    const stats: Record<string, { count: number; avgPrice: number }> = {};
    products.forEach(p => {
      const brand = p.brand || '其他';
      if (!stats[brand]) {
        stats[brand] = { count: 0, avgPrice: 0 };
      }
      stats[brand].count++;
      stats[brand].avgPrice += p.price || 0;
    });
    
    return Object.entries(stats).map(([brand, data]) => ({
      brand,
      count: data.count,
      avgPrice: Math.round(data.avgPrice / data.count)
    })).sort((a, b) => b.count - a.count);
  }, [products]);

  // 今日报价
  const todayQuotes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return quotes.filter(q => q.created_at?.startsWith(today));
  }, [quotes]);

  // 供應商比價 - 按條碼分組，顯示所有符合條件的產品
  const priceComparison = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredProducts.forEach(p => {
      const barcode = p.barcode || `no-barcode-${p.name}-${p.size}`;
      if (!grouped[barcode]) grouped[barcode] = [];
      grouped[barcode].push(p);
    });
    return Object.entries(grouped)
      .map(([barcode, items]) => {
        const sorted = [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
        const hasMultipleSuppliers = new Set(items.map(i => i.supplier)).size > 1;
        return {
          barcode,
          name: items[0].name,
          size: items[0].size,
          spec: items[0].spec,
          brand: items[0].brand,
          items: sorted,
          bestPrice: sorted[0].price,
          bestSupplier: sorted[0].supplier,
          hasMultipleSuppliers
        };
      })
      .filter(g => g.hasMultipleSuppliers)
      .sort((a, b) => (b.items.length - a.items.length) || (b.bestPrice - a.bestPrice));
  }, [filteredProducts, products]);

  // 所有產品比價 - 顯示所有產品不分供應商
  const allPriceComparison = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredProducts.forEach(p => {
      const barcode = p.barcode || `no-barcode-${p.name}-${p.size}`;
      if (!grouped[barcode]) grouped[barcode] = [];
      grouped[barcode].push(p);
    });
    return Object.entries(grouped)
      .map(([barcode, items]) => {
        const sorted = [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
        const hasMultipleSuppliers = new Set(items.map(i => i.supplier)).size > 1;
        return {
          barcode,
          name: items[0].name,
          size: items[0].size,
          spec: items[0].spec,
          brand: items[0].brand,
          items: sorted,
          bestPrice: sorted[0].price,
          bestSupplier: sorted[0].supplier,
          hasMultipleSuppliers,
          supplierCount: new Set(items.map(i => i.supplier)).size
        };
      })
      .sort((a, b) => b.supplierCount - a.supplierCount || (b.bestPrice - a.bestPrice));
  }, [filteredProducts, products]);

  // 获取报价关联的产品
  const getQuoteProducts = (quote: any) => {
    return products.filter(p => 
      p.supplier === quote.supplier || 
      (quote.name && p.barcode && quote.name.includes(p.barcode.substring(0, 8)))
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredProducts.map(p => p.id || p.barcode)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedRows);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedRows(newSet);
  };

  const handleExport = () => {
    const dataToExport = selectedRows.size > 0 
      ? filteredProducts.filter(p => selectedRows.has(p.id || p.barcode))
      : filteredProducts;
    
    import('@/src/lib/excel').then(({ exportToExcel }) => {
      exportToExcel(dataToExport, '產品資料');
    });
  };

  const openEditProduct = (product: any) => {
    setEditProduct({ ...product });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editProduct) return;
    try {
      await updateProduct(editProduct.id, {
        name: editProduct.name,
        barcode: editProduct.barcode,
        size: editProduct.size,
        spec: editProduct.spec,
        price: parseFloat(editProduct.price) || 0,
        currency: editProduct.currency,
        moq: parseInt(editProduct.moq) || 1,
        status: editProduct.status,
        batch_number: editProduct.batch_number,
        supplier: editProduct.supplier,
        notes: editProduct.notes
      });
      setProducts(products.map(p => p.id === editProduct.id ? editProduct : p));
      setEditModalOpen(false);
      localStorage.setItem('data_updated', Date.now().toString());
      alert('產品已更新');
    } catch (error) {
      console.error('Error updating product:', error);
      alert('更新失敗');
    }
  };

  const openDeleteProduct = (id: string) => {
    setDeleteProductId(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;
    if (!confirm(`確定要刪除選中的 ${selectedRows.size} 項產品嗎？此操作無法復原。`)) return;
    
    setIsDeleting(true);
    try {
      for (const id of selectedRows) {
        await deleteProduct(id);
      }
      setProducts(products.filter(p => !selectedRows.has(p.id || p.barcode)));
      setSelectedRows(new Set());
      localStorage.setItem('data_updated', Date.now().toString());
      alert(`已刪除 ${selectedRows.size} 項產品`);
    } catch (error) {
      console.error('Error deleting products:', error);
      alert('刪除失敗');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const uniqueSuppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))];
      for (const supplier of uniqueSuppliers) {
        await deleteProductsBySupplier(supplier);
      }
      await Promise.all(products.map(p => deleteProduct(p.id)));
      setProducts([]);
      setSelectedRows(new Set());
      setDeleteAllModalOpen(false);
      localStorage.setItem('data_updated', Date.now().toString());
      alert('已刪除全部產品');
    } catch (error) {
      console.error('Error deleting all products:', error);
      alert('刪除失敗');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteProductId) return;
    try {
      await deleteProduct(deleteProductId);
      setProducts(products.filter(p => (p.id || p.barcode) !== deleteProductId));
      setDeleteModalOpen(false);
      localStorage.setItem('data_updated', Date.now().toString());
      alert('產品已刪除');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('刪除失敗');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">智能比價系統</h2>
        <div className="flex gap-2">
          <Button variant={viewMode === 'products' ? 'default' : 'outline'} onClick={() => setViewMode('products')}>
            產品列表
          </Button>
          <Button variant={viewMode === 'quotes' ? 'default' : 'outline'} onClick={() => setViewMode('quotes')}>
            今日報價 ({todayQuotes.length})
          </Button>
          <Button variant={viewMode === 'compare' ? 'default' : 'outline'} onClick={() => setViewMode('compare')}>
            供應商比價 ({priceComparison.length})
          </Button>
        </div>
      </div>

      {/* 智能搜索 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="智能搜索：輸入品名、條碼、品牌、供應商、容量等關鍵詞（支持模糊匹配）" 
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="border rounded-md h-10 px-3 text-sm min-w-[140px]"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="全部">全部品牌</option>
              {BRANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-500 mt-2">
              找到 {filteredProducts.length} 個結果
            </p>
          )}
        </CardContent>
      </Card>

      {/* 品牌快速篩選 */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={selectedBrand === '全部' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setSelectedBrand('全部')}
        >
          全部 ({products.length})
        </Button>
        {brandStats.slice(0, 8).map(stat => (
          <Button
            key={stat.brand}
            variant={selectedBrand === stat.brand ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedBrand(selectedBrand === stat.brand ? '全部' : stat.brand)}
          >
            {stat.brand} ({stat.count})
          </Button>
        ))}
      </div>

      {viewMode === 'products' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>產品列表 ({filteredProducts.length})</CardTitle>
                <div className="flex gap-2">
                  <Checkbox 
                    checked={selectedRows.size === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm">全選</span>
                  {selectedRows.size > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleExport}>
                        導出已選 ({selectedRows.size})
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isDeleting}>
                        刪除已選 ({selectedRows.size})
                      </Button>
                    </>
                  )}
                  {products.length > 0 && (
                    <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => setDeleteAllModalOpen(true)}>
                      清除全部
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>品牌</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead>條碼</TableHead>
                    <TableHead>規格</TableHead>
                    <TableHead className="text-right">價格</TableHead>
                    <TableHead>供應商</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                        {searchTerm ? '沒有找到匹配的產品，請嘗試其他關鍵詞' : '暫無產品資料'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.slice(0, 50).map((p, idx) => (
                      <TableRow key={`${p.id || p.barcode}-${p.supplier}-${idx}`} className="cursor-pointer" onClick={() => handleSelectRow(p.id || p.barcode, !selectedRows.has(p.id || p.barcode))}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedRows.has(p.id || p.barcode)}
                            onCheckedChange={(c) => handleSelectRow(p.id || p.barcode, c as boolean)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                            {p.brand || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-500">{p.barcode}</TableCell>
                        <TableCell>{p.size} {p.spec}</TableCell>
                        <TableCell className="text-right font-medium">
                          {p.currency || 'HKD'} {p.price}
                        </TableCell>
                        <TableCell>
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                            {p.supplier || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${p.status === '現貨' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.status || '現貨'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditProduct(p); }}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={(e) => { e.stopPropagation(); openDeleteProduct(p.id || p.barcode); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredProducts.length > 50 && (
                <p className="text-center text-sm text-gray-500 py-4">
                  顯示前 50 條結果，請使用搜索縮小範圍
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {viewMode === 'quotes' && (
        <Card>
          <CardHeader>
            <CardTitle>今日供應商報價 ({todayQuotes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {todayQuotes.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>今日尚未收到任何報價</p>
                <p className="text-sm">前往「報單上傳」解析供應商報價單</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayQuotes.map((q, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedQuote(q);
                      setSelectedQuoteProducts(getQuoteProducts(q));
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-medium">{q.supplier || '未知供應商'}</div>
                        <div className="text-sm text-gray-500">{q.name} · {q.item_count} 項產品</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        {q.created_at ? new Date(q.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {viewMode === 'compare' && (
        <Card>
          <CardHeader>
            <CardTitle>供應商比價分析 ({allPriceComparison.length}項)</CardTitle>
            <div className="text-sm text-gray-500 mt-1">
              共 {filteredProducts.length} 項產品（已過濾），涵蓋 {[...new Set(filteredProducts.map(p => p.supplier).filter(Boolean))].length} 個供應商
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>目前沒有產品資料</p>
                <p className="text-sm">請先上傳報單或調整搜索條件</p>
              </div>
            ) : allPriceComparison.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>沒有找到可比較的產品</p>
                <p className="text-sm">嘗試調整搜索條件</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allPriceComparison.map((group, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-lg">{group.name}</div>
                        <div className="text-sm text-gray-500">
                          條碼: {group.barcode.startsWith('no-barcode-') ? '-' : group.barcode} | 規格: {group.size} {group.spec}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {group.supplierCount} 個供應商報價
                        </div>
                      </div>
                      <div className="text-right">
                        {group.hasMultipleSuppliers ? (
                          <>
                            <div className="text-green-600 font-bold text-xl">最優: {group.bestPrice} HKD</div>
                            <div className="text-xs text-gray-500">{group.bestSupplier}</div>
                          </>
                        ) : (
                          <div className="text-gray-500 text-sm">僅此供應商</div>
                        )}
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>供應商</TableHead>
                          <TableHead className="text-right">價格</TableHead>
                          <TableHead>狀態</TableHead>
                          <TableHead>備註</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item, i) => (
                          <TableRow key={i} className={group.hasMultipleSuppliers && i === 0 ? 'bg-red-50' : ''}>
                            <TableCell>
                              <span className={`font-medium ${group.hasMultipleSuppliers && i === 0 ? 'text-red-600' : ''}`}>
                                {item.supplier}
                              </span>
                              {group.hasMultipleSuppliers && i === 0 && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">最優</span>}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${group.hasMultipleSuppliers && i === 0 ? 'text-red-600 text-lg' : ''}`}>
                              {item.currency || 'HKD'} {item.price}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${item.status === '現貨' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {item.status || '現貨'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {item.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 報單詳情 Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>報單詳情 - {selectedQuote?.supplier}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>檔案：{selectedQuote?.name}</span>
              <span>共 {selectedQuote?.item_count} 項產品</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>品名</TableHead>
                  <TableHead>規格</TableHead>
                  <TableHead>價格</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>批號</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedQuoteProducts.length > 0 ? (
                  selectedQuoteProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.size}</TableCell>
                      <TableCell>{p.currency} {p.price}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>{p.batch_number}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      系統未找到匹配的產品資料
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 編輯產品 Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>編輯產品</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">品名</label>
                <Input value={editProduct.name || ''} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">條碼</label>
                <Input value={editProduct.barcode || ''} onChange={(e) => setEditProduct({ ...editProduct, barcode: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">規格</label>
                <Input value={editProduct.size || ''} onChange={(e) => setEditProduct({ ...editProduct, size: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">單價</label>
                <Input type="number" value={editProduct.price || ''} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">供應商</label>
                <Input value={editProduct.supplier || ''} onChange={(e) => setEditProduct({ ...editProduct, supplier: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">狀態</label>
                <select className="w-full border rounded-md h-9 px-2" value={editProduct.status || '現貨'} onChange={(e) => setEditProduct({ ...editProduct, status: e.target.value })}>
                  <option value="現貨">現貨</option>
                  <option value="缺貨">缺貨</option>
                  <option value="預訂">預訂</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認刪除
            </DialogTitle>
          </DialogHeader>
          <p>確定要刪除這個產品嗎？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>確認刪除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清除全部確認 Dialog */}
      <Dialog open={deleteAllModalOpen} onOpenChange={setDeleteAllModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認清除全部產品
            </DialogTitle>
          </DialogHeader>
          <p>確定要清除全部 {products.length} 項產品嗎？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllModalOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 刪除中...</> : '確認清除全部'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
