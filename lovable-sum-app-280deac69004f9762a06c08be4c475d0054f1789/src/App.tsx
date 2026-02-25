import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LockScreen } from "@/components/security/LockScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { SetupScreen, APP_CONFIGURED_KEY } from "@/components/setup/SetupScreen";

import { useAppLock } from "@/hooks/useAppLock";
import { defaultAdapter } from "@/lib/storageAdapter";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import CardsPage from "./pages/CardsPage";
import CardStatementPage from "./pages/CardStmtPage";
import SettingsPage from "./pages/SettingsPage";
import InvestmentsPage from "./pages/InvestPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

interface AppConfig {
  appConfigured: boolean;
  hasPassword: boolean;
  requirePassword: boolean;
}

function AppContent() {
  const { hasPassword, loading, refresh } = useAppLock();
  const [unlocked, setUnlocked] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [appConfigured, setAppConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    checkConfigured();
  }, []);

  const checkConfigured = async () => {
    const config = await defaultAdapter.getItem<AppConfig | null>(APP_CONFIGURED_KEY, null);
    setAppConfigured(config?.appConfigured === true);
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Still checking config
  if (appConfigured === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // First run → setup
  if (!appConfigured) {
    return (
      <SetupScreen
        onComplete={() => {
          setAppConfigured(true);
          setUnlocked(true);
          refresh();
        }}
      />
    );
  }

  // Has password and not unlocked → lock screen
  if (hasPassword && !unlocked) {
    return (
      <LockScreen 
        onUnlock={() => {
          setUnlocked(true);
        }} 
      />
    );
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:cardId" element={<CardStatementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
