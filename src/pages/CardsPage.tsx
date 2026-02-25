import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CreditCard as CardIcon } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCreditCards, useCardDetails } from '@/hooks/useCreditCards';
import { formatCurrency, getCurrentMonth, formatMonthYear } from '@/lib/formatters';
import { AddCardSheet } from '@/components/cards/AddCardSheet';
import { CreditCard } from '@/lib/storage';

const CARD_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-orange-500 to-red-600',
  'from-cyan-500 to-blue-600',
];

function CardItem({
  card,
  index,
  onClick,
}: {
  card: CreditCard;
  index: number;
  onClick: () => void;
}) {
  const { monthlyTotal, availableLimit } = useCardDetails(card.id);
  const colorClass = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <div
        className={`relative h-40 rounded-2xl bg-gradient-to-br ${colorClass} p-5 shadow-lg overflow-hidden`}
      >
        {/* Card Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 h-16 w-16 rounded-full border-4 border-white/30" />
          <div className="absolute top-8 right-8 h-16 w-16 rounded-full border-4 border-white/20" />
        </div>

        <div className="relative h-full flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <CardIcon className="h-8 w-8 text-white/80" />
            <div className="text-right">
              <p className="text-xs text-white/70">Fatura {formatMonthYear(getCurrentMonth())}</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(monthlyTotal)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-white font-semibold">{card.name}</p>
            <div className="flex items-center justify-between">
              <p className="text-white/80 font-mono text-sm">
                •••• •••• •••• {card.last4 || '****'}
              </p>
              <div className="text-right text-xs text-white/70">
                {card.closingDay && <p>Fecha dia {card.closingDay}</p>}
                {card.limit && (
                  <p>Limite: {formatCurrency(availableLimit)} disponível</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function CardsPage() {
  const navigate = useNavigate();
  const { cards, loading, createCard } = useCreditCards();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const handleCardClick = (cardId: string) => {
    navigate(`/cards/${cardId}`);
  };

  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-center flex-1">Cartões</h1>
          <Button onClick={() => setShowAddSheet(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>
      }
    >
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="space-y-4 pb-4">
          {/* Cards List */}
          {cards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CardIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
                <Button className="mt-4" onClick={() => setShowAddSheet(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Cartão
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cards.map((card, index) => (
                <CardItem
                  key={card.id}
                  card={card}
                  index={index}
                  onClick={() => handleCardClick(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Card Sheet */}
      <AddCardSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        cards={cards}
        onSubmit={createCard}
      />
    </PageContainer>
  );
}
