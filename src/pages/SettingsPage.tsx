import { useState, useRef, useEffect } from 'react';
import {
  Moon,
  Sun,
  Download,
  Upload,
  DollarSign,
  Lock,
  Unlock,
  Trash2,
  FolderDown,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/hooks/useSettings';
import { exportAllData, importAllData, clearAllData } from '@/lib/storage';
import { isPasswordEnabled, removePassword } from '@/lib/security';
import { exportToFile, isNativePlatform } from '@/lib/fileExport';
import { toast } from '@/hooks/use-toast';
import { PasswordSetupSheet } from '@/components/security/PwdSetupSheet';
import { ExportBackupDialog } from '@/components/settings/ExportDialog';
import { CategoryManager } from '@/components/settings/CategoryManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CURRENCIES = [
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileiro' },
  { code: 'USD', symbol: '$', name: 'Dólar Americano' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

export default function SettingsPage() {
  const { settings, updateSettings, toggleTheme } = useSettings();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showRemovePassword, setShowRemovePassword] = useState(false);
  const [showClearData, setShowClearData] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local string states for decimal inputs
  const [yieldRateStr, setYieldRateStr] = useState('');
  const [extraYieldStr, setExtraYieldStr] = useState('');

  // Sync local strings when settings load
  useEffect(() => {
    setYieldRateStr(settings.balanceYieldRate ? String(settings.balanceYieldRate) : '');
    setExtraYieldStr(settings.balanceExtraYieldPercent ? String(settings.balanceExtraYieldPercent) : '');
  }, [settings.balanceYieldRate, settings.balanceExtraYieldPercent]);

  useEffect(() => {
    isPasswordEnabled().then(setHasPassword);
  }, []);

  const handleExport = async (includeInvestments: boolean) => {
    setIsExporting(true);
    try {
      const data = await exportAllData(includeInvestments);
      const filename = `controlefinancas-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      const result = await exportToFile(data, filename);
      
      if (result.success) {
        const locationMsg = isNativePlatform() 
          ? ` Salvo em: ${result.path}` 
          : '';
        const investMsg = includeInvestments 
          ? 'Backup exportado com investimentos!' 
          : 'Backup exportado sem investimentos!';
        toast({ 
          title: investMsg + locationMsg,
          description: isNativePlatform() ? 'Verifique a pasta Downloads ou Documentos' : undefined,
        });
      } else {
        toast({ title: result.error || 'Erro ao exportar', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro ao exportar', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      await importAllData(text);
      toast({ title: 'Dados importados com sucesso!' });
      window.location.reload();
    } catch (error) {
      toast({ title: 'Erro ao importar arquivo', variant: 'destructive' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCurrencyChange = (code: string) => {
    const currency = CURRENCIES.find(c => c.code === code);
    if (currency) {
      updateSettings({
        currency: currency.code,
        currencySymbol: currency.symbol,
      });
    }
  };

  const handleRemovePassword = async () => {
    await removePassword();
    setHasPassword(false);
    setShowRemovePassword(false);
    toast({ title: 'Senha removida' });
  };

  const handleClearAllData = async () => {
    await clearAllData();
    setShowClearData(false);
    toast({ title: 'Todos os dados foram apagados' });
    window.location.reload();
  };

  return (
    <PageContainer
      header={<h1 className="text-2xl font-bold text-center">Configurações</h1>}
    >
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="space-y-6 pb-4">
          {/* Appearance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aparência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.theme === 'dark' ? (
                    <Moon className="h-5 w-5 text-primary" />
                  ) : (
                    <Sun className="h-5 w-5 text-warning" />
                  )}
                  <Label htmlFor="theme">Tema Escuro</Label>
                </div>
                <Switch
                  id="theme"
                  checked={settings.theme === 'dark'}
                  onCheckedChange={toggleTheme}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Segurança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {hasPassword ? (
                    <Lock className="h-5 w-5 text-success" />
                  ) : (
                    <Unlock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <Label>Senha do App</Label>
                    <p className="text-xs text-muted-foreground">
                      {hasPassword 
                        ? 'Senha ativa - proteja seus dados' 
                        : 'Sem proteção - qualquer pessoa pode acessar'}
                    </p>
                  </div>
                </div>
              </div>
              
              {hasPassword ? (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowRemovePassword(true)}
                >
                  Remover Senha
                </Button>
              ) : (
                <Button 
                  className="w-full"
                  onClick={() => setShowPasswordSetup(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Criar Senha
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Currency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Moeda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <Select
                  value={settings.currency}
                  onValueChange={handleCurrencyChange}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Balance Yield Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Rendimento do Saldo Principal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>O saldo rende?</Label>
                <RadioGroup
                  value={settings.balanceYieldEnabled ? 'yes' : 'no'}
                  onValueChange={(v) => updateSettings({ balanceYieldEnabled: v === 'yes' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="yes" id="yield-yes" />
                    <Label htmlFor="yield-yes" className="text-sm cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="no" id="yield-no" />
                    <Label htmlFor="yield-no" className="text-sm cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {settings.balanceYieldEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Taxa de rendimento (% ao ano)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={yieldRateStr}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '' || /^[\d.,]*$/.test(raw)) {
                          setYieldRateStr(raw);
                        }
                      }}
                      onBlur={() => {
                        const val = parseFloat(yieldRateStr.replace(',', '.'));
                        const num = isNaN(val) ? 0 : val;
                        updateSettings({ balanceYieldRate: num });
                        setYieldRateStr(num ? String(num) : '');
                      }}
                      placeholder="Ex: 14.9"
                    />
                  </div>

                  {/* Extra Yield */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label>Rendimento Extra</Label>
                    </div>
                    <Switch
                      checked={settings.balanceExtraYieldEnabled ?? false}
                      onCheckedChange={(v) => updateSettings({ balanceExtraYieldEnabled: v })}
                    />
                  </div>

                  {settings.balanceExtraYieldEnabled && (
                    <div className="space-y-2">
                      <Label>Percentual do CDI (%)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={extraYieldStr}
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '' || /^[\d.,]*$/.test(raw)) {
                            setExtraYieldStr(raw);
                          }
                        }}
                        onBlur={() => {
                          const val = parseFloat(extraYieldStr.replace(',', '.'));
                          const num = isNaN(val) ? 0 : val;
                          updateSettings({ balanceExtraYieldPercent: num });
                          setExtraYieldStr(num ? String(num) : '');
                        }}
                        placeholder="Ex: 105"
                      />
                      <p className="text-xs text-muted-foreground">
                        Taxa final: {((settings.balanceYieldRate ?? 0) * ((settings.balanceExtraYieldPercent ?? 100) / 100)).toFixed(2)}% a.a. ({settings.balanceYieldRate ?? 0}% × {settings.balanceExtraYieldPercent ?? 100}%)
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Imposto é retirado diariamente?</Label>
                    <RadioGroup
                      value={settings.balanceYieldTaxMode ?? 'on_withdrawal'}
                      onValueChange={(v) => updateSettings({ balanceYieldTaxMode: v as 'daily' | 'on_withdrawal' })}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="daily" id="tax-daily" />
                        <Label htmlFor="tax-daily" className="text-sm cursor-pointer">
                          Sim, descontar diariamente
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="on_withdrawal" id="tax-withdrawal" />
                        <Label htmlFor="tax-withdrawal" className="text-sm cursor-pointer">
                          Não, descontar apenas no saque
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Categories */}
          <CategoryManager />

          {/* Data Management */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowExportDialog(true)}
                disabled={isExporting}
              >
                {isNativePlatform() ? (
                  <FolderDown className="h-4 w-4 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isExporting 
                  ? 'Exportando...' 
                  : isNativePlatform() 
                    ? 'Exportar para Downloads' 
                    : 'Exportar Backup (JSON)'}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? 'Importando...' : 'Importar Backup'}
              </Button>

              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => setShowClearData(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar Todos os Dados
              </Button>
            </CardContent>
          </Card>

          {/* App Info */}
          <div className="text-center text-sm text-muted-foreground pt-4">
            <p>Controle de Finanças 2.0.0</p>
            <p>Seus dados ficam salvos localmente no dispositivo</p>
          </div>
        </div>
      </ScrollArea>

      {/* Password Setup Sheet */}
      <PasswordSetupSheet
        open={showPasswordSetup}
        onOpenChange={setShowPasswordSetup}
        onComplete={() => setHasPassword(true)}
      />

      {/* Export Backup Dialog */}
      <ExportBackupDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onConfirm={handleExport}
      />

      {/* Remove Password Confirmation */}
      <AlertDialog open={showRemovePassword} onOpenChange={setShowRemovePassword}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover senha?</AlertDialogTitle>
            <AlertDialogDescription>
              Após remover a senha, qualquer pessoa com acesso ao seu dispositivo
              poderá ver suas informações financeiras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePassword}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Data Confirmation */}
      <AlertDialog open={showClearData} onOpenChange={setShowClearData}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente todas as suas transações,
              cartões, investimentos, configurações e senha. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
