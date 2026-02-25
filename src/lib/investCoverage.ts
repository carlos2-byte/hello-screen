/**
 * Investment Coverage System
 * 
 * Rule: Money is only withdrawn from investment on the exact date 
 * when the expense/invoice is due, and only the necessary amount 
 * to cover that day's balance (gradual withdrawal as needed).
 */

import { getInvestmentsForCoverage, useInvestmentForCoverage as baseUseInvestmentForCoverage } from './investments';
import { Transaction, saveTransaction } from './storage';
import { getLocalDateString } from './dateUtils';
import { generateId } from './formatters';
import { ConsolidatedInvoice } from './invoiceUtils';
import { defaultAdapter } from './storageAdapter';

const COVERAGE_RECORDS_KEY = 'investment_coverage_records';

export interface CoverageRecord {
  id: string;
  date: string; // Date the coverage was applied
  investmentId: string;
  investmentName: string;
  expenseId?: string; // Transaction or invoice ID that triggered coverage
  expenseDescription: string;
  amountCovered: number;
  transactionId: string; // The income transaction created
}

type StatementItem = Transaction | ConsolidatedInvoice;

function isConsolidatedInvoice(item: StatementItem): item is ConsolidatedInvoice {
  return 'isConsolidatedInvoice' in item && item.isConsolidatedInvoice === true;
}

/**
 * Get all coverage records
 */
export async function getCoverageRecords(): Promise<CoverageRecord[]> {
  return (await defaultAdapter.getItem<CoverageRecord[]>(COVERAGE_RECORDS_KEY, [])) ?? [];
}

/**
 * Save coverage record
 */
async function saveCoverageRecord(record: CoverageRecord): Promise<void> {
  const records = await getCoverageRecords();
  records.push(record);
  await defaultAdapter.setItem(COVERAGE_RECORDS_KEY, records);
}

/**
 * Get coverage records for a specific month
 */
export async function getCoverageRecordsForMonth(month: string): Promise<CoverageRecord[]> {
  const records = await getCoverageRecords();
  return records.filter(r => r.date.startsWith(month));
}

/**
 * Calculate what needs to be covered TODAY based on due dates
 * Returns the amount that should be withdrawn from investment today
 */
export async function calculateTodaysCoverageNeed(
  statementItems: StatementItem[]
): Promise<{
  needsCoverage: boolean;
  amountNeeded: number;
  dueItems: Array<{ id: string; description: string; amount: number }>;
}> {
  const today = getLocalDateString();
  const coverageInvestments = await getInvestmentsForCoverage();
  
  if (coverageInvestments.length === 0) {
    return { needsCoverage: false, amountNeeded: 0, dueItems: [] };
  }
  
  // Calculate running balance up to today
  let incomeTotal = 0;
  let expenseTotal = 0;
  const todaysDueItems: Array<{ id: string; description: string; amount: number }> = [];
  
  for (const item of statementItems) {
    if (isConsolidatedInvoice(item)) {
      // Invoice: check due date
      if (item.dueDate < today) {
        // Already past - already counted in balance
        expenseTotal += item.total;
      } else if (item.dueDate === today) {
        // Due today - needs to be covered if balance goes negative
        todaysDueItems.push({
          id: item.cardId,
          description: `Fatura ${item.cardName}`,
          amount: item.total,
        });
        expenseTotal += item.total;
      }
      // Future dates: not counted yet
    } else {
      const tx = item as Transaction;
      const amount = Math.abs(tx.amount);
      
      if (tx.type === 'income') {
        incomeTotal += amount;
      } else {
        if (tx.date < today) {
          // Already past
          expenseTotal += amount;
        } else if (tx.date === today) {
          // Due today
          todaysDueItems.push({
            id: tx.id,
            description: tx.description || 'Despesa',
            amount: amount,
          });
          expenseTotal += amount;
        }
        // Future dates: not counted yet
      }
    }
  }
  
  const currentBalance = incomeTotal - expenseTotal;
  
  // If balance is negative, we need coverage
  if (currentBalance < 0) {
    return {
      needsCoverage: true,
      amountNeeded: Math.abs(currentBalance),
      dueItems: todaysDueItems,
    };
  }
  
  return { needsCoverage: false, amountNeeded: 0, dueItems: [] };
}

/**
 * Check if coverage was already applied for today
 */
export async function wasCoverageAppliedToday(): Promise<boolean> {
  const today = getLocalDateString();
  const records = await getCoverageRecords();
  return records.some(r => r.date === today);
}

