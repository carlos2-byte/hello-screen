import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { exportToPDF, exportToJPG, shareToWhatsApp } from '@/utils/exportReport';

interface ExportButtonsProps {
  elementId: string;
  filename: string;
}

export function ExportButtons({ elementId, filename }: ExportButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try { await fn(); } finally { setLoading(null); }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={!!loading}
        onClick={() => run('pdf', () => exportToPDF(elementId, filename))}
      >
        {loading === 'pdf' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : '📄'}{' '}
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={!!loading}
        onClick={() => run('jpg', () => exportToJPG(elementId, filename))}
      >
        {loading === 'jpg' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : '🖼️'}{' '}
        JPG
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={!!loading}
        onClick={() => run('wpp', () => shareToWhatsApp(elementId, filename))}
      >
        {loading === 'wpp' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : '💬'}{' '}
        WhatsApp
      </Button>
    </div>
  );
}
