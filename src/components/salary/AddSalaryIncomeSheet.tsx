import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SalaryAccount, SalaryIncomeEntry } from '@/lib/salaryAccounts';
import { getLocalDateString, getMonthFromDate } from '@/lib/dateUtils';

interface AddSalaryIncomeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: SalaryAccount | null;
  onSubmit: (entry: Omit<SalaryIncomeEntry, 'id'>) => Promise<void>;
}

export function AddSalaryIncomeSheet({ open, onOpenChange, account, onSubmit }: AddSalaryIncomeSheetProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setDate(getLocalDateString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        accountId: account.id,
        amount: parsedAmount,
        date,
        description: description.trim() || 'Salário',
        month: getMonthFromDate(date),
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Lançar Receita - {account?.name}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pb-6">
          <div className="space-y-2">
            <Label>Valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Salário, Bônus..."
            />
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Lançar Receita'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
