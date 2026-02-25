import { useState, useMemo, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthSelector } from '@/components/transactions/MonthSelector';
import { Button } from '@/components/ui/button';
import { useStatement, isConsolidatedInvoice } from '@/hooks/useStatement';
import { formatCurrency, getCurrentMonth } from '@/lib/formatters';
import { getCategories } from '@/lib/storage';
import { TrendingUp, TrendingDown, PiggyBank, Shield, Share2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { calculateFutureCoverableExpenses } from '@/lib/investCoverage';
import { ShareSummarySheet } from '@/components/dashboard/ShareSummarySheet';
import { useInvestments } from '@/hooks/useInvestments';
import { useCreditCards } from '@/hooks/useCreditCards';

export default function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const { items, totals, balanceData, loading } = useStatement(month);
  const { totalInvested } = useInvestments();
  const { cards } = useCreditCards();
  const [futureCoverage, setFutureCoverage] = useState<{ total: number; items: Array<{ date: string; description: string; amount: number }> }>({ total: 0, items: [] });
  const [showShare, setShowShare] = useState(false);

  // Calculate future expenses that will be covered by investment
  useEffect(() => {
    const calculateCoverage = async () => {
      if (items.length === 0) {
        setFutureCoverage({ total: 0, items: [] });
        return;
      }
      const { totalCoverable, coverableItems } = await calculateFutureCoverableExpenses(items);
      setFutureCoverage({ total: totalCoverable, items: coverableItems });
    };
    calculateCoverage();
  }, [items]);

  // Category breakdown for current month - extract from statement items
  const { categoryData, categoryTotals } = useMemo(() => {
    const categories = getCategories().filter(c => c.type === 'expense');
    const totalsMap: Record<string, number> = {};
    
    // Calculate category totals from statement items
    for (const item of items) {
      if (isConsolidatedInvoice(item)) {
        // For invoices, aggregate from transactions
        for (const tx of item.transactions) {
          if (tx.category) {
            totalsMap[tx.category] = (totalsMap[tx.category] || 0) + Math.abs(tx.amount);
          }
        }
      } else if (item.type === 'expense' && item.category) {
        totalsMap[item.category] = (totalsMap[item.category] || 0) + Math.abs(item.amount);
      }
    }
    
    const data = categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        value: totalsMap[cat.id] || 0,
        color: cat.color,
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
    
    return { categoryData: data, categoryTotals: totalsMap };
  }, [items]);

  const totalExpenses = totals.expense;
  const currentBalance = balanceData?.currentBalance ?? (totals.income - totals.expense);

  return (
    <PageContainer
      header={
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <h1 className="text-2xl font-bold text-center">Relatório</h1>
            <div className="flex-1 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => setShowShare(true)}>
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <MonthSelector month={month} onMonthChange={setMonth} />
        </div>
      }
    >
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-6 pb-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-success/10 border-success/20">
              <CardContent className="pt-4 px-3">
                <TrendingUp className="h-5 w-5 text-success mb-1" />
                <p className="text-[10px] text-muted-foreground">Receitas</p>
                <p className="text-sm font-bold text-success tabular-nums">
                  {formatCurrency(totals.income)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="pt-4 px-3">
                <TrendingDown className="h-5 w-5 text-destructive mb-1" />
                <p className="text-[10px] text-muted-foreground">Saídas previstas</p>
                <p className="text-sm font-bold text-destructive tabular-nums">
                  {formatCurrency(totals.expense)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-4 px-3">
                <PiggyBank className="h-5 w-5 text-primary mb-1" />
                <p className="text-[10px] text-muted-foreground">Saldo Atual</p>
                <p className={`text-sm font-bold tabular-nums ${currentBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(currentBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Total Expenses */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total de Despesas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-destructive tabular-nums">
                {formatCurrency(totalExpenses)}
              </p>
              {futureCoverage.total > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/10 p-2 rounded">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>
                    {formatCurrency(futureCoverage.total)} será coberto por investimento
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : categoryData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Sem despesas neste mês
                </p>
              ) : (
                <div className="space-y-4">
                  {categoryData.map(cat => {
                    const percentage = totalExpenses > 0 
                      ? ((cat.value / totalExpenses) * 100).toFixed(1)
                      : '0';
                    
                    return (
                      <div key={cat.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cat.color }}
                            />
                            <span>{cat.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium tabular-nums">
                              {formatCurrency(cat.value)}
                            </span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({percentage}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Summary List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumo das Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Total de receitas</span>
                  <span className="font-medium text-success tabular-nums">
                    +{formatCurrency(totals.income)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Total de saídas previstas</span>
                  <span className="font-medium text-destructive tabular-nums">
                    -{formatCurrency(totals.expense)}
                  </span>
                </div>
                {futureCoverage.total > 0 && (
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3 text-primary" />
                      Cobertura pendente (investimento)
                    </span>
                    <span className="font-medium text-primary tabular-nums">
                      {formatCurrency(futureCoverage.total)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 font-medium">
                  <span>Saldo Atual</span>
                  <span className={currentBalance >= 0 ? 'text-success' : 'text-destructive'}>
                    {currentBalance >= 0 ? '+' : ''}{formatCurrency(currentBalance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <ShareSummarySheet
        open={showShare}
        onOpenChange={setShowShare}
        month={month}
        income={totals.income}
        expense={totals.expense}
        currentBalance={currentBalance}
        futureCoverage={futureCoverage.total}
        categoryData={categoryData}
        totalInvested={totalInvested}
        statementItems={items}
        cards={cards}
      />
    </PageContainer>
  );
}
