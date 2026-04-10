import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Upload, Package, FileText, Settings } from 'lucide-react';
import { cn } from './lib/utils';
import UploadQuote from './pages/UploadQuote';
import Products from './pages/Products';
import QuoteGenerator from './pages/QuoteGenerator';
import SettingsPage from './pages/Settings';

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { icon: Upload, label: '報單上傳', path: '/upload' },
    { icon: Package, label: '產品主檔', path: '/products' },
    { icon: FileText, label: '生成報單', path: '/quote' },
    { icon: Settings, label: '設定', path: '/settings' },
  ];

  return (
    <div className="w-64 bg-white border-r h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-teal-700 flex items-center gap-2">
          <Package className="w-6 h-6" />
          香水批發追蹤君
        </h1>
        <p className="text-xs text-gray-500 mt-1">WeChat Edition</p>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              location.pathname === item.path
                ? "bg-teal-50 text-teal-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50 font-sans">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<UploadQuote />} />
            <Route path="/products" element={<Products />} />
            <Route path="/quote" element={<QuoteGenerator />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}