import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface PasswordOverlayProps {
  children: React.ReactNode;
}

export default function PasswordOverlay({ children }: PasswordOverlayProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already unlocked in this session
    const unlocked = sessionStorage.getItem('site_unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const correctPassword = import.meta.env.VITE_SITE_PASSWORD || import.meta.env.VITE_PASSWORD || 'admin';
    
    if (password === correctPassword) {
      setIsUnlocked(true);
      sessionStorage.setItem('site_unlocked', 'true');
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-gray-100">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md mx-4">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">香水批發追蹤君</h1>
            <p className="text-gray-500 mt-2">請輸入密碼以訪問</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="請輸入密碼"
                className={`text-center text-lg ${error ? 'border-red-500' : ''}`}
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm text-center mt-2">
                  密碼錯誤，請重新輸入
                </p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!password}
            >
              確認
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
