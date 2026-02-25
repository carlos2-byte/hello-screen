/**
 * Invoice utilities for credit card billing logic
 * 
 * Invoice period: From (F+1) of previous month to (F) of current month
 * where F = closing day defined by user
 */

import { Transaction, CreditCard, getCreditCards, getAllTransactions } from './storage';
import { 
  parseLocalMonth, 
  getLocalDateString, 
  getLocalMonth,
  getNextMonthLocal,
  getPreviousMonthLocal,
  parseLocalDate,
} from './dateUtils';

export interface ConsolidatedInvoice {
  id: string;
  cardId: string;
  cardName: string;
  invoiceMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  total: number;
  transactions: Transaction[];
  type: 'expense' | 'income';
  isConsolidatedInvoice: true;
}

/**
 * Calculate which invoice month a transaction belongs to based on closing day
 * 
 * Rule: Transactions from (F+1) of previous month to (F) of current month
 * belong to the invoice of that month.
 * 
 * Example: Closing day 25
 * - Transaction on Jan 20 -> January invoice (before closing)
 * - Transaction on Jan 26 -> February invoice (after closing)
 */
export function calculateInvoiceMonth(transactionDate: string, closingDay: number): string {
  const date = parseLocalDate(transactionDate);
  const day = date.getDate();
  const transactionMonth = getLocalMonth(date);
  
  if (day <= closingDay) {
    // Before or on closing day -> current month invoice
    return transactionMonth;
  } else {
    // After closing day -> next month invoice
    return getNextMonthLocal(transactionMonth);
  }
}

/**
 * Calculate the due date for an invoice
 * 
 * Rule: If dueDay > closingDay, due date is in the invoice month
 * If dueDay <= closingDay, due date is in the month after invoice month
 */
export function calculateDueDate(invoiceMonth: string, closingDay: number, dueDay: number): string {
  const invoiceDate = parseLocalMonth(invoiceMonth);
  
  if (dueDay > closingDay) {
    // Due day is after closing day in the same month
    invoiceDate.setDate(dueDay);
    return getLocalDateString(invoiceDate);
  } else {
    // Due day is before or equal to closing day, so it's in the next month
    invoiceDate.setMonth(invoiceDate.getMonth() + 1);
    invoiceDate.setDate(dueDay);
    return getLocalDateString(invoiceDate);
  }
}

/**
 * Check if an invoice has been paid (by cash, debit, or another card)
 */
export function isInvoicePaid(
  cardId: string,
  invoiceMonth: string,
  allTransactions: Transaction[]
): boolean {
  return allTransactions.some(tx => 
    tx.isInvoicePayment && 
    tx.paidInvoiceCardId === cardId && 
    tx.paidInvoiceMonth === invoiceMonth
  );
}

/**
 * Get all consolidated invoices for a specific month
 * Returns invoices that have their due date in the specified month
 * Excludes invoices that have been paid (they should not appear in the general statement)
 */
