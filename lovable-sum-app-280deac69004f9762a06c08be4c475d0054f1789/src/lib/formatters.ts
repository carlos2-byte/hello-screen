/**
 * Formatting utilities for currency and dates
 * Uses LOCAL dates only - no UTC/timezone conversion
 */

import { 
  getLocalMonth, 
  getLocalDateString, 
  formatDateShortBR, 
  formatMonthYearBR,
  getPreviousMonthLocal,
  getNextMonthLocal,
  getMonthsInRangeLocal
} from './dateUtils';

export function formatCurrency(
  amount: number,
  currency: string = 'BRL',
  locale: string = 'pt-BR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  dateString: string,
  _locale: string = 'pt-BR',
  _options?: Intl.DateTimeFormatOptions
): string {
  return formatDateShortBR(dateString);
}

export function formatFullDate(
  dateString: string,
  _locale: string = 'pt-BR'
): string {
  // Format as dd de month de yyyy
  const [year, month, day] = dateString.split('-').map(Number);
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `${String(day).padStart(2, '0')} de ${monthNames[month - 1]} de ${year}`;
}

export function formatMonthYear(
  month: string,
  _locale: string = 'pt-BR'
): string {
  return formatMonthYearBR(month);
}

export function getCurrentMonth(): string {
  return getLocalMonth();
}

export function getCurrentDate(): string {
  return getLocalDateString();
}

export function getPreviousMonth(month: string): string {
  return getPreviousMonthLocal(month);
}

export function getNextMonth(month: string): string {
  return getNextMonthLocal(month);
}

export function getMonthsInRange(startMonth: string, endMonth: string): string[] {
  return getMonthsInRangeLocal(startMonth, endMonth);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
