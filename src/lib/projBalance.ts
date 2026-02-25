/**
 * Projected Balance Logic
 * 
 * Features:
 * 1. "Saldo Atual" = Entradas - despesas/faturas já vencidas (data <= hoje)
 * 2. "Saídas Previstas" = despesas/faturas com data futura
 * 3. Real-time updates when transactions are added/edited/deleted
 */

import { getTransactionsByMonth, Transaction, getSettings } from './storage';
import { getInvestmentsForCoverage, calculateDailyYield } from './investments';
import { getLocalDateString, parseLocalDate, getLocalMonth, addDaysToDate } from './dateUtils';
import { ConsolidatedInvoice } from './invoiceUtils';

type StatementItem = Transaction | ConsolidatedInvoice;

function isConsolidatedInvoice(item: StatementItem): item is ConsolidatedInvoice {
  return 'isConsolidatedInvoice' in item && item.isConsolidatedInvoice === true;
}

/**
 * Calculate real-time balances from statement items
 * 
 * - currentBalance: Entradas - despesas/faturas já vencidas (data <= hoje)
 * - projectedExpenses: total de despesas/faturas com data futura
 */
export async function calculateRealTimeBalances(
  month: string,
  statementItems: StatementItem[]
): Promise<{
  currentBalance: number;
  projectedExpenses: number;
  dailyYield: number;
  totalIncome: number;
  totalExpense: number;
}> {
  const today = getLocalDateString();
  
  let totalIncome = 0;
  let pastExpenses = 0; // Despesas/faturas já vencidas (data <= hoje)
  let futureExpenses = 0; // Despesas/faturas futuras (data > hoje)
  
  for (const item of statementItems) {
    if (isConsolidatedInvoice(item)) {
      // Fatura consolidada: usar dueDate para determinar se já venceu
      const amount = item.total;
      if (item.dueDate <= today) {
        pastExpenses += amount;
      } else {
        futureExpenses += amount;
      }
    } else {
      // Transação normal
      const tx = item as Transaction;
      const amount = Math.abs(tx.amount);
      
      if (tx.type === 'income') {
        // Entradas: contar todas (não importa a data para entradas)
        totalIncome += amount;
      } else {
        // Despesas: separar por data
        if (tx.date <= today) {
          pastExpenses += amount;
        } else {
          futureExpenses += amount;
        }
      }
    }
  }
  
  // Saldo Atual = Entradas - despesas/faturas já vencidas
  const currentBalance = totalIncome - pastExpenses;
  
  // Calculate daily yield based on current balance using settings rate
  // Uses the same multiplicative formula as investments: rate * (bonusPercent / 100)
  let dailyYield = 0;
  if (currentBalance > 0) {
    const settings = await getSettings();
    if (settings.balanceYieldEnabled && settings.balanceYieldRate) {
      const cdiBonusPercent = settings.balanceExtraYieldEnabled ? settings.balanceExtraYieldPercent : undefined;
      const grossYield = calculateDailyYield(currentBalance, settings.balanceYieldRate, cdiBonusPercent);
      
      // Apply tax if daily mode (same logic as investments)
      if (settings.balanceYieldTaxMode === 'daily' && grossYield > 0) {
        // Use 180 days as default bracket for balance (conservative)
        const taxRate = 0.225; // 22.5% for up to 180 days
        dailyYield = grossYield * (1 - taxRate);
      } else {
        dailyYield = grossYield;
      }
    }
  }
  
  return {
    currentBalance,
    projectedExpenses: futureExpenses,
    dailyYield,
    totalIncome,
    totalExpense: pastExpenses + futureExpenses,
  };
}

/**
 * Legacy function for compatibility
 * @deprecated Use calculateRealTimeBalances instead
 */
