import { useState } from 'react';
import { Plus, TrendingUp, Trash2, ArrowDownToLine, ArrowUpFromLine, Percent, Info, Shield, Edit2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useInvestments } from '@/hooks/useInvestments';
import { InvestmentDetailSheet } from '@/components/InvestmentDetailSheet';
import { useTransactions } from '@/hooks/useTransactions';
import { formatCurrency, getCurrentMonth } from '@/lib/formatters';
import { formatDateBR } from '@/lib/dateUtils';
import { Investment, getMonthlyYieldEstimate, getDailyYieldEstimate, getInvestmentTaxInfo } from '@/lib/investments';
import { toast } from '@/hooks/use-toast';
import { CurrencyInput, parseCurrencyValue } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function InvestmentsPage() {
  const { 
    investments, 
    totalInvested, 
    defaultRate, 
    loading, 
    create, 
    remove, 
    deposit, 
    withdraw, 
    updateDefaultRate,
    updateYieldRate,
    toggleCoverage,
  } = useInvestments();
  const { addTransaction } = useTransactions(getCurrentMonth());

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [showEditRateSheet, setShowEditRateSheet] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);
  const [detailInvestment, setDetailInvestment] = useState<Investment | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRate, setNewRate] = useState('');
  const [hasCdiBonus, setHasCdiBonus] = useState(false);
  const [cdiBonusPercent, setCdiBonusPercent] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editHasCdiBonus, setEditHasCdiBonus] = useState(false);
  const [editCdiBonusPercent, setEditCdiBonusPercent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTaxMode, setNewTaxMode] = useState<'daily' | 'on_withdrawal'>('on_withdrawal');
  const [editTaxMode, setEditTaxMode] = useState<'daily' | 'on_withdrawal'>('on_withdrawal');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyValue(newAmount);
    if (!newName.trim() || isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const rate = newRate ? parseFloat(newRate.replace(',', '.')) : undefined;
      const bonus = hasCdiBonus && cdiBonusPercent ? parseFloat(cdiBonusPercent.replace(',', '.')) : undefined;
      await create(newName.trim(), amount, rate, undefined, newType.trim() || undefined, bonus, newTaxMode);
      toast({ title: 'Investimento criado!' });
      setNewName('');
      setNewType('');
      setNewAmount('');
      setNewRate('');
      setHasCdiBonus(false);
      setCdiBonusPercent('');
      setNewTaxMode('on_withdrawal');
      setShowAddSheet(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;
    
    const amount = parseCurrencyValue(actionAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await deposit(selectedInvestment.id, amount);
      toast({ title: 'Depósito realizado!' });
      setActionAmount('');
      setShowDepositSheet(false);
      setSelectedInvestment(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;
    
    const amount = parseCurrencyValue(actionAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (amount > selectedInvestment.currentAmount) {
      toast({ title: 'Valor excede o saldo disponível', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await withdraw(selectedInvestment.id, amount);
      if (result?.success) {
        // Create income transaction with net amount (after IR)
        await addTransaction({
          amount: result.amount,
          description: `Resgate: ${result.investmentName}`,
          type: 'income',
          date: new Date().toISOString().split('T')[0],
          category: 'income',
        });
        const taxMsg = result.taxAmount && result.taxAmount > 0
          ? ` (IR: ${formatCurrency(result.taxAmount)})`
          : '';
        toast({
          title: 'Resgate realizado!',
          description: `Líquido: ${formatCurrency(result.amount)}${taxMsg}`
        });
      }
      setActionAmount('');
      setShowWithdrawSheet(false);
      setSelectedInvestment(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newRate.replace(',', '.'));
    if (isNaN(rate) || rate < 0) return;

    await updateDefaultRate(rate);
    toast({ title: 'Taxa atualizada!' });
    setNewRate('');
    setShowRateSheet(false);
  };

  const handleEditInvestmentRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;
    
    const rate = parseFloat(editRate.replace(',', '.'));
    if (isNaN(rate) || rate < 0) return;

    setIsSubmitting(true);
    try {
      const bonus = editHasCdiBonus && editCdiBonusPercent ? parseFloat(editCdiBonusPercent.replace(',', '.')) : undefined;
      await updateYieldRate(selectedInvestment.id, rate, bonus, editTaxMode);
      toast({ 
        title: 'Taxa atualizada!',
        description: 'O novo rendimento será aplicado a partir de hoje.'
      });
      setEditRate('');
      setEditHasCdiBonus(false);
      setEditCdiBonusPercent('');
      setShowEditRateSheet(false);
      setSelectedInvestment(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCoverage = async (inv: Investment) => {
    await toggleCoverage(inv.id);
    toast({ 
      title: inv.canCoverNegativeBalance 
        ? 'Cobertura desativada' 
        : 'Cobertura ativada',
      description: inv.canCoverNegativeBalance
        ? 'Este investimento não será mais usado para cobrir saldo negativo.'
        : 'Este investimento poderá ser usado para cobrir saldo negativo.'
    });
  };

  const handleDelete = async () => {
    if (!investmentToDelete) return;
    await remove(investmentToDelete.id);
    toast({ title: 'Investimento excluído' });
    setInvestmentToDelete(null);
  };

  const getDaysSinceStart = (inv: Investment) => {
    const start = new Date(inv.startDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  };

  // Calculate totals for display
  const totalDailyYield = investments
    .filter(i => i.isActive)
    .reduce((sum, inv) => {
      const days = getDaysSinceStart(inv);
      return sum + getDailyYieldEstimate(inv.currentAmount, inv.yieldRate, inv.cdiBonusPercent, days, inv.taxMode).net;
    }, 0);

  const totalMonthlyYield = investments
    .filter(i => i.isActive)
    .reduce((sum, inv) => {
      const days = getDaysSinceStart(inv);
      return sum + getMonthlyYieldEstimate(inv.currentAmount, inv.yieldRate, inv.cdiBonusPercent, days, inv.taxMode).net;
    }, 0);

  const totalMonthlyTax = investments
    .filter(i => i.isActive)
    .reduce((sum, inv) => {
      const days = getDaysSinceStart(inv);
      const est = getMonthlyYieldEstimate(inv.currentAmount, inv.yieldRate, inv.cdiBonusPercent, days, inv.taxMode);
      return sum + (est.gross - est.net);
    }, 0);

  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-center flex-1">Investimentos</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRateSheet(true)}>
              <Percent className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setShowAddSheet(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Total Card */}
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 min-w-0">
              <TrendingUp className="h-8 w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total Investido</p>
                <p className="text-2xl font-bold text-primary tabular-nums truncate">
                  {formatCurrency(totalInvested)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-primary/20">
              <div>
                <p className="text-[10px] text-muted-foreground">Rend. Dia</p>
                <p className="text-xs font-semibold text-success tabular-nums">
                  +{formatCurrency(totalDailyYield)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Rend. Mês</p>
                <p className="text-xs font-semibold text-success tabular-nums">
                  +{formatCurrency(totalMonthlyYield)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">IR est. (mês)</p>
                <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                  -{formatCurrency(totalMonthlyTax)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Taxa padrão: {defaultRate}% a.a. • IR: tab. reg. p/ IR (15% a 22,5%)
            </p>
          </CardContent>
        </Card>

        {/* Add Investment Button - overlapping between card and list */}
        <div className="flex justify-center -mt-10 -mb-6 relative z-10">
          <Button
            className="rounded-full px-6 h-10 shadow-lg"
            onClick={() => setShowAddSheet(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {/* Investments List */}
        <ScrollArea className="h-[calc(100vh-380px)]">

          {/* Investments List */}
          {investments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum investimento cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {investments.map(inv => {
                const days = getDaysSinceStart(inv);
                const dailyYield = getDailyYieldEstimate(inv.currentAmount, inv.yieldRate, inv.cdiBonusPercent, days, inv.taxMode);
                const monthlyYield = getMonthlyYieldEstimate(inv.currentAmount, inv.yieldRate, inv.cdiBonusPercent, days, inv.taxMode);
                const totalYield = inv.accumulatedYield ?? 0;
                const taxInfo = getInvestmentTaxInfo(inv);
                const isDailyTax = inv.taxMode === 'daily';
                const monthlyTax = monthlyYield.gross - monthlyYield.net;
                
                return (
                  <Card key={inv.id} className="cursor-pointer" onClick={() => setDetailInvestment(inv)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{inv.name}</h3>
                            {inv.type && (
                              <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                                {inv.type}
                              </span>
                            )}
                            {inv.cdiBonusPercent && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                {inv.cdiBonusPercent}%
                              </span>
                            )}
                            {inv.canCoverNegativeBalance && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Shield className="h-4 w-4 text-primary" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Pode cobrir saldo negativo</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Início: {formatDateBR(inv.startDate)} • {inv.yieldRate}% a.a.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Imposto: {inv.taxMode === 'daily' ? 'descontado diariamente' : 'descontado no saque'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8 shrink-0"
                          onClick={(e) => { e.stopPropagation(); setInvestmentToDelete(inv); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Saldo atual</p>
                          <p className="text-xl font-bold tabular-nums truncate">
                            {formatCurrency(inv.currentAmount)}
                          </p>
                          {/* totalYield kept for internal use but hidden from UI */}
                        </div>
                      </div>

                      {/* Yield Estimates */}
                      <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            {isDailyTax ? 'Rend. Líq./Dia' : 'Rend. Dia'}
                          </p>
                          <p className="text-xs font-medium text-success tabular-nums">
                            +{formatCurrency(dailyYield.net)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            {isDailyTax ? 'Rend. Líq./Mês' : 'Rend. Mês'}
                          </p>
                          <p className="text-xs font-medium text-success tabular-nums">
                            +{formatCurrency(monthlyYield.net)}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-[10px] text-muted-foreground">
                              {isDailyTax ? 'IR descontado' : 'IR est. (saque)'}
                            </p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Alíquota: {taxInfo.rateLabel}</p>
                                  <p>{isDailyTax ? 'IR já descontado do rendimento' : 'IR cobrado apenas no resgate'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            -{formatCurrency(isDailyTax ? monthlyTax : monthlyYield.gross * taxInfo.weightedRate)} ({taxInfo.rateLabel})
                          </p>
                        </div>
                      </div>

                      {/* Coverage Toggle */}
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg mb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Cobrir saldo negativo</span>
                        </div>
                        <Switch
                          checked={inv.canCoverNegativeBalance || false}
                          onCheckedChange={() => handleToggleCoverage(inv)}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvestment(inv);
                            setShowDepositSheet(true);
                          }}
                        >
                          <ArrowDownToLine className="h-4 w-4 mr-1" />
                          Depositar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvestment(inv);
                            setShowWithdrawSheet(true);
                          }}
                        >
                          <ArrowUpFromLine className="h-4 w-4 mr-1" />
                          Resgatar
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvestment(inv);
                            setEditRate(String(inv.yieldRate));
                            setEditHasCdiBonus(!!inv.cdiBonusPercent);
                            setEditCdiBonusPercent(inv.cdiBonusPercent ? String(inv.cdiBonusPercent) : '');
                            setEditTaxMode(inv.taxMode ?? 'on_withdrawal');
                            setShowEditRateSheet(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Add Investment Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Novo Investimento</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Tesouro Selic, CDB Banco X"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo (opcional)</Label>
              <Input
                value={newType}
                onChange={e => setNewType(e.target.value)}
                placeholder="Ex: Renda Fixa, Tesouro, CDB, Fundos"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Inicial</Label>
              <CurrencyInput value={newAmount} onChange={setNewAmount} required />
            </div>
            <div className="space-y-2">
              <Label>Taxa de Referência (% a.a.)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                placeholder={`Padrão: ${defaultRate}%`}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <Label htmlFor="has-cdi-bonus" className="cursor-pointer">
                Existe bônus acima da %?
              </Label>
              <Switch
                id="has-cdi-bonus"
                checked={hasCdiBonus}
                onCheckedChange={setHasCdiBonus}
              />
            </div>
            {hasCdiBonus && (
              <div className="space-y-2">
                <Label>Percentual da (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={cdiBonusPercent}
                  onChange={e => setCdiBonusPercent(e.target.value)}
                  placeholder="Ex: 115 (para 115%)"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o percentual. Ex: 115 significa 115% da taxa.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Forma de cobrança do imposto</Label>
              <RadioGroup
                value={newTaxMode}
                onValueChange={(v) => setNewTaxMode(v as 'daily' | 'on_withdrawal')}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="daily" id="new-tax-daily" />
                  <Label htmlFor="new-tax-daily" className="text-sm cursor-pointer">
                    Descontar imposto diariamente
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="on_withdrawal" id="new-tax-withdrawal" />
                  <Label htmlFor="new-tax-withdrawal" className="text-sm cursor-pointer">
                    Descontar imposto apenas no saque
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              Rendimento calculado com base em 252 dias úteis/ano.
              IR pela tabela regressiva, cobrado apenas no resgate.
            </p>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar Investimento'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Rate Sheet */}
      <Sheet open={showRateSheet} onOpenChange={setShowRateSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Taxa Padrão de Rendimento</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleUpdateRate} className="space-y-4">
            <div className="space-y-2">
              <Label>Taxa Anual (%)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                placeholder={`Atual: ${defaultRate}%`}
              />
              <p className="text-xs text-muted-foreground">
                Novos investimentos usarão esta taxa por padrão.
                Rendimento diário = (taxa anual / 252) × saldo
              </p>
            </div>
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Investment Rate Sheet */}
      <Sheet open={showEditRateSheet} onOpenChange={setShowEditRateSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Alterar Taxa de {selectedInvestment?.name}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleEditInvestmentRate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Taxa (% a.a.)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={editRate}
                onChange={e => setEditRate(e.target.value)}
                placeholder="Ex: 7.5"
                required
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <Label htmlFor="edit-cdi-bonus" className="cursor-pointer">
                Existe bônus acima da %?
              </Label>
              <Switch
                id="edit-cdi-bonus"
                checked={editHasCdiBonus}
                onCheckedChange={setEditHasCdiBonus}
              />
            </div>
            {editHasCdiBonus && (
              <div className="space-y-2">
                <Label>Percentual da (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editCdiBonusPercent}
                  onChange={e => setEditCdiBonusPercent(e.target.value)}
                  placeholder="Ex: 115 (para 115%)"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o percentual. Ex: 115 significa 115% da taxa.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Forma de cobrança do imposto</Label>
              <RadioGroup
                value={editTaxMode}
                onValueChange={(v) => setEditTaxMode(v as 'daily' | 'on_withdrawal')}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="daily" id="edit-tax-daily" />
                  <Label htmlFor="edit-tax-daily" className="text-sm cursor-pointer">
                    Descontar imposto diariamente
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="on_withdrawal" id="edit-tax-withdrawal" />
                  <Label htmlFor="edit-tax-withdrawal" className="text-sm cursor-pointer">
                    Descontar imposto apenas no saque
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Importante:</strong> A nova taxa será aplicada apenas a partir de hoje.
              O histórico de rendimentos passados não será recalculado.
            </p>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Atualizar Taxa'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Deposit Dialog - centered */}
      <Dialog open={showDepositSheet} onOpenChange={setShowDepositSheet}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Depositar em {selectedInvestment?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDeposit} className="space-y-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <CurrencyInput value={actionAmount} onChange={setActionAmount} required />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Depositando...' : 'Confirmar Depósito'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog - centered */}
      <Dialog open={showWithdrawSheet} onOpenChange={setShowWithdrawSheet}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resgatar de {selectedInvestment?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saldo disponível: {formatCurrency(selectedInvestment?.currentAmount || 0)}
            </p>
            <div className="space-y-2">
              <Label>Valor</Label>
              <CurrencyInput value={actionAmount} onChange={setActionAmount} required />
              <p className="text-xs text-muted-foreground">
                IR descontado automaticamente (tabela regressiva: 22,5% a 15%).
                O valor líquido será adicionado como receita.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Resgatando...' : 'Confirmar Resgate'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Investment Detail Sheet */}
      <InvestmentDetailSheet
        investment={detailInvestment}
        open={!!detailInvestment}
        onOpenChange={(open) => { if (!open) setDetailInvestment(null); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!investmentToDelete} onOpenChange={() => setInvestmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir investimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{investmentToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
