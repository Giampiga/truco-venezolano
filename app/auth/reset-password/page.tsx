'use client';
import { useState } from 'react';
import Link from 'next/link';
import { browserAuth, authConfigured } from '@/lib/auth/browser';
import { Button } from '@/components/ui/button';
export default function ResetPassword() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="account-page">
      <h1>Elige una contraseña nueva</h1>
      <form
        className="account-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const password = new FormData(e.currentTarget).get(
              'password',
            ) as string;
            const { error } = await browserAuth().auth.updateUser({ password });
            if (error) throw error;
            setMessage('Contraseña actualizada. Ya puedes volver al salón.');
          } catch {
            setMessage(
              'No pudimos cambiar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Contraseña nueva
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <Button type="submit" disabled={busy || !authConfigured}>
          Guardar contraseña
        </Button>
      </form>
      <output>{message}</output>
      <Link href="/">Volver al salón</Link>
    </main>
  );
}
