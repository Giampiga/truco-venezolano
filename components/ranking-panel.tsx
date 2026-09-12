'use client';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { roomRequest, RoomRequestError } from '@/hooks/use-room';
import type { Ranking } from '@/lib/rating';
import { Button } from '@/components/ui/button';
export function RankingPanel({
  onPlay,
}: {
  onPlay: (format: '1v1' | '2v2') => void;
}) {
  const [format, setFormat] = useState<'1v1' | '2v2'>('1v1');
  const [data, setData] = useState<Ranking | null>(null);
  const [error, setError] = useState('');
  const [signin, setSignin] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void roomRequest<Ranking>(
      `/api/ranking?format=${format}`,
      undefined,
      abort.signal,
    )
      .then((next) => {
        setData(next);
        setError('');
        setSignin(false);
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setError(e.message);
          setSignin(e instanceof RoomRequestError && e.status === 401);
        }
      });
    return () => abort.abort();
  }, [format, retry]);
  const current = data?.format === format ? data : null;
  return (
    <section className="ranking-panel" aria-label="Ranking competitivo">
      <div className="section-top">
        <h2>
          <Trophy size={18} /> Clasificación
        </h2>
        <span>ELO</span>
      </div>
      <div className="segmented">
        <button
          aria-pressed={format === '1v1'}
          onClick={() => setFormat('1v1')}
        >
          Duelo
        </button>
        <button
          aria-pressed={format === '2v2'}
          onClick={() => setFormat('2v2')}
        >
          Parejas
        </button>
      </div>
      {error ? (
        <div className="ranking-error">
          <p role="alert">{error}</p>
          {signin ? (
            <p>Usa «Entrar» en la parte superior para acceder a tu cuenta.</p>
          ) : (
            <Button variant="outline" onClick={() => setRetry(retry + 1)}>
              Reintentar
            </Button>
          )}
        </div>
      ) : !current ? (
        <p>Cargando clasificación…</p>
      ) : (
        <>
          <div className="your-rating">
            <div>
              <span>Tu Elo</span>
              <strong>{current.you?.rating ?? 1000}</strong>
            </div>
            <p>
              {current.you
                ? `${current.you.wins} ${current.you.wins === 1 ? 'victoria' : 'victorias'} · ${current.you.games} ${current.you.games === 1 ? 'partida' : 'partidas'}`
                : 'Tu primera partida empieza aquí.'}
            </p>
          </div>
          <Button className="w-full" onClick={() => onPlay(format)}>
            Crear competitiva
          </Button>
          <details className="inline-help">
            <summary>¿Cómo cambia mi Elo?</summary>
            <p className="ranking-explainer">
              24 piedras y reglas fijas. Ganas o pierdes Elo según el resultado
              y la fuerza del rival. Solo cuentan tres partidas contra los
              mismos rivales en 24 horas.
            </p>
          </details>
          {current.leaders.length ? (
            <ol className="leaderboard">
              {current.leaders.map((player, i) => (
                <li key={`${i}-${player.name}`}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{player.name}</strong>
                    <small>
                      {player.games}{' '}
                      {player.games === 1 ? 'partida' : 'partidas'}
                    </small>
                  </div>
                  <b>{player.rating}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ranking-empty">
              Todavía no hay posiciones. Completa una competitiva para aparecer.
            </p>
          )}
          {!!current.history.length && (
            <details className="rating-history">
              <summary>Tus últimas partidas</summary>
              {current.history.map((match) => (
                <div key={match.room}>
                  <span>
                    {match.won ? 'Victoria' : 'Derrota'}
                    {!match.rated && ' · Sin Elo (rival repetido)'}
                    <small>{new Date(match.at).toLocaleDateString('es')}</small>
                  </span>
                  <b>
                    {match.delta > 0 ? '+' : ''}
                    {match.delta}
                    <small>{match.rating} Elo</small>
                  </b>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
