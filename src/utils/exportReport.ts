import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

function assertNative(): boolean {
  if (!Capacitor.isNativePlatform()) {
    toast({ title: 'Disponível apenas no app Android', variant: 'destructive' });
    return false;
  }
  return true;
}

async function captureElement(elementId: string): Promise<HTMLCanvasElement | null> {
  const el = document.getElementById(elementId);
  if (!el) {
    toast({ title: 'Elemento não encontrado', variant: 'destructive' });
    return null;
  }
  return html2canvas(el, { scale: 2, backgroundColor: '#0f1729', useCORS: true, logging: false });
}

async function saveFile(data: string, filename: string, toDownloads = true): Promise<string> {
  const dirs = toDownloads
    ? [
        { dir: Directory.ExternalStorage, path: `Download/${filename}` },
        { dir: Directory.Documents, path: filename },
        { dir: Directory.Cache, path: filename },
      ]
    : [{ dir: Directory.Cache, path: filename }];

  for (const { dir, path } of dirs) {
    try {
      const r = await Filesystem.writeFile({ path, data, directory: dir, recursive: true });
      return r.uri;
    } catch { continue; }
  }
  throw new Error('Falha ao salvar arquivo');
}

export async function exportToPDF(elementId: string, filename: string) {
  if (!assertNative()) return;
  try {
    const canvas = await captureElement(elementId);
    if (!canvas) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const imgW = pw - 20;
    const imgH = (canvas.height * imgW) / canvas.width;
    const x = 10;

    pdf.setFillColor(15, 23, 41);
    pdf.rect(0, 0, pw, ph, 'F');

    let remainH = imgH;
    let srcY = 0;
    let page = 0;

    while (remainH > 0) {
      if (page > 0) {
        pdf.addPage();
        pdf.setFillColor(15, 23, 41);
        pdf.rect(0, 0, pw, ph, 'F');
      }
      const sliceH = Math.min(remainH, ph - 20);
      const srcSliceH = (sliceH / imgH) * canvas.height;
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = srcSliceH;
      const ctx = slice.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcSliceH, 0, 0, canvas.width, srcSliceH);
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', x, 10, imgW, sliceH);
      }
      srcY += srcSliceH;
      remainH -= sliceH;
      page++;
    }

    const base64 = pdf.output('datauristring').split(',')[1];
    await saveFile(base64, `${filename}.pdf`, true);
    toast({ title: 'PDF salvo na pasta Downloads!' });
  } catch {
    toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
  }
}

export async function exportToJPG(elementId: string, filename: string) {
  if (!assertNative()) return;
  try {
    const canvas = await captureElement(elementId);
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    await saveFile(base64, `${filename}.jpg`, true);
    toast({ title: 'Imagem salva com sucesso!' });
  } catch {
    toast({ title: 'Erro ao gerar imagem', variant: 'destructive' });
  }
}

export async function shareToWhatsApp(elementId: string, filename: string) {
  if (!assertNative()) return;
  try {
    const canvas = await captureElement(elementId);
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/png').split(',')[1];
    const uri = await saveFile(base64, `${filename}.png`, false);

    await Share.share({
      title: 'Relatório Financeiro',
      url: uri,
      dialogTitle: 'Compartilhar Relatório',
    });
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      toast({ title: 'Erro ao compartilhar', variant: 'destructive' });
    }
  }
}
