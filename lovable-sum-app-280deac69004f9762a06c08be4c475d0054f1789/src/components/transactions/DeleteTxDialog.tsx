import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/lib/storage';

interface DeleteTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string, deleteType: 'single' | 'fromThis' | 'all') => void;
}

export function DeleteTransactionDialog({ 
  transaction, 
  open, 
  onOpenChange,
  onDelete,
}: DeleteTransactionDialogProps) {
  if (!transaction) return null;

  const hasMultiple = 
    (transaction.installments && transaction.installments > 1) || 
    transaction.parentId ||
    transaction.recurrenceId;

  const isRecurring = !!transaction.recurrenceId;
  const isInstallment = (transaction.installments && transaction.installments > 1) || transaction.parentId;

  const handleDelete = (type: 'single' | 'fromThis' | 'all') => {
    onDelete(transaction.id, type);
    onOpenChange(false);
  };

  if (!hasMultiple) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{transaction.description || 'Esta transação'}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete('single')}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir transação</AlertDialogTitle>
          <AlertDialogDescription>
            {isRecurring 
              ? 'Esta é uma transação recorrente. O que deseja fazer?'
              : `Esta é a parcela ${transaction.currentInstallment}/${transaction.installments}. O que deseja fazer?`
            }
            <span className="block mt-2 text-xs text-muted-foreground">
              Nota: lançamentos passados são preservados automaticamente.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            onClick={() => handleDelete('single')}
            className="justify-start"
          >
            Excluir apenas esta
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDelete('fromThis')}
            className="justify-start"
          >
            Excluir esta e as futuras
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleDelete('all')}
            className="justify-start"
          >
            Excluir todas as futuras {isRecurring ? 'recorrências' : 'parcelas'}
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
