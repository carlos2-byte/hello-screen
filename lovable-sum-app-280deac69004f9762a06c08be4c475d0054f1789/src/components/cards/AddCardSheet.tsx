import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard } from '@/lib/storage';

interface AddCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards?: CreditCard[]; // Existing cards for selecting payer
  onSubmit: (card: Omit<CreditCard, 'id'>) => Promise<CreditCard>;
}

export function AddCardSheet({ open, onOpenChange, cards = [], onSubmit }: AddCardSheetProps) {
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('25');
  const [dueDay, setDueDay] = useState('5');
  const [defaultPayerCardId, setDefaultPayerCardId] = useState<string>('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter available payer cards (cards that can pay other cards)
  const availablePayerCards = cards.filter(c => c.canPayOtherCards !== false);

  const resetForm = () => {
    setName('');
    setLast4('');
    setLimit('');
    setClosingDay('25');
    setDueDay('5');
    setDefaultPayerCardId('');
    setIsDefault(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        last4: last4.trim() || undefined,
        limit: limit ? parseFloat(limit.replace(',', '.')) : undefined,
        closingDay: parseInt(closingDay),
        dueDay: parseInt(dueDay),
        defaultPayerCardId: defaultPayerCardId || undefined,
        isDefault: isDefault || undefined,
      });
      resetForm();
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
          <SheetTitle>Novo Cartão</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pb-6">
          <div className="space-y-2">
            <Label htmlFor="cardName">Nome do Cartão</Label>
            <Input id="cardName" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last4">Últimos 4 dígitos (opcional)</Label>
            <Input 
              id="last4" 
              value={last4} 
              onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} 
              placeholder="0000"
              maxLength={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit">Limite (opcional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input 
                id="limit" 
                type="text"
                inputMode="decimal"
                value={limit} 
                onChange={e => setLimit(e.target.value)} 
                placeholder="0,00"
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fechamento</Label>
              <Select value={closingDay} onValueChange={setClosingDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {days.map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Select value={dueDay} onValueChange={setDueDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {days.map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cartão Padrão */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/20">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="isDefault" className="font-normal cursor-pointer">
              Cartão padrão (será selecionado automaticamente nas despesas)
            </Label>
          </div>

          {/* Default Payer Card Selection */}
          {availablePayerCards.length > 0 && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
...
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Adicionar Cartão'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}