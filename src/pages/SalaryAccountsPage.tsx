import { useState } from 'react';
import { Plus, Wallet, Trash2, TrendingUp, ArrowDownCircle, Pencil, Ban } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSalaryAccounts, useSalaryAccountEntries } from '@/hooks/useSalaryAccounts';
import { formatCurrency } from '@/lib/formatters';
import { AddSalaryAccountSheet } from '@/components/salary/AddSalaryAccountSheet';
import { AddSalaryIncomeSheet } from '@/components/salary/AddSalaryIncomeSheet';
import { EditSalaryAccountSheet } from '@/components/salary/EditSalaryAccountSheet';
import { SalaryAccount, SalaryAccountWithBalance } from '@/hooks/useSalaryAccounts';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

function AccountEntries({ accountId }: { accountId: string }) {
  const { entries, loading } = useSalaryAccountEntries(accountId);
  
  if (loading) return <p className="text-xs text-muted-foreground">Carregando...</p>;
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">Nenhum lançamento</p>;
  
  return (
    <div className="space-y-1 mt-2">
      {entries.slice(0, 3).map(entry => (
        <div key={entry.id} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {entry.description || 'Receita'} - {entry.date}
            {entry.consolidated && <span className="ml-1 text-primary/60">🔒</span>}
          </span>
          <span className="text-emerald-500 font-medium">+{formatCurrency(entry.amount)}</span>
        </div>
      ))}
      {entries.length > 3 && (
        <p className="text-xs text-muted-foreground">+{entries.length - 3} lançamentos</p>
      )}
    </div>
  );
}

type DeleteAction = 'transfer' | 'force' | null;

export default function SalaryAccountsPage() {
  const { accounts, loading, createAccount, editAccount, removeAccount, deactivate, addIncome, refresh } = useSalaryAccounts();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showIncomeSheet, setShowIncomeSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SalaryAccountWithBalance | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<SalaryAccountWithBalance | null>(null);
  const [deleteAction, setDeleteAction] = useState<DeleteAction>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [deleteHasHistory, setDeleteHasHistory] = useState(false);

  const handleAddIncome = (account: SalaryAccountWithBalance) => {
    setSelectedAccount(account);
    setShowIncomeSheet(true);
  };

  const handleEdit = (account: SalaryAccountWithBalance) => {
    setSelectedAccount(account);
    setShowEditSheet(true);
  };

  const handleDeleteRequest = async (account: SalaryAccountWithBalance) => {
    setAccountToDelete(account);
    setDeleteAction(null);
    setTransferTargetId('');
    // Check if has history via entryCount (balance > 0 or entries exist)
    const hasEntries = account.entryCount > 0;
    setDeleteHasHistory(hasEntries);
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;

    if (deleteHasHistory) {
      if (deleteAction === 'transfer') {
        if (!transferTargetId) {
          toast.error('Selecione a conta destino para transferir o histórico.');
          return;
        }
        const success = await removeAccount(accountToDelete.id, { transferToAccountId: transferTargetId });
        if (success) {
          toast.success('Conta excluída e histórico transferido com sucesso.');
          setAccountToDelete(null);
        }
      } else if (deleteAction === 'force') {
        const success = await removeAccount(accountToDelete.id, { forceDelete: true });
        if (success) {
          toast.success('Conta e histórico excluídos permanentemente.');
          setAccountToDelete(null);
        }
      }
    } else {
      const success = await removeAccount(accountToDelete.id);
      if (success) {
        toast.success('Conta excluída com sucesso.');
        setAccountToDelete(null);
      }
    }
  };

  const activeAccounts = accounts.filter(a => a.active !== false);
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0);
  const otherAccounts = activeAccounts.filter(a => a.id !== accountToDelete?.id);

  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-center flex-1">Receitas</h1>
          <Button onClick={() => setShowAddSheet(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>
      }
    >
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="space-y-4 pb-4">
          {/* Total Balance */}
          {activeAccounts.length > 0 && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">Saldo Total</p>
                <p className="text-2xl font-bold text-primary truncate">{formatCurrency(totalBalance)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Refletido no saldo geral da Home
                </p>
              </CardContent>
            </Card>
          )}

          {activeAccounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma fonte de receita cadastrada</p>
                <Button className="mt-4" onClick={() => setShowAddSheet(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Fonte
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeAccounts.map(account => (
                <Card key={account.id} className="overflow-hidden">
                  <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{account.name}</h3>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                          <span>Dia pgto: {account.payDay}</span>
                          {account.canReceiveTransfers && (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <ArrowDownCircle className="h-3 w-3" />
                              Recebe transf.
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-lg font-bold truncate">
                          {formatCurrency(account.balance)}
                          <span className="text-xs font-normal text-muted-foreground ml-1">(calculado)</span>
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddIncome(account)}
                          title="Adicionar receita"
                        >
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(account)}
                          title="Editar conta"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRequest(account)}
                          title="Excluir conta"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <AccountEntries accountId={account.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <AddSalaryAccountSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onSubmit={createAccount}
      />

      <AddSalaryIncomeSheet
        open={showIncomeSheet}
        onOpenChange={setShowIncomeSheet}
        account={selectedAccount}
        onSubmit={async (data) => {
          await addIncome(data);
          refresh();
        }}
      />

      <EditSalaryAccountSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        account={selectedAccount}
        onSubmit={async (account) => {
          await editAccount(account);
          refresh();
        }}
      />

      {/* Delete Account Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => { if (!open) setAccountToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fonte "{accountToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteHasHistory ? (
                  <>
                    <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Esta conta possui <strong>{accountToDelete?.entryCount} lançamento(s)</strong> e saldo de{' '}
                        <strong>{formatCurrency(accountToDelete?.balance ?? 0)}</strong>.
                        A exclusão afetará o saldo histórico e o saldo geral exibido na Home.
                      </AlertDescription>
                    </Alert>

                    <p className="text-sm font-medium">Escolha uma ação:</p>

                    <div className="space-y-2">
                      {otherAccounts.length > 0 && (
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            deleteAction === 'transfer' ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                          onClick={() => setDeleteAction('transfer')}
                        >
                          <input
                            type="radio"
                            name="deleteAction"
                            checked={deleteAction === 'transfer'}
                            onChange={() => setDeleteAction('transfer')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Transferir histórico para outra conta</p>
                            <p className="text-xs text-muted-foreground">
                              Os lançamentos serão movidos para a conta selecionada.
                            </p>
                            {deleteAction === 'transfer' && (
                              <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                                <SelectTrigger className="mt-2">
                                  <SelectValue placeholder="Selecionar conta destino..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {otherAccounts.map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </label>
                      )}

                      <label
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          deleteAction === 'force' ? 'border-destructive bg-destructive/5' : 'border-border'
                        }`}
                        onClick={() => setDeleteAction('force')}
                      >
                        <input
                          type="radio"
                          name="deleteAction"
                          checked={deleteAction === 'force'}
                          onChange={() => setDeleteAction('force')}
                          className="mt-1"
                        />
                        <div>
                          <p className="text-sm font-medium text-destructive">Excluir fonte e todo histórico</p>
                          <p className="text-xs text-muted-foreground">
                            Todos os lançamentos serão perdidos permanentemente. O saldo será removido.
                          </p>
                        </div>
                      </label>
                    </div>
                  </>
                ) : (
                  <p>A fonte será excluída permanentemente. Esta ação não pode ser desfeita.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteHasHistory && !deleteAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAction === 'transfer' ? 'Transferir e Excluir' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
