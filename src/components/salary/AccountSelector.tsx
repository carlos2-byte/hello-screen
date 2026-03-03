import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getSalaryAccounts, SalaryAccount } from '@/lib/salaryAccounts';

interface AccountSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function AccountSelector({ value, onChange, label = 'Conta obrigatória' }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<SalaryAccount[]>([]);

  useEffect(() => {
    getSalaryAccounts().then(setAccounts);
  }, []);

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">
        Selecione a conta que deve pagar esta despesa
      </p>
      <Select value={value || 'none'} onValueChange={(val) => onChange(val === 'none' ? '' : val)}>
        <SelectTrigger>
          <SelectValue placeholder="Nenhuma (sem conta obrigatória)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma (sem conta obrigatória)</SelectItem>
          {accounts.map(a => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
