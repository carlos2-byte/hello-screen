import { useState, useEffect, useCallback } from 'react';
import { AppSettings, getSettings, saveSettings } from '@/lib/storage';

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>({
    theme: 'dark',
    currency: 'BRL',
    currencySymbol: 'R$',
    locale: 'pt-BR',
    balanceYieldEnabled: false,
    balanceYieldRate: 6.5,
    balanceYieldTaxMode: 'on_withdrawal',
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getSettings();
      setSettingsState(loaded);
      
      // Apply theme
      if (loaded.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      const newSettings = { ...settings, ...updates };
      setSettingsState(newSettings);
      await saveSettings(newSettings);

      // Apply theme immediately
      if (updates.theme) {
        if (updates.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    [settings]
  );

  const toggleTheme = useCallback(() => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }, [settings.theme, updateSettings]);

  const toggleBalanceYield = useCallback(() => {
    updateSettings({ balanceYieldEnabled: !settings.balanceYieldEnabled });
  }, [settings.balanceYieldEnabled, updateSettings]);

  return {
    settings,
    loading,
    updateSettings,
    toggleTheme,
    toggleBalanceYield,
    refresh: loadSettings,
  };
}
