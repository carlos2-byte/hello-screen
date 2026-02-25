/**
 * Investments management
 * Yield is calculated DAILY and added to balance the NEXT DAY
 * Tax (IR) uses regressive table and is applied ONLY on withdrawal
 */

import { defaultAdapter } from './storageAdapter';
import { generateId } from './formatters';
import { getLocalDateString, getLocalMonth, parseLocalDate, getMonthsInRangeLocal, addDaysToDate } from './dateUtils';

const INVESTMENTS_KEY = 'investments';
const DEFAULT_YIELD_KEY = 'default_yield_rate';
const YIELD_HISTORY_KEY = 'yield_history';
const LAST_YIELD_PROCESS_KEY = 'last_yield_process_date';

// Regressive IR tax table for fixed income (renda fixa)
const IR_TAX_BRACKETS = [
  { maxDays: 180, rate: 0.225 },    // 22.5%
  { maxDays: 360, rate: 0.20 },     // 20%
  { maxDays: 720, rate: 0.175 },    // 17.5%
  { maxDays: Infinity, rate: 0.15 }, // 15%
];

/**
 * Get IR tax rate based on days since deposit
 */
export function getIRTaxRate(days: number): number {
  for (const bracket of IR_TAX_BRACKETS) {
    if (days <= bracket.maxDays) return bracket.rate;
  }
  return 0.15;
}

/**
 * Calculate days between two YYYY-MM-DD date strings
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export interface DepositRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // principal of this deposit
  accumulatedYield: number; // gross yield accumulated on this deposit
}

export interface Investment {
  id: string;
  name: string;
  type?: string;
  initialAmount: number;
  currentAmount: number; // = totalDeposited + accumulatedYield (gross, before IR)
  totalDeposited: number;
  accumulatedYield: number; // Sum of all gross yields (IR NOT deducted)
  yieldRate: number;
  cdiBonusPercent?: number;
  startDate: string;
  lastYieldDate?: string;
  isActive: boolean;
  createdAt: string;
  canCoverNegativeBalance?: boolean;
  taxMode?: 'daily' | 'on_withdrawal'; // 'daily' = IR deducted each day; 'on_withdrawal' = IR only at withdrawal
  yieldRateHistory?: YieldRateChange[];
  deposits?: DepositRecord[];
}

export interface YieldRateChange {
  date: string;
  previousRate: number;
  newRate: number;
}

export interface YieldHistory {
  id: string;
  investmentId: string;
  date: string;
  appliedDate: string;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Get default yield rate
 */
export async function getDefaultYieldRate(): Promise<number> {
  return (await defaultAdapter.getItem<number>(DEFAULT_YIELD_KEY, 6.5)) ?? 6.5;
}

/**
 * Set default yield rate
 */
export async function setDefaultYieldRate(rate: number): Promise<void> {
  await defaultAdapter.setItem(DEFAULT_YIELD_KEY, rate);
}

/**
 * Get all investments
 */
