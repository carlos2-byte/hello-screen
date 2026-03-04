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
  consolidated?: boolean; // Once true, amount cannot be changed
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

/**
 * Check if an account has any income entries (financial history).
 * Accounts with history cannot be deleted.
 */
export async function accountHasHistory(accountId: string): Promise<boolean> {
  const entries = await getSalaryIncomeEntries();
  return entries.some(e => e.accountId === accountId);
}

export async function deleteSalaryAccount(id: string): Promise<{ success: boolean; error?: string }> {
  const hasHistory = await accountHasHistory(id);
  if (hasHistory) {
    return { success: false, error: 'Conta possui histórico financeiro e não pode ser excluída.' };
  }
  const accounts = await getSalaryAccounts();
  await defaultAdapter.setItem(SALARY_ACCOUNTS_KEY, accounts.filter(a => a.id !== id));
  return { success: true };
}

// Income entries for salary accounts
export async function getSalaryIncomeEntries(): Promise<SalaryIncomeEntry[]> {
  return (await defaultAdapter.getItem<SalaryIncomeEntry[]>(SALARY_INCOME_KEY, [])) ?? [];
}

/**
 * Add income entry. Automatically consolidates (marks as immutable) after saving.
 * Validates that balance won't go negative.
 */
export async function addSalaryIncomeEntry(entry: SalaryIncomeEntry): Promise<{ success: boolean; error?: string }> {
  if (entry.amount <= 0) {
    return { success: false, error: 'O valor deve ser maior que zero.' };
  }

  const entries = await getSalaryIncomeEntries();
  // Mark as consolidated immediately - history is immutable
  entry.consolidated = true;
  entries.push(entry);
  await defaultAdapter.setItem(SALARY_INCOME_KEY, entries);
  
  // Update account balance
  const account = await getSalaryAccountById(entry.accountId);
  if (account) {
    account.balance += entry.amount;
    await updateSalaryAccount(account);
  }
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
 * Deduct amount from a salary account balance.
 * Validates that balance won't go negative.
 */
export async function deductFromAccount(
  accountId: string, 
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const account = await getSalaryAccountById(accountId);
  if (!account) return { success: false, error: 'Conta não encontrada.' };
  
  if (account.balance < amount) {
    return { success: false, error: `Saldo insuficiente na conta "${account.name}". Disponível: ${account.balance.toFixed(2)}` };
  }

  account.balance -= amount;
  await updateSalaryAccount(account);
  return { success: true };
}

/**
 * Optimize payments: determine the best way to pay expenses using salary accounts.
 * 
 * Priority:
 * 1. Linked (mandatory) account - if it has sufficient balance
 * 2. Single account with highest balance that can cover the full amount
 * 3. Combination with fewest accounts needed
 * 
 * Does NOT execute any transfers - only suggests the optimal payment plan.
 */
export async function optimizePayments(
  expenses: Array<{ id: string; amount: number; mandatoryAccountId?: string }>
): Promise<Array<{ expenseId: string; accountId: string; accountName: string; amount: number }>> {
  const accounts = await getSalaryAccounts();
  if (accounts.length === 0) return [];

  const result: Array<{ expenseId: string; accountId: string; accountName: string; amount: number }> = [];
  
  // Track remaining balance per account
  const balances = new Map(accounts.map(a => [a.id, a.balance]));

  for (const exp of expenses) {
    const expAmount = Math.abs(exp.amount);
    
    // Priority 1: Mandatory (linked) account
    if (exp.mandatoryAccountId) {
      const account = accounts.find(a => a.id === exp.mandatoryAccountId);
      if (account) {
        const available = balances.get(account.id) ?? 0;
        if (available >= expAmount) {
          // Linked account covers fully
          result.push({ expenseId: exp.id, accountId: account.id, accountName: account.name, amount: expAmount });
          balances.set(account.id, available - expAmount);
          continue;
        }
        // Linked account has partial balance - use what it has, then find the rest
        if (available > 0) {
          result.push({ expenseId: exp.id, accountId: account.id, accountName: account.name, amount: available });
          balances.set(account.id, 0);
          const remaining = expAmount - available;
          // Find another account for the remainder
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

    // Priority 2: Single account with highest balance that covers the full amount
    const sorted = [...balances.entries()]
      .filter(([, bal]) => bal > 0)
      .sort((a, b) => b[1] - a[1]);

    // Try to find single account that covers it
    const singleAccount = sorted.find(([, bal]) => bal >= expAmount);
    if (singleAccount) {
      const [accId, accBal] = singleAccount;
      const acc = accounts.find(a => a.id === accId)!;
      result.push({ expenseId: exp.id, accountId: accId, accountName: acc.name, amount: expAmount });
      balances.set(accId, accBal - expAmount);
      continue;
    }

    // Priority 3: Use fewest accounts (sorted by highest balance first)
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
