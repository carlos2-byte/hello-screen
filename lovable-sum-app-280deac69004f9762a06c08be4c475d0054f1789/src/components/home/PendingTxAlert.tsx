import { useState } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface PendingItem {
  id: string;
  description: string;
  amount: number;
  isOverdue: boolean;
}

interface PendingTransactionsAlertProps {
  items: PendingItem[];
  onTogglePaid: (id: string) => void;
  onDismiss: () => void;
}

export function PendingTransactionsAlert({ items, onTogglePaid, onDismiss }: PendingTransactionsAlertProps) {
  if (items.length === 0) return null;

  const overdueItems = items.filter(i => i.isOverdue);
  const pendingItems = items.filter(i => !i.isOverdue);
  const hasOverdue = overdueItems.length > 0;

  return (
    <Alert className={hasOverdue 
      ? "bg-destructive/10 border-destructive/30 animate-fade-in" 
      : "bg-warning/10 border-warning/30 animate-fade-in"
    }>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        {hasOverdue ? 'Lançamentos vencidos' : 'Lançamentos pendentes'}
        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-1.5 mt-1">
          {overdueItems.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className="text-sm truncate text-destructive font-medium">
                {item.description} — {formatCurrency(item.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onTogglePaid(item.id)}
              >
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {pendingItems.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className="text-sm truncate">
                {item.description} — {formatCurrency(item.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onTogglePaid(item.id)}
              >
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
