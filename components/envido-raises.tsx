'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
export function EnvidoRaises({ onSelect, disabled = false }: { onSelect: (amount: number | 'falta') => void; disabled?: boolean }) {
  const [amount, setAmount] = useState('3');
  return <>
    <Button variant="secondary" disabled={disabled} onClick={() => onSelect(2)}>Quiero y Envido</Button>
    <Button variant="outline" disabled={disabled} onClick={() => onSelect('falta')}>Quiero y la Falta</Button>
    <form className="envido-raise" onSubmit={(event) => {
      event.preventDefault();
      const value = Number(amount);
      if (!disabled && Number.isInteger(value) && value >= 1 && value <= 32) onSelect(value);
    }}>
      <label>Quiero y <input aria-label="Piedras para aumentar el envite" type="number" min="1" max="32" step="1" required value={amount} disabled={disabled} onChange={(e) => setAmount(e.target.value)} /> más</label>
      <Button variant="outline" type="submit" disabled={disabled}>Aumentar</Button>
    </form>
  </>;
}
