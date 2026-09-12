'use client';
import { useEffect, useRef, useState } from 'react';
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
  onMatch.current = onMatched;
  const request = useRef(false);
  const generation = useRef(0);
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
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (state.status !== 'searching') return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (!request.current) {
          const attempt = generation.current;
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
        if (!abort.signal.aborted)
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
    generation.current++;
    request.current = true;
    setBusy(true);
    setError('');
    try {
      accept(
        await roomRequest<SearchState>('/api/matchmaking', {
          type,
          name,
          format,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No pudimos buscar una partida.',
      );
    } finally {
      request.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label="Buscar partida competitiva" className="ranked-result">
      <h2>Encontrar partida</h2>
      <p>
        Rivales de Elo cercano. En parejas, te asignamos compañero. Micrófono y
        cámara son opcionales.
      </p>
      {state.status === 'searching' ? (
        <>
          <p role="status">
            Buscando {state.format === '2v2' ? 'cuatro jugadores' : 'un rival'}…
            Ampliamos el rango de Elo mientras esperas.
          </p>
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
      <p>
        Solo las primeras 3 partidas contra el mismo rival en 24 horas dan Elo.
        En parejas, el límite se aplica a cada rival.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
