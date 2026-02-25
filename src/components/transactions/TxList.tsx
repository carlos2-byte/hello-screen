import { Transaction } from '@/lib/storage';
import { TransactionItem } from './TxItem';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionListProps {
  transactions: Transaction[];
  loading?: boolean;
  onDelete?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  showActions?: boolean;
  emptyMessage?: string;
  /** When true, show purchase date instead of invoice due date */
  showPurchaseDate?: boolean;
}

export function TransactionList({
  transactions,
  loading = false,
  onDelete,
  onEdit,
  showActions = false,
  emptyMessage = 'Nenhuma transação encontrada',
  showPurchaseDate = false,
}: TransactionListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {transactions.map(tx => (
        <TransactionItem
          key={tx.id}
          transaction={tx}
          onDelete={onDelete}
          onEdit={onEdit}
          showActions={showActions}
          showPurchaseDate={showPurchaseDate}
        />
      ))}
    </div>
  );
}
