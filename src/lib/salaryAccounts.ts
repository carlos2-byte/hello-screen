import { defaultAdapter } from './storageAdapter';

export interface SalaryAccount {
  id: string;
  name: string;
  payDay: number; // Day of month salary is deposited
  canReceiveTransfers: boolean;
  active?: boolean; // Defaults to true
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
  consolidated?: boolean; // Once true, amount cannot be changed
}

// CRUD for salary accounts
export async function getSalaryAccounts(): Promise<SalaryAccount[]> {
  const raw = (await defaultAdapter.getItem<any[]>(SALARY_ACCOUNTS_KEY, [])) ?? [];
  return raw.map(({ balance, ...rest }) => ({
    ...rest,
    active: rest.active !== false, // Default to true
  } as SalaryAccount));
}

export async function getActiveSalaryAccounts(): Promise<SalaryAccount[]> {
  const accounts = await getSalaryAccounts();
  return accounts.filter(a => a.active !== false);
}

export async function getSalaryAccountById(id: string): Promise<SalaryAccount | undefined> {
  const accounts = await getSalaryAccounts();
  return accounts.find(a => a.id === id);
}

export async function addSalaryAccount(account: SalaryAccount): Promise<void> {
  const accounts = await getSalaryAccounts();
  accounts.push({ ...account, active: true });
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

/**
 * Check if an account has any income entries (financial history).
 */
export async function accountHasHistory(accountId: string): Promise<boolean> {
  const entries = await getSalaryIncomeEntries();
  return entries.some(e => e.accountId === accountId);
}

/**
 * Count how many entries an account has
 */
export async function getAccountEntryCount(accountId: string): Promise<number> {
  const entries = await getSalaryIncomeEntries();
  return entries.filter(e => e.accountId === accountId).length;
}

/**
 * Transfer all entries from one account to another
 */
export async function transferEntriesToAccount(
  fromAccountId: string,
  toAccountId: string
): Promise<number> {
  const entries = await getSalaryIncomeEntries();
  let transferred = 0;
  for (const entry of entries) {
    if (entry.accountId === fromAccountId) {
      entry.accountId = toAccountId;
      transferred++;
    }
  }
  await defaultAdapter.setItem(SALARY_INCOME_KEY, entries);
  return transferred;
}

/**
 * Delete account - handles 3 scenarios:
 * 1. No history → direct delete
 * 2. Transfer history → move entries to another account, then delete
 * 3. Force delete → remove account (entries become orphaned)
 */
export async function deleteSalaryAccount(
  id: string,
  options?: { transferToAccountId?: string; forceDelete?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const hasHistory = await accountHasHistory(id);

  if (hasHistory) {
    if (options?.transferToAccountId) {
      // Transfer entries to another account first
      await transferEntriesToAccount(id, options.transferToAccountId);
    } else if (options?.forceDelete) {
      // Delete all entries for this account
      const entries = await getSalaryIncomeEntries();
      const filtered = entries.filter(e => e.accountId !== id);
      await defaultAdapter.setItem(SALARY_INCOME_KEY, filtered);
    } else {
      // No option chosen - cannot delete
      return { success: false, error: 'Conta possui histórico financeiro. Escolha uma ação.' };
    }
  }

  const accounts = await getSalaryAccounts();
  await defaultAdapter.setItem(SALARY_ACCOUNTS_KEY, accounts.filter(a => a.id !== id));
  return { success: true };
}

/**
 * Deactivate an account (soft delete) - preserves all history
 */
export async function deactivateSalaryAccount(id: string): Promise<void> {
  const accounts = await getSalaryAccounts();
  const index = accounts.findIndex(a => a.id === id);
  if (index !== -1) {
    accounts[index].active = false;
    await defaultAdapter.setItem(SALARY_ACCOUNTS_KEY, accounts);
  }
}

// Income entries for salary accounts
export async function getSalaryIncomeEntries(): Promise<SalaryIncomeEntry[]> {
  return (await defaultAdapter.getItem<SalaryIncomeEntry[]>(SALARY_INCOME_KEY, [])) ?? [];
}

/**
 * Calculate account balance dynamically from all income entries.
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  const entries = await getSalaryIncomeEntries();
  return entries
    .filter(e => e.accountId === accountId)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Get balances for all accounts at once (efficient batch).
 */
export async function getAllAccountBalances(): Promise<Map<string, number>> {
  const entries = await getSalaryIncomeEntries();
  const balances = new Map<string, number>();
  for (const e of entries) {
    balances.set(e.accountId, (balances.get(e.accountId) ?? 0) + e.amount);
  }
  return balances;
}

/**
 * Get total salary accounts balance (sum of all active accounts)
 */
export async function getTotalSalaryBalance(): Promise<number> {
  const [accounts, balances] = await Promise.all([
    getActiveSalaryAccounts(),
    getAllAccountBalances(),
  ]);
  return accounts.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
}

/**
 * Add income entry. Automatically consolidates (marks as immutable) after saving.
 */
export async function addSalaryIncomeEntry(entry: SalaryIncomeEntry): Promise<{ success: boolean; error?: string }> {
  if (entry.amount <= 0) {
    return { success: false, error: 'O valor deve ser maior que zero.' };
  }

  const entries = await getSalaryIncomeEntries();
  entry.consolidated = true;
  entries.push(entry);
  await defaultAdapter.setItem(SALARY_INCOME_KEY, entries);
  return { success: true };
}

/**
 * Update a salary income entry.
 * RULE: Consolidated entries cannot have their amount changed.
 * Only description can be updated on consolidated entries.
 */
export async function updateSalaryIncomeEntry(
  entry: SalaryIncomeEntry
): Promise<{ success: boolean; error?: string }> {
  const entries = await getSalaryIncomeEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  if (index === -1) {
    return { success: false, error: 'Lançamento não encontrado.' };
  }

  const existing = entries[index];
  if (existing.consolidated && existing.amount !== entry.amount) {
    return { success: false, error: 'Não é possível alterar o valor de um lançamento já consolidado.' };
  }

  entries[index] = { ...entry, consolidated: true };
  await defaultAdapter.setItem(SALARY_INCOME_KEY, entries);
  return { success: true };
}

export async function getEntriesByAccount(accountId: string): Promise<SalaryIncomeEntry[]> {
  const entries = await getSalaryIncomeEntries();
  return entries.filter(e => e.accountId === accountId).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Optimize payments: determine the best way to pay expenses using salary accounts.
 */
export async function optimizePayments(
  expenses: Array<{ id: string; amount: number; mandatoryAccountId?: string }>
): Promise<Array<{ expenseId: string; accountId: string; accountName: string; amount: number }>> {
  const accounts = await getActiveSalaryAccounts();
  if (accounts.length === 0) return [];

  const dynamicBalances = await getAllAccountBalances();
  const result: Array<{ expenseId: string; accountId: string; accountName: string; amount: number }> = [];
  const balances = new Map(accounts.map(a => [a.id, dynamicBalances.get(a.id) ?? 0]));

  for (const exp of expenses) {
    const expAmount = Math.abs(exp.amount);
    
    if (exp.mandatoryAccountId) {
      const account = accounts.find(a => a.id === exp.mandatoryAccountId);
      if (account) {
        const available = balances.get(account.id) ?? 0;
        if (available >= expAmount) {
          result.push({ expenseId: exp.id, accountId: account.id, accountName: account.name, amount: expAmount });
          balances.set(account.id, available - expAmount);
          continue;
        }
        if (available > 0) {
          result.push({ expenseId: exp.id, accountId: account.id, accountName: account.name, amount: available });
          balances.set(account.id, 0);
          const remaining = expAmount - available;
          const sorted = [...balances.entries()]
            .filter(([id]) => id !== account.id && (balances.get(id) ?? 0) > 0)
            .sort((a, b) => b[1] - a[1]);
          
          let left = remaining;
          for (const [accId, accBal] of sorted) {
            if (left <= 0) break;
            const acc = accounts.find(a => a.id === accId)!;
            const use = Math.min(accBal, left);
            result.push({ expenseId: exp.id, accountId: accId, accountName: acc.name, amount: use });
            balances.set(accId, accBal - use);
            left -= use;
          }
          continue;
        }
      }
    }

    const sorted = [...balances.entries()]
      .filter(([, bal]) => bal > 0)
      .sort((a, b) => b[1] - a[1]);

    const singleAccount = sorted.find(([, bal]) => bal >= expAmount);
    if (singleAccount) {
      const [accId, accBal] = singleAccount;
      const acc = accounts.find(a => a.id === accId)!;
      result.push({ expenseId: exp.id, accountId: accId, accountName: acc.name, amount: expAmount });
      balances.set(accId, accBal - expAmount);
      continue;
    }

    let left = expAmount;
    for (const [accId, accBal] of sorted) {
      if (left <= 0) break;
      const acc = accounts.find(a => a.id === accId)!;
      const use = Math.min(accBal, left);
      result.push({ expenseId: exp.id, accountId: accId, accountName: acc.name, amount: use });
      balances.set(accId, accBal - use);
      left -= use;
    }
  }

  return result;
}
