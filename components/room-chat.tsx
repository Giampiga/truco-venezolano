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
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [room.messages.length]);
  async function send(event: SyntheticEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    if (await act({ type: 'chat', text, id: crypto.randomUUID() })) setText('');
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
                <time>
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
