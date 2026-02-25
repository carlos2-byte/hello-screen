import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/lib/storage';

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (editType: 'single' | 'fromThis' | 'all') => void;
}

export function EditTransactionDialog({ 
  transaction, 
  open, 
  onOpenChange,
  onConfirm,
}: EditTransactionDialogProps) {
  if (!transaction) return null;

  const hasMultiple = 
    (transaction.installments && transaction.installments > 1) || 
    transaction.parentId ||
    transaction.recurrenceId;

  const isRecurring = !!transaction.recurrenceId;
  const isInstallment = (transaction.installments && transaction.installments > 1) || transaction.parentId;

  // For single transactions, just proceed with edit
  if (!hasMultiple) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar transação</AlertDialogTitle>
          <AlertDialogDescription>
            {isRecurring 
              ? 'Esta é uma transação recorrente. O que deseja editar?'
              : `Esta é a parcela ${transaction.currentInstallment}/${transaction.installments}. O que deseja editar?`
            }
            <span className="block mt-2 text-xs text-muted-foreground">
              Nota: lançamentos passados são preservados automaticamente.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            onClick={() => {
              onConfirm('single');
              onOpenChange(false);
            }}
            className="justify-start"
          >
            Editar apenas esta
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onConfirm('fromThis');
              onOpenChange(false);
            }}
            className="justify-start"
          >
            Editar esta e as futuras
          </Button>
          <Button
            variant="default"
            onClick={() => {
              onConfirm('all');
              onOpenChange(false);
            }}
            className="justify-start"
          >
            Editar todas as futuras {isRecurring ? 'recorrências' : 'parcelas'}
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
