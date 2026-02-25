import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  getCreditCards,
  getCreditCardById,
  addCreditCard,
  updateCreditCard,
  deleteCreditCard,
  getCardPurchases,
  getCardMonthlyTotal,
  Transaction,
} from '@/lib/storage';
import { generateId, getCurrentMonth } from '@/lib/formatters';
import { generateAutoCardPayments } from '@/lib/autoCardPay';
import { 
  storeOriginalCardLimit, 
  removeOriginalCardLimit,
  recalculateCardLimit,
} from '@/lib/dataIntegrity';

export function useCreditCards() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const loadedCards = await getCreditCards();
      setCards(loadedCards);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const createCard = useCallback(
    async (card: Omit<CreditCard, 'id'>) => {
      const newCard: CreditCard = {
        ...card,
        id: generateId(),
      };
      await addCreditCard(newCard);
      
      // Store original limit for data integrity calculations
      if (newCard.limit) {
        await storeOriginalCardLimit(newCard.id, newCard.limit);
      }
      
      await loadCards();
      return newCard;
    },
    [loadCards]
  );

  const editCard = useCallback(
    async (card: CreditCard) => {
      await updateCreditCard(card);
      // If card has a payer configured, regenerate auto-payments
      if (card.defaultPayerCardId) {
        await generateAutoCardPayments();
      }
      // Recalculate limit to ensure consistency
      await recalculateCardLimit(card.id);
      await loadCards();
    },
    [loadCards]
  );

  const removeCard = useCallback(
    async (cardId: string) => {
      // Remove stored original limit
      await removeOriginalCardLimit(cardId);
      await deleteCreditCard(cardId);
      await loadCards();
    },
    [loadCards]
  );

  return {
    cards,
    loading,
    createCard,
    editCard,
    removeCard,
    refresh: loadCards,
  };
}

export function useCardDetails(cardId: string, month?: string) {
  const [card, setCard] = useState<CreditCard | null>(null);
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const targetMonth = month || getCurrentMonth();

  const loadDetails = useCallback(async () => {
    if (!cardId) {
      setCard(null);
      setPurchases([]);
      setMonthlyTotal(0);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const [loadedCard, loadedPurchases, total] = await Promise.all([
        getCreditCardById(cardId),
        getCardPurchases(cardId, targetMonth),
        getCardMonthlyTotal(cardId, targetMonth),
      ]);
      
      setCard(loadedCard || null);
      setPurchases(loadedPurchases);
      setMonthlyTotal(total);
    } finally {
      setLoading(false);
    }
  }, [cardId, targetMonth]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Calculate available limit based on total unpaid purchases across all months
  // The card.limit already tracks available limit (it's consumed when purchases are made
  // and restored when payments are made)
  const availableLimit = card?.limit ?? 0;

  return {
    card,
    purchases,
    monthlyTotal,
    availableLimit,
    loading,
    refresh: loadDetails,
  };
}