export async function calculateProjectedBalance(
  month: string,
  baseIncome: number,
  baseExpense: number
): Promise<{
  projectedBalance: number;
  dailyYield: number;
  remainingExpenses: number;
  paidExpenses: number;
}> {
  const today = getLocalDateString();
  const transactions = await getTransactionsByMonth(month);
  
  const incomes = transactions.filter(tx => tx.type === 'income');
  const expenses = transactions.filter(tx => tx.type === 'expense');
  
  let paidExpenses = 0;
  let remainingExpenses = 0;
  
  for (const expense of expenses) {
    const amount = Math.abs(expense.amount);
    if (expense.date <= today) {
      paidExpenses += amount;
    } else {
      remainingExpenses += amount;
    }
  }
  
  let receivedIncome = 0;
  for (const income of incomes) {
    if (income.date <= today) {
      receivedIncome += Math.abs(income.amount);
    }
  }
  
  const currentBalance = receivedIncome - paidExpenses;
  const projectedBalance = currentBalance - remainingExpenses;
  
  let dailyYield = 0;
  if (currentBalance > 0) {
    const settings = await getSettings();
    if (settings.balanceYieldEnabled && settings.balanceYieldRate) {
      const cdiBonusPercent = settings.balanceExtraYieldEnabled ? settings.balanceExtraYieldPercent : undefined;
      const grossYield = calculateDailyYield(currentBalance, settings.balanceYieldRate, cdiBonusPercent);
      
      if (settings.balanceYieldTaxMode === 'daily' && grossYield > 0) {
        const taxRate = 0.225;
        dailyYield = grossYield * (1 - taxRate);
      } else {
        dailyYield = grossYield;
      }
    }
  }
  
  return {
    projectedBalance,
    dailyYield,
    remainingExpenses,
    paidExpenses,
  };
}

/**
 * Get the balance at a specific date in the month
 * Useful for showing balance progression
 */
export async function getBalanceAtDate(
  month: string,
  targetDate: string
): Promise<number> {
  const transactions = await getTransactionsByMonth(month);
  
  let balance = 0;
  for (const tx of transactions) {
    if (tx.date <= targetDate) {
      if (tx.type === 'income') {
        balance += Math.abs(tx.amount);
      } else {
        balance -= Math.abs(tx.amount);
      }
    }
  }
  
  return balance;
}

/**
 * Calculate the accumulated daily yield for the current month
 * Based on daily balances and the investment yield rate
 */
export async function calculateAccumulatedYield(month: string): Promise<number> {
  const today = getLocalDateString();
  const currentMonth = getLocalMonth();
  
  // Only calculate for current or past months
  if (month > currentMonth) {
    return 0;
  }
  
  const settings = await getSettings();
  if (!settings.balanceYieldEnabled || !settings.balanceYieldRate) {
    return 0;
  }
  
  const cdiBonusPercent = settings.balanceExtraYieldEnabled ? settings.balanceExtraYieldPercent : undefined;
  
  // Determine the range of dates to calculate
  const monthStart = `${month}-01`;
  const isCurrentMonth = month === currentMonth;
  const endDate = isCurrentMonth ? today : getLastDayOfMonth(month);
  
  // Get all transactions for the month
  const transactions = await getTransactionsByMonth(month);
  
  // Calculate yield for each day
  let totalYield = 0;
  let currentDate = monthStart;
  
  while (currentDate <= endDate) {
    // Calculate balance at end of previous day
    const previousDay = addDaysToDate(currentDate, -1);
    let balance = 0;
    
    for (const tx of transactions) {
      if (tx.date <= previousDay) {
        if (tx.type === 'income') {
          balance += Math.abs(tx.amount);
        } else {
          balance -= Math.abs(tx.amount);
        }
      }
    }
    
    if (balance > 0) {
      const grossYield = calculateDailyYield(balance, settings.balanceYieldRate, cdiBonusPercent);
      
      // Apply tax if daily mode
      if (settings.balanceYieldTaxMode === 'daily' && grossYield > 0) {
        const taxRate = 0.225;
        totalYield += grossYield * (1 - taxRate);
      } else {
        totalYield += grossYield;
      }
    }
    
    currentDate = addDaysToDate(currentDate, 1);
  }
  
  return totalYield;
}

/**
 * Get the last day of a month as YYYY-MM-DD
 */
function getLastDayOfMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  // Create date for first day of next month, then subtract 1 day
  const lastDay = new Date(year, monthNum, 0);
  return getLocalDateString(lastDay);
}

/**
 * Check if we're at the end of the month (last day)
 */
export function isEndOfMonth(): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return today.getMonth() !== tomorrow.getMonth();
}

/**
 * Get days until end of month
 */
export function getDaysUntilMonthEnd(): number {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return lastDay.getDate() - today.getDate();
}
