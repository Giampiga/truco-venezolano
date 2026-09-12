import type { ReactNode } from 'react';
import type { EngineSnapshot } from '@/lib/truco-engine';
import type { TrucoCard } from '@/lib/truco-rules';
import { pendingCanto } from '@/lib/game-copy';

export function CantoNotice({ state, you, name, canAnswer }: {
  state: Pick<EngineSnapshot, 'priority' | 'truco' | 'envido' | 'seats' | 'handComplete'>;
  you: string;
  name: (id: string) => string;
  canAnswer: boolean;
}) {
  const canto = pendingCanto(state);
  if (!canto) return null;
  const callers = state.seats.filter(seat => seat.team === canto.by);
  const caller = canto.bySeatId ? name(canto.bySeatId) : callers.map(seat => name(seat.id)).join(' / ');
  const own = callers.some(seat => seat.id === you);
  return <div className="canto-notice" role="status">
    <strong>{caller}: «{canto.label}»</strong>
    <p>{canAnswer ? 'Te toca responder a este canto.' : own ? 'Esperando la respuesta del equipo rival.' : 'Tu equipo debe responder a este canto.'}</p>
    <p><b>Quiero:</b> {canto.accept} <b>No quiero:</b> {canto.reject}</p>
    {canto.suspended && <p>Después se responde al {canto.suspended}, si la partida sigue.</p>}
  </div>;
}

export function PlayedStacks({ played, seats, name, renderCard }: {
  played: EngineSnapshot['played'];
  seats: EngineSnapshot['seats'];
  name: (id: string) => string;
  renderCard: (card: TrucoCard) => ReactNode;
}) {
  return <div className="played-stacks" aria-label="Cartas jugadas en esta base">
    {seats.map(seat => {
      const cards = played.filter(play => play.seatId === seat.id);
      return <details className="player-stack" key={seat.id}>
        <summary>
          <span>{name(seat.id)}</span>
          <span className="stack-preview" aria-hidden="true">
            {cards.map((play, index) => <span key={index} style={{ marginLeft: index * 16, marginTop: index * 5 }}>{renderCard(play.card)}</span>)}
            {!cards.length && <span className="stack-empty">Sin jugar</span>}
          </span>
          <small>{cards.length ? `${cards.length} ${cards.length === 1 ? 'carta' : 'cartas'} · Ver` : '0 cartas'}</small>
        </summary>
        <ol>{cards.map((play, index) => <li key={index}><span aria-hidden="true">{renderCard(play.card)}</span>{index + 1}.ª carta: {play.card.rank} de {play.card.suit}{play.card.passed ? ' (pasada)' : ''}</li>)}</ol>
      </details>;
    })}
  </div>;
}
