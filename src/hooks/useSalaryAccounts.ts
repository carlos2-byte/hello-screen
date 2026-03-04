import { useState, useEffect, useCallback } from 'react';
import {
  SalaryAccount,
  SalaryIncomeEntry,
  getSalaryAccounts,
  addSalaryAccount,
  updateSalaryAccount,
  deleteSalaryAccount,
  addSalaryIncomeEntry,
  getEntriesByAccount,
} from '@/lib/salaryAccounts';
import { generateId } from '@/lib/formatters';
import { toast } from 'sonner';

export function useSalaryAccounts() {
  const [accounts, setAccounts] = useState<SalaryAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getSalaryAccounts();
      setAccounts(loaded);
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

  const removeAccount = useCallback(async (id: string): Promise<boolean> => {
    const result = await deleteSalaryAccount(id);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    await loadAccounts();
    return true;
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
