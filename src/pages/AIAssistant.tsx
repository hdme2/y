import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Send, Bot, User, Loader2, BarChart3, Package, Users, FileText, Settings } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const APP_CONTEXT = `
你是一個專業的香港香水批發決策助手。這是一個香水批發追蹤管理系統，包含以下功能：

1. 儀表板 (Dashboard) - 顯示庫存概覽、圖表統計、熱銷品牌分析
2. 產品管理 (Products) - 管理產品主檔、條碼、價格、庫存
3. 報單上傳 (Upload Quote) - AI 解析供應商報單PDF/Excel/圖片
4. 一鍵生成報單 (Quote Generator) - 選擇產品生成報價單，支持品牌篩選
5. 客戶管理 (CRM) - 管理批發客戶、標籤、跟進狀態
6. AI 決策助手 - 回答關於市場趨勢、採購建議等問題
7. 系統設定 (Settings) - 公司資訊、利潤率規則等

系統使用港幣 (HKD) 和美元 (USD) 報價，支援繁體中文。
`;

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是你的專屬 AI 決策助手。我了解這個香水批發管理系統的所有功能。你可以問我：\n\n📊 關於數據分析\n📦 關於產品建議\n👥 關於客戶管理\n💰 關於定價策略\n📈 市場趨勢分析\n\n請告訴我能如何幫助你？' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `${APP_CONTEXT}\n\n用戶問題：${userMsg}\n\n請用繁體中文回答，簡潔專業。`,
          history: messages
        })
      });
      
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，系統目前無法回應，請檢查 API Key 或稍後再試。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { icon: BarChart3, label: '數據分析', query: '分析目前的銷售數據和庫存狀況' },
    { icon: Package, label: '產品建議', query: '建議應該採購哪些品牌的香水' },
    { icon: Users, label: '客戶分析', query: '分析現有客戶的分布和價值' },
    { icon: FileText, label: '報單問題', query: '如何上傳和解讀供應商報單' },
  ];

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">AI 決策助手</h2>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {quickActions.map((action, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => {
              setInput(action.query);
            }}
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </Button>
        ))}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-teal-700" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-teal-600 text-white rounded-tr-none' 
                  : 'bg-gray-100 text-gray-800 rounded-tl-none'
              }`}>
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-teal-700" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span className="text-sm text-gray-500">思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        
        <div className="p-4 border-t bg-white">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入問題，例如：建議多採購哪些品牌的香水？" 
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
