import { useState, useEffect, useCallback } from 'react';
import {
  Transaction,
  getAllTransactions,
  getTransactionsByMonth,
  saveTransaction,
  saveTransactions,
  deleteTransaction,
  deleteTransactionsByParentId,
  deleteTransactionsFromDate,
  deleteTransactionsByRecurrenceId,
  getMonthlyTotals,
  getCategoryTotals,
  getCreditCardById,
  updateCreditCard,
  getTransactionById,
} from '@/lib/storage';
import { generateId, getCurrentMonth } from '@/lib/formatters';
import { addMonthsToDate, addWeeksToDate, addYearsToDate, getLocalDateString } from '@/lib/dateUtils';
import { calculateInvoiceMonth } from '@/lib/invoiceUtils';
import { generateAutoCardPayments } from '@/lib/autoCardPay';
import { processIncomeTransfer, initializeMonthEndCheck } from '@/lib/balanceTransfer';
import { syncAfterTransactionChange, storeOriginalCardLimit } from '@/lib/dataIntegrity';

export interface TransferResult {
  transferred: boolean;
  amount?: number;
  investmentName?: string;
}

interface AddTransactionOptions {
  installments?: number;
  isInstallmentTotal?: boolean; // true = valor é o total, false = valor é da parcela
  isRecurring?: boolean;
  recurrenceType?: 'weekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string;
  // For card-to-card payments
  isCardToCardPayment?: boolean;
  sourceCardId?: string;
  targetCardId?: string;
}

