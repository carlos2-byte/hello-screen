/**
 * Auto Card Payment Logic
 * 
 * Handles the automatic creation of expense transactions when a card is configured
 * to be paid by another card (defaultPayerCardId).
 * 
 * Rule: On the due date of the paid card, the invoice total is recorded as
 * a NORMAL expense on the payer card (not as a new invoice).
 */

import {
  Transaction,
  CreditCard,
  getCreditCards,
  getCreditCardById,
  getAllTransactions,
  saveTransaction,
  updateCreditCard,
} from './storage';
import {
  getLocalMonth,
  parseLocalDate,
  getInvoiceDueDate,
} from './dateUtils';
import { calculateInvoiceMonth, calculateDueDate } from './invoiceUtils';
import { generateId } from './formatters';

/**
 * Check if an auto-payment transaction already exists for a specific card/month combination
 */
function autoPaymentExists(
  transactions: Transaction[],
  targetCardId: string,
  invoiceMonth: string
): boolean {
  return transactions.some(tx =>
    tx.isCardToCardPayment &&
    tx.targetCardId === targetCardId &&
    tx.paidInvoiceMonth === invoiceMonth
  );
}

/**
 * Get the total of an invoice for a specific card and month
 */
function getInvoiceTotal(
  transactions: Transaction[],
  cardId: string,
  invoiceMonth: string
): number {
  return transactions
    .filter(tx =>
      tx.isCardPayment &&
      tx.cardId === cardId &&
      tx.invoiceMonth === invoiceMonth &&
      tx.type === 'expense' &&
      !tx.isCardToCardPayment
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

/**
 * Generate auto-payment transactions for cards configured with defaultPayerCardId.
 * 
 * This should be called when:
 * 1. A card is configured with defaultPayerCardId
 * 2. A transaction is added to a card with defaultPayerCardId
 * 3. The app loads (to catch any missed auto-payments)
 * 
 * The function:
 * - Finds all cards with defaultPayerCardId set
 * - For each invoice month with purchases, creates an expense in the payer card
 * - The expense date is the due date of the paid card's invoice
 * - Consumes limit from the payer card
 */
export async function generateAutoCardPayments(): Promise<void> {
  const cards = await getCreditCards();
  const allTransactions = await getAllTransactions();

  // Find cards that are configured to be paid by another card
  const paidCards = cards.filter(c => c.defaultPayerCardId);

  for (const paidCard of paidCards) {
    const payerCard = await getCreditCardById(paidCard.defaultPayerCardId!);
    if (!payerCard) continue;

    const paidClosingDay = paidCard.closingDay || 25;
    const paidDueDay = paidCard.dueDay || 5;
    const payerClosingDay = payerCard.closingDay || 25;

    // Get all card purchases for the paid card
    const paidCardPurchases = allTransactions.filter(tx =>
      tx.isCardPayment &&
      tx.cardId === paidCard.id &&
      tx.type === 'expense' &&
      !tx.isCardToCardPayment
    );

    // Group by invoice month
    const invoiceMonths = new Set<string>();
    for (const tx of paidCardPurchases) {
      const invoiceMonth = tx.invoiceMonth || calculateInvoiceMonth(tx.date, paidClosingDay);
      invoiceMonths.add(invoiceMonth);
    }

    // For each invoice month, check if we need to create an auto-payment
    for (const invoiceMonth of invoiceMonths) {
      // Skip if auto-payment already exists
      if (autoPaymentExists(allTransactions, paidCard.id, invoiceMonth)) {
        continue;
      }

      // Calculate the invoice total
      const invoiceTotal = getInvoiceTotal(allTransactions, paidCard.id, invoiceMonth);
      if (invoiceTotal <= 0) continue;

      // Calculate the due date for this invoice
      const dueDate = getInvoiceDueDate(invoiceMonth, paidClosingDay, paidDueDay);

      // Calculate which invoice month this expense belongs to on the payer card
      const payerInvoiceMonth = calculateInvoiceMonth(dueDate, payerClosingDay);

      // Create the expense transaction on the payer card
      const autoPaymentTx: Transaction = {
        id: generateId(),
        amount: -Math.abs(invoiceTotal),
        date: dueDate,
        description: `Pagamento da fatura do cartão ${paidCard.name}`,
        category: 'other',
        type: 'expense',
        isCardPayment: true,
        cardId: payerCard.id,
        invoiceMonth: payerInvoiceMonth,
        isCardToCardPayment: true,
        sourceCardId: payerCard.id,
        targetCardId: paidCard.id,
        paidInvoiceMonth: invoiceMonth,
      };

      await saveTransaction(autoPaymentTx);

      // Update payer card limit (consume limit)
      if (typeof payerCard.limit === 'number') {
        const newLimit = payerCard.limit - Math.abs(invoiceTotal);
        await updateCreditCard({ ...payerCard, limit: newLimit });
        // Update local reference for subsequent iterations
        payerCard.limit = newLimit;
      }

      // Mark the paid card's invoice as paid (restore its limit)
      if (typeof paidCard.limit === 'number') {
        const newLimit = paidCard.limit + Math.abs(invoiceTotal);
        await updateCreditCard({ ...paidCard, limit: newLimit });
        // Update local reference
        paidCard.limit = newLimit;
      }

      // Add to allTransactions to prevent duplicate creation in this run
      allTransactions.push(autoPaymentTx);
    }
  }
}

/**
 * Recalculate auto-payments for a specific card when its transactions change.
 * This is called when:
 * - A transaction is added/edited/deleted from a card with defaultPayerCardId
 * - The card's defaultPayerCardId setting changes
 */
export async function recalculateAutoPaymentsForCard(cardId: string): Promise<void> {
  const card = await getCreditCardById(cardId);
  if (!card?.defaultPayerCardId) return;

  // For now, just run the full generation which handles duplicates
  await generateAutoCardPayments();
}
