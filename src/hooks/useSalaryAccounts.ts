import { useState, useEffect, useCallback } from 'react';
import {
  SalaryAccount,
  SalaryIncomeEntry,
  getSalaryAccounts,
  addSalaryAccount,
  updateSalaryAccount,
  deleteSalaryAccount,
  deactivateSalaryAccount,
  addSalaryIncomeEntry,
  getEntriesByAccount,
  getAllAccountBalances,
  getAccountEntryCount,
} from '@/lib/salaryAccounts';
import { generateId } from '@/lib/formatters';
import { toast } from 'sonner';

export type { SalaryAccount } from '@/lib/salaryAccounts';

export interface SalaryAccountWithBalance extends SalaryAccount {
  balance: number;
  entryCount: number;
}

export function useSalaryAccounts() {
  const [accounts, setAccounts] = useState<SalaryAccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const [loaded, balances] = await Promise.all([
        getSalaryAccounts(),
        getAllAccountBalances(),
      ]);
      // Get entry counts in parallel
      const entryCounts = await Promise.all(
        loaded.map(a => getAccountEntryCount(a.id))
      );
      setAccounts(loaded.map((a, i) => ({
        ...a,
        balance: balances.get(a.id) ?? 0,
        entryCount: entryCounts[i],
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const createAccount = useCallback(async (data: Omit<SalaryAccount, 'id'>) => {
    const account: SalaryAccount = { ...data, id: generateId() };
    await addSalaryAccount(account);
    await loadAccounts();
    return account;
  }, [loadAccounts]);

  const editAccount = useCallback(async (account: SalaryAccount) => {
    await updateSalaryAccount(account);
    await loadAccounts();
  }, [loadAccounts]);

  const removeAccount = useCallback(async (
    id: string,
    options?: { transferToAccountId?: string; forceDelete?: boolean }
  ): Promise<boolean> => {
    const result = await deleteSalaryAccount(id, options);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    await loadAccounts();
    return true;
  }, [loadAccounts]);

  const deactivate = useCallback(async (id: string) => {
    await deactivateSalaryAccount(id);
    await loadAccounts();
  }, [loadAccounts]);

  const addIncome = useCallback(async (data: Omit<SalaryIncomeEntry, 'id'>): Promise<boolean> => {
    const entry: SalaryIncomeEntry = { ...data, id: generateId() };
    const result = await addSalaryIncomeEntry(entry);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    await loadAccounts();
    return true;
  }, [loadAccounts]);

  return {
    accounts,
    loading,
    createAccount,
    editAccount,
    removeAccount,
    deactivate,
    addIncome,
    refresh: loadAccounts,
  };
}

export function useSalaryAccountEntries(accountId: string) {
  const [entries, setEntries] = useState<SalaryIncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    if (!accountId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const loaded = await getEntriesByAccount(accountId);
      setEntries(loaded);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return { entries, loading, refresh: loadEntries };
}
