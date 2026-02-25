/**
 * Data Integrity Service
 * 
 * Centralizes recalculation of balances across the system:
 * - Credit card limits
 * - Statement totals
 * - Investment balances
 * 
 * Ensures any change (edit/delete) in transactions is reflected
 * consistently across all views and calculations.
 */

import { defaultAdapter } from './storageAdapter';
import { 
  Transaction, 
  CreditCard, 
  getCreditCards, 
  getAllTransactions,
  listTransactionObjects,
  updateCreditCard,
} from './storage';
import { generateAutoCardPayments } from './autoCardPay';

const ORIGINAL_LIMITS_KEY = 'original_card_limits';

/**
 * Store original card limits (set when card is created)
 * This is needed to recalculate available limits from scratch
 */
export async function storeOriginalCardLimit(cardId: string, limit: number): Promise<void> {
  const limits = await defaultAdapter.getItem<Record<string, number>>(ORIGINAL_LIMITS_KEY, {}) ?? {};
  limits[cardId] = limit;
  await defaultAdapter.setItem(ORIGINAL_LIMITS_KEY, limits);
}

/**
 * Get original card limit
 */
export async function getOriginalCardLimit(cardId: string): Promise<number | null> {
  const limits = await defaultAdapter.getItem<Record<string, number>>(ORIGINAL_LIMITS_KEY, {}) ?? {};
  return limits[cardId] ?? null;
}

/**
 * Remove stored original limit when card is deleted
 */
export async function removeOriginalCardLimit(cardId: string): Promise<void> {
  const limits = await defaultAdapter.getItem<Record<string, number>>(ORIGINAL_LIMITS_KEY, {}) ?? {};
  delete limits[cardId];
  await defaultAdapter.setItem(ORIGINAL_LIMITS_KEY, limits);
}

/**
 * Recalculate a card's available limit from scratch
 * 
 * Available Limit = Original Limit - Sum of all unpaid card expenses
 * 
 * An expense is "unpaid" if there's no invoice payment for its invoice month
 */
export async function recalculateCardLimit(cardId: string): Promise<number> {
  const [card, allTransactions] = await Promise.all([
    getCreditCards().then(cards => cards.find(c => c.id === cardId)),
    getAllTransactions(),
  ]);
  
  if (!card) return 0;
  
  // Get original limit (or use current as fallback for backwards compatibility)
  let originalLimit = await getOriginalCardLimit(cardId);
  if (originalLimit === null) {
    // Backwards compatibility: calculate original from current limit + consumed
    const consumed = allTransactions
      .filter(tx => tx.cardId === cardId && tx.isCardPayment && tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    const restored = allTransactions
      .filter(tx => tx.isInvoicePayment && tx.paidInvoiceCardId === cardId)
      .reduce((sum, tx) => {
        // Find all transactions for the paid invoice month and sum them
        const paidMonth = tx.paidInvoiceMonth;
        const monthExpenses = allTransactions
          .filter(t => t.cardId === cardId && t.isCardPayment && t.invoiceMonth === paidMonth)
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return sum + monthExpenses;
      }, 0);
    
    originalLimit = (card.limit ?? 0) + consumed - restored;
    await storeOriginalCardLimit(cardId, originalLimit);
  }
  
  // Calculate total unpaid expenses
  // Group expenses by invoice month, then check which months are paid
  const paidMonths = new Set(
    allTransactions
      .filter(tx => tx.isInvoicePayment && tx.paidInvoiceCardId === cardId)
      .map(tx => tx.paidInvoiceMonth)
  );
  
  const unpaidExpenses = allTransactions
    .filter(tx => {
      if (tx.cardId !== cardId || !tx.isCardPayment || tx.type !== 'expense') return false;
      // Check if this invoice month is paid
      const invoiceMonth = tx.invoiceMonth;
      return invoiceMonth ? !paidMonths.has(invoiceMonth) : true;
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  
  const availableLimit = Math.max(0, originalLimit - unpaidExpenses);
  
  // Update card with new limit
  if (card.limit !== availableLimit) {
    await updateCreditCard({ ...card, limit: availableLimit });
  }
  
  return availableLimit;
}

/**
 * Recalculate limits for all cards
 */
export async function recalculateAllCardLimits(): Promise<void> {
  const cards = await getCreditCards();
  
  for (const card of cards) {
    await recalculateCardLimit(card.id);
  }
}

/**
 * Sync data after a transaction is modified or deleted
 * 
 * This should be called after ANY transaction change to ensure
 * all related data is consistent:
 * - Card limits are recalculated
 * - Auto-payments are regenerated
 */
export async function syncAfterTransactionChange(
  affectedCardIds?: string[]
): Promise<void> {
  // Recalculate affected card limits
  if (affectedCardIds && affectedCardIds.length > 0) {
    for (const cardId of affectedCardIds) {
      await recalculateCardLimit(cardId);
    }
  } else {
    // If no specific cards, recalculate all
    await recalculateAllCardLimits();
  }
  
  // Regenerate auto-payments to ensure they reflect current state
  await generateAutoCardPayments();
}

/**
 * Validate data integrity across the system
 * 
 * Returns a report of any inconsistencies found
 */
export async function validateDataIntegrity(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  const [cards, transactions] = await Promise.all([
    getCreditCards(),
    getAllTransactions(),
  ]);
  
  // Check 1: Card limits should match calculated values
  for (const card of cards) {
    const originalLimit = await getOriginalCardLimit(card.id);
    if (originalLimit !== null) {
      const paidMonths = new Set(
        transactions
          .filter(tx => tx.isInvoicePayment && tx.paidInvoiceCardId === card.id)
          .map(tx => tx.paidInvoiceMonth)
      );
      
      const unpaidExpenses = transactions
        .filter(tx => {
          if (tx.cardId !== card.id || !tx.isCardPayment || tx.type !== 'expense') return false;
          const invoiceMonth = tx.invoiceMonth;
          return invoiceMonth ? !paidMonths.has(invoiceMonth) : true;
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      const expectedLimit = Math.max(0, originalLimit - unpaidExpenses);
      
      if (card.limit !== undefined && Math.abs((card.limit || 0) - expectedLimit) > 0.01) {
        issues.push(
          `Cartão ${card.name}: limite atual ${card.limit?.toFixed(2)} deveria ser ${expectedLimit.toFixed(2)}`
        );
      }
    }
  }
  
  // Check 2: All card transactions should have invoiceMonth set
  const cardTxsWithoutMonth = transactions.filter(
    tx => tx.isCardPayment && !tx.invoiceMonth
  );
  
  if (cardTxsWithoutMonth.length > 0) {
    issues.push(
      `${cardTxsWithoutMonth.length} transações de cartão sem mês de fatura definido`
    );
  }
  
  // Check 3: Orphaned transactions (referencing non-existent cards)
  const cardIds = new Set(cards.map(c => c.id));
  const orphanedTxs = transactions.filter(
    tx => tx.cardId && !cardIds.has(tx.cardId)
  );
  
  if (orphanedTxs.length > 0) {
    issues.push(
      `${orphanedTxs.length} transações referenciando cartões inexistentes`
    );
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Fix common data integrity issues
 */
export async function fixDataIntegrity(): Promise<number> {
  let fixedCount = 0;
  
  // Fix 1: Recalculate all card limits
  await recalculateAllCardLimits();
  fixedCount++;
  
  // Fix 2: Regenerate auto-payments
  await generateAutoCardPayments();
  fixedCount++;
  
  return fixedCount;
}
