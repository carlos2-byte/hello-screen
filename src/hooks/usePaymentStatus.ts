import { useState, useEffect, useCallback } from 'react';
import { defaultAdapter } from '@/lib/storageAdapter';
import { parseLocalDate, getLocalDateString } from '@/lib/dateUtils';

const PAYMENT_STATUS_KEY = 'payment_status';

export interface PaymentStatus {
  [itemId: string]: {
    isPaid: boolean;
    paidAt?: string;
  };
}

export function usePaymentStatus() {
  const [status, setStatus] = useState<PaymentStatus>({});
  const [loading, setLoading] = useState(true);

  // Load status from storage
  useEffect(() => {
    async function load() {
      const saved = await defaultAdapter.getItem<PaymentStatus>(PAYMENT_STATUS_KEY, {});
      setStatus(saved ?? {});
      setLoading(false);
    }
    load();
  }, []);

  // Toggle payment status for an item
  const toggleStatus = useCallback(async (itemId: string) => {
    const newStatus = { ...status };
    const current = newStatus[itemId];
    
    if (current?.isPaid) {
      // Unmark as paid
      delete newStatus[itemId];
    } else {
      // Mark as paid
      newStatus[itemId] = {
        isPaid: true,
        paidAt: new Date().toISOString(),
      };
    }
    
    setStatus(newStatus);
    await defaultAdapter.setItem(PAYMENT_STATUS_KEY, newStatus);
  }, [status]);

  // Check if an item is paid
  const isPaid = useCallback((itemId: string): boolean => {
    return status[itemId]?.isPaid ?? false;
  }, [status]);

  // Check if an item is overdue (not paid and past due date)
  const isOverdue = useCallback((itemId: string, dueDate: string): boolean => {
    if (isPaid(itemId)) return false;
    
    const today = getLocalDateString(new Date());
    const due = parseLocalDate(dueDate);
    const todayDate = parseLocalDate(today);
    
    return todayDate > due;
  }, [isPaid]);

  return {
    status,
    loading,
    toggleStatus,
    isPaid,
    isOverdue,
  };
}
