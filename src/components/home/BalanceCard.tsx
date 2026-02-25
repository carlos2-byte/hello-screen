import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Calendar, Sparkles, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BalanceCardProps {
  /** Saldo Atual: Entradas - despesas/faturas já vencidas */
  currentBalance: number;
  /** Saídas previstas: total de despesas/faturas futuras */
  projectedExpenses: number;
  income: number;
  expense: number;
  loading?: boolean;
  dailyYield?: number;
  balanceYieldEnabled?: boolean;
  balanceYieldRate?: number;
  balanceExtraYieldEnabled?: boolean;
  balanceExtraYieldPercent?: number;
  balanceYieldTaxMode?: 'daily' | 'on_withdrawal';
  onToggleBalanceYield?: () => void;
}

export function BalanceCard({ 
  currentBalance, 
  projectedExpenses,
  income, 
  expense, 
  loading,
  dailyYield = 0,
  balanceYieldEnabled = false,
  balanceYieldRate = 0,
  balanceExtraYieldEnabled = false,
  balanceExtraYieldPercent = 0,
  balanceYieldTaxMode = 'on_withdrawal',
  onToggleBalanceYield,
}: BalanceCardProps) {
  const hasFutureExpenses = projectedExpenses > 0;
  // Use multiplicative formula: rate * (bonusPercent / 100), same as investments
  const effectiveRate = balanceExtraYieldEnabled && balanceExtraYieldPercent > 0
    ? balanceYieldRate * (balanceExtraYieldPercent / 100)
    : balanceYieldRate;
  
  return (
    <Card className="bg-gradient-to-br from-primary/20 to-accent/10 border-primary/20">
      <CardContent className="pt-6">
        {/* Main Balance - Saldo Atual */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            {onToggleBalanceYield && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-full transition-colors",
                  balanceYieldEnabled 
                    ? "bg-success/20 text-success hover:bg-success/30" 
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
                onClick={onToggleBalanceYield}
                title={balanceYieldEnabled ? "Rendimento ativo" : "Rendimento inativo"}
              >
                <PiggyBank className="h-3.5 w-3.5" />
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Saldo Atual
            </p>
            {balanceYieldEnabled && (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <PiggyBank className="h-3 w-3" />
                RENDENDO
              </span>
            )}
          </div>
          <p
            className={cn(
              'text-3xl font-bold tabular-nums',
              currentBalance >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {loading ? '...' : formatCurrency(currentBalance)}
          </p>
          
          {/* Show future expenses indicator */}
          {hasFutureExpenses && (
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Contas a vencer: {formatCurrency(projectedExpenses)}</span>
            </div>
          )}
          
          {/* Show daily yield indicator */}
          {balanceYieldEnabled && (
            <div className="mt-2 space-y-0.5">
              {dailyYield > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-success">
                  <Sparkles className="h-3 w-3" />
                  <span>Rendimento diário: +{formatCurrency(dailyYield)}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center">
                Saldo rendendo a {effectiveRate.toFixed(2)}% a.a.{balanceExtraYieldEnabled && balanceExtraYieldPercent > 0 ? ` (${balanceYieldRate}% × ${balanceExtraYieldPercent}%)` : ''} • Imposto {balanceYieldTaxMode === 'daily' ? 'descontado diariamente' : 'descontado apenas no saque'}
              </p>
            </div>
          )}
        </div>

        {/* Income / Expense Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Income - Entradas */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="font-semibold text-success tabular-nums">
                {loading ? '...' : formatCurrency(income)}
              </p>
            </div>
          </div>

          {/* Expense - Saídas Previstas */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/20">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saídas previstas</p>
              <p className="font-semibold text-destructive tabular-nums">
                {loading ? '...' : formatCurrency(expense)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
