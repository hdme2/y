import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Search, Upload, Mail, MessageCircle, Download, Loader2, Plus, Phone, MapPin, Star, Edit, Trash2 } from 'lucide-react';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { exportToExcel, exportToCSV } from '@/src/lib/excel';
import { ImportModal } from '@/src/components/ImportModal';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from '@/src/lib/api';

const mockCustomers = [
  { id: 1, name: '李老闆 (旺角)', wechat: 'lee_perfume', type: '大客', company: '旺角香水店', phone: '61234567', address: '旺角彌敦道', lastContact: '8 天前', status: '未回覆', tags: ['熱門', '高利潤'], totalOrders: 150000, remark: 'VIP客戶' },
  { id: 2, name: '陳小姐 (代購)', wechat: 'chen_daigou', type: '散客', company: '', phone: '', address: '', lastContact: '12 天前', status: '未回覆', tags: ['代購'], totalOrders: 25000, remark: '' },
  { id: 3, name: '王總 (深圳)', wechat: 'wang_sz', type: '批發', company: '深圳貿易公司', phone: '13800001111', address: '深圳市福田區', lastContact: '2 天前', status: '跟進中', tags: ['群組', '準客戶'], totalOrders: 80000, remark: '有擴展計劃' },
];

export default function CRM() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('全部');
  const [filterType, setFilterType] = useState('全部');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await getCustomers();
      if (data && data.length > 0) {
        setCustomers(data);
      } else {
        setCustomers(mockCustomers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers(mockCustomers);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredCustomers.map(c => c.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    const newSet = new Set(selectedRows);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedRows(newSet);
  };

  const handleExport = () => {
    const dataToExport = selectedRows.size > 0 
      ? customers.filter(c => selectedRows.has(c.id))
      : filteredCustomers;
    
    const formattedData = dataToExport.map(c => ({
      '客戶名稱': c.name,
      '公司': c.company || '',
      '微信號': c.wechat,
      '電話': c.phone || '',
      '地址': c.address || '',
      '類型': c.type,
      '標籤': Array.isArray(c.tags) ? c.tags.join(', ') : c.tags || '',
      '最後聯絡': c.lastContact,
      '狀態': c.status,
      '總消費': c.totalOrders || 0,
      '備註': c.remark || c.notes || ''
    }));
    
    exportToExcel(formattedData, '客戶資料_導出');
  };

  const handleExportCSV = () => {
    const dataToExport = selectedRows.size > 0 
      ? customers.filter(c => selectedRows.has(c.id))
      : filteredCustomers;
    
    const formattedData = dataToExport.map(c => ({
      '客戶名稱': c.name,
      '公司': c.company || '',
      '微信號': c.wechat,
      '電話': c.phone || '',
      '地址': c.address || '',
      '類型': c.type,
      '標籤': Array.isArray(c.tags) ? c.tags.join(', ') : c.tags || '',
      '最後聯絡': c.lastContact,
      '狀態': c.status,
      '總消費': c.totalOrders || 0,
      '備註': c.remark || c.notes || ''
    }));
    
    exportToCSV(formattedData, '客戶資料_導出');
  };

  const handleImport = async (data: any[]) => {
    console.log('Imported data:', data);
    try {
      for (const item of data) {
        await addCustomer({
          name: item.name || '',
          company: item.company || '',
          wechat: item.wechat || '',
          phone: item.phone || '',
          address: item.address || '',
          type: item.type || '散客',
          tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()) : [],
          notes: item.remark || item.notes || ''
        });
      }
      alert(`成功匯入 ${data.length} 筆客戶資料到 Supabase！`);
      fetchCustomers();
    } catch (error) {
      console.error('Error importing customers:', error);
      setCustomers(prev => [...prev, ...data.map((d, i) => ({ 
        ...d, 
        id: Date.now() + i, 
        tags: d.tags ? d.tags.split(',').map((t: string) => t.trim()) : [],
        totalOrders: d.totalOrders || 0
      }))]);
    }
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    
    try {
      if (editingCustomer.id && editingCustomer.id > 1000000) {
        await updateCustomer(editingCustomer.id, editingCustomer);
      } else {
        await addCustomer(editingCustomer);
      }
      fetchCustomers();
      setIsEditModalOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('確定要刪除這個客戶嗎？')) return;
    
    try {
      await deleteCustomer(id.toString());
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
  };

  const openNewCustomer = () => {
    setEditingCustomer({
      name: '',
      company: '',
      wechat: '',
      phone: '',
      address: '',
      type: '散客',
      tags: [],
      status: '未回覆',
      notes: ''
    });
    setIsEditModalOpen(true);
  };

  const openEditCustomer = (customer: any) => {
    setEditingCustomer({ ...customer });
    setIsEditModalOpen(true);
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = !searchTerm || 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.wechat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tags?.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === '全部' || c.status === filterStatus;
    const matchesType = filterType === '全部' || c.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status !== '已刪除').length,
    vip: customers.filter(c => c.type === '大客' || c.totalOrders > 50000).length,
    pending: customers.filter(c => c.status === '未回覆').length
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">客戶管理 (CRM)</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNewCustomer} className="gap-2">
            <Plus className="w-4 h-4" /> 新增客戶
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> 導入
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> 導出
          </Button>
          {selectedRows.size > 0 && (
            <span className="text-sm text-teal-600 self-center">
              已選擇 {selectedRows.size} 名
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-500">總客戶數</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-teal-600">{stats.active}</div>
            <div className="text-sm text-gray-500">活躍客戶</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.vip}</div>
            <div className="text-sm text-gray-500">VIP 客戶</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">{stats.pending}</div>
            <div className="text-sm text-gray-500">待跟進</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row justify-between items-center">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="搜尋名稱、微信號、公司、標籤..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="border rounded-md h-10 px-3 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="全部">全部狀態</option>
              <option value="未回覆">未回覆</option>
              <option value="跟進中">跟進中</option>
              <option value="已成交">已成交</option>
              <option value="已刪除">已刪除</option>
            </select>
            <select 
              className="border rounded-md h-10 px-3 text-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="全部">全部類型</option>
              <option value="大客">大客</option>
              <option value="批發">批發</option>
              <option value="散客">散客</option>
              <option value="代購">代購</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedRows.size === filteredCustomers.length && filteredCustomers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>客戶名稱</TableHead>
                <TableHead>公司</TableHead>
                <TableHead>聯繫方式</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>標籤</TableHead>
                <TableHead>總消費</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>最後聯絡</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                    <p className="text-sm text-gray-500 mt-2">載入中...</p>
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-gray-500">
                    沒有找到客戶資料
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedRows.has(c.id)}
                      onCheckedChange={(checked) => handleSelectRow(c.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {c.type === '大客' && <Star className="w-4 h-4 text-yellow-500" />}
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{c.company || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {c.wechat && <div>WeChat: {c.wechat}</div>}
                      {c.phone && <div>📞 {c.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(c.tags || []).map(t => (
                        <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    ${(c.totalOrders || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      c.status === '未回覆' ? 'bg-red-50 text-red-600' : 
                      c.status === '跟進中' ? 'bg-blue-50 text-blue-600' :
                      c.status === '已成交' ? 'bg-green-50 text-green-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className={c.lastContact && c.lastContact.includes('天前') && parseInt(c.lastContact) > 7 ? 'text-red-500 font-medium' : ''}>
                    {c.lastContact || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEditCustomer(c)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-red-500" onClick={() => handleDeleteCustomer(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImport} 
        title="批量導入客戶資料"
      />

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer?.id > 1000000 ? '編輯客戶' : '新增客戶'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">客戶名稱 *</label>
              <Input 
                value={editingCustomer?.name || ''} 
                onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                placeholder="姓名"
              />
            </div>
            <div>
              <label className="text-sm font-medium">公司</label>
              <Input 
                value={editingCustomer?.company || ''} 
                onChange={(e) => setEditingCustomer({...editingCustomer, company: e.target.value})}
                placeholder="公司名稱"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">微信</label>
                <Input 
                  value={editingCustomer?.wechat || ''} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, wechat: e.target.value})}
                  placeholder="WeChat ID"
                />
              </div>
              <div>
                <label className="text-sm font-medium">電話</label>
                <Input 
                  value={editingCustomer?.phone || ''} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                  placeholder="電話號碼"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">地址</label>
              <Input 
                value={editingCustomer?.address || ''} 
                onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})}
                placeholder="地址"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">類型</label>
                <select 
                  className="w-full border rounded-md h-10 px-3 text-sm"
                  value={editingCustomer?.type || '散客'}
                  onChange={(e) => setEditingCustomer({...editingCustomer, type: e.target.value})}
                >
                  <option value="大客">大客</option>
                  <option value="批發">批發</option>
                  <option value="散客">散客</option>
                  <option value="代購">代購</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">狀態</label>
                <select 
                  className="w-full border rounded-md h-10 px-3 text-sm"
                  value={editingCustomer?.status || '未回覆'}
                  onChange={(e) => setEditingCustomer({...editingCustomer, status: e.target.value})}
                >
                  <option value="未回覆">未回覆</option>
                  <option value="跟進中">跟進中</option>
                  <option value="已成交">已成交</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">標籤 (用逗號分隔)</label>
              <Input 
                value={Array.isArray(editingCustomer?.tags) ? editingCustomer.tags.join(', ') : ''} 
                onChange={(e) => setEditingCustomer({
                  ...editingCustomer, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                })}
                placeholder="VIP, 熱門, 準客戶"
              />
            </div>
            <div>
              <label className="text-sm font-medium">備註</label>
              <Input 
                value={editingCustomer?.notes || ''} 
                onChange={(e) => setEditingCustomer({...editingCustomer, notes: e.target.value})}
                placeholder="備註信息"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>取消</Button>
            <Button onClick={handleSaveCustomer}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
