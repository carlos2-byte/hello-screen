import { X, ArrowUpRight, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

interface TransferAlertProps {
  amount: number;
  investmentName: string;
  onDismiss: () => void;
}

export function TransferAlert({ amount, investmentName, onDismiss }: TransferAlertProps) {
  return (
    <Alert className="relative bg-primary/10 border-primary/20">
      <Wallet className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary flex items-center gap-2">
        Transferência automática
        <ArrowUpRight className="h-4 w-4" />
      </AlertTitle>
      <AlertDescription className="text-foreground/80">
        O saldo positivo de {formatCurrency(amount)} do mês anterior foi transferido automaticamente para o investimento <strong>{investmentName}</strong>.
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
