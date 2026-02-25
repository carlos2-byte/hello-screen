import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '@/lib/storage';
import { 
  ConsolidatedInvoice, 
  getStatementTransactions, 
  getStatementTotals 
} from '@/lib/invoiceUtils';
import { getCurrentMonth } from '@/lib/formatters';
import { calculateRealTimeBalances } from '@/lib/projBalance';
import { getLocalMonth, getLocalDateString } from '@/lib/dateUtils';

export type StatementItem = Transaction | ConsolidatedInvoice;

export function isConsolidatedInvoice(item: StatementItem): item is ConsolidatedInvoice {
  return 'isConsolidatedInvoice' in item && item.isConsolidatedInvoice === true;
}

interface BalanceData {
  /** Saldo Atual: Entradas - despesas/faturas já vencidas ou lançadas até hoje */
  currentBalance: number;
  /** Saídas previstas: total de despesas/faturas com data futura */
  projectedExpenses: number;
  /** Rendimento diário estimado */
  dailyYield: number;
  /** Total de entradas */
  totalIncome: number;
  /** Total de saídas (passadas + futuras) */
  totalExpense: number;
}

export function useStatement(month?: string) {
  const [items, setItems] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);

  const currentMonth = month || getCurrentMonth();

  const loadStatement = useCallback(async () => {
    setLoading(true);
    try {
      const [statementItems, statementTotals] = await Promise.all([
        getStatementTransactions(currentMonth),
        getStatementTotals(currentMonth),
      ]);
      
      setItems(statementItems);
      setTotals(statementTotals);
      
      // Calculate real-time balances (current balance and projected expenses)
      const balances = await calculateRealTimeBalances(currentMonth, statementItems);
      setBalanceData(balances);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  // Legacy balance for compatibility
  const balance = totals.income - totals.expense;

  return {
    items,
    loading,
    totals,
    balance,
    balanceData,
    refresh: loadStatement,
  };
}
