import { defaultAdapter, StorageAdapter } from './storageAdapter';
import { migrateSchemaOnce } from './migrations/migrateSchema';
import { getMonthFromDate, getInvoiceMonth, getLocalDateString } from './dateUtils';

export type Maybe<T> = T | undefined;

export interface Transaction {
  id: string;
  amount: number;
  date: string; 
  description?: string;
  category?: string;
  type: 'income' | 'expense';
  isCardPayment?: boolean;
  cardId?: string;
  installments?: number;
  currentInstallment?: number;
  parentId?: string;
  createdAt?: string;
  invoiceMonth?: string;
  isRecurring?: boolean;
  recurrenceType?: 'weekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string;
  recurrenceId?: string; // Groups all recurring instances
  // For card-to-card payments (paying one card with another)
  isCardToCardPayment?: boolean;
  sourceCardId?: string; // The card being used to pay
  targetCardId?: string; // The card being paid off
  // Invoice payment tracking
  isInvoicePayment?: boolean; // Marks transactions that are invoice payments
  paidInvoiceCardId?: string; // The card whose invoice was paid
  paidInvoiceMonth?: string; // The month of the paid invoice
}

export interface CreditCard {
  id: string;
  name: string;
  last4?: string;
  limit?: number;
  color?: string;
  closingDay?: number; 
  dueDay?: number;
  canPayOtherCards?: boolean; // If this card can be used to pay other cards' invoices
  defaultPayerCardId?: string; // Which card pays this card's invoice by default
  isDefault?: boolean; // Only one card can be default at a time
}

export interface AppSettings {
  theme: 'light' | 'dark';
  currency: string;
  currencySymbol: string;
  locale?: string;
  balanceYieldEnabled?: boolean;
  balanceYieldRate?: number; // % a.a.
  balanceYieldTaxMode?: 'daily' | 'on_withdrawal';
  balanceExtraYieldEnabled?: boolean;
  balanceExtraYieldPercent?: number; // % adicional
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  type: 'expense' | 'income';
  color: string;
}

const TRANSACTIONS_KEY = 'transactions';
const CARDS_KEY = 'creditCards';
const SETTINGS_KEY = 'app_settings';
const CUSTOM_CATEGORIES_KEY = 'custom_categories';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  currency: 'BRL',
  currencySymbol: 'R$',
};

const categories = [
  { id: 'income', name: 'Receita', icon: 'TrendingUp', type: 'income', color: 'hsl(152, 55%, 50%)' },
  { id: 'food', name: 'Alimentação', icon: 'UtensilsCrossed', type: 'expense', color: 'hsl(38, 90%, 55%)' },
  { id: 'transport', name: 'Transporte', icon: 'Car', type: 'expense', color: 'hsl(200, 75%, 55%)' },
  { id: 'housing', name: 'Moradia', icon: 'Home', type: 'expense', color: 'hsl(280, 60%, 65%)' },
  { id: 'health', name: 'Saúde', icon: 'Heart', type: 'expense', color: 'hsl(0, 65%, 55%)' },
  { id: 'education', name: 'Educação', icon: 'GraduationCap', type: 'expense', color: 'hsl(45, 80%, 55%)' },
  { id: 'leisure', name: 'Lazer', icon: 'Gamepad2', type: 'expense', color: 'hsl(320, 60%, 55%)' },
  { id: 'other', name: 'Outros', icon: 'MoreHorizontal', type: 'expense', color: 'hsl(180, 55%, 50%)' },
];

export function getCategories() {
  return categories;
}

export async function getAllCategories(): Promise<typeof categories> {
  const custom = await getCustomCategories();
  return [...categories, ...custom];
}

export function getCategoryById(id: string) {
  return categories.find(c => c.id === id) || categories.find(c => c.id === 'other');
}

export async function getCategoryByIdAsync(id: string) {
  const all = await getAllCategories();
  return all.find(c => c.id === id) || categories.find(c => c.id === 'other');
}

// Custom Categories
export async function getCustomCategories(): Promise<CustomCategory[]> {
  return (await defaultAdapter.getItem<CustomCategory[]>(CUSTOM_CATEGORIES_KEY, [])) ?? [];
}

