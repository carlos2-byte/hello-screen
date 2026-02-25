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
import { TrendingUp, X } from 'lucide-react';

interface ExportBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (includeInvestments: boolean) => void;
}

export function ExportBackupDialog({
  open,
  onOpenChange,
  onConfirm,
}: ExportBackupDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Deseja incluir os investimentos no backup?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <p>
              Escolha se deseja exportar seus investimentos junto com os demais dados:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li>Lista de investimentos cadastrados</li>
              <li>Saldo atual de cada investimento</li>
              <li>Histórico de aportes e resgates</li>
              <li>Rendimentos registrados</li>
              <li>Configurações específicas</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onConfirm(false);
              onOpenChange(false);
            }}
          >
            Não, sem investimentos
          </Button>
          <Button
            onClick={() => {
              onConfirm(true);
              onOpenChange(false);
            }}
          >
            Sim, incluir investimentos
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