export function useTransactions(month?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});

  const currentMonth = month || getCurrentMonth();

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Initialize month-end check for balance transfers
      await initializeMonthEndCheck();
      
      const txs = month
        ? await getTransactionsByMonth(month)
        : await getAllTransactions();
      setTransactions(txs);

      const monthlyTotals = await getMonthlyTotals(currentMonth);
      setTotals(monthlyTotals);

      const catTotals = await getCategoryTotals(currentMonth);
      setCategoryTotals(catTotals);
    } finally {
      setLoading(false);
    }
  }, [month, currentMonth]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const addTransaction = useCallback(
    async (
      tx: Omit<Transaction, 'id' | 'createdAt'>,
      options: AddTransactionOptions = {}
    ): Promise<TransferResult | null> => {
      const { 
        installments = 1, 
        isInstallmentTotal = true,
        isRecurring = false,
        recurrenceType = 'monthly',
        recurrenceEndDate,
        isCardToCardPayment = false,
        sourceCardId,
        targetCardId,
      } = options;

      // Get card info if it's a card payment
      let closingDay = 25;
      let card = null;
      if (tx.isCardPayment && tx.cardId) {
        card = await getCreditCardById(tx.cardId);
        if (card?.closingDay) {
          closingDay = card.closingDay;
        }
      }

      // Helper to consume card limit
      const consumeCardLimit = async (amount: number) => {
        if (card && card.limit && tx.type === 'expense') {
          const newLimit = card.limit - Math.abs(amount);
          await updateCreditCard({ ...card, limit: newLimit });
          card.limit = newLimit; // Update local reference for subsequent calls
        }
      };

      let savedTransaction: Transaction | null = null;

      // Handle recurring transactions (indefinite - generate 5 years ahead)
      if (isRecurring) {
        const recurrenceId = generateId();
        const recurringTransactions: Transaction[] = [];
        let currentDate = tx.date;
        let totalAmount = 0;
        
        // Generate transactions for the next 5 years (will be extended when user views future months)
        const maxEndDate = addYearsToDate(tx.date, 5);
        
        while (currentDate <= maxEndDate) {
          let invoiceMonth: string | undefined;
          if (tx.isCardPayment) {
            invoiceMonth = calculateInvoiceMonth(currentDate, closingDay);
          }

          const newTx: Transaction = {
            ...tx,
            id: generateId(),
            amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
            date: currentDate,
            isRecurring: true,
            recurrenceType,
            recurrenceId,
            invoiceMonth,
          };
          
          recurringTransactions.push(newTx);
          
          // Keep reference to first transaction if it's income
          if (!savedTransaction && tx.type === 'income') {
            savedTransaction = newTx;
          }
          
          totalAmount += Math.abs(tx.amount);

          // Calculate next date based on recurrence type
          switch (recurrenceType) {
            case 'weekly':
              currentDate = addWeeksToDate(currentDate, 1);
              break;
            case 'yearly':
              currentDate = addYearsToDate(currentDate, 1);
              break;
            case 'monthly':
            default:
              currentDate = addMonthsToDate(currentDate, 1);
              break;
          }
        }

        await saveTransactions(recurringTransactions);
        await consumeCardLimit(totalAmount);
      } else if (installments > 1) {
        // Create installment transactions
        const parentId = generateId();
        const installmentTransactions: Transaction[] = [];
        
        // Calculate amount per installment
        const installmentAmount = isInstallmentTotal 
          ? tx.amount / installments 
          : tx.amount;
        
        const totalAmount = isInstallmentTotal ? tx.amount : tx.amount * installments;

        for (let i = 0; i < installments; i++) {
          const installmentDate = addMonthsToDate(tx.date, i);
          
          let invoiceMonth: string | undefined;
          if (tx.isCardPayment) {
            invoiceMonth = calculateInvoiceMonth(installmentDate, closingDay);
          }

          installmentTransactions.push({
            ...tx,
            id: i === 0 ? parentId : generateId(),
            parentId: i === 0 ? undefined : parentId,
            amount: tx.type === 'expense' ? -Math.abs(installmentAmount) : Math.abs(installmentAmount),
            date: installmentDate,
            installments,
            currentInstallment: i + 1,
            description: `${tx.description || ''} (${i + 1}/${installments})`.trim(),
            invoiceMonth,
          });
        }

        await saveTransactions(installmentTransactions);
        await consumeCardLimit(totalAmount);
      } else {
        // Single transaction
        let invoiceMonth: string | undefined;
        if (tx.isCardPayment) {
          invoiceMonth = calculateInvoiceMonth(tx.date, closingDay);
        }

        const newTx: Transaction = {
          ...tx,
          id: generateId(),
          amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
          invoiceMonth,
          // Card-to-card payment fields
          isCardToCardPayment: isCardToCardPayment || undefined,
          sourceCardId: isCardToCardPayment ? sourceCardId : undefined,
          targetCardId: isCardToCardPayment ? targetCardId : undefined,
        };
        await saveTransaction(newTx);
        await consumeCardLimit(Math.abs(tx.amount));
        
        savedTransaction = newTx;
      }

      // Sync data integrity - recalculate card limits from scratch
      const affectedCardIds = tx.cardId ? [tx.cardId] : [];
      if (isCardToCardPayment && targetCardId) {
        affectedCardIds.push(targetCardId);
      }
      await syncAfterTransactionChange(affectedCardIds);

      // Check if this income triggers a balance transfer from previous month
      let transferResult: TransferResult | null = null;
      if (savedTransaction && savedTransaction.type === 'income') {
        const result = await processIncomeTransfer(savedTransaction);
        if (result && result.transferred) {
          transferResult = result;
        }
      }

      await loadTransactions();
      
      return transferResult;
    },
    [loadTransactions]
  );

  const updateTransactionItem = useCallback(
    async (
      id: string, 
      updates: Partial<Transaction>,
      updateType: 'single' | 'fromThis' | 'all' = 'single'
    ) => {
      // IMPORTANT: Always fetch from storage to get complete transaction data
      // The local 'transactions' state only contains current month transactions
      const allTxs = await getAllTransactions();
      const tx = allTxs.find(t => t.id === id);
      if (!tx) return;

      // REGRA GLOBAL: alterações nunca afetam o passado
      // Usamos a data de hoje como limite mínimo
      const today = getLocalDateString();

      // Check if date is being changed for a recurring transaction
      const isRecurring = !!tx.recurrenceId;
      const isInstallment = tx.parentId || (tx.installments && tx.installments > 1);
      const dateChanged = updates.date && updates.date !== tx.date;

      // For recurring/installment updates (non-single), we should NOT change the date
      // Each transaction should keep its original date (month) - only update other fields
      // UNLESS the date is explicitly changed, which triggers delete + recreate
      const getUpdatesForRelated = (): Partial<Transaction> => {
        // Remove date from updates when updating multiple related transactions
        // This ensures each transaction stays in its original month
        const { date, invoiceMonth, ...safeUpdates } = updates;
        return safeUpdates;
      };

      if (updateType === 'single') {
        // Single transaction can have date changed
        await saveTransaction({ ...tx, ...updates });
      } else if (updateType === 'fromThis' || updateType === 'all') {
        // If date changed for recurring, we need to:
        // 1. Delete old recurrence from this point forward
        // 2. Create new recurrence with the new date
        if (dateChanged && isRecurring && updates.date) {
          const fromDate = updateType === 'all' ? today : (tx.date >= today ? tx.date : today);
          
          // Find and delete old recurring transactions from this point
          const toDelete = allTxs.filter(t => {
            if (t.recurrenceId !== tx.recurrenceId) return false;
            return t.date >= fromDate;
          });
          
          for (const t of toDelete) {
            await deleteTransaction(t.id);
          }

          // Create new recurring series with the updated data
          const newRecurrenceId = generateId();
          const recurringTransactions: Transaction[] = [];
          let currentDate = updates.date;
          
          // Get card info if needed
          let closingDay = 25;
          if (tx.isCardPayment && tx.cardId) {
            const card = await getCreditCardById(tx.cardId);
            if (card?.closingDay) {
              closingDay = card.closingDay;
            }
          }
          
          // Generate transactions for the next 5 years
          const maxEndDate = addYearsToDate(updates.date, 5);
          
          while (currentDate <= maxEndDate) {
            let invoiceMonth: string | undefined;
            if (tx.isCardPayment) {
              invoiceMonth = calculateInvoiceMonth(currentDate, closingDay);
            }

            const newTx: Transaction = {
              ...tx,
              ...updates,
              id: generateId(),
              date: currentDate,
              isRecurring: true,
              recurrenceType: tx.recurrenceType || 'monthly',
              recurrenceId: newRecurrenceId,
              invoiceMonth,
            };
            
            recurringTransactions.push(newTx);

            // Calculate next date based on recurrence type
            switch (tx.recurrenceType) {
              case 'weekly':
                currentDate = addWeeksToDate(currentDate, 1);
                break;
              case 'yearly':
                currentDate = addYearsToDate(currentDate, 1);
                break;
              case 'monthly':
              default:
                currentDate = addMonthsToDate(currentDate, 1);
                break;
            }
          }

          await saveTransactions(recurringTransactions);
        } else {
          // Normal update without date change - update only safe fields
          const fromDate = updateType === 'all' ? today : (tx.date >= today ? tx.date : today);
          
          const relatedTxs = allTxs.filter(t => {
            if (isRecurring) {
              return t.recurrenceId === tx.recurrenceId && t.date >= fromDate;
            }
            if (isInstallment) {
              const parentId = tx.parentId || tx.id;
              return (t.id === parentId || t.parentId === parentId) && t.date >= fromDate;
            }
            return t.id === tx.id;
          });

          const safeUpdates = getUpdatesForRelated();
          for (const relatedTx of relatedTxs) {
            await saveTransaction({ ...relatedTx, ...safeUpdates });
          }
        }
      }

      // Sync data integrity - recalculate affected card limits
      const affectedCardIds = new Set<string>();
      if (tx.cardId) affectedCardIds.add(tx.cardId);
      if (updates.cardId) affectedCardIds.add(updates.cardId);
      await syncAfterTransactionChange(Array.from(affectedCardIds));

      await loadTransactions();
    },
    [loadTransactions]
  );

  const removeTransaction = useCallback(
    async (
      id: string, 
      deleteType: 'single' | 'fromThis' | 'all' = 'single'
    ) => {
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      // REGRA GLOBAL: exclusões nunca afetam o passado
      const today = getLocalDateString();

      // Helper function to restore card limit for a transaction
      const restoreCardLimit = async (transaction: Transaction) => {
        if (transaction.isCardPayment && transaction.cardId) {
          const card = await getCreditCardById(transaction.cardId);
          if (card && card.limit) {
            const restoredLimit = (card.limit || 0) + Math.abs(transaction.amount);
            await updateCreditCard({ ...card, limit: restoredLimit });
          }
        }
      };

      if (deleteType === 'single') {
        await restoreCardLimit(tx);
        await deleteTransaction(id);
      } else if (deleteType === 'fromThis') {
        // Delete this and all future (>= today)
        const allTxs = await getAllTransactions();
        const fromDate = tx.date >= today ? tx.date : today;
        
        const toDelete = allTxs.filter(t => {
          if (tx.recurrenceId) {
            return t.recurrenceId === tx.recurrenceId && t.date >= fromDate;
          }
          if (tx.parentId || (tx.installments && tx.installments > 1)) {
            const parentId = tx.parentId || tx.id;
            return (t.id === parentId || t.parentId === parentId) && t.date >= fromDate;
          }
          return t.id === tx.id && t.date >= fromDate;
        });
        
        // Restore limits for all transactions being deleted
        for (const t of toDelete) {
          await restoreCardLimit(t);
        }
        
        // Delete individually to respect the date filter
        for (const t of toDelete) {
          await deleteTransaction(t.id);
        }
      } else if (deleteType === 'all') {
        // Delete all related (ONLY >= today, preserve past)
        const allTxs = await getAllTransactions();
        const toDelete = allTxs.filter(t => {
          // First check if it's related
          let isRelated = false;
          if (tx.recurrenceId) {
            isRelated = t.recurrenceId === tx.recurrenceId;
          } else if (tx.parentId || (tx.installments && tx.installments > 1)) {
            const parentId = tx.parentId || tx.id;
            isRelated = t.id === parentId || t.parentId === parentId;
          } else {
            isRelated = t.id === tx.id;
          }
          // Then only include if date >= today (preserve past)
          return isRelated && t.date >= today;
        });
        
        // Restore limits for all transactions being deleted
        for (const t of toDelete) {
          await restoreCardLimit(t);
        }
        
        // Delete individually to respect the date filter
        for (const t of toDelete) {
          await deleteTransaction(t.id);
        }
      }

      // Sync data integrity - recalculate affected card limits
      const affectedCardId = tx.cardId;
      await syncAfterTransactionChange(affectedCardId ? [affectedCardId] : undefined);
      
      await loadTransactions();
    },
    [loadTransactions, transactions]
  );

  const balance = totals.income - totals.expense;

  return {
    transactions,
    loading,
    totals,
    categoryTotals,
    balance,
    addTransaction,
    updateTransaction: updateTransactionItem,
    removeTransaction,
    refresh: loadTransactions,
  };
}
