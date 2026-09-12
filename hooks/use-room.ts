'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomAction, RoomState } from '@/lib/room-model';

export class RoomRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function roomRequest<T>(
  path: string,
  payload?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store',
    signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new RoomRequestError(
      data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
        ? data.error
        : 'No se pudo conectar con la mesa. Vuelve a intentarlo.',
      response.status,
    );
  if (data === null)
    throw new Error(
      'La mesa envió una respuesta inválida. Vuelve a intentarlo.',
    );
  return data as T;
}
export function useRoom() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(true);
  const active = useRef<string | null>(null);
  const acting = useRef<AbortController | null>(null);
  const accept = useCallback((next: RoomState) => {
    if (active.current !== next.id) return;
    setRoom((previous) =>
      !previous || next.revision >= previous.revision ? next : previous,
    );
  }, []);
  const enter = useCallback((next: RoomState) => {
    acting.current?.abort();
    acting.current = null;
    active.current = next.id;
    setPending(false);
    setRoom(next);
    setError('');
    setConnected(true);
    localStorage.setItem('truco-online-room', next.id);
    history.replaceState(null, '', `?mesa=${next.code}`);
  }, []);
  const detach = useCallback(() => {
    acting.current?.abort();
    acting.current = null;
    active.current = null;
    setPending(false);
    setRoom(null);
    setError('');
    localStorage.removeItem('truco-online-room');
    history.replaceState(null, '', location.pathname);
  }, []);
  const act = useCallback(
    async (action: RoomAction) => {
      const id = active.current;
      if (!id || acting.current) return false;
      const abort = new AbortController();
      acting.current = abort;
      setPending(true);
      setError('');
      try {
        const next = await roomRequest<RoomState>(
          `/api/rooms/${id}`,
          action,
          abort.signal,
        );
        if (abort.signal.aborted || active.current !== id) return false;
        if (action.type === 'leave') detach();
        else accept(next);
        return true;
      } catch (error) {
        if (abort.signal.aborted || active.current !== id) return false;
        if (
          error instanceof RoomRequestError &&
          [401, 403, 404, 410].includes(error.status)
        )
          detach();
        setError(
          error instanceof Error
            ? error.message
            : 'No se pudo enviar la acción.',
        );
        return false;
      } finally {
        if (acting.current === abort) {
          acting.current = null;
          setPending(false);
        }
      }
    },
    [accept, detach],
  );
  useEffect(() => {
    const id = room?.id;
    if (!id) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let heartbeat = 0;
    const poll = async () => {
      try {
        const action =
          Date.now() - heartbeat > 10_000 ? { type: 'heartbeat' } : undefined;
        if (action) heartbeat = Date.now();
        const next = await roomRequest<RoomState>(
          `/api/rooms/${id}`,
          action,
          abort.signal,
        );
        if (!abort.signal.aborted && active.current === id) {
          accept(next);
          setConnected(true);
        }
      } catch (error) {
        if (!abort.signal.aborted && active.current === id) {
          if (
            error instanceof RoomRequestError &&
            [401, 403, 404, 410].includes(error.status)
          ) {
            detach();
            setError(error.message);
            return;
          }
          setConnected(false);
        }
      }
      if (!abort.signal.aborted)
        timer = setTimeout(poll, document.hidden ? 5000 : 1500);
    };
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [room?.id, accept, detach]);
  useEffect(
    () => () => {
      active.current = null;
      acting.current?.abort();
    },
    [],
  );
  return { room, enter, detach, act, error, pending, connected };
}