export async function addCustomCategory(cat: CustomCategory): Promise<void> {
  const custom = await getCustomCategories();
  custom.push(cat);
  await defaultAdapter.setItem(CUSTOM_CATEGORIES_KEY, custom);
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const custom = await getCustomCategories();
  const filtered = custom.filter(c => c.id !== id);
  await defaultAdapter.setItem(CUSTOM_CATEGORIES_KEY, filtered);
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  const settings = await defaultAdapter.getItem<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  return settings ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await defaultAdapter.setItem(SETTINGS_KEY, settings);
}

// Credit Cards
export async function getCreditCards(): Promise<CreditCard[]> {
  return (await defaultAdapter.getItem<CreditCard[]>(CARDS_KEY, [])) ?? [];
}

export async function getCreditCardById(id: string): Promise<CreditCard | undefined> {
  const cards = await getCreditCards();
  return cards.find(c => c.id === id);
}

export async function addCreditCard(card: CreditCard): Promise<void> {
  const cards = await getCreditCards();
  // If new card is default, unmark all others
  if (card.isDefault) {
    cards.forEach(c => c.isDefault = false);
  }
  cards.push(card);
  await defaultAdapter.setItem(CARDS_KEY, cards);
}

export async function getDefaultCreditCard(): Promise<CreditCard | undefined> {
  const cards = await getCreditCards();
  return cards.find(c => c.isDefault === true);
}

export async function updateCreditCard(card: CreditCard): Promise<void> {
  const cards = await getCreditCards();
  // If this card is being set as default, unmark all others
  if (card.isDefault) {
    cards.forEach(c => c.isDefault = false);
  }
  const index = cards.findIndex(c => c.id === card.id);
  if (index !== -1) {
    cards[index] = card;
    await defaultAdapter.setItem(CARDS_KEY, cards);
  }
}

export async function deleteCreditCard(id: string): Promise<void> {
  const cards = await getCreditCards();
  const filtered = cards.filter(c => c.id !== id);
  await defaultAdapter.setItem(CARDS_KEY, filtered);
}

