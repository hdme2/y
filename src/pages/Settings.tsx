import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { UploadCloud, Save, Loader2, MapPin, Globe, Mail, MessageCircle } from 'lucide-react';

const STORAGE_KEY = 'perfume_settings';

const defaultSettings = {
  company_name: '',
  company_address: '',
  company_phone: '',
  company_wechat: '',
  company_email: '',
  company_website: '',
  logo_url: '',
  margin_rules: [
    { min: 100, max: 999, margin: 15 },
    { min: 1000, max: null, margin: 10 }
  ]
};

export default function SettingsPage() {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(defaultSettings);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
        if (parsed.logo_url) {
          setLogoPreview(parsed.logo_url);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setSettings({ ...settings, logo_url: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      alert('設定已成功儲存！');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setSettings({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <h2 className="text-2xl font-bold tracking-tight">系統設定</h2>

      {/* 公司資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>公司資訊</CardTitle>
          <CardDescription>這些資訊將顯示在報單和 PDF 中</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">公司名稱</label>
              <Input 
                value={settings.company_name || ''} 
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="香港香水批發"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">電話</label>
              <Input 
                value={settings.company_phone || ''} 
                onChange={(e) => updateField('company_phone', e.target.value)}
                placeholder="+852 1234 5678"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block flex items-center gap-2">
              <MapPin className="w-4 h-4" /> 地址
            </label>
            <Input 
              value={settings.company_address || ''} 
              onChange={(e) => updateField('company_address', e.target.value)}
              placeholder="香港九龍旺角彌敦道xxx號"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> WeChat
              </label>
              <Input 
                value={settings.company_wechat || ''} 
                onChange={(e) => updateField('company_wechat', e.target.value)}
                placeholder="hkperfume"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </label>
              <Input 
                value={settings.company_email || ''} 
                onChange={(e) => updateField('company_email', e.target.value)}
                placeholder="info@hkperfume.com"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block flex items-center gap-2">
              <Globe className="w-4 h-4" /> 網站
            </label>
            <Input 
              value={settings.company_website || ''} 
              onChange={(e) => updateField('company_website', e.target.value)}
              placeholder="www.hkperfume.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">公司 Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group cursor-pointer">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center">
                    <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                    <span className="text-xs text-gray-500">上傳</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleLogoChange}
                />
              </div>
              <div className="text-sm text-gray-500">
                建議上傳正方形或橫向圖片<br/>
                點擊圖片可更換
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 利潤規則 */}
      <Card>
        <CardHeader>
          <CardTitle>利潤率設定</CardTitle>
          <CardDescription>根據訂貨量自動調整報價利潤率</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(settings.margin_rules || []).map((rule: any, index: number) => (
            <div key={index} className="grid grid-cols-3 gap-4 items-end">
              <div>
                {index === 0 && <label className="text-xs text-gray-500 mb-1 block">最小數量</label>}
                <Input 
                  type="number" 
                  value={rule.min} 
                  onChange={(e) => {
                    const newRules = [...settings.margin_rules];
                    newRules[index].min = Number(e.target.value);
                    setSettings({ ...settings, margin_rules: newRules });
                  }}
                  placeholder="最小"
                />
              </div>
              <div>
                {index === 0 && <label className="text-xs text-gray-500 mb-1 block">最大數量</label>}
                <Input 
                  type="number" 
                  value={rule.max || ''} 
                  onChange={(e) => {
                    const newRules = [...settings.margin_rules];
                    newRules[index].max = e.target.value ? Number(e.target.value) : null;
                    setSettings({ ...settings, margin_rules: newRules });
                  }}
                  placeholder="無限"
                />
              </div>
              <div>
                {index === 0 && <label className="text-xs text-gray-500 mb-1 block">利潤率 %</label>}
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={rule.margin} 
                    onChange={(e) => {
                      const newRules = [...settings.margin_rules];
                      newRules[index].margin = Number(e.target.value);
                      setSettings({ ...settings, margin_rules: newRules });
                    }}
                    placeholder="%"
                  />
                  {settings.margin_rules.length > 1 && (
                    <Button 
                      variant="destructive" 
                      size="icon"
                      onClick={() => {
                        const newRules = settings.margin_rules.filter((_: any, i: number) => i !== index);
                        setSettings({ ...settings, margin_rules: newRules });
                      }}
                    >×</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Button 
            variant="outline" 
            onClick={() => {
              const newRules = [...settings.margin_rules, { min: 0, max: 0, margin: 0 }];
              setSettings({ ...settings, margin_rules: newRules });
            }}
          >
            + 新增階層
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2 px-8" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? '儲存中...' : '儲存設定'}
        </Button>
      </div>
    </div>
  );
}
