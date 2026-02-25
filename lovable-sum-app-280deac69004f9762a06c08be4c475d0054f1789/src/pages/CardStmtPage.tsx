import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Pencil } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCardDetails, useCreditCards } from '@/hooks/useCreditCards';
import { useTransactions } from '@/hooks/useTransactions';
import { formatCurrency, getCurrentMonth, formatMonthYear } from '@/lib/formatters';
import { getInvoiceDueDate, formatDateBR } from '@/lib/dateUtils';
import { TransactionList } from '@/components/transactions/TxList';
import { MonthSelector } from '@/components/transactions/MonthSelector';
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTxDialog';
import { EditTransactionDialog } from '@/components/transactions/EditTxDialog';
import { AddTransactionSheet } from '@/components/transactions/AddTxSheet';
import { EditCardSheet } from '@/components/cards/EditCardSheet';
import { CreditCard, Transaction } from '@/lib/storage';
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

export default function CardStatementPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, removeCard, editCard, refresh: refreshCards } = useCreditCards();
  const { updateTransaction, removeTransaction } = useTransactions();
  
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showDeleteCard, setShowDeleteCard] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);
  
  // Transaction management states
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [pendingEditType, setPendingEditType] = useState<'single' | 'fromThis' | 'all'>('single');

  const card = cards.find(c => c.id === cardId);
  const { purchases, monthlyTotal, availableLimit, refresh: refreshCard } = useCardDetails(cardId || '', selectedMonth);
  
  // Calculate due date for display
  const dueDate = card?.closingDay && card?.dueDay 
    ? getInvoiceDueDate(selectedMonth, card.closingDay, card.dueDay)
    : null;

  // Redirect if card not found
  useEffect(() => {
    if (!cardId || (cards.length > 0 && !card)) {
      navigate('/cards');
    }
  }, [cardId, card, cards.length, navigate]);

  const handleDeleteCard = async () => {
    if (card) {
      await removeCard(card.id);
      setShowDeleteCard(false);
      navigate('/cards');
    }
  };

  const handleEditCard = async (updatedCard: CreditCard) => {
    await editCard(updatedCard);
    refreshCards();
  };

  // Transaction handlers
  const handleDeleteTransaction = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
  };

  const handleConfirmDelete = async (id: string, deleteType: 'single' | 'fromThis' | 'all') => {
    await removeTransaction(id, deleteType);
    setTransactionToDelete(null);
    refreshCard();
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    
    const hasMultiple = 
      (transaction.installments && transaction.installments > 1) || 
      transaction.parentId ||
      transaction.recurrenceId;
    
    if (hasMultiple) {
      setEditDialogOpen(true);
    } else {
      setShowEditSheet(true);
    }
  };

  const handleEditConfirm = (editType: 'single' | 'fromThis' | 'all') => {
    setPendingEditType(editType);
    setEditDialogOpen(false);
    setShowEditSheet(true);
  };

  const handleSubmitEdit = async (
    tx: Omit<Transaction, 'id' | 'createdAt'>
  ) => {
    if (transactionToEdit) {
      await updateTransaction(transactionToEdit.id, {
        amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
        description: tx.description,
        category: tx.category,
        type: tx.type,
        date: tx.date,
        isCardPayment: tx.isCardPayment,
        cardId: tx.cardId,
      }, pendingEditType);
      
      setTransactionToEdit(null);
      setPendingEditType('single');
      refreshCard();
    }
  };

  const handleEditSheetClose = (open: boolean) => {
    setShowEditSheet(open);
    if (!open) {
      setTransactionToEdit(null);
      setPendingEditType('single');
    }
  };

  if (!card) {
    return null;
  }

  return (
    <PageContainer
      header={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/cards')}
              className="-ml-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{card.name}</h1>
              <p className="text-sm text-muted-foreground">
                •••• {card.last4 || '****'} • Fecha dia {card.closingDay || '--'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEditCard(true)}
            >
              <Pencil className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteCard(true)}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      }
    >
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="space-y-4 pb-4">
          {/* Month Navigation */}
          <MonthSelector 
            month={selectedMonth} 
            onMonthChange={setSelectedMonth} 
          />

          {/* Card Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Fatura {formatMonthYear(selectedMonth)}</p>
                <p className="text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
                {dueDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vence em {formatDateBR(dueDate)}
                  </p>
                )}
              </CardContent>
            </Card>
            {card.limit && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Disponível</p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(availableLimit)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>


          {/* Purchases */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-medium mb-3">Compras do período</h3>
              <TransactionList
                transactions={purchases}
                onDelete={handleDeleteTransaction}
                onEdit={handleEditTransaction}
                showActions
                showPurchaseDate
                emptyMessage="Nenhuma compra neste período"
              />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Delete Card Confirmation */}
      <AlertDialog open={showDeleteCard} onOpenChange={setShowDeleteCard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cartão "{card.name}"? As
              transações vinculadas a este cartão não serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCard}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Transaction Sheet */}
      <AddTransactionSheet
        open={showEditSheet}
        onOpenChange={handleEditSheetClose}
        onSubmit={handleSubmitEdit}
        cards={cards}
        editingTransaction={transactionToEdit}
      />

      {/* Edit Transaction Dialog (for recurring/installments) */}
      <EditTransactionDialog
        transaction={transactionToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onConfirm={handleEditConfirm}
      />

      {/* Delete Transaction Dialog */}
      <DeleteTransactionDialog
        transaction={transactionToDelete}
        open={!!transactionToDelete}
        onOpenChange={(open) => !open && setTransactionToDelete(null)}
        onDelete={handleConfirmDelete}
      />


      {/* Edit Card Sheet */}
      <EditCardSheet
        open={showEditCard}
        onOpenChange={setShowEditCard}
        card={card}
        cards={cards}
        onSubmit={handleEditCard}
      />
    </PageContainer>
  );
}
