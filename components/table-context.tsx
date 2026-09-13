import { useState, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import { describeVira, type EngineSnapshot } from '@/lib/truco-engine';
import type { TrucoCard } from '@/lib/truco-rules';
import { pendingCanto } from '@/lib/game-copy';
import { tablePosition } from '@/lib/table-seats';

export function TableVira({
  card,
  children,
  manoPosition,
}: {
  card: TrucoCard;
  children: ReactNode;
  manoPosition?: ReturnType<typeof tablePosition>;
}) {
  const details = describeVira(card);
  return (
    <Popover>
      <PopoverTrigger
        className="table-vira"
        data-mano={manoPosition}
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
  const prompt = canAnswer
    ? 'Te toca responder.'
    : own
      ? 'Esperando la respuesta del equipo rival.'
      : 'Tu pareja debe responder.';
  return (
    <output className="canto-notice" data-opponent={!own} aria-live="polite">
      <span className="canto-title">
        <span className="canto-caller">{caller} canta</span>
        <strong>«{canto.label}»</strong>
      </span>
      <p className="canto-response-prompt">{prompt}</p>
      <details className="canto-explanation">
        <summary>¿Qué pasa si quiero o no quiero?</summary>
        <dl className="canto-outcomes">
          <div>
            <dt>Si quieres</dt>
            <dd>{canto.accept}</dd>
          </div>
          <div>
            <dt>Si no quieres</dt>
            <dd>{canto.reject}</dd>
          </div>
        </dl>
      </details>
      {canto.suspended && (
        <p className="mt-3">
          Después se responde al {canto.suspended}, si la partida sigue.
        </p>
      )}
    </output>
  );
}

export function FlorReminder({
  state,
  you,
  canDeclare,
}: {
  state: Pick<EngineSnapshot, 'handComplete' | 'invalidFlor' | 'rules'>;
  you: string;
  canDeclare: boolean;
}) {
  if (state.handComplete || state.rules.florMode === 'off') return null;
  if (state.invalidFlor?.includes(you))
    return (
      <small className="flor-reminder">
        Flor invalidada: jugaste sin cantarla.
      </small>
    );
  return canDeclare ? (
    <small className="flor-reminder">
      Canta Flor antes de esta carta. Si juegas sin cantarla, pierdes la Flor de
      esta base.
    </small>
  ) : null;
}

type HandSummaryProps = {
  state: ReturnType<typeof import('@/lib/truco-engine').projectPublic>;
  name: (id: string) => string;
};

export function HandSummary(props: HandSummaryProps) {
  return props.state.handComplete ? (
    <HandSummaryDialog key={props.state.handNumber} {...props} />
  ) : null;
}

function HandSummaryDialog({ state, name }: HandSummaryProps) {
  const labels = {
    envido: 'Envido',
    flor: 'Flor',
    truco: 'Truco',
    prive: 'Privando',
  };
  return (
    <Dialog defaultOpen>
      <DialogTrigger
        render={<Button variant="outline" className="justify-self-start" />}
      >
        Ver puntos de la base
      </DialogTrigger>
      <DialogContent className="hand-summary max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="pr-8">
          Base {state.handNumber} · Reparto de puntos
        </DialogTitle>
        <DialogDescription>
          Así se repartieron los puntos de esta base.
        </DialogDescription>
        <div className="hand-summary-teams">
          {(['A', 'B'] as const).map((team) => {
            const awards = state.handAwards.filter(
              (award) => award.team === team,
            );
            const total = state.match.score[team] - state.handStartScore[team];
            return (
              <div key={team}>
                <h3>
                  {state.seats
                    .filter((seat) => seat.team === team)
                    .map((seat) => name(seat.id))
                    .join(' / ')}{' '}
                  <b>+{total}</b>
                </h3>
                {awards.length ? (
                  <ul>
                    {awards.map((award, index) => (
                      <li key={index}>
                        {award.amount} {award.amount === 1 ? 'punto' : 'puntos'}{' '}
                        por {labels[award.reason]}
                        {award.reason === 'envido' &&
                        state.envido.answer === 'no-quiero'
                          ? ' no querido'
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {total
                      ? `${total} puntos de esta base guardada.`
                      : 'Sin puntos en esta base.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <EnvidoResult result={state.envidoResult} name={name} />
        <EnvidoResult result={state.florResult} name={name} title="Flor" />
        {!!state.invalidFlor.length && (
          <p>
            Flor invalidada: {state.invalidFlor.map(name).join(' / ')}. No suma
            puntos.
          </p>
        )}
        <DialogClose render={<Button />}>Continuar</DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function EnvidoResult({
  result,
  name,
  title = 'Envido',
}: {
  result: ReturnType<typeof import('@/lib/truco-engine').envidoResult>;
  title?: string;
  name: (id: string) => string;
}) {
  if (!result) return null;
  const winners = result.totals.filter((seat) => seat.team === result.winner);
  return (
    <section
      className="envido-result"
      aria-label={`Resultado de ${title}`}
      aria-live="polite"
    >
      <strong>
        {title} ·{' '}
        {result.cancelled
          ? 'Anulado por Flor'
          : result.declined
            ? 'No querido'
            : 'Resultado de la base'}
      </strong>
      <dl>
        {result.totals.map((seat) => (
          <div key={seat.id}>
            <dt>{name(seat.id)}</dt>
            <dd>
              {seat.valid === false
                ? seat.tantos > 0
                  ? `${seat.tantos} tantos · Flor invalidada`
                  : 'Sin Flor'
                : `${seat.tantos} tantos`}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        {result.cancelled ? (
          'La Flor anuló el Envido. No suma puntos.'
        ) : !result.winner ? (
          'Ninguna Flor válida. No suma puntos.'
        ) : (
          <>
            {winners.map((seat) => name(seat.id)).join(' / ')}: +{result.points}{' '}
            {result.points === 1 ? 'punto' : 'puntos'}.
            {result.declined
              ? ' El rival no quiso; los tantos no deciden el resultado.'
              : result.tied
                ? ' Empate en tantos: gana la mano.'
                : ''}
          </>
        )}
      </p>
    </section>
  );
}

export function PlayedStacks({
  played,
  seats,
  name,
  renderCard,
  you,
  onPlayCard,
  manoSeatId,
  vira,
}: {
  you: string;
  manoSeatId: string;
  vira: TrucoCard;
  onPlayCard?: (id: string) => void;
  played: EngineSnapshot['played'];
  seats: EngineSnapshot['seats'];
  name: (id: string) => string;
  renderCard: (card: TrucoCard) => ReactNode;
}) {
  return (
    <div
      className={`played-stacks ${seats.length === 2 ? 'duel-piles' : 'partnership-piles'}`}
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
            data-position={tablePosition(seats, seat.id, you)}
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
              <span title={name(seat.id)}>{name(seat.id)}</span>
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
      {seats.length === 4 && (
        <div
          className="table-vira-slot"
          data-mano={tablePosition(seats, manoSeatId, you)}
        >
          <TableVira card={vira}>{renderCard(vira)}</TableVira>
        </div>
      )}
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
