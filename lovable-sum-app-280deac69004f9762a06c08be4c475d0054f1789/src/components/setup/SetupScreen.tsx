import { useState, useRef } from 'react';
import { Lock, Upload, ArrowRight, Eye, EyeOff, Check, KeyRound, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createPassword, getSecurityConfig } from '@/lib/security';
import { importAllData } from '@/lib/storage';
import { defaultAdapter } from '@/lib/storageAdapter';
import { toast } from '@/hooks/use-toast';

const APP_CONFIGURED_KEY = 'app_configured';

interface SetupScreenProps {
  onComplete: () => void;
}

type SetupStep = 'choose' | 'create-password' | 'recovery' | 'password-done' | 'restore-backup' | 'restore-password';

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [step, setStep] = useState<SetupStep>('choose');

  // Password creation state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryType, setRecoveryType] = useState<'code' | 'question'>('code');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Restore backup state
  const [backupData, setBackupData] = useState<any>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [showBackupPwd, setShowBackupPwd] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finishSetup = async (hasPassword: boolean) => {
    await defaultAdapter.setItem(APP_CONFIGURED_KEY, {
      appConfigured: true,
      hasPassword,
      requirePassword: hasPassword,
    });
    onComplete();
  };

  // ─── OPTION 3: Skip ───
  const handleSkip = async () => {
    await finishSetup(false);
    toast({ title: 'App configurado!', description: 'Você pode criar uma senha depois em Configurações.' });
  };

  // ─── OPTION 1: Create Password ───
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      toast({ title: 'Senha deve ter pelo menos 4 caracteres', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Senhas não coincidem', variant: 'destructive' });
      return;
    }
    setStep('recovery');
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryType === 'question' && (!question.trim() || !answer.trim())) {
      toast({ title: 'Preencha a pergunta e resposta', variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    try {
      const result = await createPassword(password, {
        type: recoveryType,
        question: recoveryType === 'question' ? question.trim() : undefined,
        answer: recoveryType === 'question' ? answer.trim() : undefined,
      });
      if (result.success) {
        if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
        setStep('password-done');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handlePasswordComplete = async () => {
    await finishSetup(true);
    toast({ title: 'Senha criada com sucesso!' });
  };

  // ─── OPTION 2: Restore Backup ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        setBackupData(parsed);
        if (parsed.passwordHash) {
          setStep('restore-password');
        } else {
          handleRestoreWithoutPassword(parsed);
        }
      } catch {
        toast({ title: 'Arquivo inválido', description: 'Não foi possível ler o backup.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreWithoutPassword = async (data: any) => {
    setIsRestoring(true);
    try {
      await importAllData(JSON.stringify(data.data || data));
      await finishSetup(false);
      toast({ title: 'Backup restaurado!', description: 'Seus dados foram recuperados com sucesso.' });
    } catch {
      toast({ title: 'Erro ao restaurar', variant: 'destructive' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupPassword || !backupData) return;

    setIsRestoring(true);
    try {
      // Hash the entered password and compare with backup
      const encoder = new TextEncoder();
      const data = encoder.encode(backupPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hash !== backupData.passwordHash) {
        toast({ title: 'Senha incorreta', description: 'A senha não corresponde ao backup.', variant: 'destructive' });
        setBackupPassword('');
        return;
      }

      // Restore data
      const dataToImport = backupData.data || backupData;
      await importAllData(JSON.stringify(dataToImport));

      // Restore password config
      await createPassword(backupPassword, { type: 'code' });
      await finishSetup(true);
      toast({ title: 'Backup restaurado!', description: 'Dados e senha recuperados com sucesso.' });
    } catch {
      toast({ title: 'Erro ao restaurar', variant: 'destructive' });
    } finally {
      setIsRestoring(false);
    }
  };

  // ─── Choose screen ───
  if (step === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Bem-vindo!</h1>
            <p className="text-sm text-muted-foreground">
              Configure seu app para começar
            </p>
          </div>

          <div className="space-y-3">
            <Card 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setStep('create-password')}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Criar Senha</p>
                  <p className="text-xs text-muted-foreground">Proteja seus dados com uma senha</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Restaurar Backup</p>
                  <p className="text-xs text-muted-foreground">Importe dados de um backup anterior</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
              onClick={handleSkip}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Iniciar sem Senha</p>
                  <p className="text-xs text-muted-foreground">Você pode criar uma depois</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    );
  }

  // ─── Create Password ───
  if (step === 'create-password') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 mx-auto mb-2 text-primary" />
            <CardTitle>Criar Senha</CardTitle>
            <CardDescription>Proteja o acesso ao seu app</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    minLength={4}
                    required
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmar Senha</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('choose')}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1">Continuar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Recovery setup ───
  if (step === 'recovery') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <KeyRound className="h-10 w-10 mx-auto mb-2 text-primary" />
            <CardTitle>Recuperação</CardTitle>
            <CardDescription>Escolha como recuperar o acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <RadioGroup value={recoveryType} onValueChange={v => setRecoveryType(v as 'code' | 'question')}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border">
                  <RadioGroupItem value="code" id="setup-code" />
                  <Label htmlFor="setup-code" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">Código de Recuperação</div>
                    <div className="text-xs text-muted-foreground">Um código será gerado. Guarde em local seguro.</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border">
                  <RadioGroupItem value="question" id="setup-question" />
                  <Label htmlFor="setup-question" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">Pergunta de Segurança</div>
                    <div className="text-xs text-muted-foreground">Crie uma pergunta que só você saiba responder.</div>
                  </Label>
                </div>
              </RadioGroup>

              {recoveryType === 'question' && (
                <>
                  <div className="space-y-2">
                    <Label>Pergunta</Label>
                    <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ex: Nome do meu primeiro pet" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Resposta</Label>
                    <Input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Sua resposta" required />
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('create-password')}>Voltar</Button>
                <Button type="submit" className="flex-1" disabled={isCreating}>
                  {isCreating ? 'Criando...' : 'Criar Senha'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Password Done ───
  if (step === 'password-done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center">
              <div className="h-14 w-14 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                <Check className="h-7 w-7 text-success" />
              </div>
              <h3 className="text-lg font-semibold">Senha Criada!</h3>
              <p className="text-sm text-muted-foreground mt-1">Sua senha será solicitada ao abrir o app.</p>
            </div>

            {recoveryCode && (
              <Card className="bg-warning/10 border-warning/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Código de Recuperação</CardTitle>
                  <CardDescription className="text-xs">Anote em local seguro.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-2xl text-center tracking-widest py-3 bg-background rounded-lg">
                    {recoveryCode}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={handlePasswordComplete} className="w-full" size="lg">
              Começar a Usar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Restore Backup: Enter Password ───
  if (step === 'restore-password') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Upload className="h-10 w-10 mx-auto mb-2 text-primary" />
            <CardTitle>Restaurar Backup</CardTitle>
            <CardDescription>Digite a senha do backup para restaurar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRestoreWithPassword} className="space-y-4">
              <div className="relative">
                <Input
                  type={showBackupPwd ? 'text' : 'password'}
                  value={backupPassword}
                  onChange={e => setBackupPassword(e.target.value)}
                  placeholder="Senha do backup"
                  autoFocus
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowBackupPwd(!showBackupPwd)}
                >
                  {showBackupPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setStep('choose'); setBackupData(null); setBackupPassword(''); }}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={isRestoring || !backupPassword}>
                  {isRestoring ? 'Restaurando...' : 'Restaurar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export { APP_CONFIGURED_KEY };
