import { defaultAdapter } from './storageAdapter';

export interface SalaryAccount {
  id: string;
  name: string;
  balance: number;
  payDay: number; // Day of month salary is deposited
  canReceiveTransfers: boolean;
}

const SALARY_ACCOUNTS_KEY = 'salary_accounts';
const SALARY_INCOME_KEY = 'salary_income_entries';

export interface SalaryIncomeEntry {
  id: string;
  accountId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  month: string; // YYYY-MM
}

// CRUD for salary accounts
export async function getSalaryAccounts(): Promise<SalaryAccount[]> {
  return (await defaultAdapter.getItem<SalaryAccount[]>(SALARY_ACCOUNTS_KEY, [])) ?? [];
}

export async function getSalaryAccountById(id: string): Promise<SalaryAccount | undefined> {
  const accounts = await getSalaryAccounts();
  return accounts.find(a => a.id === id);
}

export async function addSalaryAccount(account: SalaryAccount): Promise<void> {
  const accounts = await getSalaryAccounts();
  accounts.push(account);
  await defaultAdapter.setItem(SALARY_ACCOUNTS_KEY, accounts);
}

export async function updateSalaryAccount(account: SalaryAccount): Promise<void> {
  const accounts = await getSalaryAccounts();
  const index = accounts.findIndex(a => a.id === account.id);
  if (index !== -1) {
    accounts[index] = account;
    await defaultAdapter.setItem(SALARY_ACCOUNTS_KEY, accounts);
  }
}

export async function deleteSalaryAccount(id: string): Promise<void> {
  const accounts = await getSalaryAccounts();
  await defaultAdapter.setItem(SALARY_ACCOUNTS_KEY, accounts.filter(a => a.id !== id));
}

// Income entries for salary accounts
export async function getSalaryIncomeEntries(): Promise<SalaryIncomeEntry[]> {
  return (await defaultAdapter.getItem<SalaryIncomeEntry[]>(SALARY_INCOME_KEY, [])) ?? [];
}

export async function addSalaryIncomeEntry(entry: SalaryIncomeEntry): Promise<void> {
  const entries = await getSalaryIncomeEntries();
  entries.push(entry);
  await defaultAdapter.setItem(SALARY_INCOME_KEY, entries);
  
  // Update account balance
  const account = await getSalaryAccountById(entry.accountId);
  if (account) {
    account.balance += entry.amount;
    await updateSalaryAccount(account);
  }
}

export async function updateSalaryIncomeEntry(entry: SalaryIncomeEntry): Promise<void> {
  const entries = await getSalaryIncomeEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  if (index !== -1) {
    // Don't change balance of already posted entries - just update description/future amounts
    entries[index] = entry;
    await defaultAdapter.setItem(SALARY_INCOME_KEY, entries);
  }
}

export async function getEntriesByAccount(accountId: string): Promise<SalaryIncomeEntry[]> {
  const entries = await getSalaryIncomeEntries();
  return entries.filter(e => e.accountId === accountId).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Optimize payments: given expenses with mandatory accounts, 
 * determine which account should pay each to minimize transfers.
 * Returns a map of expenseId -> accountId
 */
export async function optimizePayments(
  expenses: Array<{ id: string; amount: number; mandatoryAccountId?: string }>
): Promise<Array<{ expenseId: string; accountId: string; accountName: string }>> {
  const accounts = await getSalaryAccounts();
  if (accounts.length === 0) return [];

  const result: Array<{ expenseId: string; accountId: string; accountName: string }> = [];
  
  // Track remaining balance per account
  const balances = new Map(accounts.map(a => [a.id, a.balance]));

  // First: assign expenses with mandatory accounts
  for (const exp of expenses) {
    if (exp.mandatoryAccountId) {
      const account = accounts.find(a => a.id === exp.mandatoryAccountId);
      if (account) {
        result.push({ expenseId: exp.id, accountId: account.id, accountName: account.name });
        balances.set(account.id, (balances.get(account.id) ?? 0) - Math.abs(exp.amount));
      }
    }
  }

  // Second: assign remaining expenses to accounts with highest balance (minimizes transfers)
  const unassigned = expenses.filter(e => !e.mandatoryAccountId);
  for (const exp of unassigned) {
    // Find account with highest remaining balance
    let bestAccountId = '';
    let bestBalance = -Infinity;
    for (const [id, bal] of balances) {
      if (bal > bestBalance) {
        bestBalance = bal;
        bestAccountId = id;
      }
    }
    if (bestAccountId) {
      const account = accounts.find(a => a.id === bestAccountId)!;
      result.push({ expenseId: exp.id, accountId: bestAccountId, accountName: account.name });
      balances.set(bestAccountId, bestBalance - Math.abs(exp.amount));
    }
  }

  return result;
}
