import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { FileText, Image as ImageIcon, Copy, Download, Search, Loader2, Edit, Trash2, Plus, AlertTriangle } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { getProducts, getQuotes, updateQuote, deleteQuote, addQuote, deleteProductsBySupplier } from '@/src/lib/api';

const BRANDS = [
  '全部', 'VERSACE', 'GUCCI', 'CHANEL', 'DIOR', 'YSL', 'TOM FORD', 
  'JO MALONE', 'HERMES', 'BURBERRY', 'PRADA', 'LANCOME', 'ARMANI', 
  'DOLCE & GABBANA', 'COACH', 'MICHAEL KORS', 'MARC JACOBS', 'CHLOE', '其他'
];

const extractBrand = (name: string): string => {
  if (!name) return '其他';
  const upper = name.toUpperCase();
  for (const brand of BRANDS.slice(1)) {
    if (upper.includes(brand)) return brand;
  }
  return '其他';
};

const convertToSimplified = (str: string): string => {
  if (!str) return '';
  const simpMap: Record<string, string> = {
    '餘': '余', '單': '单', '雲': '云', '電': '电', '國': '国', '門': '门',
    '間': '间', '開': '开', '關': '关', '長': '長', '業': '业', '員': '员',
    '網': '网', '聲': '声', '號': '号', '園': '园', '塊': '块', '場': '场',
    '環': '环', '產': '产', '報': '报', '線': '线', '車': '车', '葉': '叶',
    '見': '见', '記': '记', '認': '认', '盡': '尽', '異': '异', '聽': '听',
    '韻': '韵', '顯': '显', '鹽': '盐', '顧': '顾', '館': '馆', '麵': '面',
    '麗': '丽', '寶': '宝', '護': '护', '費': '费', '鄉': '乡', '錶': '表',
    '錯': '错', '頭': '头', '題': '题', '懸': '悬', '影響': '影响', '憶': '忆',
    '學習': '学习', '質': '质', '興': '兴', '衛': '卫', '點': '点', '嚴': '严',
    '廳': '厅', '歡': '欢', '準': '准', '灑': '洒', '輸': '输', '濟': '济',
    '證': '证', '處': '处', '療': '疗', '蟲': '虫', '鐘': '钟', '蘭': '兰'
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
    '见': '見', '记': '記', '认': '認', '尽': '盡', '异': '異', '听': '聽',
    '显': '顯', '盐': '鹽', '顾': '顧', '馆': '館', '面': '麵', '丽': '麗',
    '宝': '寶', '护': '護', '费': '費', '乡': '鄉', '表': '錶', '错': '錯',
    '头': '頭', '题': '題', '悬': '懸', '影响': '影響', '忆': '憶', '学习': '學習',
    '质': '質', '兴': '興', '卫': '衛', '点': '點', '严': '嚴', '厅': '聽',
    '欢': '歡', '准': '準', '洒': '灑', '输': '輸', '济': '濟', '证': '證',
    '处': '處', '疗': '療', '虫': '蟲', '钟': '鐘', '兰': '蘭'
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

const STORAGE_KEY = 'perfume_settings';

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export default function QuoteGenerator() {
  const [products, setProducts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('全部');
  const [currency, setCurrency] = useState('HKD');
  const [margin, setMargin] = useState(15);
  const [quantity, setQuantity] = useState(100);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [quoteProducts, setQuoteProducts] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(true);
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [selectedComparisonItems, setSelectedComparisonItems] = useState<Set<string>>(new Set());
  
  const quoteRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

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
      
      const localSettings = loadSettings();
      if (localSettings) {
        setSettings(localSettings);
        if (localSettings.margin_rules?.length > 0) {
          setMargin(localSettings.margin_rules[0].margin || 15);
        }
      }
      
      if (productsData && productsData.length > 0) {
        const processed = productsData.map((p: any) => ({
          ...p,
          brand: extractBrand(p.name),
          basePrice: p.price || 0,
          customPrice: null as number | null,
          originalSupplier: p.supplier
        }));
        setProducts(processed);
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

  // 按供应商分组产品（显示比价）
  const productsBySupplier = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    products.forEach(p => {
      const supplier = p.supplier || '未知';
      if (!grouped[supplier]) grouped[supplier] = [];
      grouped[supplier].push(p);
    });
    return grouped;
  }, [products]);

  // 相同产品比价 - 按 SKU/條碼/自定義編碼 任一匹配
  const priceComparison = useMemo(() => {
    const comparison: Record<string, any[]> = {};
    products.forEach(p => {
      const matchKeys: string[] = [];
      if (p.barcode) matchKeys.push(`barcode:${p.barcode}`);
      
      if (matchKeys.length > 0) {
        matchKeys.forEach(key => {
          if (!comparison[key]) comparison[key] = [];
          if (!comparison[key].includes(p)) comparison[key].push(p);
        });
      } else {
        const key = `name:${p.name}-${p.size}`;
        if (!comparison[key]) comparison[key] = [];
        comparison[key].push(p);
      }
    });
    // 只返回有多于1个供应商的产品
    return Object.fromEntries(
      Object.entries(comparison).filter(([_, arr]) => arr.length > 1)
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm || 
        fuzzyMatch(p.name, searchTerm) ||
        fuzzyMatch(p.barcode || '', searchTerm) ||
        fuzzyMatch(p.brand, searchTerm) ||
        fuzzyMatch(p.supplier || '', searchTerm);
      const matchesBrand = selectedBrand === '全部' || p.brand === selectedBrand;
      return matchesSearch && matchesBrand;
    });
  }, [products, searchTerm, selectedBrand]);

  const selectedProductList = useMemo(() => {
    return products.filter(p => selectedProducts.includes(p.id || p.barcode));
  }, [products, selectedProducts]);

  const calculatePrice = (product: any) => {
    const basePrice = product.customPrice ?? product.basePrice;
    if (currency === 'USD') {
      return (basePrice / 7.8 * (1 + margin / 100)).toFixed(2);
    }
    return (basePrice * (1 + margin / 100)).toFixed(2);
  };

  const updateCustomPrice = (productId: string, value: number | null) => {
    setProducts(prev => prev.map(p => {
      if ((p.id || p.barcode) === productId) {
        return { ...p, customPrice: value };
      }
      return p;
    }));
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id || p.barcode));
    }
  };

  const handleSelectProduct = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, id]);
    } else {
      setSelectedProducts(selectedProducts.filter(pid => pid !== id));
    }
  };

  const handleEditPrice = (productId: string, currentPrice: number) => {
    setEditingPrice(productId);
    setEditingValue(currentPrice.toString());
  };

  const savePrice = () => {
    if (editingPrice && editingValue) {
      const price = parseFloat(editingValue);
      if (!isNaN(price) && price >= 0) {
        updateCustomPrice(editingPrice, price);
      }
    }
    setEditingPrice(null);
    setEditingValue('');
  };

  const openEditQuote = (quote: any) => {
    setSelectedQuote(quote);
    let savedProducts: any[] = [];
    let productIds: string[] = [];
    
    if (quote.product_ids) {
      try {
        productIds = typeof quote.product_ids === 'string' 
          ? JSON.parse(quote.product_ids) 
          : quote.product_ids;
      } catch {
        productIds = [];
      }
    }
    
    if (productIds.length > 0) {
      savedProducts = products.filter(p => productIds.includes(p.id || p.barcode));
      setSelectedProducts(productIds);
    } else {
      savedProducts = products.filter(p => p.supplier === quote.supplier);
      setSelectedProducts(savedProducts.map(p => p.id || p.barcode));
    }
    setQuoteProducts(savedProducts);
    if (quote.currency) setCurrency(quote.currency);
    if (quote.margin) setMargin(quote.margin);
    if (quote.quantity) setQuantity(quote.quantity);
    setEditModalOpen(true);
  };

  const openDeleteQuote = (quote: any) => {
    setSelectedQuote(quote);
    setDeleteModalOpen(true);
  };

  const handleDeleteQuote = async () => {
    if (!selectedQuote) return;
    try {
      const supplierName = (selectedQuote.supplier || '').trim();
      await deleteQuote(selectedQuote.id);
      await deleteProductsBySupplier(supplierName);
      
      const supplierLower = supplierName.toLowerCase();
      setQuotes(quotes.filter(q => q.id !== selectedQuote.id));
      setProducts(products.filter(p => {
        const productSupplier = (p.supplier || '').toLowerCase();
        return productSupplier !== supplierLower;
      }));
      setDeleteModalOpen(false);
      setSelectedQuote(null);
      localStorage.setItem('data_updated', Date.now().toString());
      alert('報單及相關產品已刪除');
    } catch (error) {
      console.error('Error deleting quote:', error);
      const supplierName = (selectedQuote.supplier || '').trim();
      const supplierLower = supplierName.toLowerCase();
      setQuotes(quotes.filter(q => q.id !== selectedQuote.id));
      setProducts(products.filter(p => {
        const productSupplier = (p.supplier || '').toLowerCase();
        return productSupplier !== supplierLower;
      }));
      setDeleteModalOpen(false);
      setSelectedQuote(null);
      localStorage.setItem('data_updated', Date.now().toString());
      alert('報單及相關產品已刪除（本地記錄）');
    }
  };

  const handleBatchDeleteQuotes = async () => {
    if (selectedQuotes.size === 0) return;
    if (!confirm(`確定要刪除選中的 ${selectedQuotes.size} 個報單及其相關產品嗎？`)) return;
    
    try {
      for (const quoteId of selectedQuotes) {
        const quote = quotes.find(q => q.id === quoteId);
        if (quote) {
          const supplierName = (quote.supplier || '').trim();
          await deleteQuote(quoteId);
          await deleteProductsBySupplier(supplierName);
        }
      }
      setQuotes(quotes.filter(q => !selectedQuotes.has(q.id)));
      const suppliersToRemove = new Set(
        quotes.filter(q => selectedQuotes.has(q.id)).map(q => (q.supplier || '').toLowerCase())
      );
      setProducts(products.filter(p => !suppliersToRemove.has((p.supplier || '').toLowerCase())));
      setSelectedQuotes(new Set());
      localStorage.setItem('data_updated', Date.now().toString());
      alert(`已刪除 ${selectedQuotes.size} 個報單及其相關產品`);
    } catch (error) {
      console.error('Error batch deleting quotes:', error);
      alert('批量刪除失敗');
    }
  };

  const toggleQuoteSelection = (quoteId: string) => {
    const newSet = new Set(selectedQuotes);
    if (newSet.has(quoteId)) {
      newSet.delete(quoteId);
    } else {
      newSet.add(quoteId);
    }
    setSelectedQuotes(newSet);
  };

  const toggleAllQuotes = (checked: boolean) => {
    if (checked) {
      setSelectedQuotes(new Set(quotes.map(q => q.id)));
    } else {
      setSelectedQuotes(new Set());
    }
  };

  const generateImage = async () => {
    if (!quoteRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(quoteRef.current, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `報價單_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating image', err);
    }
  };

  const generatePDF = async () => {
    if (selectedProductList.length === 0) return;
    setIsGeneratingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      const pageWidth = 297;
      
      // 標題
      pdf.setFontSize(16);
      pdf.text('報價單', pageWidth / 2, 15, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`日期: ${new Date().toLocaleDateString('zh-TW')}`, pageWidth - 20, 15, { align: 'right' });
      
      // 表格
      const tableData = selectedProductList.map(p => [
        p.brand || '',
        p.name || '',
        p.size || '',
        p.barcode || '-',
        p.supplier || '',
        `${p.currency || 'HKD'} ${p.basePrice}`,
        `${p.currency || 'HKD'} ${calculatePrice(p)}`,
        p.status || ''
      ]);
      
      pdf.autoTable({
        head: [['品牌', '品名', '規格', '條碼', '供應商', '成本', '報價', '狀態']],
        body: tableData,
        startY: 25,
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] }
      });
      
      pdf.save(`報價單_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('生成PDF失敗');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateExcel = () => {
    if (selectedProductList.length === 0) return;
    
    const data = selectedProductList.map(p => ({
      '品牌': p.brand || '',
      '品名': p.name || '',
      '規格': p.size || '',
      '條碼': p.barcode || '-',
      '供應商': p.supplier || '',
      '成本': p.basePrice || 0,
      '報價': calculatePrice(p),
      '貨幣': p.currency || 'HKD',
      '狀態': p.status || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '報價單');
    XLSX.writeFile(wb, `報價單_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generateComparisonImage = async () => {
    if (!comparisonRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(comparisonRef.current, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `供應商比價_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating image', err);
    }
  };

  const generateComparisonPDF = async () => {
    if (Object.keys(priceComparison).length === 0) return;
    setIsGeneratingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pageWidth = 210;
      
      // 標題
      pdf.setFontSize(16);
      pdf.text('供應商比價分析', pageWidth / 2, 15, { align: 'center' });
      
      let yPos = 25;
      
      Object.entries(priceComparison).forEach(([key, items]) => {
        const sortedItems = [...items].sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
        const best = sortedItems[0];
        
        // 檢查是否需要換頁
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${best.name} ${best.size || ''}`, 10, yPos);
        yPos += 5;
        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(8);
        pdf.text(`識別碼: ${best.barcode || '-'}`, 10, yPos);
        yPos += 4;
        pdf.text(`最優供應商: ${best.supplier} - ${best.basePrice} HKD`, 10, yPos);
        yPos += 4;
        
        // 所有報價
        sortedItems.forEach((item, i) => {
          pdf.text(`${item.supplier}: ${item.basePrice} HKD ${i === 0 ? '✓ 最優' : ''}`, 15, yPos);
          yPos += 3;
        });
        
        yPos += 5;
      });
      
      pdf.save(`供應商比價_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('生成PDF失敗');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateComparisonExcel = () => {
    if (Object.keys(priceComparison).length === 0) return;
    
    const data: any[] = [];
    
    Object.entries(priceComparison).forEach(([key, items]) => {
      const sortedItems = [...items].sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
      const best = sortedItems[0];
      
      items.forEach((item, i) => {
        data.push({
          '商品 名稱': best.name || '',
          '規格': best.size || '',
          '識別碼': best.barcode || '',
          '供應商': item.supplier || '',
          '報價 (HKD)': item.basePrice || 0,
          '是否最優': i === 0 ? '是' : '否'
        });
      });
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '比價分析');
    XLSX.writeFile(wb, `供應商比價_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const copyWeChatText = () => {
    let text = `香水報價 ${new Date().toLocaleDateString('zh-TW')}\n\n`;
    selectedProductList.forEach(p => {
      text += `${p.name} ${p.size}\n`;
      text += `品牌: ${p.brand} | 供應商: ${p.supplier} | 條碼: ${p.barcode || '-'}\n`;
      text += `報價: ${currency} ${calculatePrice(p)} / 件\n\n`;
    });
    text += `歡迎查詢！`;
    navigator.clipboard.writeText(text);
    alert('已複製微信報價文字！');
  };

  const handleSaveQuote = async () => {
    if (selectedProducts.length === 0) {
      alert('請先選擇產品');
      return;
    }
    try {
      const supplier = selectedProductList[0]?.supplier || '未知供應商';
      await addQuote({
        supplier,
        name: `報單_${new Date().toISOString().split('T')[0]}`,
        item_count: selectedProducts.length,
        product_ids: JSON.stringify(selectedProducts),
        currency,
        margin,
        quantity,
        created_at: new Date().toISOString()
      });
      alert('報單已保存');
      fetchData();
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('保存失敗');
    }
  };

  // 生成报价单中的比价信息
  const getProductIdentifier = (p: any) => {
    return p.barcode || p.sku || p.custom_code || `${p.name?.substring(0, 10)}`;
  };

  const renderPriceComparison = () => {
    const compKeys = Object.keys(priceComparison);
    if (compKeys.length === 0) return null;
    
    const sortedGroups = compKeys.map(key => {
      const items = priceComparison[key];
      const sorted = [...items].sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
      return { key, items: sorted, best: sorted[0] };
    }).sort((a, b) => (a.best.basePrice || 0) - (b.best.basePrice || 0));

    const addBestToQuote = (item: any) => {
      const id = item.id || item.barcode;
      if (!selectedProducts.includes(id)) {
        setSelectedProducts([...selectedProducts, id]);
      }
    };

    const addAllBestToQuote = () => {
      sortedGroups.forEach(group => {
        const id = group.best.id || group.best.barcode;
        if (!selectedProducts.includes(id)) {
          setSelectedProducts(prev => [...prev, id]);
        }
      });
    };

    const toggleComparisonItem = (id: string) => {
      const newSet = new Set(selectedComparisonItems);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      setSelectedComparisonItems(newSet);
    };

    const toggleAllComparisonItems = (checked: boolean) => {
      if (checked) {
        const allIds = sortedGroups.map(group => group.best.id || group.best.barcode);
        setSelectedComparisonItems(new Set(allIds));
      } else {
        setSelectedComparisonItems(new Set());
      }
    };

    const addSelectedToQuote = () => {
      selectedComparisonItems.forEach(id => {
        if (!selectedProducts.includes(id)) {
          setSelectedProducts(prev => [...prev, id]);
        }
      });
      setSelectedComparisonItems(new Set());
    };

    // 計算總節省
    const totalSavings = sortedGroups.reduce((sum, group) => {
      if (group.items.length > 1) {
        const highest = group.items[group.items.length - 1].basePrice || 0;
        const lowest = group.items[0].basePrice || 0;
        return sum + (highest - lowest);
      }
      return sum;
    }, 0);

    return (
      <div className="mt-4 border border-yellow-200 rounded-lg overflow-hidden">
        <div className="bg-yellow-50 p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={selectedComparisonItems.size === sortedGroups.length && sortedGroups.length > 0}
                onCheckedChange={(c) => toggleAllComparisonItems(c as boolean)}
              />
              <span className="text-xs text-gray-500">全選</span>
              <h4 className="font-bold text-yellow-800">📊 供應商比價分析 ({compKeys.length}項)</h4>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={addSelectedToQuote} 
                disabled={selectedComparisonItems.size === 0}
                variant="outline"
                className="border-green-600 text-green-600"
              >
                添加所選 ({selectedComparisonItems.size})
              </Button>
              <Button size="sm" onClick={addAllBestToQuote} className="bg-green-600 hover:bg-green-700">
                一鍵添加最優價
              </Button>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-green-700">✅ 最優報價: {sortedGroups.length} 項</span>
            <span className="text-orange-700">💰 總可節省: HKD ${totalSavings.toFixed(2)}</span>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {sortedGroups.map((group, idx) => {
            const best = group.best;
            const itemId = best.id || best.barcode;
            const savings = group.items.length > 1 ? ((group.items[group.items.length - 1].basePrice || 0) - (best.basePrice || 0)).toFixed(2) : 0;
            return (
              <div key={group.key} className="border-b border-yellow-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox 
                    checked={selectedComparisonItems.has(itemId)}
                    onCheckedChange={() => toggleComparisonItem(itemId)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{best.name}</div>
                    <div className="text-xs text-gray-500">
                      識別碼: {best.barcode || best.sku || best.custom_code || '-'}
                      {best.size && ` | 規格: ${best.size}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-600 font-bold text-lg">${best.basePrice}</div>
                    <div className="text-xs text-green-700">最優供應商: {best.supplier}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {group.items.map((p, i) => (
                    <span 
                      key={i} 
                      className={`text-xs px-2 py-1 rounded ${i === 0 ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {p.supplier}: ${p.basePrice} {i === 0 && '✓ 最優'}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {best.created_at ? new Date(best.created_at).toLocaleDateString('zh-TW') : ''}
                  </span>
                  {savings > 0 && (
                    <span className="text-xs text-orange-600">
                      💰 最高可省: ${savings}
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => addBestToQuote(best)}>
                    + 添加
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">一鍵生成報單</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveQuote} disabled={selectedProducts.length === 0}>
            <Plus className="w-4 h-4 mr-2" /> 保存報單
          </Button>
          <Button variant="outline" onClick={copyWeChatText} disabled={selectedProducts.length === 0}>
            <Copy className="w-4 h-4 mr-2" /> 複製微信
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 左側 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">選擇產品</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input 
                placeholder="搜索產品..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <select 
                className="w-full border rounded-md h-9 px-2 text-sm"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <div className="border rounded-md max-h-80 overflow-y-auto">
                {filteredProducts.slice(0, 50).map(p => {
                  const pId = p.id || p.barcode;
                  const hasBetterPrice = Object.entries(priceComparison).some(([key, items]) => 
                    items.some(item => (item.id || item.barcode) === pId && (item.basePrice || 0) < (p.basePrice || 0))
                  );
                  const isBestPrice = Object.entries(priceComparison).some(([key, items]) => 
                    items[0] && (items[0].id || items[0].barcode) === pId
                  );
                  return (
                    <div 
                      key={pId}
                      className={`flex items-center gap-1 p-2 hover:bg-gray-50 text-sm cursor-pointer border-b ${isBestPrice ? 'bg-green-50' : ''}`}
                      onClick={() => handleSelectProduct(pId, !selectedProducts.includes(pId))}
                    >
                      <Checkbox checked={selectedProducts.includes(pId)} />
                      <span className="flex-1 truncate">{p.name}</span>
                      {isBestPrice && <span className="text-xs bg-green-500 text-white px-1 rounded">最優</span>}
                      {hasBetterPrice && !isBestPrice && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">有更低</span>}
                      <span className="text-xs text-orange-600">{p.supplier?.substring(0,3)}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-between text-sm">
                <span>已選: {selectedProducts.length}</span>
                <button className="text-teal-600" onClick={handleSelectAll}>
                  {selectedProducts.length === filteredProducts.length ? '取消全選' : '全選'}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">定價設定</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><label className="text-xs text-gray-500">貨幣</label>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant={currency === 'HKD' ? 'default' : 'outline'} onClick={() => setCurrency('HKD')} className="flex-1">HKD</Button>
                  <Button size="sm" variant={currency === 'USD' ? 'default' : 'outline'} onClick={() => setCurrency('USD')} className="flex-1">USD</Button>
                </div>
              </div>
              <div><label className="text-xs text-gray-500">利潤率 (%)</label>
                <Input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="mt-1" />
              </div>
              <div><label className="text-xs text-gray-500">最小訂量</label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* 歷史報單 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">歷史報單 ({quotes.length})</CardTitle>
                {selectedQuotes.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={handleBatchDeleteQuotes}>
                    刪除已選 ({selectedQuotes.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-48 overflow-y-auto">
              {quotes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">暫無報單記錄</p>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <Checkbox 
                    checked={selectedQuotes.size === quotes.length && quotes.length > 0}
                    onCheckedChange={(c) => toggleAllQuotes(c as boolean)}
                  />
                  <span className="text-xs text-gray-500">全選</span>
                </div>
              )}
              {quotes.slice(0, 10).map((q, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedQuotes.has(q.id)}
                      onCheckedChange={() => toggleQuoteSelection(q.id)}
                    />
                    <div>
                      <div className="font-medium">{q.supplier}</div>
                      <div className="text-xs text-gray-500">{q.item_count}項 | {new Date(q.created_at).toLocaleDateString('zh-TW')}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditQuote(q)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => openDeleteQuote(q)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 右側：報單預覽 */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>報單預覽 ({selectedProducts.length}項)</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={generateImage} disabled={selectedProducts.length === 0}>
                    圖片
                  </Button>
                  <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGeneratingPDF || selectedProducts.length === 0}>
                    {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : ''} PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateExcel} disabled={selectedProducts.length === 0}>
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={quoteRef} className="bg-white p-6 rounded-lg border" style={{ minHeight: '500px' }}>
                {/* 公司資訊頭部 */}
                <div className="flex justify-between items-start border-b pb-4 mb-4">
                  <div>
                    <h1 className="text-xl font-bold">{settings?.company_name || '香港香水批發'}</h1>
                    {settings?.company_address && <p className="text-sm text-gray-500">{settings.company_address}</p>}
                    <div className="flex gap-4 text-sm text-gray-500 mt-1">
                      {settings?.company_phone && <span>📞 {settings.company_phone}</span>}
                      {settings?.company_wechat && <span>💬 {settings.company_wechat}</span>}
                      {settings?.company_email && <span>✉️ {settings.company_email}</span>}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>日期: {new Date().toLocaleDateString('zh-TW')}</div>
                    <div>貨幣: {currency}</div>
                    <div>MOQ: {quantity}件</div>
                  </div>
                </div>

                {/* 產品列表 */}
                {selectedProductList.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">請在左側選擇產品</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2">品牌</th>
                        <th className="text-left py-2">品名/規格</th>
                        <th className="text-left py-2">條碼</th>
                        <th className="text-right py-2">供應商</th>
                        <th className="text-right py-2">成本</th>
                        <th className="text-right py-2">報價</th>
                        <th className="text-center py-2">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProductList.map((p, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{p.brand}</span></td>
                          <td className="py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-gray-500">{p.size}</div></td>
                          <td className="py-2 font-mono text-xs">{p.barcode || '-'}</td>
                          <td className="text-right py-2"><span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">{p.supplier}</span></td>
                          <td className="text-right py-2">
                            {editingPrice === (p.id || p.barcode) ? (
                              <div className="flex items-center gap-1">
                                <Input className="w-16 h-6 text-right text-xs" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && savePrice()} autoFocus />
                                <button onClick={savePrice} className="text-green-600">✓</button>
                              </div>
                            ) : (
                              <div className="cursor-pointer hover:text-teal-600" onClick={() => handleEditPrice(p.id || p.barcode, p.basePrice)} title="點擊修改">
                                {currency} {p.basePrice}
                              </div>
                            )}
                          </td>
                          <td className="text-right py-2 font-bold text-teal-600">{currency} {calculatePrice(p)}</td>
                          <td className="text-center py-2"><span className={`px-2 py-0.5 rounded text-xs ${p.status === '現貨' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status || '現貨'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 供應商比價分析 */}
          {showComparison && Object.keys(priceComparison).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>供應商比價分析 ({Object.keys(priceComparison).length}項)</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={generateComparisonImage}>
                      圖片
                    </Button>
                    <Button variant="outline" size="sm" onClick={generateComparisonPDF}>
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={generateComparisonExcel}>
                      Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={comparisonRef} className="bg-white p-4 rounded-lg border">
                  {renderPriceComparison()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 編輯報單 Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>載入報單</DialogTitle>
          </DialogHeader>
          <p>確定要載入「{selectedQuote?.supplier}」的報單嗎？</p>
          <p className="text-sm text-gray-500">將載入 {quoteProducts.length} 項產品</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>取消</Button>
            <Button onClick={() => setEditModalOpen(false)}>確認載入</Button>
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
          <p>確定要刪除報單「{selectedQuote?.supplier}」嗎？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteQuote}>確認刪除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
