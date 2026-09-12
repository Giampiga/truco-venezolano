'use client';
import { AccountLabel } from '@/components/account-label';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RoomAction, RoomState } from '@/lib/room-model';
export function RoomChat({
  room,
  act,
  pending,
}: {
  room: RoomState;
  act: (action: RoomAction) => Promise<boolean>;
  pending: boolean;
}) {
  const [text, setText] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const latestMessage = room.messages.at(-1)?.id;
  useEffect(() => {
    if (stick.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [latestMessage]);
  async function send(event: SyntheticEvent) {
    event.preventDefault();
    if (pending || room.closed || !text.trim()) return;
    const draft = text;
    if (await act({ type: 'chat', text: draft, id: crypto.randomUUID() })) {
      setText((current) => (current === draft ? '' : current));
      stick.current = true;
      if (scroll.current)
        scroll.current.scrollTop = scroll.current.scrollHeight;
    }
  }
  return (
    <section className="room-chat">
      <div className="panel-heading">
        <MessageCircle size={18} />
        <h2>Chat de la mesa</h2>
      </div>
      <div
        className="chat-scroll"
        ref={scroll}
        role="log"
        aria-live="polite"
        aria-label="Mensajes de la mesa"
        onScroll={() => {
          const el = scroll.current;
          if (el)
            stick.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        }}
      >
        {room.messages.length ? (
          room.messages.map((message) => (
            <article
              className={message.seatId === room.you ? 'own-message' : ''}
              key={message.id}
            >
              <div>
                <strong>
                  {message.seatId === room.you ? 'Tú' : message.author}
                </strong>
                <AccountLabel handle={message.handle} />
                <time dateTime={new Date(message.at).toISOString()}>
                  {new Date(message.at).toLocaleTimeString('es', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p>{message.text}</p>
            </article>
          ))
        ) : (
          <p className="chat-empty">
            Saluda a la mesa. Los mensajes llegan a todos los jugadores.
          </p>
        )}
      </div>
      <form onSubmit={send}>
        <Input
          aria-label="Mensaje a la mesa"
          placeholder="Escribe a la mesa…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={300}
          disabled={room.closed}
        />
        <Button
          size="icon"
          type="submit"
          disabled={pending || !text.trim() || room.closed}
          aria-label="Enviar mensaje"
        >
          <Send size={16} />
        </Button>
      </form>
    </section>
  );
}
