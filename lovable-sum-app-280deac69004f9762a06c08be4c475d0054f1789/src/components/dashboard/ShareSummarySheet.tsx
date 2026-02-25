import { useState, useRef, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { type CreditCard as CreditCardType } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Download, Share2, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { FinancialSummaryPage, FinancialDetailsPage } from './FinancialSummaryPDF';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { StatementItem } from '@/hooks/useStatement';

interface CategoryItem {
  id: string;
  name: string;
  value: number;
  color: string;
}

interface ShareSummarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  income: number;
  expense: number;
  currentBalance: number;
  futureCoverage: number;
  categoryData: CategoryItem[];
  totalInvested: number;
  statementItems: StatementItem[];
  cards?: CreditCardType[];
}

export function ShareSummarySheet({
  open,
  onOpenChange,
  month,
  income,
  expense,
  currentBalance,
  futureCoverage,
  categoryData,
  totalInvested,
  statementItems,
  cards = [],
}: ShareSummarySheetProps) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState<'pdf' | 'image' | null>(null);

  const canvasOpts = {
    scale: 2,
    backgroundColor: '#0f1729',
    useCORS: true,
    logging: false,
  };

  const captureCanvas = useCallback(async (el: HTMLDivElement | null) => {
    if (!el) return null;
    return html2canvas(el, canvasOpts);
  }, []);

  const handleDownloadPDF = async () => {
    setGenerating('pdf');
    try {
      const [summaryCanvas, detailsCanvas] = await Promise.all([
        captureCanvas(summaryRef.current),
        captureCanvas(detailsRef.current),
      ]);
      if (!summaryCanvas) return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = 190;
      const x = (pageWidth - imgWidth) / 2;

      // Page 1: Summary
      pdf.setFillColor(15, 23, 41);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      const sumHeight = (summaryCanvas.height * imgWidth) / summaryCanvas.width;
      pdf.addImage(summaryCanvas.toDataURL('image/png'), 'PNG', x, 15, imgWidth, sumHeight);

      // Page 2+: Details
      if (detailsCanvas) {
        const detHeight = (detailsCanvas.height * imgWidth) / detailsCanvas.width;
        const maxContentHeight = pageHeight - 20; // margins
        let remainingHeight = detHeight;
        let sourceY = 0;

        while (remainingHeight > 0) {
          pdf.addPage();
          pdf.setFillColor(15, 23, 41);
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');

          const sliceHeight = Math.min(remainingHeight, maxContentHeight);
          const sourceSliceHeight = (sliceHeight / detHeight) * detailsCanvas.height;

          // Create a slice canvas
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = detailsCanvas.width;
          sliceCanvas.height = sourceSliceHeight;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(detailsCanvas, 0, sourceY, detailsCanvas.width, sourceSliceHeight, 0, 0, detailsCanvas.width, sourceSliceHeight);
            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', x, 10, imgWidth, sliceHeight);
          }

          sourceY += sourceSliceHeight;
          remainingHeight -= sliceHeight;
        }
      }

      pdf.save(`resumo-financeiro-${month}.pdf`);
      toast({ title: 'PDF salvo com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const handleDownloadImage = async () => {
    setGenerating('image');
    try {
      const [summaryCanvas, detailsCanvas] = await Promise.all([
        captureCanvas(summaryRef.current),
        captureCanvas(detailsRef.current),
      ]);
      if (!summaryCanvas) return;

      // Merge both canvases vertically
      const gap = 20;
      const totalHeight = summaryCanvas.height + (detailsCanvas ? gap + detailsCanvas.height : 0);
      const mergedCanvas = document.createElement('canvas');
      mergedCanvas.width = summaryCanvas.width;
      mergedCanvas.height = totalHeight;
      const ctx = mergedCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f1729';
        ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height);
        ctx.drawImage(summaryCanvas, 0, 0);
        if (detailsCanvas) {
          ctx.drawImage(detailsCanvas, 0, summaryCanvas.height + gap);
        }
      }

      const link = document.createElement('a');
      link.download = `resumo-financeiro-${month}.png`;
      link.href = mergedCanvas.toDataURL('image/png');
      link.click();

      toast({ title: 'Imagem salva com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar imagem', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const handleShare = async () => {
    setGenerating('image');
    try {
      const [summaryCanvas, detailsCanvas] = await Promise.all([
        captureCanvas(summaryRef.current),
        captureCanvas(detailsRef.current),
      ]);
      if (!summaryCanvas) return;

      const gap = 20;
      const totalHeight = summaryCanvas.height + (detailsCanvas ? gap + detailsCanvas.height : 0);
      const mergedCanvas = document.createElement('canvas');
      mergedCanvas.width = summaryCanvas.width;
      mergedCanvas.height = totalHeight;
      const ctx = mergedCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f1729';
        ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height);
        ctx.drawImage(summaryCanvas, 0, 0);
        if (detailsCanvas) {
          ctx.drawImage(detailsCanvas, 0, summaryCanvas.height + gap);
        }
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        mergedCanvas.toBlob(resolve, 'image/png')
      );

      if (blob && navigator.share) {
        const file = new File([blob], `resumo-financeiro-${month}.png`, { type: 'image/png' });
        await navigator.share({ title: 'Resumo Financeiro', files: [file] });
      } else {
        handleDownloadImage();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Erro ao compartilhar', variant: 'destructive' });
      }
    } finally {
      setGenerating(null);
    }
  };

  const sharedProps = {
    month,
    income,
    expense,
    currentBalance,
    futureCoverage,
    categoryData,
    totalInvested,
    statementItems,
    cards,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-3">
          <SheetTitle>Compartilhar Resumo</SheetTitle>
        </SheetHeader>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col items-center gap-4 py-4">
            <FinancialSummaryPage ref={summaryRef} {...sharedProps} />
            <FinancialDetailsPage ref={detailsRef} {...sharedProps} />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex gap-2 safe-bottom">
          <Button variant="outline" className="flex-1" onClick={handleDownloadPDF} disabled={!!generating}>
            {generating === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            PDF
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleDownloadImage} disabled={!!generating}>
            {generating === 'image' && !navigator.share ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            Imagem
          </Button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <Button className="flex-1" onClick={handleShare} disabled={!!generating}>
              {generating === 'image' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
