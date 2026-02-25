/**
 * Date utilities - ALL dates are LOCAL, no UTC/timezone conversion
 * Brazilian format: dd/MM/yyyy
 */

/**
 * Get current date as YYYY-MM-DD string (LOCAL time)
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current month as YYYY-MM string (LOCAL time)
 */
export function getLocalMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse a YYYY-MM-DD string into a LOCAL Date object
 * IMPORTANT: This avoids timezone issues by using the Date constructor with individual parts
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

/**
 * Parse a YYYY-MM string into a LOCAL Date object (first day of month)
 */
export function parseLocalMonth(monthString: string): Date {
  const [year, month] = monthString.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Get the month (YYYY-MM) from a date string (YYYY-MM-DD)
 */
export function getMonthFromDate(dateString: string): string {
  return dateString.slice(0, 7);
}

/**
 * Get previous month as YYYY-MM
 */
export function getPreviousMonthLocal(monthString: string): string {
  const date = parseLocalMonth(monthString);
  date.setMonth(date.getMonth() - 1);
  return getLocalMonth(date);
}

/**
 * Get next month as YYYY-MM
 */
export function getNextMonthLocal(monthString: string): string {
  const date = parseLocalMonth(monthString);
  date.setMonth(date.getMonth() + 1);
  return getLocalMonth(date);
}

/**
 * Add months to a date string, returning new YYYY-MM-DD
 */
export function addMonthsToDate(dateString: string, months: number): string {
  const date = parseLocalDate(dateString);
  date.setMonth(date.getMonth() + months);
  return getLocalDateString(date);
}

/**
 * Add weeks to a date string, returning new YYYY-MM-DD
 */
export function addWeeksToDate(dateString: string, weeks: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + (weeks * 7));
  return getLocalDateString(date);
}

/**
 * Add years to a date string, returning new YYYY-MM-DD
 */
export function addYearsToDate(dateString: string, years: number): string {
  const date = parseLocalDate(dateString);
  date.setFullYear(date.getFullYear() + years);
  return getLocalDateString(date);
}

/**
 * Add days to a date string, returning new YYYY-MM-DD
 */
export function addDaysToDate(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

/**
 * Format date as dd/MM/yyyy (Brazilian format)
 */
export function formatDateBR(dateString: string): string {
  const date = parseLocalDate(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date as dd/MMM (short Brazilian format)
 */
export function formatDateShortBR(dateString: string): string {
  const date = parseLocalDate(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${day} ${monthNames[date.getMonth()]}`;
}

/**
 * Format month as "Mês Ano" (e.g., "Janeiro 2024")
 */
export function formatMonthYearBR(monthString: string): string {
  const date = parseLocalMonth(monthString);
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Check if a date belongs to a specific month
 */
export function isDateInMonth(dateString: string, monthString: string): boolean {
  return dateString.startsWith(monthString);
}

/**
 * Get all months between start and end (inclusive)
 */
export function getMonthsInRangeLocal(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let current = startMonth;
  
  while (current <= endMonth) {
    months.push(current);
    current = getNextMonthLocal(current);
  }
  
  return months;
}

/**
 * Calculate which invoice month an expense belongs to based on card closing day
 * 
 * Rules:
 * - If expense day <= closing day: belongs to CURRENT month invoice
 * - If expense day > closing day: belongs to NEXT month invoice
 */
export function getInvoiceMonth(expenseDate: string, closingDay: number): string {
  const date = parseLocalDate(expenseDate);
  const expenseDay = date.getDate();
  const expenseMonth = getLocalMonth(date);
  
  if (expenseDay <= closingDay) {
    // Expense is before or on closing day - goes to current month invoice
    return expenseMonth;
  } else {
    // Expense is after closing day - goes to next month invoice
    return getNextMonthLocal(expenseMonth);
  }
}

/**
 * Calculate the due date for an invoice based on closing day and due day
 * 
 * Rules:
 * - If due day > closing day: due date is in the SAME month as invoice month
 * - If due day <= closing day: due date is in the NEXT month after invoice month
 * 
 * Example: Closing day 30, Due day 6 -> closes Jan 30, due Feb 6
 */
export function getInvoiceDueDate(invoiceMonth: string, closingDay: number, dueDay: number): string {
  const invoiceDate = parseLocalMonth(invoiceMonth);
  
  if (dueDay > closingDay) {
    // Due day is after closing day in the same month
    invoiceDate.setDate(dueDay);
    return getLocalDateString(invoiceDate);
  } else {
    // Due day is before or equal to closing day, so it's in the next month
    invoiceDate.setMonth(invoiceDate.getMonth() + 1);
    invoiceDate.setDate(dueDay);
    return getLocalDateString(invoiceDate);
  }
}

/**
 * Get the billing period for a given invoice month
 * Returns { start: YYYY-MM-DD, end: YYYY-MM-DD }
 */
export function getBillingPeriod(invoiceMonth: string, closingDay: number): { start: string; end: string } {
  const prevMonth = getPreviousMonthLocal(invoiceMonth);
  const prevMonthDate = parseLocalMonth(prevMonth);
  const currMonthDate = parseLocalMonth(invoiceMonth);
  
  // Start: closing day + 1 of previous month
  prevMonthDate.setDate(closingDay + 1);
  
  // End: closing day of current month
  currMonthDate.setDate(closingDay);
  
  return {
    start: getLocalDateString(prevMonthDate),
    end: getLocalDateString(currMonthDate)
  };
}
