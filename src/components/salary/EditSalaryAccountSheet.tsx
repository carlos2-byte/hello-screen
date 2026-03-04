import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { SalaryAccount } from '@/lib/salaryAccounts';

interface EditSalaryAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: SalaryAccount | null;
  onSubmit: (account: SalaryAccount) => Promise<void>;
}

export function EditSalaryAccountSheet({ open, onOpenChange, account, onSubmit }: EditSalaryAccountSheetProps) {
  const [name, setName] = useState('');
  const [payDay, setPayDay] = useState('5');
  const [canReceiveTransfers, setCanReceiveTransfers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payDayChanged, setPayDayChanged] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setPayDay(String(account.payDay));
      setCanReceiveTransfers(account.canReceiveTransfers);
      setPayDayChanged(false);
    }
  }, [account]);

  const handlePayDayChange = (value: string) => {
    setPayDay(value);
    setPayDayChanged(account ? value !== String(account.payDay) : false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...account,
        name: name.trim(),
        payDay: parseInt(payDay),
        canReceiveTransfers,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Editar Conta</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pb-6">
          <div className="space-y-2">
            <Label htmlFor="editAccountName">Nome da Conta</Label>
            <Input
              id="editAccountName"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Itaú Salário, Nubank..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Dia do Pagamento</Label>
            <Select value={payDay} onValueChange={handlePayDayChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {days.map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {payDayChanged && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Alterar o dia de pagamento <strong>não</strong> modifica lançamentos já registrados.
                A mudança afeta apenas novos lançamentos.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <div className="space-y-0.5">
              <Label>Pode receber transferências</Label>
              <p className="text-xs text-muted-foreground">
                Permitir transferências de outras contas
              </p>
            </div>
            <Switch checked={canReceiveTransfers} onCheckedChange={setCanReceiveTransfers} />
          </div>

          <div className="p-3 border rounded-lg bg-muted/10">
            <p className="text-xs text-muted-foreground">
              ⚠️ Valores já consolidados não podem ser alterados por edição de conta.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
