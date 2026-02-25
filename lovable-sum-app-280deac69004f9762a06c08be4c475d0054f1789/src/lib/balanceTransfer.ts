/**
 * Balance Transfer Logic
 * 
 * Rules:
 * 1. When a month closes with NEGATIVE balance:
 *    - Covered automatically by the authorized investment (existing logic)
 * 
 * 2. When a month closes with POSITIVE balance:
 *    - NOT transferred immediately to investment
 *    - Kept as income balance until the first income of the next month
 * 
 * 3. Automatic transfer in the following month:
 *    - On the date of the first income of the new month, the accumulated positive
 *      balance from the previous month is transferred to the authorized investment
 */

import { defaultAdapter } from './storageAdapter';
import { getLocalDateString, getLocalMonth, getPreviousMonthLocal } from './dateUtils';
import { 
  getInvestmentsForCoverage, 
  addToInvestment 
} from './investments';
import { 
  getTransactionsByMonth, 
  saveTransaction, 
  Transaction,
  getMonthlyTotals
} from './storage';
import { generateId } from './formatters';

const PENDING_TRANSFER_KEY = 'pending_balance_transfer';
const TRANSFER_HISTORY_KEY = 'balance_transfer_history';

export interface PendingTransfer {
  month: string; // YYYY-MM - the month that had the positive balance
  amount: number; // The positive balance amount
  recordedAt: string; // ISO date when this was recorded
  status: 'pending' | 'transferred';
}

export interface TransferHistory {
  id: string;
  fromMonth: string; // Month that had the positive balance
  amount: number;
  investmentId: string;
  investmentName: string;
  transferDate: string; // Date when transfer happened
  triggeredByTransactionId: string; // The first income transaction that triggered transfer
  createdAt: string;
}

/**
 * Get pending balance transfer (if any)
 */
export async function getPendingTransfer(): Promise<PendingTransfer | null> {
  return await defaultAdapter.getItem<PendingTransfer>(PENDING_TRANSFER_KEY, null);
}

/**
 * Save pending balance transfer
 */
export async function savePendingTransfer(transfer: PendingTransfer | null): Promise<void> {
  if (transfer) {
    await defaultAdapter.setItem(PENDING_TRANSFER_KEY, transfer);
  } else {
    await defaultAdapter.removeItem(PENDING_TRANSFER_KEY);
  }
}

/**
 * Get transfer history
 */
export async function getTransferHistory(): Promise<TransferHistory[]> {
  return (await defaultAdapter.getItem<TransferHistory[]>(TRANSFER_HISTORY_KEY, [])) ?? [];
}

/**
 * Save transfer to history
 */
async function saveTransferToHistory(transfer: TransferHistory): Promise<void> {
  const history = await getTransferHistory();
  history.push(transfer);
  await defaultAdapter.setItem(TRANSFER_HISTORY_KEY, history);
}

/**
 * Check and record month-end balance for potential transfer
 * Called when navigating between months or at month end
 */
export async function checkAndRecordMonthEndBalance(month: string): Promise<void> {
  const currentMonth = getLocalMonth();
  
  // Only process if we're checking a past month (the month has ended)
  if (month >= currentMonth) {
    return;
  }
  
  // Check if we already have a pending transfer for this or a later month
  const pendingTransfer = await getPendingTransfer();
  if (pendingTransfer && pendingTransfer.month >= month) {
    // Already processed this month or a later one
    return;
  }
  
  // Calculate balance for the month
  const totals = await getMonthlyTotals(month);
  const balance = totals.income - totals.expense;
  
  // Only record if positive balance
  if (balance > 0) {
    // Check if there's an authorized investment available
    const coverageInvestments = await getInvestmentsForCoverage();
    if (coverageInvestments.length > 0) {
      await savePendingTransfer({
        month,
        amount: balance,
        recordedAt: new Date().toISOString(),
        status: 'pending',
      });
    }
  }
}

/**
 * Check if this is the first income of the current month
 * If so, process the pending transfer from previous month
 */
