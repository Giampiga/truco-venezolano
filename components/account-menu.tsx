'use client';
import {
  useEffect,
  useState,
  useRef,
  useEffectEvent,
  type SyntheticEvent,
} from 'react';
import { UserRound } from 'lucide-react';
import { browserAuth, authConfigured } from '@/lib/auth/browser';
import { authReturnPath } from '@/lib/auth/return-path';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProfilePanel } from '@/components/profile-panel';
type Account = {
  id: string;
  registered: boolean;
  profile: { name: string; handle: string } | null;
};
export function AccountMenu({
  open,
  onOpenChange,
  name,
  onName,
  onSession,
  playing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onName: (name: string) => void;
  onSession: (registered: boolean) => void;
  playing: boolean;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const currentAccount = useRef<Account | null | undefined>(undefined);
  const notify = useEffectEvent((value: Account | null) => {
    onSession(!!value?.registered);
    if (value?.profile) onName(value.profile.name);
  });
  const openError = useEffectEvent(() => onOpenChange(true));
  useEffect(() => {
    let alive = true;
    let pending: AbortController | undefined;
    async function load() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      setLoading(true);
      try {
        const response = await fetch('/api/account', {
          signal: controller.signal,
        });
        if (!response.ok && response.status !== 401) throw new Error();
        const value = response.ok ? ((await response.json()) as Account) : null;
        if (!alive || controller.signal.aborted) return;
        if (currentAccount.current === undefined && value && !value.registered)
          setMode('signup');
        currentAccount.current = value;
        setAccount(value);
        notify(value);
        if (new URLSearchParams(location.search).has('auth_error')) {
          setError(
            'El enlace de acceso venció o no es válido. Inténtalo de nuevo.',
          );
          openError();
          history.replaceState(
            null,
            '',
            authReturnPath(location.pathname + location.search),
          );
        }
      } catch {
        if (alive && !controller.signal.aborted) {
          setAccount(null);
          currentAccount.current = null;
          notify(null);
          setError('No pudimos consultar tu cuenta. Inténtalo otra vez.');
        }
      } finally {
        if (alive && !controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const subscription = authConfigured
      ? browserAuth().auth.onAuthStateChange((event, session) => {
          if (
            event === 'SIGNED_OUT' ||
            (event === 'SIGNED_IN' &&
              currentAccount.current &&
              currentAccount.current.id !== session?.user.id)
          ) {
            localStorage.removeItem('truco-online-room');
            location.assign(
              authReturnPath(location.pathname + location.search),
            );
            return;
          }
          if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return;
          // Supabase also emits SIGNED_IN when the same user refocuses a tab.
          // Keep their in-progress profile edits mounted in that case.
          if (
            event === 'SIGNED_IN' &&
            currentAccount.current?.id === session?.user.id &&
            currentAccount.current?.registered ===
              !!(
                !session?.user.is_anonymous && session?.user.email_confirmed_at
              )
          )
            return;
          setTimeout(() => {
            if (alive) void load();
          }, 0);
        }).data.subscription
      : null;
    return () => {
      alive = false;
      pending?.abort();
      subscription?.unsubscribe();
    };
  }, [retry]);
  function callbackUrl(reset = false) {
    const url = new URL('/auth/callback', location.origin);
    url.searchParams.set(
      'next',
      authReturnPath(location.pathname + location.search),
    );
    if (reset) url.searchParams.set('reset', '1');
    return url.href;
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (cause) {
      const code =
        cause && typeof cause === 'object' && 'code' in cause ? cause.code : '';
      setError(
        code === 'email_not_confirmed'
          ? 'Confirma tu correo antes de iniciar sesión. Revisa también la carpeta de correo no deseado.'
          : code === 'invalid_credentials'
            ? 'El correo o la contraseña no son correctos.'
            : code === 'over_request_rate_limit' ||
                code === 'over_email_send_rate_limit'
              ? 'Has hecho varios intentos seguidos. Espera un momento antes de volver a intentarlo.'
              : 'No se pudo completar la solicitud. Revisa tus datos o inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function email(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || playing || !authConfigured) return;
    const data = new FormData(event.currentTarget);
    await perform(async () => {
      const auth = browserAuth().auth;
      const email = (data.get('email') as string).trim();
      const password = data.get('password') as string;
      const result =
        mode === 'reset'
          ? await auth.resetPasswordForEmail(email, {
              redirectTo: callbackUrl(true),
            })
          : mode === 'login'
            ? await auth.signInWithPassword({ email, password })
            : account && !account.registered
              ? await auth.updateUser(
                  { email, data: { display_name: name.trim() } },
                  {
                    emailRedirectTo: callbackUrl(true),
                  },
                )
              : await auth.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo: callbackUrl(),
                    data: { display_name: name.trim() },
                  },
                });
      if (result.error) throw result.error;
      setMessage(
        mode === 'login'
          ? 'Sesión iniciada.'
          : 'Revisa tu correo y sigue el enlace para continuar.',
      );
      if (mode === 'login') {
        localStorage.removeItem('truco-online-room');
        location.assign(authReturnPath(location.pathname + location.search));
      }
    });
  }
  return (
    <>
      <Button
        variant="outline"
        className="account-trigger"
        onClick={() => onOpenChange(true)}
      >
        <UserRound size={17} />
        {loading
          ? 'Mi cuenta'
          : account?.registered
            ? 'Mi cuenta'
            : account
              ? 'Invitado'
              : 'Entrar'}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="account-dialog">
          <DialogHeader>
            <DialogTitle>
              {account?.registered ? 'Mi cuenta' : 'Tu lugar en la mesa'}
            </DialogTitle>
            <DialogDescription>
              {account?.registered
                ? account.profile
                  ? `@${account.profile.handle} · Cuenta registrada`
                  : 'Cuenta registrada'
                : 'Juega como invitado o guarda tu progreso con una cuenta.'}
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          {error === 'No pudimos consultar tu cuenta. Inténtalo otra vez.' &&
            !busy &&
            !loading && (
              <Button
                variant="outline"
                onClick={() => {
                  setError('');
                  setRetry((value) => value + 1);
                }}
              >
                Volver a consultar la cuenta
              </Button>
            )}
          {message && <output>{message}</output>}
          {loading ? (
            <output>Consultando tu cuenta…</output>
          ) : account?.registered ? (
            <>
              <ProfilePanel
                key={account.id}
                onName={(name, handle) => {
                  onName(name);
                  setAccount((current) =>
                    current
                      ? {
                          ...current,
                          profile: {
                            name,
                            handle: handle ?? current.profile?.handle ?? '',
                          },
                        }
                      : current,
                  );
                }}
              />
              <Button
                variant="ghost"
                disabled={busy || playing || !authConfigured}
                onClick={() =>
                  void perform(async () => {
                    const { error } = await browserAuth().auth.signOut({
                      scope: 'local',
                    });
                    if (error) throw error;
                    localStorage.removeItem('truco-online-room');
                    location.assign(
                      authReturnPath(location.pathname + location.search),
                    );
                  })
                }
              >
                Cerrar sesión
              </Button>
              {playing && <small>Sal de la mesa antes de cerrar sesión.</small>}
            </>
          ) : (
            <>
              <form
                className="guest-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (busy || loading) return;
                  if (account) {
                    onOpenChange(false);
                    return;
                  }
                  void perform(async () => {
                    const { error } =
                      await browserAuth().auth.signInAnonymously({
                        options: { data: { display_name: name.trim() } },
                      });
                    if (error) throw error;
                    onOpenChange(false);
                  });
                }}
              >
                <label>
                  Alias para esta sesión
                  <input
                    id="player-name"
                    value={name}
                    onChange={(e) => onName(e.target.value)}
                    minLength={2}
                    maxLength={24}
                    required
                    autoComplete="off"
                  />
                </label>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy || (!account && !authConfigured)}
                >
                  {account ? 'Listo, a jugar' : 'Entrar como invitado'}
                </Button>
              </form>
              <details className="inline-help">
                <summary>¿Qué se guarda?</summary>
                <p>
                  Una cuenta guarda tus partidas, Elo y amigos. Como invitado,
                  dependes de la sesión de este navegador. Crear una cuenta por
                  correo desde aquí conserva esa identidad.
                </p>
              </details>
              {mode === 'signup' && account && (
                <p>
                  Primero confirma tu correo. Después podrás elegir una
                  contraseña.
                </p>
              )}
              <div className="account-divider">
                {mode === 'signup'
                  ? 'Crear una cuenta'
                  : mode === 'reset'
                    ? 'Recuperar acceso'
                    : 'Iniciar sesión'}
              </div>
              {!authConfigured && (
                <output>
                  El acceso estará disponible cuando se conecte el nuevo
                  servicio de cuentas.
                </output>
              )}
              <div className="social-signin">
                {(['google', 'facebook', 'apple'] as const).map((provider) => (
                  <Button
                    key={provider}
                    variant="outline"
                    disabled={!authConfigured || busy || playing}
                    onClick={() =>
                      void perform(async () => {
                        const options = {
                          redirectTo: callbackUrl(),
                        };
                        const { error } =
                          account && mode === 'signup'
                            ? await browserAuth().auth.linkIdentity({
                                provider,
                                options,
                              })
                            : await browserAuth().auth.signInWithOAuth({
                                provider,
                                options,
                              });
                        if (error) throw error;
                      })
                    }
                  >
                    Continuar con{' '}
                    {provider === 'google'
                      ? 'Google'
                      : provider === 'apple'
                        ? 'Apple'
                        : 'Facebook'}
                  </Button>
                ))}
              </div>
              <form className="account-form" onSubmit={email}>
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="tu@correo.com"
                  />
                </label>
                {mode !== 'reset' && !(mode === 'signup' && account) && (
                  <label>
                    Contraseña
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      autoComplete={
                        mode === 'signup' ? 'new-password' : 'current-password'
                      }
                      required
                    />
                  </label>
                )}
                <Button
                  type="submit"
                  disabled={!authConfigured || busy || playing}
                >
                  {busy
                    ? 'Un momento…'
                    : mode === 'signup'
                      ? 'Crear cuenta'
                      : mode === 'reset'
                        ? 'Enviar enlace'
                        : 'Iniciar sesión'}
                </Button>
              </form>
              <div className="account-links">
                <button
                  disabled={busy}
                  onClick={() => {
                    setMode(mode === 'signup' ? 'login' : 'signup');
                    setMessage('');
                    setError('');
                  }}
                >
                  {mode === 'signup'
                    ? 'Ya tengo una cuenta'
                    : 'Crear una cuenta'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setMode(mode === 'reset' ? 'login' : 'reset');
                    setMessage('');
                    setError('');
                  }}
                >
                  {mode === 'reset'
                    ? 'Volver al inicio de sesión'
                    : 'Olvidé mi contraseña'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
