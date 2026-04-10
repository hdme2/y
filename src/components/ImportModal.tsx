import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog';
import { Progress } from '@/src/components/ui/progress';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { importFromExcel } from '@/src/lib/excel';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  title?: string;
}

export function ImportModal({ isOpen, onClose, onImport, title = "匯入資料" }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setProgress(10);
    setError(null);

    try {
      const data = await importFromExcel(file);
      setProgress(50);
      
      if (data.length === 0) {
        throw new Error('檔案中沒有資料');
      }

      await onImport(data);
      setProgress(100);
      
      setTimeout(() => {
        onClose();
        setFile(null);
        setProgress(0);
        setIsImporting(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || '匯入失敗，請檢查檔案格式');
      setIsImporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            請上傳 Excel 或 CSV 檔案進行批量匯入。
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {!isImporting && progress === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <FileSpreadsheet className="w-10 h-10 text-teal-600 mb-2" />
                <span className="text-sm font-medium text-gray-700">
                  {file ? file.name : '點擊選擇檔案'}
                </span>
                {!file && <span className="text-xs text-gray-500 mt-1">支援 .xlsx, .csv</span>}
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>匯入中...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>取消</Button>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? '處理中...' : '開始匯入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
