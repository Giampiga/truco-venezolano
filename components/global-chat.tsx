'use client';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { MessageCircle, X } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import { AccountLabel } from '@/components/account-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { roomRequest } from '@/hooks/use-room';
type Message = {
  id: number;
  author: string;
  handle: string | null;
  message: string;
  at: number;
  own: boolean;
};
export function GlobalChat({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const refreshVersion = useRef(0);
  const sending = useRef(false);
  async function refresh(signal?: AbortSignal) {
    const version = ++refreshVersion.current;
    try {
      const data = await roomRequest<{ messages: Message[] }>(
        '/api/chat',
        undefined,
        signal,
      );
      if (signal?.aborted || version !== refreshVersion.current) return;
      setMessages(data.messages);
      setLoading(false);
      setError('');
    } catch (error) {
      if (signal?.aborted || version !== refreshVersion.current) return;
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el chat.',
      );
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden) await refresh(controller.signal);
      if (!controller.signal.aborted)
        timer = setTimeout(() => void poll(), 4000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open]);
  useEffect(() => {
    if (stick.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  async function send(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !text.trim()) return;
    sending.current = true;
    const draft = text;
    setBusy(true);
    setError('');
    try {
      await roomRequest('/api/chat', {
        id: crypto.randomUUID(),
        name,
        text: draft,
      });
      setText((current) => (current === draft ? '' : current));
      stick.current = true;
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo enviar el mensaje.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="global-chat-widget">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button className="global-chat-toggle" />}
          aria-label={open ? 'Cerrar chat global' : 'Abrir chat global'}
        >
          {open ? <X size={20} /> : <MessageCircle size={20} />} Chat global
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={12}
          className="global-chat-popup"
        >
          <section className="room-chat global-chat" aria-label="Chat global">
            <div className="panel-heading">
              <PopoverTitle>Chat global</PopoverTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar panel del chat global"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <p className="canto-help">
              Habla con todos los jugadores del salón. Los mensajes son visibles
              para quienes tienen acceso al sitio.
            </p>
            <div
              className="chat-scroll"
              role="log"
              aria-live="polite"
              aria-label="Mensajes del chat global"
              ref={scroll}
              onScroll={() => {
                const el = scroll.current;
                if (el)
                  stick.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 50;
              }}
            >
              {loading ? (
                <p>Cargando mensajes…</p>
              ) : !messages.length ? (
                <p>El salón está tranquilo. ¡Saluda!</p>
              ) : (
                messages.map((m) => (
                  <article key={m.id} className={m.own ? 'own-message' : ''}>
                    <div>
                      <strong>{m.own ? `${m.author} (tú)` : m.author}</strong>
                      <AccountLabel handle={m.handle ?? undefined} />
                      <time dateTime={new Date(m.at).toISOString()}>
                        {new Date(m.at).toLocaleTimeString('es', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <p>{m.message}</p>
                  </article>
                ))
              )}
            </div>
            {error && <p role="alert">{error}</p>}
            <form onSubmit={send}>
              <Input
                aria-label="Mensaje al chat global"
                placeholder="Escribe al salón…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
              />
              <Button type="submit" disabled={busy || !text.trim()}>
                Enviar
              </Button>
            </form>
          </section>
        </PopoverContent>
      </Popover>
    </div>
  );
}
