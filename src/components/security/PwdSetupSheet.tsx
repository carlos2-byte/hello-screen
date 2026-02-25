import { useState } from 'react';
import { Eye, EyeOff, Lock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createPassword, isPasswordEnabled, removePassword } from '@/lib/security';
import { toast } from '@/hooks/use-toast';

interface PasswordSetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function PasswordSetupSheet({ open, onOpenChange, onComplete }: PasswordSetupSheetProps) {
  const [step, setStep] = useState<'password' | 'recovery' | 'done'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryType, setRecoveryType] = useState<'code' | 'question'>('code');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setStep('password');
    setPassword('');
    setConfirmPassword('');
    setRecoveryType('code');
    setQuestion('');
    setAnswer('');
    setRecoveryCode('');
  };

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
        if (result.recoveryCode) {
          setRecoveryCode(result.recoveryCode);
        }
        setStep('done');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = () => {
    resetForm();
    onOpenChange(false);
    onComplete();
  };

  return (
    <Sheet open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {step === 'password' && 'Criar Senha'}
            {step === 'recovery' && 'Recuperação'}
            {step === 'done' && 'Senha Criada'}
          </SheetTitle>
        </SheetHeader>

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
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

            <Button type="submit" className="w-full" size="lg">
              Continuar
            </Button>
          </form>
        )}

        {step === 'recovery' && (
          <form onSubmit={handleRecoverySubmit} className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Escolha como recuperar o acesso caso esqueça a senha:
            </p>

            <RadioGroup 
              value={recoveryType} 
              onValueChange={(v) => setRecoveryType(v as 'code' | 'question')}
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="code" id="code" />
                <Label htmlFor="code" className="flex-1 cursor-pointer">
                  <div className="font-medium">Código de Recuperação</div>
                  <div className="text-sm text-muted-foreground">
                    Um código único será gerado. Guarde-o em local seguro.
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="question" id="question" />
                <Label htmlFor="question" className="flex-1 cursor-pointer">
                  <div className="font-medium">Pergunta de Segurança</div>
                  <div className="text-sm text-muted-foreground">
                    Crie uma pergunta e resposta que só você saiba.
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {recoveryType === 'question' && (
              <>
                <div className="space-y-2">
                  <Label>Pergunta</Label>
                  <Input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ex: Nome do meu primeiro pet"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resposta</Label>
                  <Input
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Sua resposta"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep('password')}
              >
                Voltar
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={isCreating}
              >
                {isCreating ? 'Criando...' : 'Criar Senha'}
              </Button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Senha Criada com Sucesso!</h3>
              <p className="text-muted-foreground">
                Sua senha será solicitada ao abrir o app.
              </p>
            </div>

            {recoveryCode && (
              <Card className="bg-warning/10 border-warning/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Código de Recuperação</CardTitle>
                  <CardDescription>
                    Anote este código em local seguro. Você precisará dele se esquecer sua senha.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-2xl text-center tracking-widest py-4 bg-background rounded-lg">
                    {recoveryCode}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleComplete} className="w-full" size="lg">
              Concluir
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
