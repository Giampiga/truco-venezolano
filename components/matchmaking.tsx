'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { roomRequest } from '@/hooks/use-room';
import type { RoomState } from '@/lib/room-model';
type SearchState = {
  status: 'idle' | 'searching' | 'matched';
  room?: RoomState;
  format?: '1v1' | '2v2';
  since?: number;
};
export function Matchmaking({
  name,
  onMatched,
}: {
  name: string;
  onMatched: (room: RoomState) => void;
}) {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [format, setFormat] = useState<'1v1' | '2v2'>('1v1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onMatch = useRef(onMatched);
  useEffect(() => {
    onMatch.current = onMatched;
  }, [onMatched]);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cancelRequests = useCallback(() => {
    generation.current++;
    request.current?.abort();
  }, []);
  function accept(next: SearchState) {
    setState(next);
    if (next.status === 'matched' && next.room) onMatch.current(next.room);
  }
  useEffect(() => {
    const abort = new AbortController();
    const attempt = generation.current;
    void roomRequest<SearchState>('/api/matchmaking', undefined, abort.signal)
      .then((next) => {
        if (!abort.signal.aborted && attempt === generation.current)
          accept(next);
      })
      .catch(() => {});
    return () => {
      abort.abort();
      cancelRequests();
    };
  }, [cancelRequests]);
  useEffect(() => {
    if (state.status !== 'searching') return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const attempt = generation.current;
      try {
        if (!request.current) {
          const next = await roomRequest<SearchState>(
            '/api/matchmaking',
            { type: 'poll' },
            abort.signal,
          );
          if (!abort.signal.aborted && attempt === generation.current) {
            accept(next);
            setError('');
          }
        }
      } catch (e) {
        if (!abort.signal.aborted && attempt === generation.current)
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo actualizar la búsqueda.',
          );
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 3000);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [state.status]);
  async function act(type: 'join' | 'cancel') {
    if (request.current) return;
    const attempt = ++generation.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy(true);
    setError('');
    try {
      const next = await roomRequest<SearchState>(
        '/api/matchmaking',
        {
          type,
          name,
          format,
        },
        abort.signal,
      );
      if (!abort.signal.aborted && attempt === generation.current) accept(next);
    } catch (e) {
      if (abort.signal.aborted || attempt !== generation.current) return;
      setError(
        e instanceof Error ? e.message : 'No pudimos buscar una partida.',
      );
    } finally {
      if (request.current === abort) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Buscar partida competitiva" className="ranked-result">
      <h2>Encontrar partida</h2>
      <p>Encuentra rivales de tu nivel.</p>
      {state.status === 'searching' ? (
        <>
          <output className="block">
            Buscando {state.format === '2v2' ? 'cuatro jugadores' : 'un rival'}…
            Ampliamos el rango de Elo mientras esperas.
          </output>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void act('cancel')}
          >
            Cancelar búsqueda
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label>
            Formato{' '}
            <select
              aria-label="Formato de búsqueda"
              value={format}
              onChange={(e) => setFormat(e.target.value as '1v1' | '2v2')}
            >
              <option value="1v1">Duelo · 1v1</option>
              <option value="2v2">Parejas · 2v2</option>
            </select>
          </label>
          <Button disabled={busy} onClick={() => void act('join')}>
            {busy ? 'Buscando…' : 'Buscar competitiva'}
          </Button>
        </div>
      )}
      <details className="inline-help">
        <summary>¿Cómo funciona la búsqueda?</summary>
        <p>
          En parejas, te asignamos compañero. Micrófono y cámara son opcionales.
        </p>
        <p>
          Solo las primeras 3 partidas contra el mismo rival en 24 horas dan
          Elo. En parejas, el límite se aplica a cada rival.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
