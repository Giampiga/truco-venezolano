'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  browserAuth,
  authConfigured,
  authErrorMessage,
} from '@/lib/auth/browser';
import { authReturnPath } from '@/lib/auth/return-path';
import { Button } from '@/components/ui/button';
export default function ResetPassword() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(authConfigured);
  const [next, setNext] = useState('/');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!authConfigured) return;
    let alive = true;
    void browserAuth()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        if (
          data.user &&
          !data.user.is_anonymous &&
          data.user.email_confirmed_at
        )
          setUserId(data.user.id);
        setNext(
          authReturnPath(new URLSearchParams(location.search).get('next')),
        );
      })
      .catch(() => {
        if (alive)
          setError(
            'No pudimos verificar tu sesión. Abre el enlace de tu correo otra vez.',
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <main className="account-page">
      <h1>Elige una contraseña nueva</h1>
      {loading && <output>Verificando tu sesión…</output>}
      {!loading && !userId && (
        <p>
          {authConfigured
            ? 'El enlace venció o no hay una sesión confirmada. Vuelve al salón y solicita un enlace nuevo desde «Olvidé mi contraseña».'
            : 'El servicio de cuentas todavía no está conectado.'}
        </p>
      )}
      {userId && !saved && (
        <form
          className="account-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = e.currentTarget;
            const data = new FormData(form);
            const password = data.get('password') as string;
            if (password !== data.get('confirmation')) {
              setError('Las contraseñas no coinciden.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              const auth = browserAuth().auth;
              const { data, error: sessionError } = await auth.getUser();
              if (sessionError || data.user?.id !== userId) throw new Error();
              const { error } = await auth.updateUser({ password });
              if (error) throw error;
              form.reset();
              setSaved(true);
              setMessage('Contraseña actualizada. Ya puedes volver al salón.');
            } catch (cause) {
              setError(authErrorMessage(cause));
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
          <label>
            Repite la contraseña
            <input
              name="confirmation"
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
      )}
      {error && <p role="alert">{error}</p>}
      <output>{message}</output>
      <Link href={next}>Volver al salón</Link>
    </main>
  );
}