export async function getCardPurchases(cardId: string, month?: string): Promise<Transaction[]> {
  const txs = Object.values(await listTransactionObjects());
  
  return txs.filter(tx => {
    if (tx.cardId !== cardId || !tx.isCardPayment) return false;
    
    if (month && tx.invoiceMonth) {
      return tx.invoiceMonth === month;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getCardMonthlyTotal(cardId: string, month: string): Promise<number> {
  // getCardPurchases already filters out future card-to-card payments
  const purchases = await getCardPurchases(cardId, month);
  return purchases.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

// Transactions
export async function listTransactionObjects(): Promise<Record<string, Transaction>> {
  return (await defaultAdapter.getItem<Record<string, Transaction>>(TRANSACTIONS_KEY, {})) ?? {};
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const txs = Object.values(await listTransactionObjects());
  return txs.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTransactionsByMonth(month: string): Promise<Transaction[]> {
  const txs = Object.values(await listTransactionObjects());
  return txs
    .filter(tx => {
      if (tx.isCardPayment && tx.invoiceMonth) {
        return tx.invoiceMonth === month;
      }
      return getMonthFromDate(tx.date) === month;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTransactionById(id: string): Promise<Transaction | undefined> {
  const txs = await listTransactionObjects();
  return txs[id];
}

export async function saveTransaction(tx: Transaction): Promise<void> {
  const txs = await listTransactionObjects();
  tx.createdAt = tx.createdAt ?? new Date().toISOString();
  txs[tx.id] = tx;
  await defaultAdapter.setItem(TRANSACTIONS_KEY, txs);
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const txs = await listTransactionObjects();
  for (const tx of transactions) {
    tx.createdAt = tx.createdAt ?? new Date().toISOString();
    txs[tx.id] = tx;
  }
  await defaultAdapter.setItem(TRANSACTIONS_KEY, txs);
}

export async function updateTransaction(tx: Transaction): Promise<void> {
  await saveTransaction(tx);
}

export async function deleteTransaction(id: string): Promise<void> {
  const txs = await listTransactionObjects();
  delete txs[id];
  await defaultAdapter.setItem(TRANSACTIONS_KEY, txs);
}

export async function deleteTransactionsByParentId(parentId: string): Promise<void> {
  const txs = await listTransactionObjects();
  // Delete the parent and all children
  const idsToDelete = Object.values(txs)
    .filter(tx => tx.id === parentId || tx.parentId === parentId)
    .map(tx => tx.id);
  
  for (const id of idsToDelete) {
    delete txs[id];
  }
  await defaultAdapter.setItem(TRANSACTIONS_KEY, txs);
}

export async function deleteTransactionsFromDate(
  parentIdOrRecurrenceId: string, 
  fromDate: string,
  isRecurrence: boolean = false
): Promise<void> {
  const txs = await listTransactionObjects();
  const idsToDelete: string[] = [];
  
  for (const tx of Object.values(txs)) {
    const matches = isRecurrence 
      ? tx.recurrenceId === parentIdOrRecurrenceId
      : (tx.id === parentIdOrRecurrenceId || tx.parentId === parentIdOrRecurrenceId);
    
    if (matches && tx.date >= fromDate) {
      idsToDelete.push(tx.id);
    }
  }
  
  for (const id of idsToDelete) {
    delete txs[id];
  }
  await defaultAdapter.setItem(TRANSACTIONS_KEY, txs);
}

export async function deleteTransactionsByRecurrenceId(recurrenceId: string): Promise<void> {
  const txs = await listTransactionObjects();
  const idsToDelete = Object.values(txs)
    .filter(tx => tx.recurrenceId === recurrenceId)
    .map(tx => tx.id);
  
  for (const id of idsToDelete) {
    delete txs[id];
  }
  await defaultAdapter.setItem(TRANSACTIONS_KEY, txs);
}

// Monthly Totals
export async function getMonthlyTotals(month: string): Promise<{ income: number; expense: number }> {
  const txs = await getTransactionsByMonth(month);
  let income = 0;
  let expense = 0;
  
  for (const tx of txs) {
    if (tx.type === 'income') {
      income += Math.abs(tx.amount);
    } else {
      expense += Math.abs(tx.amount);
    }
  }
  
  return { income, expense };
}

export async function getCategoryTotals(month: string): Promise<Record<string, number>> {
  const txs = await getTransactionsByMonth(month);
  const totals: Record<string, number> = {};
  
  for (const tx of txs) {
    if (tx.type === 'expense' && tx.category) {
      totals[tx.category] = (totals[tx.category] || 0) + Math.abs(tx.amount);
    }
  }
  
  return totals;
}

// Get all months that have transactions
export async function getMonthsWithTransactions(): Promise<string[]> {
  const txs = Object.values(await listTransactionObjects());
  const months = new Set<string>();
  
  for (const tx of txs) {
    if (tx.isCardPayment && tx.invoiceMonth) {
      months.add(tx.invoiceMonth);
    }
    months.add(getMonthFromDate(tx.date));
  }
  
  return Array.from(months).sort();
}

// Keys for investments (used in export/import)
const INVESTMENTS_KEY = 'investments';
const DEFAULT_YIELD_KEY = 'default_yield_rate';
const YIELD_HISTORY_KEY = 'yield_history';
const LAST_YIELD_PROCESS_KEY = 'last_yield_process_date';
const PAYMENT_STATUS_KEY = 'payment_status';
const COVERAGE_RECORDS_KEY = 'investment_coverage_records';
const PENDING_TRANSFER_KEY = 'pending_balance_transfer';
const TRANSFER_HISTORY_KEY = 'balance_transfer_history';
const ORIGINAL_LIMITS_KEY = 'original_card_limits';

// Export/Import
export async function exportAllData(includeInvestments: boolean = true): Promise<string> {
  const [transactions, cards, settings, securityConfig, customCategories, paymentStatus, coverageRecords, pendingTransfer, transferHistory, originalLimits] = await Promise.all([
    listTransactionObjects(),
    getCreditCards(),
    getSettings(),
    defaultAdapter.getItem<{ passwordHash?: string } | null>('app_password', null),
    getCustomCategories(),
    defaultAdapter.getItem(PAYMENT_STATUS_KEY, {}),
    defaultAdapter.getItem(COVERAGE_RECORDS_KEY, []),
    defaultAdapter.getItem(PENDING_TRANSFER_KEY, null),
    defaultAdapter.getItem(TRANSFER_HISTORY_KEY, []),
    defaultAdapter.getItem(ORIGINAL_LIMITS_KEY, null),
  ]);
  
  const data: Record<string, unknown> = {
    version: 3,
    exportedAt: new Date().toISOString(),
    transactions,
    creditCards: cards,
    settings,
    includesInvestments: includeInvestments,
    passwordHash: securityConfig?.passwordHash || null,
    customCategories,
    paymentStatus,
    coverageRecords,
    pendingTransfer,
    transferHistory,
    originalLimits,
  };
  
  if (includeInvestments) {
    const [investments, yieldHistory, defaultYieldRate, lastYieldProcess] = await Promise.all([
      defaultAdapter.getItem(INVESTMENTS_KEY, {}),
      defaultAdapter.getItem(YIELD_HISTORY_KEY, []),
      defaultAdapter.getItem(DEFAULT_YIELD_KEY, 6.5),
      defaultAdapter.getItem(LAST_YIELD_PROCESS_KEY, null),
    ]);
    
    data.investments = investments;
    data.yieldHistory = yieldHistory;
    data.defaultYieldRate = defaultYieldRate;
    data.lastYieldProcessDate = lastYieldProcess;
  }
  
  return JSON.stringify(data, null, 2);
}

export async function importAllData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  
  if (data.transactions) {
    await defaultAdapter.setItem(TRANSACTIONS_KEY, data.transactions);
  }
  if (data.creditCards) {
    await defaultAdapter.setItem(CARDS_KEY, data.creditCards);
  }
  if (data.settings) {
    await defaultAdapter.setItem(SETTINGS_KEY, data.settings);
  }
  if (data.customCategories) {
    await defaultAdapter.setItem(CUSTOM_CATEGORIES_KEY, data.customCategories);
  }
  
  // Import investments if present in backup
  if (data.investments !== undefined) {
    await defaultAdapter.setItem(INVESTMENTS_KEY, data.investments);
  }
  if (data.yieldHistory !== undefined) {
    await defaultAdapter.setItem(YIELD_HISTORY_KEY, data.yieldHistory);
  }
  if (data.defaultYieldRate !== undefined) {
    await defaultAdapter.setItem(DEFAULT_YIELD_KEY, data.defaultYieldRate);
  }
  if (data.lastYieldProcessDate !== undefined) {
    await defaultAdapter.setItem(LAST_YIELD_PROCESS_KEY, data.lastYieldProcessDate);
  }
  
  // Import additional app state
  if (data.paymentStatus !== undefined) {
    await defaultAdapter.setItem(PAYMENT_STATUS_KEY, data.paymentStatus);
  }
  if (data.coverageRecords !== undefined) {
    await defaultAdapter.setItem(COVERAGE_RECORDS_KEY, data.coverageRecords);
  }
  if (data.pendingTransfer !== undefined) {
    await defaultAdapter.setItem(PENDING_TRANSFER_KEY, data.pendingTransfer);
  }
  if (data.transferHistory !== undefined) {
    await defaultAdapter.setItem(TRANSFER_HISTORY_KEY, data.transferHistory);
  }
  if (data.originalLimits !== undefined) {
    await defaultAdapter.setItem(ORIGINAL_LIMITS_KEY, data.originalLimits);
  }
}

// Clear all data
export async function clearAllData(): Promise<void> {
  await defaultAdapter.clear();
}

export default {
  getCreditCards,
  getCreditCardById,
  getDefaultCreditCard,
  addCreditCard,
  updateCreditCard,
  deleteCreditCard,
  saveTransaction,
  saveTransactions,
  getTransactionsByMonth,
  getAllTransactions,
  listTransactionObjects,
  deleteTransaction,
  deleteTransactionsByParentId,
  getMonthlyTotals,
  getCategoryTotals,
  getSettings,
  saveSettings,
  exportAllData,
  importAllData,
};