export async function processIncomeTransfer(
  newIncomeTransaction: Transaction
): Promise<{ 
  transferred: boolean; 
  amount?: number; 
  investmentName?: string;
} | null> {
  // Only process income transactions
  if (newIncomeTransaction.type !== 'income') {
    return null;
  }
  
  const transactionMonth = getLocalMonth(new Date(newIncomeTransaction.date));
  
  // Check if there's a pending transfer from the previous month
  const pendingTransfer = await getPendingTransfer();
  if (!pendingTransfer || pendingTransfer.status !== 'pending') {
    return null;
  }
  
  // The pending transfer should be from the previous month
  const expectedMonth = getPreviousMonthLocal(transactionMonth);
  if (pendingTransfer.month !== expectedMonth) {
    // If the pending transfer is from an older month, still process it
    // (catches edge case where user skips a month)
    if (pendingTransfer.month >= transactionMonth) {
      return null;
    }
  }
  
  // Check if this is the first income of this month
  const monthTransactions = await getTransactionsByMonth(transactionMonth);
  const existingIncomes = monthTransactions.filter(tx => 
    tx.type === 'income' && 
    tx.id !== newIncomeTransaction.id &&
    // Exclude auto-generated coverage transactions
    !tx.description?.includes('Cobertura automática') &&
    !tx.description?.includes('Transferência automática')
  );
  
  // If there are already income transactions (other than this one), don't transfer
  if (existingIncomes.length > 0) {
    return null;
  }
  
  // Get the first available coverage investment
  const coverageInvestments = await getInvestmentsForCoverage();
  if (coverageInvestments.length === 0) {
    // No investment to transfer to, clear the pending transfer
    await savePendingTransfer(null);
    return null;
  }
  
  const targetInvestment = coverageInvestments[0];
  const transferAmount = pendingTransfer.amount;
  
  // Add to investment
  await addToInvestment(targetInvestment.id, transferAmount);
  
  // Create expense transaction for the transfer (debit from income balance)
  const transferTransaction: Transaction = {
    id: generateId(),
    amount: -transferAmount, // Negative because it's leaving the income balance
    description: `Transferência automática: ${targetInvestment.name}`,
    type: 'expense',
    category: 'other',
    date: getLocalDateString(),
    createdAt: new Date().toISOString(),
  };
  
  await saveTransaction(transferTransaction);
  
  // Record in history
  await saveTransferToHistory({
    id: generateId(),
    fromMonth: pendingTransfer.month,
    amount: transferAmount,
    investmentId: targetInvestment.id,
    investmentName: targetInvestment.name,
    transferDate: getLocalDateString(),
    triggeredByTransactionId: newIncomeTransaction.id,
    createdAt: new Date().toISOString(),
  });
  
  // Clear pending transfer
  await savePendingTransfer(null);
  
  return {
    transferred: true,
    amount: transferAmount,
    investmentName: targetInvestment.name,
  };
}

/**
 * Calculate the actual carry-over balance for display
 * This is the positive balance from the previous month that hasn't been transferred yet
 */
export async function getPendingCarryOverBalance(currentMonth: string): Promise<number> {
  const pendingTransfer = await getPendingTransfer();
  if (!pendingTransfer || pendingTransfer.status !== 'pending') {
    return 0;
  }
  
  const previousMonth = getPreviousMonthLocal(currentMonth);
  
  // Only show if the pending transfer is from the previous month or older
  if (pendingTransfer.month > previousMonth) {
    return 0;
  }
  
  return pendingTransfer.amount;
}

/**
 * Initialize month-end balance check for the previous month
 * Should be called when the app loads or when navigating to a new month
 */
export async function initializeMonthEndCheck(): Promise<void> {
  const currentMonth = getLocalMonth();
  const previousMonth = getPreviousMonthLocal(currentMonth);
  
  // Check and record the previous month's balance
  await checkAndRecordMonthEndBalance(previousMonth);
}
