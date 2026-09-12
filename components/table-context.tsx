import { useState, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { describeVira, type EngineSnapshot } from '@/lib/truco-engine';
import type { TrucoCard } from '@/lib/truco-rules';
import { pendingCanto } from '@/lib/game-copy';

export function TableVira({
  card,
  children,
}: {
  card: TrucoCard;
  children: ReactNode;
}) {
  const details = describeVira(card);
  return (
    <Popover>
      <PopoverTrigger
        className="table-vira"
        openOnHover
        delay={200}
        closeDelay={150}
        aria-label={`Vira: ${card.rank} de ${card.suit}. Ver piezas y detalles`}
      >
        <span className="table-vira-label">
          Vira <Info size={12} aria-hidden="true" />
        </span>
        <span aria-hidden="true">{children}</span>
      </PopoverTrigger>
      <PopoverContent className="vira-details" side="right" sideOffset={12}>
        <PopoverTitle>
          {card.rank} de {card.suit}
        </PopoverTitle>
        <p>{details.text}</p>
        <p className="text-muted-foreground">{details.substitution}</p>
      </PopoverContent>
    </Popover>
  );
}

export function CantoNotice({
  state,
  you,
  name,
  canAnswer,
}: {
  state: Pick<
    EngineSnapshot,
    'priority' | 'truco' | 'envido' | 'seats' | 'handComplete'
  >;
  you: string;
  name: (id: string) => string;
  canAnswer: boolean;
}) {
  const canto = pendingCanto(state);
  if (!canto) return null;
  const callers = state.seats.filter((seat) => seat.team === canto.by);
  const caller = canto.bySeatId
    ? name(canto.bySeatId)
    : callers.map((seat) => name(seat.id)).join(' / ');
  const own = callers.some((seat) => seat.id === you);
  return (
    <output className="canto-notice">
      <strong>
        {caller}: «{canto.label}»
      </strong>
      <span className="block mt-1">
        {canAnswer
          ? 'Te toca responder a este canto.'
          : own
            ? 'Esperando la respuesta del equipo rival.'
            : 'Tu equipo debe responder a este canto.'}
      </span>
      <span className="block mt-1">
        <b>Quiero:</b> {canto.accept} <b>No quiero:</b> {canto.reject}
      </span>
      {canto.suspended && (
        <span className="block mt-1">
          Después se responde al {canto.suspended}, si la partida sigue.
        </span>
      )}
    </output>
  );
}

export function PlayedStacks({
  played,
  seats,
  name,
  renderCard,
  you,
  onPlayCard,
}: {
  you: string;
  onPlayCard?: (id: string) => void;
  played: EngineSnapshot['played'];
  seats: EngineSnapshot['seats'];
  name: (id: string) => string;
  renderCard: (card: TrucoCard) => ReactNode;
}) {
  return (
    <div
      className={`played-stacks ${seats.length === 2 ? 'duel-piles' : ''}`}
      aria-label="Cartas jugadas en esta base"
    >
      {[
        ...seats.filter((seat) => seat.id !== you),
        ...seats.filter((seat) => seat.id === you),
      ].map((seat) => {
        const cards = played.filter((play) => play.seatId === seat.id);
        return (
          <details
            className={`player-stack ${seat.id === you ? 'your-play-pile' : ''}`}
            key={seat.id}
          >
            <summary
              ref={(node) => {
                if (!node || seat.id !== you || !onPlayCard) return;
                const drop = (event: Event) =>
                  onPlayCard((event as CustomEvent<string>).detail);
                node.addEventListener('card-drop', drop);
                return () => node.removeEventListener('card-drop', drop);
              }}
              data-card-drop={
                seat.id === you && onPlayCard ? 'true' : undefined
              }
              onDragOver={(event) => {
                if (seat.id === you && onPlayCard) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(event) => {
                if (seat.id === you && onPlayCard) {
                  event.preventDefault();
                  onPlayCard(event.dataTransfer.getData('text/truco-card'));
                }
              }}
            >
              <span>{name(seat.id)}</span>
              {seat.id === you && onPlayCard && !cards.length && (
                <small>Suelta tu carta aquí</small>
              )}
              <span className="stack-preview" aria-hidden="true">
                {cards.map((play, index) => (
                  <span
                    key={index}
                    style={{
                      marginLeft: index * 12,
                      marginTop: index * 8,
                      zIndex: index + 1,
                    }}
                  >
                    {renderCard(play.card)}
                  </span>
                ))}
                {!cards.length && (
                  <span className="stack-empty">Sin jugar</span>
                )}
              </span>
              {cards.length > 0 && (
                <small>
                  <span className="stack-show">Ver </span>
                  <span className="stack-hide">Apilar </span>
                  {cards.length} {cards.length === 1 ? 'carta' : 'cartas'}
                </small>
              )}
            </summary>
            <ol>
              {cards.map((play, index) => (
                <li key={index}>
                  <span aria-hidden="true">{renderCard(play.card)}</span>
                  {index + 1}.ª carta: {play.card.rank} de {play.card.suit}
                  {play.card.passed ? ' (pasada)' : ''}
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

export function CantoBranch({
  title,
  available,
  disabled = false,
  children,
}: {
  title: string;
  available: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={<Button variant="outline" className="canto-trigger" />}
      >
        {title}
        <span aria-hidden="true">▾</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="canto-popover"
        onSubmit={() => setOpen(false)}
        onClick={(event) => {
          const button = (event.target as HTMLElement).closest('button');
          if (button && !button.disabled && button.type !== 'submit')
            setOpen(false);
        }}
      >
        <PopoverTitle>{title}</PopoverTitle>
        <fieldset disabled={disabled} className="canto-options">
          {children}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
