'use client';
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type SyntheticEvent,
} from 'react';
import { Button } from '@/components/ui/button';
type Profile = { handle: string; name: string; bio: string };
type Friend = Profile & { status: string; outgoing: boolean };
type Match = {
  room_id: string;
  mode: string;
  format: string;
  at: number;
  won: boolean;
  opponents: string;
  score: string;
  delta: number | null;
  rating: number | null;
  rated: number | null;
};
type ProfileData = {
  me: (Profile & { created_at?: number }) | null;
  found: Profile | null;
  friends: Friend[];
  history: { matches: Match[]; more: boolean };
  ratings: {
    format: string;
    rating: number;
    peak: number;
    games: number;
    wins: number;
  }[];
  stats: { mode: string; games: number; wins: number }[];
};
export function ProfilePanel({
  onName,
}: {
  onName: (name: string, handle?: string) => void;
}) {
  const [section, setSection] = useState('profile');
  const [mode, setMode] = useState('all');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(
    async (handle = '') => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      try {
        const response = await fetch(
          `/api/profile?handle=${encodeURIComponent(handle)}&mode=${mode}&offset=${offset}`,
          { signal: controller.signal },
        );
        const value = (await response.json()) as ProfileData & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(value.error || 'No pudimos cargar tu perfil.');
        if (mounted.current && !controller.signal.aborted) {
          setData(value);
          setError('');
        }
        return value;
      } catch (error) {
        if (mounted.current && !controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : 'No pudimos cargar tu perfil.',
          );
        throw error;
      } finally {
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      }
    },
    [mode, offset],
  );
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => void load().catch(() => {}), 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
      pending.current?.abort();
    };
  }, [load]);
  async function act(input: Record<string, unknown>) {
    if (busy || loading) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const value = (await response.json()) as ProfileData & { error?: string };
      if (!response.ok)
        throw new Error(value.error || 'No pudimos guardar el cambio.');
      if (!mounted.current) return;
      setNotice(
        input.type === 'save'
          ? 'Perfil guardado. Tu nombre aparecerá en las mesas.'
          : 'Lista de amigos actualizada.',
      );
      setLoading(true);
      const updated = await load();
      if (mounted.current && input.type === 'save' && updated.me)
        onName(updated.me.name, updated.me.handle);
    } catch (e) {
      if (mounted.current && !(e instanceof Error && e.name === 'AbortError'))
        setError(
          e instanceof Error ? e.message : 'No pudimos guardar el cambio.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void act({
      type: 'save',
      ...Object.fromEntries(new FormData(event.currentTarget)),
    });
  }
  return (
    <section className="account-content" aria-busy={busy || loading}>
      <nav className="account-tabs" aria-label="Secciones de la cuenta">
        {[
          ['profile', 'Perfil'],
          ['history', 'Historial'],
          ['friends', 'Amigos'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={section === id ? 'page' : undefined}
            disabled={busy}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {notice && <output>{notice}</output>}
      {loading && <output>Cargando tu perfil…</output>}
      {!loading && !data && (
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            void load().catch(() => {});
          }}
        >
          Volver a intentar
        </Button>
      )}
      {data && (
        <>
          {section === 'profile' && (
            <>
              <div className="profile-overview">
                <strong>{data.me?.name ?? 'Tu perfil'}</strong>
                {data.me?.created_at && (
                  <span>
                    En la mesa desde{' '}
                    {new Date(data.me.created_at).toLocaleDateString('es', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <div className="profile-stats">
                {data.ratings.map((r) => (
                  <div key={r.format}>
                    <span>{r.format === '1v1' ? 'Duelo' : 'Parejas'}</span>
                    <strong>{r.rating} Elo</strong>
                    <small>Mejor Elo: {r.peak}</small>
                  </div>
                ))}
                {!data.ratings.length && (
                  <p>Todavía no has jugado una competitiva.</p>
                )}
              </div>
              <form
                className="account-form"
                onSubmit={save}
                key={JSON.stringify(data.me)}
              >
                <label>
                  Nombre de usuario
                  <input
                    name="handle"
                    autoComplete="username"
                    aria-describedby="handle-help"
                    required
                    pattern="[a-zA-Z0-9_]{3,20}"
                    minLength={3}
                    maxLength={20}
                    defaultValue={data.me?.handle}
                    placeholder="tu_usuario"
                  />
                </label>
                <small id="handle-help">
                  Entre 3 y 20 letras, números o guiones bajos. Tus amigos te
                  encontrarán con este usuario.
                </small>
                <label>
                  Nombre visible
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={24}
                    defaultValue={data.me?.name}
                  />
                </label>
                <label>
                  Sobre ti
                  <textarea
                    name="bio"
                    maxLength={160}
                    defaultValue={data.me?.bio}
                  />
                </label>
                <Button type="submit" disabled={busy || loading}>
                  Guardar perfil
                </Button>
              </form>
            </>
          )}
          {section === 'history' && (
            <>
              <div className="history-toolbar">
                <label>
                  Partidas
                  <select
                    value={mode}
                    disabled={busy || loading}
                    onChange={(e) => {
                      setLoading(true);
                      setMode(e.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="all">Todas</option>
                    <option value="ranked">Competitivas</option>
                    <option value="casual">Entre panas</option>
                  </select>
                </label>
              </div>
              <div className="profile-stats">
                {data.stats.map((s) => (
                  <div key={s.mode}>
                    <span>
                      {s.mode === 'ranked' ? 'Competitivas' : 'Entre panas'}
                    </span>
                    <strong>{s.games} partidas</strong>
                    <small>
                      {s.wins} victorias ·{' '}
                      {s.games ? Math.round((s.wins / s.games) * 100) : 0}%
                    </small>
                  </div>
                ))}
              </div>
              {!data.history.matches.length && (
                <p>No hay partidas terminadas en esta categoría.</p>
              )}
              <ol className="profile-history">
                {data.history.matches.map((m) => (
                  <li key={m.room_id}>
                    <div>
                      <strong>
                        {m.won ? 'Victoria' : 'Derrota'} <span>{m.score}</span>
                      </strong>
                      <p>Contra {m.opponents}</p>
                      <small>
                        {m.mode === 'ranked' ? 'Competitiva' : 'Entre panas'} ·{' '}
                        {m.format} · {new Date(m.at).toLocaleDateString('es')}
                      </small>
                    </div>
                    {m.mode === 'ranked' && (
                      <span>
                        {m.delta === null
                          ? 'Elo pendiente'
                          : m.rated
                            ? `${m.delta > 0 ? '+' : ''}${m.delta} Elo`
                            : 'Sin cambio de Elo'}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <div className="history-pagination">
                <Button
                  variant="outline"
                  disabled={busy || loading || offset === 0}
                  onClick={() => {
                    setLoading(true);
                    setOffset(Math.max(0, offset - 20));
                  }}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || loading || !data.history.more}
                  onClick={() => {
                    setLoading(true);
                    setOffset(offset + 20);
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </>
          )}
          {section === 'friends' && (
            <>
              <h2>Amigos</h2>
              <p>
                Busca el @usuario exacto. La otra persona debe aceptar tu
                solicitud.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (busy || loading) return;
                  setLoading(true);
                  setError('');
                  try {
                    const value = await load(
                      (new FormData(e.currentTarget).get('search') as string)
                        .replace(/^@/, '')
                        .trim(),
                    );
                    if (mounted.current)
                      setNotice(
                        value.found ? '' : 'No encontramos ese usuario.',
                      );
                  } catch {
                    /* load displays the error. */
                  }
                }}
              >
                <label>
                  Buscar jugador
                  <input name="search" required maxLength={20} />
                </label>
                <Button type="submit" disabled={busy || loading}>
                  Buscar
                </Button>
              </form>
              {data.found && (
                <article>
                  <strong>
                    {data.found.name} · @{data.found.handle}
                  </strong>
                  <p>{data.found.bio}</p>
                  {data.me && data.found.handle !== data.me.handle && (
                    <Button
                      disabled={
                        busy ||
                        loading ||
                        data.friends.some(
                          (f) => f.handle === data.found!.handle,
                        )
                      }
                      onClick={() =>
                        void act({
                          type: 'request',
                          handle: data.found!.handle,
                        })
                      }
                    >
                      Agregar amigo
                    </Button>
                  )}
                </article>
              )}
              {!data.friends.length && (
                <p>Todavía no tienes amigos ni solicitudes.</p>
              )}
              {data.friends.map((friend) => (
                <article key={friend.handle}>
                  <strong>
                    {friend.name} · @{friend.handle}
                  </strong>
                  <p>{friend.bio}</p>
                  <p>
                    {friend.status === 'accepted'
                      ? 'Amigos'
                      : friend.outgoing
                        ? 'Solicitud enviada'
                        : 'Quiere ser tu amigo'}
                  </p>
                  {friend.status === 'pending' && !friend.outgoing && (
                    <Button
                      disabled={busy || loading}
                      onClick={() =>
                        void act({ type: 'accept', handle: friend.handle })
                      }
                    >
                      Aceptar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy || loading}
                    onClick={() =>
                      void act({ type: 'remove', handle: friend.handle })
                    }
                  >
                    {friend.status === 'accepted'
                      ? 'Quitar amigo'
                      : friend.outgoing
                        ? 'Cancelar solicitud'
                        : 'Rechazar'}
                  </Button>
                </article>
              ))}
              <Button
                variant="outline"
                disabled={busy || loading}
                onClick={() => {
                  setLoading(true);
                  void load().catch(() => {});
                }}
              >
                Actualizar amigos
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}