export async function getConsolidatedInvoicesForMonth(
  targetMonth: string
): Promise<ConsolidatedInvoice[]> {
  const cards = await getCreditCards();
  const allTransactions = await getAllTransactions();
  
  const invoices: ConsolidatedInvoice[] = [];
  
  for (const card of cards) {
    // If this card is configured to be paid with another card, its invoice must NOT appear
    // in the general statement. It should exist exclusively as an expense inside the payer card.
    if (card.defaultPayerCardId) {
      continue;
    }

    // Use default values if not set
    const closingDay = card.closingDay || 25;
    const dueDay = card.dueDay || 5;
    
    // Get all card transactions for this card
    // This includes:
    // 1. Regular card purchases (isCardPayment && type === 'expense')
    // 2. Card-to-card payments (isCardToCardPayment) - when THIS card pays another card's invoice
    // Card-to-card payments are regular expenses on the payer card and MUST be included in the invoice total
    const cardTransactions = allTransactions.filter(tx => {
      // Must be a card payment for this card and an expense
      if (!tx.isCardPayment || tx.cardId !== card.id || tx.type !== 'expense') {
        return false;
      }
      return true;
    });
    
    if (cardTransactions.length === 0) continue;
    
    // Group by invoice month
    const byInvoiceMonth = new Map<string, Transaction[]>();
    
    for (const tx of cardTransactions) {
      const invoiceMonth = tx.invoiceMonth || calculateInvoiceMonth(tx.date, closingDay);
      const existing = byInvoiceMonth.get(invoiceMonth) || [];
      existing.push(tx);
      byInvoiceMonth.set(invoiceMonth, existing);
    }
    
    // Find invoices whose due date falls in the target month
    for (const [invoiceMonth, transactions] of byInvoiceMonth) {
      const dueDate = calculateDueDate(invoiceMonth, closingDay, dueDay);
      const dueDateMonth = getLocalMonth(parseLocalDate(dueDate));
      
      if (dueDateMonth === targetMonth) {
        // Skip invoices that have been paid - they should not appear in the general statement
        if (isInvoicePaid(card.id, invoiceMonth, allTransactions)) {
          continue;
        }
        
        const total = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        
        if (total > 0) {
          invoices.push({
            id: `invoice-${card.id}-${invoiceMonth}`,
            cardId: card.id,
            cardName: card.name,
            invoiceMonth,
            dueDate,
            total,
            transactions,
            type: 'expense',
            isConsolidatedInvoice: true,
          });
        }
      }
    }
  }
  
  return invoices;
}

/**
 * Get transactions for the main statement view
 * - Excludes individual card transactions (they are consolidated into invoices)
 * - Includes card-to-card payment transactions as regular expenses (they belong to the payer card's statement)
 * - Excludes invoice payment markers (cash/debit) - they only mark the invoice as paid
 * - Includes consolidated invoices as single entries on their due dates
 */
export async function getStatementTransactions(
  targetMonth: string
): Promise<(Transaction | ConsolidatedInvoice)[]> {
  const allTransactions = await getAllTransactions();
  
  // Filter transactions for the main statement
  const nonCardTransactions = allTransactions.filter(tx => {
    // Exclude invoice payment markers (cash/debit payments that just mark invoice as paid)
    // These should not appear in the general statement - they only track that the invoice was paid
    if (tx.isInvoicePayment) {
      return false;
    }
    
    // Card-to-card payment transactions ARE regular card payments and will be included
    // in the consolidated invoice of the payer card. Don't include them separately here
    // to avoid duplication - they'll show up via the payer card's invoice.
    if (tx.isCardToCardPayment) {
      return false;
    }
    
    // Include if not a card payment (regular income/expense)
    if (!tx.isCardPayment) {
      // Check if transaction date is in target month
      const txMonth = getLocalMonth(parseLocalDate(tx.date));
      return txMonth === targetMonth;
    }
    return false;
  });
  
  // Get consolidated invoices for this month
  const invoices = await getConsolidatedInvoicesForMonth(targetMonth);
  
  // Combine and sort by date (due date for invoices, transaction date for others)
  const combined: (Transaction | ConsolidatedInvoice)[] = [
    ...nonCardTransactions,
    ...invoices,
  ];
  
  combined.sort((a, b) => {
    const dateA = 'dueDate' in a ? a.dueDate : a.date;
    const dateB = 'dueDate' in b ? b.dueDate : b.date;
    return dateB.localeCompare(dateA);
  });
  
  return combined;
}

/**
 * Calculate statement totals (excluding card transaction details, including invoice totals)
 * Invoice payment markers are excluded from totals as they are already represented
 * by the consolidated invoice entries
 */
export async function getStatementTotals(
  targetMonth: string
): Promise<{ income: number; expense: number }> {
  const items = await getStatementTransactions(targetMonth);
  
  let income = 0;
  let expense = 0;
  
  for (const item of items) {
    if ('isConsolidatedInvoice' in item && item.isConsolidatedInvoice) {
      // Consolidated invoice
      expense += item.total;
    } else {
      // Regular transaction
      const tx = item as Transaction;
      if (tx.type === 'income') {
        income += Math.abs(tx.amount);
      } else {
        expense += Math.abs(tx.amount);
      }
    }
  }
  
  return { income, expense };
}
