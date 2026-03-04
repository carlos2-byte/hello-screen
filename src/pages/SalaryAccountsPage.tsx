import { useState } from 'react';
import { Plus, Wallet, Trash2, TrendingUp, ArrowDownCircle } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSalaryAccounts, useSalaryAccountEntries } from '@/hooks/useSalaryAccounts';
import { formatCurrency } from '@/lib/formatters';
import { AddSalaryAccountSheet } from '@/components/salary/AddSalaryAccountSheet';
import { AddSalaryIncomeSheet } from '@/components/salary/AddSalaryIncomeSheet';
import { SalaryAccount } from '@/lib/salaryAccounts';
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

export default function SalaryAccountsPage() {
  const { accounts, loading, createAccount, removeAccount, addIncome, refresh } = useSalaryAccounts();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showIncomeSheet, setShowIncomeSheet] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SalaryAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<SalaryAccount | null>(null);

  const handleAddIncome = (account: SalaryAccount) => {
    setSelectedAccount(account);
    setShowIncomeSheet(true);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-center flex-1">Contas Salário</h1>
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
          {accounts.length > 0 && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">Saldo Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalBalance)}</p>
              </CardContent>
            </Card>
          )}

          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma conta salário cadastrada</p>
                <Button className="mt-4" onClick={() => setShowAddSheet(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Conta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map(account => (
                <Card key={account.id} className="overflow-hidden">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
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
                        <p className="mt-2 text-lg font-bold">{formatCurrency(account.balance)}</p>
                      </div>
                      <div className="flex gap-1">
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
                          onClick={() => setAccountToDelete(account)}
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

      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta salário?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta "{accountToDelete?.name}" será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (accountToDelete) {
                  const success = await removeAccount(accountToDelete.id);
                  if (success) {
                    setAccountToDelete(null);
                  } else {
                    setAccountToDelete(null);
                  }
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
