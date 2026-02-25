import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMonthYear, getPreviousMonth, getNextMonth, getCurrentMonth } from '@/lib/formatters';
import { getMonthsWithTransactions } from '@/lib/storage';

interface MonthSelectorProps {
  month: string;
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ month, onMonthChange }: MonthSelectorProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [showSelect, setShowSelect] = useState(false);
  const currentMonth = getCurrentMonth();
  const isCurrentMonth = month === currentMonth;

  // Load all months that have transactions
  useEffect(() => {
    const loadMonths = async () => {
      const months = await getMonthsWithTransactions();
      // Always include current month and selected month
      const allMonths = new Set([...months, currentMonth, month]);
      // Add a few future months for planning
      let futureMonth = currentMonth;
      for (let i = 0; i < 6; i++) {
        futureMonth = getNextMonth(futureMonth);
        allMonths.add(futureMonth);
      }
      // Add some past months even if empty
      let pastMonth = currentMonth;
      for (let i = 0; i < 12; i++) {
        pastMonth = getPreviousMonth(pastMonth);
        allMonths.add(pastMonth);
      }
      setAvailableMonths(Array.from(allMonths).sort());
    };
    loadMonths();
  }, [currentMonth, month]);

  const handlePrevious = () => {
    onMonthChange(getPreviousMonth(month));
  };

  const handleNext = () => {
    onMonthChange(getNextMonth(month));
  };

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevious}
        className="h-10 w-10"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      {showSelect ? (
        <Select 
          value={month} 
          onValueChange={(value) => {
            onMonthChange(value);
            setShowSelect(false);
          }}
          open={showSelect}
          onOpenChange={setShowSelect}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(m => (
              <SelectItem key={m} value={m}>
                {formatMonthYear(m)}
                {m === currentMonth && ' (atual)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <button
          onClick={() => setShowSelect(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-semibold capitalize page-title">
            {formatMonthYear(month)}
          </span>
          {!isCurrentMonth && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMonthChange(currentMonth);
              }}
              className="text-xs text-primary hover:underline"
            >
              (ir para atual)
            </button>
          )}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-10 w-10"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
