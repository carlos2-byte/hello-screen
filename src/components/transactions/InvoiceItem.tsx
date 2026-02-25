import { ConsolidatedInvoice } from '@/lib/invoiceUtils';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { formatDateShortBR } from '@/lib/dateUtils';
import { CreditCard, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceItemProps {
  invoice: ConsolidatedInvoice;
  onClick?: (invoice: ConsolidatedInvoice) => void;
  isPaid?: boolean;
  isOverdue?: boolean;
  onTogglePaid?: (id: string) => void;
}

export function InvoiceItem({ invoice, onClick, isPaid = false, isOverdue = false, onTogglePaid }: InvoiceItemProps) {
  return (
    <div className="flex items-center gap-2 py-2">
      {/* Payment status indicator */}
      {onTogglePaid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePaid(invoice.id);
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

      <button
        onClick={() => onClick?.(invoice)}
        className="flex-1 flex items-center gap-2 text-left hover:bg-muted/50 rounded-lg transition-colors -mx-1 px-1"
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10"
        >
          <FileText className="h-4 w-4 text-destructive" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-medium text-sm truncate max-w-[100px]">
              Fatura {invoice.cardName}
            </p>
            <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">{formatDateShortBR(invoice.dueDate)}</span>
            <span className="bg-muted px-1 py-0.5 rounded text-[9px]">
              {invoice.transactions.length}x
            </span>
          </div>
        </div>

        <span className="font-semibold text-sm tabular-nums text-foreground whitespace-nowrap">
          -{formatCurrency(invoice.total)}
        </span>
      </button>
    </div>
  );
}