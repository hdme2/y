import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Package, FileSpreadsheet, Loader2 } from "lucide-react";
import { getProducts, getQuotes } from '@/src/lib/api';

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setProducts(productsData || []);
      setQuotes(quotesData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const todayQuotes = quotes.filter(q => {
    const today = new Date().toISOString().split('T')[0];
    return q.created_at?.startsWith(today);
  });

  const totalProducts = products.length;
  const totalSuppliers = [...new Set(products.map(p => p.supplier))].length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">總覽</h2>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">產品總數</CardTitle>
            <Package className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : totalProducts}</div>
            <p className="text-xs text-muted-foreground">共 {totalSuppliers} 個供應商</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日報單</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : todayQuotes.length}</div>
            <p className="text-xs text-muted-foreground">報單記錄</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總報單數</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : quotes.length}</div>
            <p className="text-xs text-muted-foreground">歷史記錄</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近報單</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供應商</TableHead>
                <TableHead>檔案名稱</TableHead>
                <TableHead>產品數量</TableHead>
                <TableHead>日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.slice(0, 10).map((q, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{q.supplier}</TableCell>
                  <TableCell>{q.name}</TableCell>
                  <TableCell>{q.item_count}</TableCell>
                  <TableCell>{q.created_at ? new Date(q.created_at).toLocaleDateString('zh-TW') : '-'}</TableCell>
                </TableRow>
              ))}
              {quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    暫無報單記錄
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}