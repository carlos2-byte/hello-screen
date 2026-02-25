import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface CoverageAlertProps {
  amount: number;
  investmentName: string;
  onDismiss: () => void;
}

export function CoverageAlert({ amount, investmentName, onDismiss }: CoverageAlertProps) {
  return (
    <Alert className="bg-primary/10 border-primary/30 animate-fade-in">
      <Shield className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        Cobertura de Saldo Negativo
        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="text-sm">
        Foi utilizado <strong>{formatCurrency(amount)}</strong> do investimento{' '}
        <strong>"{investmentName}"</strong> para cobrir o saldo negativo deste mês.
        Uma transação de receita foi registrada automaticamente.
      </AlertDescription>
    </Alert>
  );
}
