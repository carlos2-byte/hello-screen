import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carlos.controledefinancas',
  appName: 'Controle de Finanças',
  webDir: 'dist',
  plugins: {
    Filesystem: {
      // Enables proper filesystem access on Android
    }
  },
  android: {
    // Ensure plugins are included in the build
    includePlugins: ['@capacitor/filesystem']
  }
};

export default config;
