'use client';
import {
  useEffect,
  useState,
  useEffectEvent,
  type SyntheticEvent,
} from 'react';
import { UserRound } from 'lucide-react';
import { browserAuth, authConfigured } from '@/lib/auth/browser';
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
  const notify = useEffectEvent((value: Account | null) => {
    onSession(!!value?.registered);
    if (value?.profile) onName(value.profile.name);
  });
  const openError = useEffectEvent(() => onOpenChange(true));
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch('/api/account');
        if (!response.ok && response.status !== 401) throw new Error();
        const value = response.ok ? ((await response.json()) as Account) : null;
        if (!alive) return;
        setAccount(value);
        notify(value);
        if (new URLSearchParams(location.search).has('auth_error')) {
          setError(
            'El enlace de acceso venció o no es válido. Inténtalo de nuevo.',
          );
          openError();
        }
      } catch {
        if (alive)
          setError('No pudimos consultar tu cuenta. Inténtalo otra vez.');
      }
    }
    void load();
    const subscription = authConfigured
      ? browserAuth().auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            localStorage.removeItem('truco-online-room');
            location.assign('/');
            return;
          }
          setTimeout(() => {
            if (alive) void load();
          }, 0);
        }).data.subscription
      : null;
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch {
      setError(
        'No se pudo completar la solicitud. Revisa tus datos o inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function email(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await perform(async () => {
      const auth = browserAuth().auth;
      const email = data.get('email') as string;
      const password = data.get('password') as string;
      const result =
        mode === 'reset'
          ? await auth.resetPasswordForEmail(email, {
              redirectTo: `${location.origin}/auth/callback?reset=1`,
            })
          : mode === 'login'
            ? await auth.signInWithPassword({ email, password })
            : account && !account.registered
              ? await auth.updateUser(
                  { email },
                  {
                    emailRedirectTo: `${location.origin}/auth/callback?reset=1`,
                  },
                )
              : await auth.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
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
        location.assign('/');
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
        {account?.registered ? 'Mi cuenta' : account ? 'Invitado' : 'Entrar'}
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
          {message && <output>{message}</output>}
          {account?.registered ? (
            <>
              <ProfilePanel
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
                disabled={busy || playing}
                onClick={() =>
                  void perform(async () => {
                    const { error } = await browserAuth().auth.signOut();
                    if (error) throw error;
                    localStorage.removeItem('truco-online-room');
                    location.assign('/');
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
                  if (account) {
                    onOpenChange(false);
                    return;
                  }
                  void perform(async () => {
                    const { error } =
                      await browserAuth().auth.signInAnonymously();
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
                          redirectTo: `${location.origin}/auth/callback`,
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
                  onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}
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
