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
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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

  const isNative = Capacitor.isNativePlatform();

  /** Convert canvas to base64 PNG (without data: prefix) */
  const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL('image/png').split(',')[1];
  };

  /** Merge summary + details canvases vertically */
  const mergeCanvases = (summaryCanvas: HTMLCanvasElement, detailsCanvas: HTMLCanvasElement | null): HTMLCanvasElement => {
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
    return mergedCanvas;
  };

  /** Save base64 to native filesystem and return URI */
  const saveToNativeFs = async (base64Data: string, filename: string, toDownloads = false): Promise<string> => {
    // Try Downloads first for visibility, fallback to Cache
    if (toDownloads) {
      try {
        const result = await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        return result.uri;
      } catch {
        // Fallback to Documents
        try {
          const result = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
          return result.uri;
        } catch {
          // Final fallback to Cache
        }
      }
    }
    // Save to Cache (used for sharing)
    await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });
    // Get the proper content URI for sharing
    const uriResult = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });
    return uriResult.uri;
  };

  /** Teste simples de compartilhamento (só texto) para diagnosticar plugin */
  const handleTestShare = async () => {
    try {
      console.log('[ShareTest] Iniciando teste simples...');
      console.log('[ShareTest] Plataforma:', Capacitor.getPlatform());
      console.log('[ShareTest] isNative:', Capacitor.isNativePlatform());
      
      const result = await Share.share({
        title: 'Teste',
        text: 'Compartilhamento funcionando!',
        dialogTitle: 'Teste de Compartilhamento',
      });
      
      console.log('[ShareTest] Resultado:', JSON.stringify(result));
      alert('Share OK: ' + JSON.stringify(result));
    } catch (err: any) {
      console.error('[ShareTest] ERRO:', err?.message, err);
      alert('Share ERRO: ' + (err?.message || JSON.stringify(err)));
    }
  };

  /** Native share – passa URI diretamente sem convertFileSrc */
  const nativeShare = async (fileUri: string, title: string) => {
    console.log('[Share] URI do Filesystem (sem modificar):', fileUri);

    try {
      await Share.share({
        title,
        text: title,
        url: fileUri,
        dialogTitle: 'Compartilhar Resumo',
      });
      console.log('[Share] Share.share executado com sucesso');
    } catch (err: any) {
      console.error('[Share] ERRO no Share.share:', err?.message, err);
      alert('[Share] ERRO: ' + (err?.message || JSON.stringify(err)));
      throw err;
    }
  };

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
        const maxContentHeight = pageHeight - 20;
        let remainingHeight = detHeight;
        let sourceY = 0;

        while (remainingHeight > 0) {
          pdf.addPage();
          pdf.setFillColor(15, 23, 41);
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');

          const sliceHeight = Math.min(remainingHeight, maxContentHeight);
          const sourceSliceHeight = (sliceHeight / detHeight) * detailsCanvas.height;

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

      const pdfFilename = `resumo-financeiro-${month}.pdf`;

      if (isNative) {
        // Native: save to Downloads only (no share sheet)
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        await saveToNativeFs(pdfBase64, pdfFilename, true);
        toast({ title: 'PDF salvo!', description: 'Verifique na pasta Downloads ou Documentos.' });
      } else {
        // Web: download normally
        pdf.save(pdfFilename);
        toast({ title: 'PDF salvo com sucesso!' });
      }
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

      const mergedCanvas = mergeCanvases(summaryCanvas, detailsCanvas);
      const imgFilename = `resumo-financeiro-${month}.png`;

      if (isNative) {
        // Native: save to Downloads only (no share sheet)
        const base64 = canvasToBase64(mergedCanvas);
        await saveToNativeFs(base64, imgFilename, true);
        toast({ title: 'Imagem salva!', description: 'Verifique na pasta Downloads ou Documentos.' });
      } else {
        const link = document.createElement('a');
        link.download = imgFilename;
        link.href = mergedCanvas.toDataURL('image/png');
        link.click();
        toast({ title: 'Imagem salva com sucesso!' });
      }
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

      const mergedCanvas = mergeCanvases(summaryCanvas, detailsCanvas);
      const imgFilename = `resumo-financeiro-${month}.png`;

      if (isNative) {
        // Native: save file then share via native share sheet (WhatsApp, etc.)
        const base64 = canvasToBase64(mergedCanvas);
        const uri = await saveToNativeFs(base64, imgFilename);
        await nativeShare(uri, 'Resumo Financeiro');
      } else {
        // Web: use Web Share API or fallback to download
        const blob = await new Promise<Blob | null>((resolve) =>
          mergedCanvas.toBlob(resolve, 'image/png')
        );

        if (blob && navigator.share) {
          const file = new File([blob], imgFilename, { type: 'image/png' });
          await navigator.share({ title: 'Resumo Financeiro', files: [file] });
        } else {
          handleDownloadImage();
        }
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
            {generating === 'image' && !generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            Imagem
          </Button>
          {(isNative || (typeof navigator !== 'undefined' && navigator.share)) && (
            <Button className="flex-1" onClick={handleShare} disabled={!!generating}>
              {generating === 'image' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          )}
        </div>

        {/* Botão de teste temporário para diagnóstico */}
        {isNative && (
          <div className="px-4 pb-3">
            <Button variant="destructive" className="w-full" onClick={handleTestShare} size="sm">
              🧪 Teste Share (só texto)
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
