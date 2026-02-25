import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Check if running on native Android/iOS
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Request storage permissions on Android (needed for Android 10+)
 */
async function requestPermissions(): Promise<boolean> {
  try {
    const result = await Filesystem.requestPermissions();
    return result.publicStorage === 'granted';
  } catch {
    // If permissions API not available, assume granted
    return true;
  }
}

/**
 * Export data to a file - uses native filesystem on Android, web download otherwise
 * Works completely offline - no network required
 */
export async function exportToFile(
  data: string,
  filename: string
): Promise<ExportResult> {
  if (isNativePlatform()) {
    return exportNative(data, filename);
  }
  return exportWeb(data, filename);
}

/**
 * Native export using Capacitor Filesystem - saves to Downloads (Android) or Documents (iOS)
 * Fully offline operation - no network dependency
 */
async function exportNative(data: string, filename: string): Promise<ExportResult> {
  try {
    // Request permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permissão de armazenamento negada. Vá em Configurações > Apps para permitir.',
      };
    }

    const platform = Capacitor.getPlatform();
    
    // Strategy: Try multiple directories for maximum compatibility
    // Priority: Downloads > Documents > Data (app-private)
    
    if (platform === 'android') {
      // Try 1: External Downloads folder (best visibility for users)
      try {
        await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: data,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        return {
          success: true,
          path: `Downloads/${filename}`,
        };
      } catch (e1) {
        console.log('ExternalStorage/Download failed, trying Documents...', e1);
      }

      // Try 2: Documents folder (accessible via Files app)
      try {
        await Filesystem.writeFile({
          path: filename,
          data: data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        return {
          success: true,
          path: `Documentos/${filename}`,
        };
      } catch (e2) {
        console.log('Documents failed, trying Data...', e2);
      }

      // Try 3: App Data directory (always works, but less accessible)
      try {
        await Filesystem.writeFile({
          path: filename,
          data: data,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        return {
          success: true,
          path: `Dados do App/${filename}`,
        };
      } catch (e3) {
        console.error('All Android save methods failed', e3);
        throw e3;
      }
    } else {
      // iOS: Use Documents directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return {
        success: true,
        path: result.uri,
      };
    }
  } catch (error) {
    console.error('Native export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao salvar arquivo no dispositivo',
    };
  }
}

/**
 * Import file from native filesystem
 * Useful when file input doesn't work properly on native
 */
export async function importFromNativeFile(filename: string): Promise<string | null> {
  if (!isNativePlatform()) return null;
  
  try {
    // Try different directories
    const directories = [
      { dir: Directory.ExternalStorage, path: `Download/${filename}` },
      { dir: Directory.Documents, path: filename },
      { dir: Directory.Data, path: filename },
    ];

    for (const { dir, path } of directories) {
      try {
        const result = await Filesystem.readFile({
          path,
          directory: dir,
          encoding: Encoding.UTF8,
        });
        return typeof result.data === 'string' ? result.data : null;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * List backup files in accessible directories
 */
export async function listBackupFiles(): Promise<string[]> {
  if (!isNativePlatform()) return [];
  
  const backupFiles: string[] = [];
  
  try {
    const directories = [
      { dir: Directory.ExternalStorage, path: 'Download' },
      { dir: Directory.Documents, path: '' },
      { dir: Directory.Data, path: '' },
    ];

    for (const { dir, path } of directories) {
      try {
        const result = await Filesystem.readdir({
          path,
          directory: dir,
        });
        
        const jsonFiles = result.files
          .filter(f => f.name.endsWith('.json') && f.name.includes('backup'))
          .map(f => f.name);
        
        backupFiles.push(...jsonFiles);
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }
  
  return [...new Set(backupFiles)]; // Remove duplicates
}

/**
 * Web export using blob download
 */
function exportWeb(data: string, filename: string): ExportResult {
  try {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      path: filename,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao exportar',
    };
  }
}