export async function getInvestments(): Promise<Investment[]> {
  const investments = await defaultAdapter.getItem<Record<string, Investment>>(INVESTMENTS_KEY, {});
  const migrated = Object.values(investments ?? {}).map(inv => {
    // Migrate legacy totalDeposited/accumulatedYield
    if (inv.totalDeposited === undefined || inv.totalDeposited === null) {
      inv.totalDeposited = inv.initialAmount;
      inv.accumulatedYield = inv.currentAmount - inv.initialAmount;
      if (inv.accumulatedYield < 0) inv.accumulatedYield = 0;
    }
    // Migrate deposits array - treat entire current balance as principal
    // to avoid double-taxation on previously taxed yields
    if (!inv.deposits || inv.deposits.length === 0) {
      inv.deposits = [{
        id: generateId(),
        date: inv.startDate,
        amount: inv.currentAmount,
        accumulatedYield: 0,
      }];
      inv.totalDeposited = inv.currentAmount;
      inv.accumulatedYield = 0;
    }
    return inv;
  });
  return migrated.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get investment by ID
 */
export async function getInvestmentById(id: string): Promise<Investment | null> {
  const investments = await defaultAdapter.getItem<Record<string, Investment>>(INVESTMENTS_KEY, {});
  return investments?.[id] ?? null;
}

/**
 * Create new investment
 */
export async function createInvestment(
  name: string,
  amount: number,
  yieldRate?: number,
  startDate?: string,
  type?: string,
  cdiBonusPercent?: number,
  taxMode?: 'daily' | 'on_withdrawal'
): Promise<Investment> {
  const investments = await defaultAdapter.getItem<Record<string, Investment>>(INVESTMENTS_KEY, {}) ?? {};
  const defaultRate = await getDefaultYieldRate();
  const start = startDate ?? getLocalDateString();

  const investment: Investment = {
    id: generateId(),
    name: name.trim(),
    type: type?.trim(),
    initialAmount: amount,
    currentAmount: amount,
    totalDeposited: amount,
    accumulatedYield: 0,
    yieldRate: yieldRate ?? defaultRate,
    cdiBonusPercent,
    taxMode: taxMode ?? 'on_withdrawal',
    startDate: start,
    isActive: true,
    createdAt: new Date().toISOString(),
    deposits: [{
      id: generateId(),
      date: start,
      amount: amount,
      accumulatedYield: 0,
    }],
  };

  investments[investment.id] = investment;
  await defaultAdapter.setItem(INVESTMENTS_KEY, investments);
  return investment;
}

/**
 * Update investment
 */
export async function updateInvestment(investment: Investment): Promise<void> {
  const investments = await defaultAdapter.getItem<Record<string, Investment>>(INVESTMENTS_KEY, {}) ?? {};
  investments[investment.id] = investment;
  await defaultAdapter.setItem(INVESTMENTS_KEY, investments);
}

/**
 * Update investment yield rate (prospective only)
 */
export async function updateInvestmentYieldRate(id: string, newRate: number, cdiBonusPercent?: number, taxMode?: 'daily' | 'on_withdrawal'): Promise<void> {
  const investment = await getInvestmentById(id);
  if (!investment) return;

  const today = getLocalDateString();
  const previousRate = investment.yieldRate;

  const rateChange: YieldRateChange = {
    date: today,
    previousRate,
    newRate,
  };

  investment.yieldRate = newRate;
  investment.cdiBonusPercent = cdiBonusPercent;
  if (taxMode) investment.taxMode = taxMode;
  investment.yieldRateHistory = investment.yieldRateHistory || [];
  investment.yieldRateHistory.push(rateChange);

  await updateInvestment(investment);
}

/**
 * Toggle investment ability to cover negative balance
 */
export async function toggleCoverNegativeBalance(id: string): Promise<void> {
  const investment = await getInvestmentById(id);
  if (!investment) return;

  investment.canCoverNegativeBalance = !investment.canCoverNegativeBalance;
  await updateInvestment(investment);
}

/**
 * Get investments that can cover negative balance
 */
export async function getInvestmentsForCoverage(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments
    .filter(i => i.isActive && i.canCoverNegativeBalance && i.currentAmount > 0)
    .sort((a, b) => b.currentAmount - a.currentAmount);
}

/**
 * Use investment to cover negative balance
 */
export async function useInvestmentForCoverage(
  negativeAmount: number
): Promise<{ usedAmount: number; investmentName: string; investmentId: string } | null> {
  const investments = await getInvestmentsForCoverage();
  if (investments.length === 0) return null;

  const investment = investments[0];
  const amountToUse = Math.min(negativeAmount, investment.currentAmount);

  if (amountToUse <= 0) return null;

  // Ensure deposits exist
  if (!investment.deposits) investment.deposits = [];
  if (investment.deposits.length === 0) {
    investment.deposits = [{
      id: generateId(),
      date: investment.startDate,
      amount: investment.currentAmount,
      accumulatedYield: 0,
    }];
  }

  // Deduct from deposits (oldest first)
  let remaining = amountToUse;
  const sortedDeposits = [...investment.deposits].sort((a, b) => a.date.localeCompare(b.date));

  for (const dep of sortedDeposits) {
    if (remaining <= 0) break;
    const depTotal = dep.amount + dep.accumulatedYield;
    const deduct = Math.min(remaining, depTotal);

    if (deduct <= dep.accumulatedYield) {
      dep.accumulatedYield -= deduct;
    } else {
      const rest = deduct - dep.accumulatedYield;
      dep.accumulatedYield = 0;
      dep.amount -= rest;
    }
    remaining -= deduct;
  }

  // Remove empty deposits
  investment.deposits = investment.deposits.filter(d => d.amount > 0 || d.accumulatedYield > 0);

  // Recalculate totals from deposits
  investment.totalDeposited = investment.deposits.reduce((s, d) => s + d.amount, 0);
  investment.accumulatedYield = investment.deposits.reduce((s, d) => s + d.accumulatedYield, 0);
  investment.currentAmount = investment.totalDeposited + investment.accumulatedYield;

  if (investment.currentAmount <= 0) {
    investment.currentAmount = 0;
    investment.totalDeposited = 0;
    investment.accumulatedYield = 0;
    investment.isActive = false;
  }

  await updateInvestment(investment);

  return {
    usedAmount: amountToUse,
    investmentName: investment.name,
    investmentId: investment.id,
  };
}

/**
 * Delete investment
 */
export async function deleteInvestment(id: string): Promise<void> {
  const investments = await defaultAdapter.getItem<Record<string, Investment>>(INVESTMENTS_KEY, {}) ?? {};
  delete investments[id];
  await defaultAdapter.setItem(INVESTMENTS_KEY, investments);

  const history = await defaultAdapter.getItem<YieldHistory[]>(YIELD_HISTORY_KEY, []) ?? [];
  const filtered = history.filter(h => h.investmentId !== id);
  await defaultAdapter.setItem(YIELD_HISTORY_KEY, filtered);
}

/**
 * Add amount to investment (new deposit)
 */
export async function addToInvestment(id: string, amount: number): Promise<void> {
  const investment = await getInvestmentById(id);
  if (!investment) return;

  // Migrate legacy if needed
  if (investment.totalDeposited === undefined || investment.totalDeposited === null) {
    investment.totalDeposited = investment.initialAmount;
    investment.accumulatedYield = investment.currentAmount - investment.initialAmount;
    if (investment.accumulatedYield < 0) investment.accumulatedYield = 0;
  }

  // Record new deposit with today's date
  if (!investment.deposits) investment.deposits = [];
  investment.deposits.push({
    id: generateId(),
    date: getLocalDateString(),
    amount: amount,
    accumulatedYield: 0,
  });

  investment.totalDeposited += amount;
  investment.currentAmount = investment.totalDeposited + investment.accumulatedYield;
  await updateInvestment(investment);
}

const BUSINESS_DAYS_PER_YEAR = 252;

/**
 * Calculate effective annual rate considering CDI bonus
 */
export function calculateEffectiveRate(annualRate: number, cdiBonusPercent?: number): number {
  if (cdiBonusPercent && cdiBonusPercent > 0) {
    return annualRate * (cdiBonusPercent / 100);
  }
  return annualRate;
}

/**
 * Calculate DAILY yield from annual rate (gross, no tax)
 */
export function calculateDailyYield(amount: number, annualRate: number, cdiBonusPercent?: number): number {
  const effectiveRate = calculateEffectiveRate(annualRate, cdiBonusPercent);
  const dailyRate = effectiveRate / 100 / BUSINESS_DAYS_PER_YEAR;
  return amount * dailyRate;
}

/**
 * Process daily yields for all investments
 * Yields are gross (no tax deduction). Tax is applied only on withdrawal.
 * Yields are distributed proportionally across individual deposits.
 */
export async function processDailyYields(): Promise<number> {
  const today = getLocalDateString();
  const lastProcessDate = await defaultAdapter.getItem<string>(LAST_YIELD_PROCESS_KEY, null);

  if (lastProcessDate === today) {
    return 0;
  }

  const investments = await getInvestments();
  const history = await defaultAdapter.getItem<YieldHistory[]>(YIELD_HISTORY_KEY, []) ?? [];

  let totalYieldAdded = 0;
  const yesterday = addDaysToDate(today, -1);

  for (const investment of investments) {
    if (!investment.isActive) continue;

    // Ensure deposits exist
    if (!investment.deposits || investment.deposits.length === 0) {
      investment.deposits = [{
        id: generateId(),
        date: investment.startDate,
        amount: investment.currentAmount,
        accumulatedYield: 0,
      }];
      investment.totalDeposited = investment.currentAmount;
      investment.accumulatedYield = 0;
    }

    let processStartDate = investment.startDate;

    const investmentHistory = history.filter(h => h.investmentId === investment.id);
    const lastInvestmentYield = investmentHistory
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (lastInvestmentYield) {
      processStartDate = addDaysToDate(lastInvestmentYield.date, 1);
    }

    if (processStartDate > yesterday) continue;

    // Use deposits as source of truth for balance
    let currentBalance = investment.deposits.reduce(
      (s, d) => s + d.amount + d.accumulatedYield, 0
    );

    const getYieldRateForDate = (date: string): number => {
      if (!investment.yieldRateHistory || investment.yieldRateHistory.length === 0) {
        return investment.yieldRate;
      }
      let activeRate = investment.yieldRate;
      for (const change of investment.yieldRateHistory.sort((a, b) => a.date.localeCompare(b.date))) {
        if (change.date <= date) {
          activeRate = change.newRate;
        } else {
          break;
        }
      }
      return activeRate;
    };

    let currentDate = processStartDate;

    while (currentDate <= yesterday) {
      const alreadyProcessed = history.some(
        h => h.investmentId === investment.id && h.date === currentDate
      );

      if (!alreadyProcessed) {
        const yieldRate = getYieldRateForDate(currentDate);
        const grossYield = calculateDailyYield(currentBalance, yieldRate, investment.cdiBonusPercent);

        const isDailyTax = investment.taxMode === 'daily';
        let taxAmount = 0;
        let netYield = grossYield;

        if (isDailyTax && grossYield > 0) {
          const daysSinceStart = daysBetween(investment.startDate, currentDate);
          const taxRate = getIRTaxRate(daysSinceStart);
          taxAmount = grossYield * taxRate;
          netYield = grossYield - taxAmount;
        }

        // Distribute net yield across deposits proportionally
        if (currentBalance > 0 && netYield > 0) {
          for (const dep of investment.deposits) {
            const depTotal = dep.amount + dep.accumulatedYield;
            const share = depTotal / currentBalance;
            dep.accumulatedYield += netYield * share;
          }
        }

        const balanceBefore = currentBalance;
        currentBalance += netYield;

        const yieldRecord: YieldHistory = {
          id: generateId(),
          investmentId: investment.id,
          date: currentDate,
          appliedDate: addDaysToDate(currentDate, 1),
          grossAmount: grossYield,
          taxAmount,
          netAmount: netYield,
          balanceBefore,
          balanceAfter: currentBalance,
        };

        history.push(yieldRecord);
        totalYieldAdded += netYield;
      } else {
        const existingRecord = history.find(
          h => h.investmentId === investment.id && h.date === currentDate
        );
        if (existingRecord) {
          currentBalance = existingRecord.balanceAfter;
        }
      }

      currentDate = addDaysToDate(currentDate, 1);
    }

    // Update investment totals from deposits
    investment.totalDeposited = investment.deposits.reduce((s, d) => s + d.amount, 0);
    investment.accumulatedYield = investment.deposits.reduce((s, d) => s + d.accumulatedYield, 0);
    investment.currentAmount = investment.totalDeposited + investment.accumulatedYield;
    investment.lastYieldDate = yesterday;
    await updateInvestment(investment);
  }

  await defaultAdapter.setItem(YIELD_HISTORY_KEY, history);
  await defaultAdapter.setItem(LAST_YIELD_PROCESS_KEY, today);

  return totalYieldAdded;
}

/**
 * Get yield history for an investment
 */
export async function getYieldHistory(investmentId: string): Promise<YieldHistory[]> {
  const history = await defaultAdapter.getItem<YieldHistory[]>(YIELD_HISTORY_KEY, []) ?? [];
  return history
    .filter(h => h.investmentId === investmentId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get total invested amount across all investments
 */
export async function getTotalInvested(): Promise<number> {
  const investments = await getInvestments();
  return investments
    .filter(i => i.isActive)
    .reduce((sum, i) => sum + i.currentAmount, 0);
}

/**
 * Get daily yield estimate (gross, no tax deducted)
 */
export function getDailyYieldEstimate(amount: number, annualRate: number, cdiBonusPercent?: number, daysSinceStart?: number, taxMode?: 'daily' | 'on_withdrawal'): { gross: number; net: number } {
  const gross = calculateDailyYield(amount, annualRate, cdiBonusPercent);
  if (taxMode === 'daily' && daysSinceStart !== undefined) {
    const taxRate = getIRTaxRate(daysSinceStart);
    return { gross, net: gross * (1 - taxRate) };
  }
  return { gross, net: gross };
}

/**
 * Get monthly yield estimate (~21 business days)
 */
export function getMonthlyYieldEstimate(amount: number, annualRate: number, cdiBonusPercent?: number, daysSinceStart?: number, taxMode?: 'daily' | 'on_withdrawal'): { gross: number; net: number } {
  const dailyGross = calculateDailyYield(amount, annualRate, cdiBonusPercent);
  const gross = dailyGross * 21;
  if (taxMode === 'daily' && daysSinceStart !== undefined) {
    const taxRate = getIRTaxRate(daysSinceStart);
    return { gross, net: gross * (1 - taxRate) };
  }
  return { gross, net: gross };
}

/**
 * Get estimated tax info for an investment based on deposit ages
 */
export function getInvestmentTaxInfo(investment: Investment): {
  weightedRate: number;
  estimatedTax: number;
  rateLabel: string;
} {
  const today = getLocalDateString();
  const deposits = investment.deposits || [];

  if (deposits.length === 0 || investment.accumulatedYield <= 0) {
    return { weightedRate: 0.225, estimatedTax: 0, rateLabel: '22,5%' };
  }

  let totalYield = 0;
  let weightedTax = 0;

  for (const dep of deposits) {
    const days = daysBetween(dep.date, today);
    const rate = getIRTaxRate(days);
    const tax = dep.accumulatedYield * rate;
    totalYield += dep.accumulatedYield;
    weightedTax += tax;
  }

  const weightedRate = totalYield > 0 ? weightedTax / totalYield : 0.225;

  return {
    weightedRate,
    estimatedTax: weightedTax,
    rateLabel: `${(weightedRate * 100).toFixed(1).replace('.', ',')}%`,
  };
}

/**
 * Withdraw from investment with regressive IR tax
 * Prioritizes oldest deposits (lowest tax rate)
 */
export async function withdrawFromInvestment(
  id: string,
  amount: number
): Promise<{ success: boolean; amount: number; grossAmount: number; taxAmount: number; investmentName: string } | null> {
  const investment = await getInvestmentById(id);
  if (!investment || amount > investment.currentAmount) return null;

  // Ensure deposits exist
  if (!investment.deposits || investment.deposits.length === 0) {
    investment.deposits = [{
      id: generateId(),
      date: investment.startDate,
      amount: investment.currentAmount,
      accumulatedYield: 0,
    }];
  }

  const today = getLocalDateString();
  // Sort oldest first (lowest tax rate)
  const sortedDeposits = investment.deposits.sort((a, b) => a.date.localeCompare(b.date));

  let remainingWithdraw = amount;
  let totalTax = 0;

  const skipTaxOnWithdraw = investment.taxMode === 'daily';

  for (const dep of sortedDeposits) {
    if (remainingWithdraw <= 0) break;

    const depTotal = dep.amount + dep.accumulatedYield;
    if (depTotal <= 0) continue;

    const withdrawFromDep = Math.min(remainingWithdraw, depTotal);

    // Calculate yield portion in this withdrawal
    const yieldPortion = depTotal > 0 ? (dep.accumulatedYield / depTotal) * withdrawFromDep : 0;
    const principalPortion = withdrawFromDep - yieldPortion;

    // Tax only on yield portion, based on deposit age (skip if daily mode - already deducted)
    if (!skipTaxOnWithdraw) {
      const days = daysBetween(dep.date, today);
      const taxRate = getIRTaxRate(days);
      const tax = yieldPortion * taxRate;
      totalTax += tax;
    }

    // Deduct from deposit
    dep.amount -= principalPortion;
    dep.accumulatedYield -= yieldPortion;

    // Fix floating point
    if (dep.amount < 0.001) dep.amount = 0;
    if (dep.accumulatedYield < 0.001) dep.accumulatedYield = 0;

    remainingWithdraw -= withdrawFromDep;
  }

  // Remove empty deposits
  investment.deposits = investment.deposits.filter(d => d.amount > 0 || d.accumulatedYield > 0);

  // Recalculate totals from deposits
  investment.totalDeposited = investment.deposits.reduce((s, d) => s + d.amount, 0);
  investment.accumulatedYield = investment.deposits.reduce((s, d) => s + d.accumulatedYield, 0);
  investment.currentAmount = investment.totalDeposited + investment.accumulatedYield;

  if (investment.currentAmount <= 0.01) {
    investment.currentAmount = 0;
    investment.totalDeposited = 0;
    investment.accumulatedYield = 0;
    investment.isActive = false;
    investment.deposits = [];
  }

  await updateInvestment(investment);

  const netAmount = amount - totalTax;

  return {
    success: true,
    amount: netAmount, // Net after IR
    grossAmount: amount,
    taxAmount: totalTax,
    investmentName: investment.name,
  };
}

/**
 * Get total yield for a specific month
 */
export async function getMonthlyYieldTotal(month: string): Promise<{ gross: number; tax: number; net: number }> {
  const history = await defaultAdapter.getItem<YieldHistory[]>(YIELD_HISTORY_KEY, []) ?? [];

  let gross = 0;
  let tax = 0;
  let net = 0;

  for (const h of history) {
    if (h.date.startsWith(month)) {
      gross += h.grossAmount;
      tax += h.taxAmount;
      net += h.netAmount;
    }
  }

  return { gross, tax, net };
}
