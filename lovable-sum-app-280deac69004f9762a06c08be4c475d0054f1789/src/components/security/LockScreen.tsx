import { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, HelpCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppLock } from '@/hooks/useAppLock';
import { toast } from '@/hooks/use-toast';
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

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const { 
    unlock, 
    recoverWithCode, 
    recoverWithAnswer, 
    resetAll,
    recoveryQuestion,
    hasRecoveryCode 
  } = useAppLock();
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsUnlocking(true);
    try {
      const success = await unlock(password);
      if (success) {
        onUnlock();
      } else {
        toast({ 
          title: 'Senha incorreta', 
          variant: 'destructive' 
        });
        setPassword('');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRecover = async () => {
    if (!recoveryInput) return;

    setIsUnlocking(true);
    try {
      let success = false;
      
      if (hasRecoveryCode) {
        success = await recoverWithCode(recoveryInput);
      } else if (recoveryQuestion) {
        success = await recoverWithAnswer(recoveryInput);
      }

      if (success) {
        toast({ title: 'Acesso recuperado!' });
        onUnlock();
      } else {
        toast({ 
          title: hasRecoveryCode ? 'Código inválido' : 'Resposta incorreta', 
          variant: 'destructive' 
        });
        setRecoveryInput('');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleFullReset = async () => {
    await resetAll();
    toast({ 
      title: 'App resetado', 
      description: 'A senha foi removida, mas seus dados foram mantidos.' 
    });
    onUnlock();
  };

  if (showRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <KeyRound className="h-12 w-12 mx-auto mb-2 text-primary" />
            <CardTitle>Recuperar Acesso</CardTitle>
            <CardDescription>
              {hasRecoveryCode 
                ? 'Digite seu código de recuperação'
                : recoveryQuestion || 'Responda a pergunta de segurança'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="text"
              placeholder={hasRecoveryCode ? 'Código de recuperação' : 'Sua resposta'}
              value={recoveryInput}
              onChange={e => setRecoveryInput(e.target.value)}
              autoFocus
            />
            
            <Button 
              className="w-full" 
              onClick={handleRecover}
              disabled={isUnlocking || !recoveryInput}
            >
              {isUnlocking ? 'Verificando...' : 'Verificar'}
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => {
                setShowRecovery(false);
                setRecoveryInput('');
              }}
            >
              Voltar
            </Button>

            <div className="pt-4 border-t">
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Completo
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Remove a senha mas mantém seus dados
              </p>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Completo?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai remover a senha do app, mas seus dados financeiros serão mantidos.
                Você poderá criar uma nova senha depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleFullReset}>
                Confirmar Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Lock className="h-12 w-12 mx-auto mb-2 text-primary" />
          <CardTitle>Controle de Finanças</CardTitle>
          <CardDescription>Digite sua senha para acessar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isUnlocking || !password}
            >
              {isUnlocking ? 'Desbloqueando...' : 'Desbloquear'}
            </Button>
          </form>

          {(hasRecoveryCode || recoveryQuestion) && (
            <Button 
              variant="link" 
              className="w-full mt-4"
              onClick={() => setShowRecovery(true)}
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              Esqueci minha senha
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
