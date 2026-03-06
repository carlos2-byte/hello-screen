import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getCategories, getAllCategories, CreditCard, Transaction } from '@/lib/storage';
import { getLocalDateString, getInvoiceMonth, addMonthsToDate, addYearsToDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Repeat, Calendar, CreditCard as CardIcon, Package, Banknote, Wallet } from 'lucide-react';
import { AccountSelector } from '@/components/salary/AccountSelector';

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    tx: Omit<Transaction, 'id' | 'createdAt'>,
    options?: {
      installments?: number;
      isInstallmentTotal?: boolean;
      isRecurring?: boolean;
      recurrenceType?: 'weekly' | 'monthly' | 'yearly';
      recurrenceEndDate?: string;
    }
  ) => Promise<void>;
  cards: CreditCard[];
  editingTransaction?: Transaction | null;
}

const defaultCategories = getCategories();

export function AddTransactionSheet({ 
  open, 
  onOpenChange, 
  onSubmit, 
  cards,
  editingTransaction,
}: AddTransactionSheetProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [date, setDate] = useState(getLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debit' | 'credit'>('cash');
  const [cardId, setCardId] = useState('');
  const [installments, setInstallments] = useState<number | undefined>(undefined);
  const [isInstallmentTotal, setIsInstallmentTotal] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCategories, setAllCategories] = useState(defaultCategories);
  const [mandatoryAccountId, setMandatoryAccountId] = useState('');

  // Load custom categories
  useEffect(() => {
    getAllCategories().then(setAllCategories);
  }, [open]);

  // Check if editing a recurring or installment transaction
  const isEditingRecurringOrInstallment = editingTransaction && (
    editingTransaction.recurrenceId || 
    editingTransaction.parentId || 
    (editingTransaction.installments && editingTransaction.installments > 1)
  );

  // Reset form when opened or load editing transaction
  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        setType(editingTransaction.type);
        setAmount(Math.abs(editingTransaction.amount).toString());
        setDescription(editingTransaction.description?.replace(/\s*\(\d+\/\d+\)$/, '') || '');
        setCategory(editingTransaction.category || 'other');
        setDate(editingTransaction.date);
        setPaymentMethod(editingTransaction.isCardPayment ? 'credit' : 'cash');
        setCardId(editingTransaction.cardId || '');
        setInstallments(undefined);
        setIsInstallmentTotal(true);
        setIsRecurring(false);
        setRecurrenceType('monthly');
        setRecurrenceEndDate('');
        setMandatoryAccountId(editingTransaction.mandatoryAccountId || '');
      } else {
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory('other');
        setDate(getLocalDateString());
        setPaymentMethod('cash');
        // Auto-select default card
        const defaultCard = cards.find(c => c.isDefault === true);
        setCardId(defaultCard ? defaultCard.id : '');
        setInstallments(undefined);
        setIsInstallmentTotal(true);
        setIsRecurring(false);
        setRecurrenceType('monthly');
        setRecurrenceEndDate('');
        setMandatoryAccountId('');
      }
    }
  }, [open, editingTransaction, cards]);

  // No longer auto-set end date for recurrence - it will be indefinite

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount)) return;

    const isCardPayment = paymentMethod === 'credit';
    let invoiceMonth = undefined;
    if (isCardPayment && cardId) {
      const card = cards.find(c => c.id === cardId);
      invoiceMonth = getInvoiceMonth(date, card?.closingDay || 25);
    }

    // Treat empty or invalid installments as 1
    const actualInstallments = installments !== undefined && installments > 0 ? installments : 1;

    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          amount: parsedAmount,
          description: description.trim(),
          category: type === 'income' ? 'income' : category,
          type,
          date,
          isCardPayment,
          cardId: isCardPayment ? cardId : undefined,
          invoiceMonth,
          mandatoryAccountId: mandatoryAccountId || undefined,
        },
        {
          installments: actualInstallments > 1 ? actualInstallments : undefined,
          isInstallmentTotal: actualInstallments > 1 ? isInstallmentTotal : undefined,
          isRecurring,
          recurrenceType: isRecurring ? recurrenceType : undefined,
          recurrenceEndDate: isRecurring ? recurrenceEndDate : undefined,
        }
      );
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const expenseCategories = allCategories.filter(c => c.type === 'expense');
  const isEditing = !!editingTransaction;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Transação' : 'Nova Transação'}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 pb-10">
            {/* Type Toggle */}
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant={type === 'expense' ? 'default' : 'outline'} 
                className="flex-1" 
                onClick={() => setType('expense')}
              >
                Despesa
              </Button>
              <Button 
                type="button" 
                variant={type === 'income' ? 'default' : 'outline'} 
                className="flex-1" 
                onClick={() => setType('income')}
              >
                Receita
              </Button>
            </div>
            
            {/* Amount */}
            <div className="space-y-2">
              <Label>Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
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

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Ex: Almoço, Uber, Netflix..." 
              />
            </div>

            {/* Category (only for expenses) */}
            {type === 'expense' && (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label>Data</Label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
              />
              {isEditingRecurringOrInstallment && (
                <p className="text-xs text-muted-foreground">
                  Alterar a data criará uma nova recorrência a partir desta data e encerrará a anterior.
                </p>
              )}
            </div>

            {/* Only show recurrence and installment options when NOT editing */}
            {!isEditing && (
              <>
                {/* Recurring Toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label>Transação Recorrente</Label>
                  </div>
                  <Switch 
                    checked={isRecurring} 
                    onCheckedChange={(checked) => {
                      setIsRecurring(checked);
                      if (checked) {
                        setInstallments(undefined);
                      }
                    }} 
                  />
                </div>

                {/* Recurrence Options */}
                {isRecurring && (
                  <div className="space-y-4 p-3 border rounded-lg bg-muted/10">
                    <div className="space-y-2">
                      <Label>Repetir</Label>
                      <Select value={recurrenceType} onValueChange={(v: 'weekly' | 'monthly' | 'yearly') => setRecurrenceType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanalmente</SelectItem>
                          <SelectItem value="monthly">Mensalmente</SelectItem>
                          <SelectItem value="yearly">Anualmente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A transação será repetida automaticamente até você excluí-la.
                    </p>
                  </div>
                )}

                {/* Installments (available for ALL transactions, not just cards) */}
                {!isRecurring && (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <Label>Parcelado</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        min="1"
                        max="999"
                        placeholder="1"
                        value={installments || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            setInstallments(undefined);
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num >= 1) {
                              setInstallments(num);
                            }
                          }
                        }}
                        className="w-16 text-center"
                      />
                      <span className="text-sm text-muted-foreground">x</span>
                    </div>
                  </div>
                )}

                {/* Ask if amount is per installment or total - ALWAYS when installments > 1 */}
                {!isRecurring && installments !== undefined && installments > 1 && (
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/10">
                    <Label>O valor informado é:</Label>
                    <RadioGroup 
                      value={isInstallmentTotal ? 'total' : 'installment'} 
                      onValueChange={(v) => setIsInstallmentTotal(v === 'total')}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="total" id="total" />
                        <Label htmlFor="total" className="font-normal">
                          Valor total (será dividido em {installments}x)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="installment" id="installment" />
                        <Label htmlFor="installment" className="font-normal">
                          Valor da parcela (cada parcela de R$ {amount || '0,00'})
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Payment Method (only for expenses) */}
                {type === 'expense' && (
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3 gap-1"
                        onClick={() => {
                          setPaymentMethod('cash');
                          setInstallments(undefined);
                        }}
                      >
                        <Banknote className="h-5 w-5" />
                        <span className="text-xs">Dinheiro</span>
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'debit' ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3 gap-1"
                        onClick={() => {
                          setPaymentMethod('debit');
                          setInstallments(undefined);
                        }}
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="text-xs">Débito</span>
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'credit' ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3 gap-1"
                        onClick={() => setPaymentMethod('credit')}
                      >
                        <CardIcon className="h-5 w-5" />
                        <span className="text-xs">Crédito</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Card Selection (only for credit) */}
                {paymentMethod === 'credit' && type === 'expense' && cards.length > 0 && (
                  <div className="space-y-2">
                    <Label>Cartão</Label>
                    <Select value={cardId} onValueChange={setCardId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cartão" />
                      </SelectTrigger>
                      <SelectContent>
                        {cards.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* Mandatory Salary Account (for all transaction types) */}
            <AccountSelector
              value={mandatoryAccountId}
              onChange={setMandatoryAccountId}
              label={type === 'income' ? 'Vincular à conta salário' : 'Conta obrigatória'}
            />

            {/* Submit Button */}
            <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar'}
            </Button>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
