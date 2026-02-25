import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carlos.controledefinancas',
  appName: 'Controle de Finanças',
  webDir: 'dist',
  plugins: {
    Filesystem: {
      // Enables proper filesystem access on Android
    },
    Share: {
      // ✅ ADICIONADO: Plugin Share
    }
  },
  android: {
    // ✅ ATUALIZADO: Incluir ambos os plugins
    includePlugins: ['@capacitor/filesystem', '@capacitor/share']
  }
};

export default config;