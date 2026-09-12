import { useState, type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
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

export function PlayedStacks({ played, seats, name, renderCard, you, onPlayCard }: {
  you: string;
  onPlayCard?: (id: string) => void;
  played: EngineSnapshot['played'];
  seats: EngineSnapshot['seats'];
  name: (id: string) => string;
  renderCard: (card: TrucoCard) => ReactNode;
}) {
  return <div className={`played-stacks ${seats.length === 2 ? 'duel-piles' : ''}`} aria-label="Cartas jugadas en esta base">
    {[...seats.filter(seat => seat.id !== you), ...seats.filter(seat => seat.id === you)].map(seat => {
      const cards = played.filter(play => play.seatId === seat.id);
      return <details className={`player-stack ${seat.id === you ? 'your-play-pile' : ''}`} key={seat.id}
        ref={node => {
          if (!node || seat.id !== you || !onPlayCard) return;
          const drop = (event: Event) => onPlayCard((event as CustomEvent<string>).detail);
          node.addEventListener('card-drop', drop);
          return () => node.removeEventListener('card-drop', drop);
        }}
        data-card-drop={seat.id === you && onPlayCard ? 'true' : undefined}
        onDragOver={event => { if (seat.id === you && onPlayCard) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
        onDrop={event => { if (seat.id === you && onPlayCard) { event.preventDefault(); onPlayCard(event.dataTransfer.getData('text/truco-card')); } }}>

        <summary>
          <span>{name(seat.id)}</span>
          {seat.id === you && onPlayCard && <small>Suelta tu carta aquí</small>}
          <span className="stack-preview" aria-hidden="true">
            {cards.map((play, index) => <span key={index} style={{ marginLeft: index * 12, marginTop: index * 8, zIndex: index + 1 }}>{renderCard(play.card)}</span>)}
            {!cards.length && <span className="stack-empty">Sin jugar</span>}
          </span>
          <small>{cards.length} {cards.length === 1 ? 'carta jugada' : 'cartas jugadas'}{cards.length > 0 && <><span className="stack-show"> · Ver cartas</span><span className="stack-hide"> · Apilar</span></>}</small>
        </summary>
        <ol>{cards.map((play, index) => <li key={index}><span aria-hidden="true">{renderCard(play.card)}</span>{index + 1}.ª carta: {play.card.rank} de {play.card.suit}{play.card.passed ? ' (pasada)' : ''}</li>)}</ol>
      </details>;
    })}
  </div>;
}

export function CantoBranch({ title, available, disabled = false, children }: { title: string; available: boolean; disabled?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverTrigger disabled={disabled} render={<Button variant="outline" className="canto-trigger" />}>
      {title}<span aria-hidden="true">▾</span>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} className="canto-popover">
      <PopoverTitle>{title}</PopoverTitle>
      <fieldset disabled={disabled} className="canto-options" onSubmit={() => setOpen(false)} onClick={event => {
        const button = (event.target as HTMLElement).closest('button');
        if (button && !button.disabled && button.type !== 'submit') setOpen(false);
      }}>{children}</fieldset>
    </PopoverContent>
  </Popover>;
}
