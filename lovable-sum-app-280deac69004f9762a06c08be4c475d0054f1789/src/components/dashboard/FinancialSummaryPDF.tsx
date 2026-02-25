import { forwardRef } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { TrendingUp, TrendingDown, Shield, Landmark, CreditCard } from 'lucide-react';
import { StatementItem, isConsolidatedInvoice } from '@/hooks/useStatement';
import { formatDateBR } from '@/lib/dateUtils';
import { getCategories, type CreditCard as CreditCardType } from '@/lib/storage';

interface CategoryItem {
  id: string;
  name: string;
  value: number;
  color: string;
}

interface FinancialSummaryPDFProps {
  month: string;
  income: number;
  expense: number;
  currentBalance: number;
  futureCoverage: number;
  categoryData: CategoryItem[];
  totalInvested: number;
  statementItems: StatementItem[];
  cards?: CreditCardType[];
}

const RADIAN = Math.PI / 180;

function renderCustomLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: {
  cx: number; cy: number; midAngle: number;
  innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

const PAGE_STYLE: React.CSSProperties = {
  width: 420,
  padding: 28,
  background: 'linear-gradient(145deg, #0f1729 0%, #162033 50%, #0d1520 100%)',
  color: '#e2e8f0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: 16,
  position: 'relative',
  overflow: 'hidden',
};

const SECTION_STYLE: React.CSSProperties = {
  padding: 14, borderRadius: 12,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  marginBottom: 18,
};

/** Page 1: Summary with charts */
export const FinancialSummaryPage = forwardRef<HTMLDivElement, FinancialSummaryPDFProps>(
  ({ month, income, expense, currentBalance, futureCoverage, categoryData, totalInvested }, ref) => {
    const barData = [
      { name: 'Receitas', value: income, fill: '#34d399' },
      { name: 'Despesas', value: expense, fill: '#f87171' },
    ];

    const topCategories = categoryData.slice(0, 6);
    const otherTotal = categoryData.slice(6).reduce((sum, c) => sum + c.value, 0);
    const pieData = otherTotal > 0
      ? [...topCategories, { id: 'other', name: 'Outros', value: otherTotal, color: '#6b7280' }]
      : topCategories;

    return (
      <div ref={ref} style={PAGE_STYLE}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(52, 211, 153, 0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(96, 165, 250, 0.05)' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Resumo Financeiro
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
            {formatMonthYear(month)}
          </h2>
        </div>

        {/* Balance Hero */}
        <div style={{
          textAlign: 'center', padding: '16px 0', marginBottom: 16, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Saldo Atual</p>
          <p style={{
            fontSize: 28, fontWeight: 800, margin: 0,
            color: currentBalance >= 0 ? '#34d399' : '#f87171', letterSpacing: -1,
          }}>
            {formatCurrency(currentBalance)}
          </p>
        </div>

        {/* Income / Expense / Invested Cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[
            { icon: <TrendingUp size={12} color="#34d399" />, label: 'Receitas', value: income, color: '#34d399', bg: 'rgba(52, 211, 153, 0.08)', border: 'rgba(52, 211, 153, 0.15)' },
            { icon: <TrendingDown size={12} color="#f87171" />, label: 'Despesas', value: expense, color: '#f87171', bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.15)' },
            { icon: <Landmark size={12} color="#60a5fa" />, label: 'Investido', value: totalInvested, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.08)', border: 'rgba(96, 165, 250, 0.15)' },
          ].map((c, i) => (
            <div key={i} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                {c.icon}
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{c.label}</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: c.color }}>{formatCurrency(c.value)}</p>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        <div style={{ ...SECTION_STYLE }}>
          <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>Receitas vs Despesas</p>
          <div style={{ width: '100%', height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={65} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Categories */}
        {pieData.length > 0 && (
          <div style={SECTION_STYLE}>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>Despesas por Categoria</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} innerRadius={28} dataKey="value" labelLine={false} label={renderCustomLabel} strokeWidth={1} stroke="rgba(15,23,41,0.6)">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                {pieData.map((cat) => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, backgroundColor: cat.color }} />
                    <span style={{ fontSize: 10, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cat.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Coverage info */}
        {futureCoverage > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.15)',
          }}>
            <Shield size={14} color="#60a5fa" />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              {formatCurrency(futureCoverage)} coberto por investimentos
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>
            FinançasPRO v2.0.0 • Gerado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    );
  }
);
FinancialSummaryPage.displayName = 'FinancialSummaryPage';

/** Page 2+: Detailed transactions */
export const FinancialDetailsPage = forwardRef<HTMLDivElement, FinancialSummaryPDFProps>(
  ({ month, statementItems, cards = [] }, ref) => {
    const categories = getCategories();
    const catMap: Record<string, string> = {};
    for (const c of categories) catMap[c.id] = c.name;

    const cardMap: Record<string, { name: string; closingDay?: number; dueDay?: number }> = {};
    for (const c of cards) cardMap[c.id] = { name: c.name, closingDay: c.closingDay, dueDay: c.dueDay };

    // Separate invoices and regular expenses/incomes
    interface InvoiceGroup {
      cardName: string;
      cardId: string;
      closingDay?: number;
      dueDay?: number;
      dueDate: string;
      total: number;
      transactions: Array<{ date: string; description: string; amount: number; category?: string }>;
    }

    const invoiceGroups: InvoiceGroup[] = [];
    const directExpenses: Array<{ date: string; description: string; amount: number; category?: string }> = [];
    const incomeList: Array<{ date: string; description: string; amount: number }> = [];

    for (const item of statementItems) {
      if (isConsolidatedInvoice(item)) {
        const card = cardMap[item.cardId];
        const txs = item.transactions.map(tx => ({
          date: tx.date || item.dueDate,
          description: tx.description || 'Compra',
          amount: Math.abs(tx.amount),
          category: tx.category ? catMap[tx.category] : undefined,
        }));
        txs.sort((a, b) => a.date.localeCompare(b.date));
        invoiceGroups.push({
          cardName: item.cardName,
          cardId: item.cardId,
          closingDay: card?.closingDay,
          dueDay: card?.dueDay,
          dueDate: item.dueDate,
          total: item.total,
          transactions: txs,
        });
      } else if (item.type === 'expense') {
        directExpenses.push({
          date: item.date,
          description: item.description || 'Despesa',
          amount: Math.abs(item.amount),
          category: item.category ? catMap[item.category] : undefined,
        });
      } else if (item.type === 'income') {
        incomeList.push({
          date: item.date,
          description: item.description || 'Receita',
          amount: Math.abs(item.amount),
        });
      }
    }
    directExpenses.sort((a, b) => a.date.localeCompare(b.date));
    incomeList.sort((a, b) => a.date.localeCompare(b.date));

    const renderTxRow = (tx: { date: string; description: string; amount: number; category?: string }, i: number, total: number, color: string, sign: string) => (
      <div key={i} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 4,
        borderBottom: i < total - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.description}
          </span>
          <span style={{ fontSize: 9, color: '#64748b' }}>
            {formatDateBR(tx.date)}{tx.category ? ` • ${tx.category}` : ''}
          </span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8, color }}>
          {sign}{formatCurrency(tx.amount)}
        </span>
      </div>
    );

    return (
      <div ref={ref} style={{ ...PAGE_STYLE, marginTop: 16 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Extrato Detalhado
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
            {formatMonthYear(month)}
          </h2>
        </div>

        {/* Credit Card Invoices */}
        {invoiceGroups.map((inv, idx) => (
          <div key={idx} style={SECTION_STYLE}>
            {/* Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CreditCard size={14} color="#a78bfa" />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: '#e2e8f0' }}>
                  {inv.cardName}
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                  {inv.closingDay && (
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>
                      Fechamento: dia {inv.closingDay}
                    </span>
                  )}
                  {inv.dueDay && (
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>
                      Vencimento: dia {inv.dueDay}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>
                  {formatCurrency(inv.total)}
                </span>
              </div>
            </div>
            {/* Card Transactions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {inv.transactions.map((tx, i) => renderTxRow(tx, i, inv.transactions.length, '#f87171', '-'))}
            </div>
          </div>
        ))}

        {/* Direct Expenses (non-card) */}
        {directExpenses.length > 0 && (
          <div style={SECTION_STYLE}>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>
              Despesas Diretas ({directExpenses.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {directExpenses.map((tx, i) => renderTxRow(tx, i, directExpenses.length, '#f87171', '-'))}
            </div>
          </div>
        )}

        {/* Income List */}
        {incomeList.length > 0 && (
          <div style={SECTION_STYLE}>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>
              Receitas ({incomeList.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {incomeList.map((tx, i) => renderTxRow({ ...tx, category: undefined }, i, incomeList.length, '#34d399', '+'))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>
            FinançasPRO v2.0.0 • Gerado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    );
  }
);
FinancialDetailsPage.displayName = 'FinancialDetailsPage';

// Keep backward-compatible default export name
export const FinancialSummaryPDF = FinancialSummaryPage;
