import { Transaction, getCategoryById, getCreditCardById } from '@/lib/storage';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { getInvoiceDueDate, formatDateShortBR } from '@/lib/dateUtils';
import { useState, useEffect } from 'react';
import {
  TrendingUp,
  UtensilsCrossed,
  Car,
  Home,
  Heart,
  GraduationCap,
  Gamepad2,
  MoreHorizontal,
  CreditCard,
  Trash2,
  Repeat,
  Pencil,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  UtensilsCrossed,
  Car,
  Home,
  Heart,
  GraduationCap,
  Gamepad2,
  MoreHorizontal,
};

interface TransactionItemProps {
  transaction: Transaction;
  onDelete?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  showActions?: boolean;
  isPaid?: boolean;
  isOverdue?: boolean;
  onTogglePaid?: (id: string) => void;
  /** When true, always show the purchase date instead of the invoice due date */
  showPurchaseDate?: boolean;
}

/**
 * Get display date for a transaction
 * - Credit card transactions: use the calculated due date (vencimento)
 * - Other transactions: use the purchase date
 * 
 * Due date logic: If dueDay < closingDay, due date is in the NEXT month
 */
function getDisplayDate(
  transaction: Transaction,
  card: { closingDay?: number; dueDay?: number } | null
): string {
  // Card-to-card invoice payments must be shown on the target card's due date
  // (the transaction.date we store), not on the payer card's own invoice due date.
  if (transaction.isCardToCardPayment) {
    return transaction.date;
  }

  if (transaction.isCardPayment && transaction.invoiceMonth && card?.closingDay && card?.dueDay) {
    return getInvoiceDueDate(transaction.invoiceMonth, card.closingDay, card.dueDay);
  }
  return transaction.date;
}

export function TransactionItem({ 
  transaction, 
  onDelete,
  onEdit,
  showActions = false,
  isPaid = false,
  isOverdue = false,
  onTogglePaid,
  showPurchaseDate = false,
}: TransactionItemProps) {
  const [displayDate, setDisplayDate] = useState<string>(transaction.date);
  const [cardName, setCardName] = useState<string | null>(null);
  
  const category = getCategoryById(transaction.category || 'other');
  const Icon = category?.icon ? iconMap[category.icon] || MoreHorizontal : MoreHorizontal;
  const isIncome = transaction.type === 'income';
  const isRecurring = !!transaction.recurrenceId;
  const isInstallment = transaction.installments && transaction.installments > 1;
  const isCardPayment = transaction.isCardPayment && transaction.cardId;

  // Calculate display date (due date for card payments, unless showPurchaseDate is set)
  useEffect(() => {
    async function calculateDate() {
      if (isCardPayment && transaction.cardId) {
        const card = await getCreditCardById(transaction.cardId);
        if (card) {
          setDisplayDate(showPurchaseDate ? transaction.date : getDisplayDate(transaction, card));
          setCardName(card.name);
        }
      } else {
        setDisplayDate(transaction.date);
        setCardName(null);
      }
    }
    calculateDate();
  }, [transaction, isCardPayment, showPurchaseDate]);

  // Only show status indicator for expenses
  const showStatusIndicator = transaction.type === 'expense' && onTogglePaid;

  return (
    <div className={cn(
      "flex items-center gap-2 py-2 group rounded-lg px-1 transition-colors",
      showStatusIndicator && !isPaid && isOverdue && "bg-destructive/10",
      showStatusIndicator && !isPaid && !isOverdue && "bg-warning/10",
    )}>
      {/* Payment status indicator */}
      {showStatusIndicator && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePaid?.(transaction.id);
          }}
          className="relative flex-shrink-0 touch-manipulation"
          title={isPaid ? 'Marcar como não pago' : 'Marcar como pago'}
        >
          <div
            className={cn(
              'h-3 w-3 rounded-full border-2 transition-colors',
              isPaid 
                ? 'bg-success border-success' 
                : isOverdue
                  ? 'bg-destructive border-destructive animate-pulse'
                  : 'bg-warning border-warning'
            )}
          />
          {isOverdue && !isPaid && (
            <AlertTriangle className="absolute -top-1 -right-1 h-2.5 w-2.5 text-destructive" />
          )}
        </button>
      )}

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: category?.color ? `${category.color}20` : 'hsl(var(--muted))' }}
      >
        <Icon
          className="h-4 w-4"
          style={{ color: category?.color || 'hsl(var(--muted-foreground))' }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="font-medium text-sm truncate max-w-[100px]">
            {transaction.description || category?.name || 'Transação'}
          </p>
          {transaction.isCardPayment && (
            <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {isRecurring && (
            <Repeat className="h-3 w-3 text-primary shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            {isCardPayment && <Calendar className="h-2.5 w-2.5" />}
            {isCardPayment ? formatDateShortBR(displayDate) : formatDate(transaction.date)}
          </span>
          {cardName && (
            <span className="bg-muted px-1 py-0.5 rounded text-[9px] truncate max-w-[50px]">
              {cardName}
            </span>
          )}
          {isInstallment && (
            <span className="bg-secondary px-1 py-0.5 rounded text-[9px]">
              {transaction.currentInstallment}/{transaction.installments}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'font-semibold text-sm tabular-nums whitespace-nowrap',
          isIncome ? 'text-success' : 'text-foreground'
        )}
      >
        {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
      </span>
      
      {showActions && (
        <div className="flex gap-0.5 shrink-0">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(transaction);
              }}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(transaction);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