/**
 * Apply coverage for today's due items if needed
 * This should be called once per day when the app loads
 */
export async function applyTodaysCoverageIfNeeded(
  statementItems: StatementItem[]
): Promise<{
  applied: boolean;
  amount: number;
  investmentName: string;
} | null> {
  const today = getLocalDateString();
  
  // Check if already applied today
  if (await wasCoverageAppliedToday()) {
    return null;
  }
  
  const { needsCoverage, amountNeeded, dueItems } = await calculateTodaysCoverageNeed(statementItems);
  
  if (!needsCoverage || amountNeeded <= 0) {
    return null;
  }
  
  // Use investment to cover
  const result = await baseUseInvestmentForCoverage(amountNeeded);
  
  if (!result) {
    return null;
  }
  
  // Create income transaction for the coverage - abbreviated with investment name
  const invNameShort = result.investmentName.length > 15
    ? result.investmentName.substring(0, 15).trim() + '…'
    : result.investmentName;
  const description = `Cobertura: ${invNameShort}`;
  
  const transaction: Transaction = {
    id: generateId(),
    amount: result.usedAmount,
    description,
    type: 'income',
    date: today,
    category: 'income',
    createdAt: new Date().toISOString(),
  };
  
  await saveTransaction(transaction);
  
  // Record the coverage
  await saveCoverageRecord({
    id: `${today}-${result.investmentId}`,
    date: today,
    investmentId: result.investmentId,
    investmentName: result.investmentName,
    expenseDescription: dueItems.map(d => d.description).join(', '),
    amountCovered: result.usedAmount,
    transactionId: transaction.id,
  });
  
  return {
    applied: true,
    amount: result.usedAmount,
    investmentName: result.investmentName,
  };
}

/**
 * Calculate future expenses that will be covered by investment
 * These should NOT be counted in the report summary until the coverage is applied
 */
export async function calculateFutureCoverableExpenses(
  statementItems: StatementItem[]
): Promise<{
  totalCoverable: number;
  coverableItems: Array<{ date: string; description: string; amount: number }>;
}> {
  const today = getLocalDateString();
  const coverageInvestments = await getInvestmentsForCoverage();
  
  if (coverageInvestments.length === 0) {
    return { totalCoverable: 0, coverableItems: [] };
  }
  
  const totalAvailable = coverageInvestments.reduce((sum, inv) => sum + inv.currentAmount, 0);
  
  // Calculate running balance and find what would need coverage
  let incomeTotal = 0;
  let expenseTotalPast = 0;
  const futureExpenses: Array<{ date: string; description: string; amount: number }> = [];
  
  // First pass: calculate current balance (past items)
  for (const item of statementItems) {
    if (isConsolidatedInvoice(item)) {
      if (item.dueDate <= today) {
        expenseTotalPast += item.total;
      } else {
        futureExpenses.push({
          date: item.dueDate,
          description: `Fatura ${item.cardName}`,
          amount: item.total,
        });
      }
    } else {
      const tx = item as Transaction;
      const amount = Math.abs(tx.amount);
      
      if (tx.type === 'income') {
        incomeTotal += amount;
      } else if (tx.date <= today) {
        expenseTotalPast += amount;
      } else {
        futureExpenses.push({
          date: tx.date,
          description: tx.description || 'Despesa',
          amount: amount,
        });
      }
    }
  }
  
  // Sort future expenses by date
  futureExpenses.sort((a, b) => a.date.localeCompare(b.date));
  
  // Simulate day by day which expenses would need coverage
  let runningBalance = incomeTotal - expenseTotalPast;
  let coverableTotal = 0;
  let remainingInvestment = totalAvailable;
  const coverableItems: Array<{ date: string; description: string; amount: number }> = [];
  
  for (const expense of futureExpenses) {
    const newBalance = runningBalance - expense.amount;
    
    if (newBalance < 0 && remainingInvestment > 0) {
      // This expense would cause negative balance
      const deficit = Math.abs(newBalance);
      const coverAmount = Math.min(deficit, remainingInvestment);
      
      coverableItems.push({
        date: expense.date,
        description: expense.description,
        amount: coverAmount,
      });
      
      coverableTotal += coverAmount;
      remainingInvestment -= coverAmount;
      runningBalance = newBalance + coverAmount;
    } else {
      runningBalance = newBalance;
    }
  }
  
  return { totalCoverable: coverableTotal, coverableItems };
}
