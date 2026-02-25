import { useState, useEffect, useCallback } from 'react';
import {
  Investment,
  getInvestments,
  createInvestment,
  deleteInvestment,
  addToInvestment,
  withdrawFromInvestment,
  getTotalInvested,
  getDefaultYieldRate,
  setDefaultYieldRate,
  processDailyYields,
  getYieldHistory,
  YieldHistory,
  getDailyYieldEstimate,
  getMonthlyYieldEstimate,
  updateInvestmentYieldRate,
  toggleCoverNegativeBalance,
  getInvestmentsForCoverage,
  useInvestmentForCoverage,
} from '@/lib/investments';

export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [defaultRate, setDefaultRate] = useState(6.5);
  const [loading, setLoading] = useState(true);

  const loadInvestments = useCallback(async () => {
    setLoading(true);
    try {
      // Process any pending daily yields first
      await processDailyYields();
      
      const [invests, total, rate] = await Promise.all([
        getInvestments(),
        getTotalInvested(),
        getDefaultYieldRate(),
      ]);
      setInvestments(invests);
      setTotalInvested(total);
      setDefaultRate(rate);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);

  const create = useCallback(async (
    name: string,
    amount: number,
    yieldRate?: number,
    startDate?: string,
    type?: string,
    cdiBonusPercent?: number,
    taxMode?: 'daily' | 'on_withdrawal'
  ) => {
    const investment = await createInvestment(name, amount, yieldRate, startDate, type, cdiBonusPercent, taxMode);
    await loadInvestments();
    return investment;
  }, [loadInvestments]);

  const remove = useCallback(async (id: string) => {
    await deleteInvestment(id);
    await loadInvestments();
  }, [loadInvestments]);

  const deposit = useCallback(async (id: string, amount: number) => {
    await addToInvestment(id, amount);
    await loadInvestments();
  }, [loadInvestments]);

  const withdraw = useCallback(async (id: string, amount: number) => {
    const result = await withdrawFromInvestment(id, amount);
    await loadInvestments();
    return result;
  }, [loadInvestments]);

  const updateDefaultRate = useCallback(async (rate: number) => {
    await setDefaultYieldRate(rate);
    setDefaultRate(rate);
  }, []);

  const updateYieldRate = useCallback(async (id: string, newRate: number, cdiBonusPercent?: number, taxMode?: 'daily' | 'on_withdrawal') => {
    await updateInvestmentYieldRate(id, newRate, cdiBonusPercent, taxMode);
    await loadInvestments();
  }, [loadInvestments]);

  const toggleCoverage = useCallback(async (id: string) => {
    await toggleCoverNegativeBalance(id);
    await loadInvestments();
  }, [loadInvestments]);

  const getCoverageInvestments = useCallback(async () => {
    return await getInvestmentsForCoverage();
  }, []);

  const useCoverage = useCallback(async (negativeAmount: number) => {
    const result = await useInvestmentForCoverage(negativeAmount);
    if (result) {
      await loadInvestments();
    }
    return result;
  }, [loadInvestments]);

  return {
    investments,
    totalInvested,
    defaultRate,
    loading,
    create,
    remove,
    deposit,
    withdraw,
    updateDefaultRate,
    updateYieldRate,
    toggleCoverage,
    getCoverageInvestments,
    useCoverage,
    refresh: loadInvestments,
    getDailyYieldEstimate,
    getMonthlyYieldEstimate,
  };
}

export function useInvestmentDetails(investmentId: string) {
  const [history, setHistory] = useState<YieldHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investmentId) return;
    
    setLoading(true);
    getYieldHistory(investmentId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [investmentId]);

  return { history, loading };
}
