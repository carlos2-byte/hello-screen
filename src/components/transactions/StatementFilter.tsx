import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard } from '@/lib/storage';

export interface FilterOptions {
  types: ('income' | 'expense' | 'card')[];
  categories: string[];
}

interface StatementFilterProps {
  cards: CreditCard[];
  availableCategories: string[];
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}

const typeOptions = [
  { value: 'income' as const, label: 'Receitas' },
  { value: 'expense' as const, label: 'Despesas' },
  { value: 'card' as const, label: 'Cartões' },
];

export function StatementFilter({
  availableCategories,
  filters,
  onFiltersChange,
}: StatementFilterProps) {
  const [open, setOpen] = useState(false);

  const activeFiltersCount = filters.types.length + filters.categories.length;

  const handleTypeToggle = (type: 'income' | 'expense' | 'card') => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const clearFilters = () => {
    onFiltersChange({ types: [], categories: [] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Filtros</h4>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Type filters */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <div className="space-y-2">
              {typeOptions.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${option.value}`}
                    checked={filters.types.includes(option.value)}
                    onCheckedChange={() => handleTypeToggle(option.value)}
                  />
                  <Label
                    htmlFor={`type-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {availableCategories.length > 0 && (
            <>
              <Separator className="my-3" />

              {/* Category filters */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <ScrollArea className="h-32">
                  <div className="space-y-2 pr-4">
                    {availableCategories.map(category => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={filters.categories.includes(category)}
                          onCheckedChange={() => handleCategoryToggle(category)}
                        />
                        <Label
                          htmlFor={`category-${category}`}
                          className="text-sm font-normal cursor-pointer capitalize"
                        >
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
