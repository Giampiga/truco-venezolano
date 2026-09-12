'use client';
import { AccountLabel } from '@/components/account-label';
import { cardDrag } from '@/lib/card-drag';
import { tablePosition } from '@/lib/table-seats';
import {
  CantoNotice,
  PlayedStacks,
  CantoBranch,
  TableVira,
} from '@/components/table-context';
import { useState } from 'react';
import { ChevronRight, Flag, Layers, Sparkles } from 'lucide-react';
import { EnvidoRaises } from '@/components/envido-raises';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EngineCommand } from '@/lib/truco-engine';
import {
  envidoScore,
  hasFlor,
  nextTrucoCall,
  trucoRank,
  type TrucoCard,
} from '@/lib/truco-rules';
import type { RoomAction, RoomState } from '@/lib/room-model';

const callName = {
  truco: 'Truco',
  retruco: 'Retruco',
  'vale-nueve': 'Vale nueve',
  'vale-juego': 'Vale juego',
};
const cardId = (card: TrucoCard) => `${card.rank}-${card.suit}`;
function PlayingCard({
  card,
  small = false,
}: {
  card: TrucoCard;
  small?: boolean;
}) {
  return (
    <span
      className={`playing-card ${small ? 'small-card' : ''} suit-${card.suit}`}
    >
      <span className="card-corner">
        <b>{card.rank}</b>
        <small>{card.suit.slice(0, 2).toUpperCase()}</small>
      </span>
      <span className="card-rank" aria-hidden="true">
        {card.rank}
      </span>
      <span className="card-suit">{card.passed ? 'pasada' : card.suit}</span>
    </span>
  );
}
export function OnlineTable({
  room,
  act,
  pending,
  connected,
}: {
  room: RoomState;
  act: (action: RoomAction) => Promise<boolean>;
  pending: boolean;
  connected: boolean;
}) {
  const game = room.game!;
  const state = game.public;
  const legal = game.legal;
  const [selection, setSelection] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<{
    command: EngineCommand;
    title: string;
  } | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(state.gameVersion);
  if (selectionVersion !== state.gameVersion) {
    setSelectionVersion(state.gameVersion);
    setSelection([]);
    setConfirmation(null);
  }
  const team = state.seats.find((seat) => seat.id === room.you)!.team;
  const other = team === 'A' ? 'B' : 'A';
  const everyonePresent = room.members.every(
    (member) => !member.left && room.serverTime - member.lastSeen < 45_000,
  );
  const disabled =
    pending || !connected || !everyonePresent || state.handComplete;
  const name = (id: string) =>
    room.members.find((member) => member.seatId === id)?.name ?? 'Jugador';
  const selected = game.private.hand.filter((card) =>
    selection.includes(cardId(card)),
  );
  const stack = legal.includes('play-stack');
  const nextCall = nextTrucoCall(
    state.truco.pending?.call ?? state.truco.accepted,
  );
  const myIndex = state.seats.findIndex((seat) => seat.id === room.you);
  const opponents = Array.from(
    { length: state.seats.length - 1 },
    (_, offset) => state.seats[(myIndex + offset + 1) % state.seats.length],
  );
  const command = (value: EngineCommand) =>
    act({
      type: 'command',
      command: value,
      id: crypto.randomUUID(),
      gameVersion: state.gameVersion,
    });
  function select(id: string) {
    setSelection((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : stack
          ? [...current.slice(-1), id]
          : [id],
    );
  }
  function play() {
    if (stack && selected.length === 2) {
      const sorted = [...selected].sort(
        (a, b) => trucoRank(b, state.vira) - trucoRank(a, state.vira),
      );
      void command({
        type: 'PLAY_STACK',
        cardIds: [cardId(sorted[0]), cardId(sorted[1])],
      });
    } else if (selected[0])
      void command({ type: 'PLAY_CARD', cardId: cardId(selected[0]) });
  }
  const pendingCall =
    state.priority.active === 'truco' && state.truco.pending
      ? callName[state.truco.pending.call]
      : state.priority.active === 'flor'
        ? 'Flor envida'
        : state.priority.active === 'envido'
          ? `Envite a ${state.envido.pending?.stake ?? 2}`
          : null;
  return (
    <section
      className="online-game"
      data-format={state.seats.length === 4 ? '2v2' : '1v1'}
    >
      <div className="match-score">
        <div>
          <span>NOSOTROS · {team}</span>
          <strong>
            {state.match.score[team]}
            <small> / {state.match.target}</small>
          </strong>
        </div>
        <div className="match-round">
          <span>BASE {String(state.handNumber).padStart(2, '0')}</span>
          <p>
            {state.match.gamesToWin === 2
              ? `Chicos ${state.match.gameWins[team]}–${state.match.gameWins[other]} · Mejor de tres`
              : 'Un chico'}
          </p>
        </div>
        <div>
          <span>ELLOS · {other}</span>
          <strong>
            {state.match.score[other]}
            <small> / {state.match.target}</small>
          </strong>
        </div>
      </div>
      {!everyonePresent && (
        <output className="connection-banner">
          La partida está en pausa mientras un jugador vuelve a conectarse.
          {room.config.ranked && (
            <Button
              variant="outline"
              disabled={
                pending ||
                !connected ||
                !room.members.some(
                  (m) =>
                    room.serverTime - m.lastSeen >= 120_000 &&
                    state.seats.find((s) => s.id === m.seatId)?.team !== team,
                )
              }
              onClick={() => void act({ type: 'claim-forfeit' })}
            >
              Reclamar victoria tras 2 minutos
            </Button>
          )}
        </output>
      )}
      <div className="online-felt">
        <div className="opponent-line">
          {opponents.map((seat) => (
            <div
              className={`online-player ${state.activeSeatId === seat.id && !state.handComplete ? 'active-player' : ''}`}
              key={seat.id}
              data-position={tablePosition(state.seats, seat.id, room.you)}
            >
              <span className="opponent-initial">
                {name(seat.id).slice(0, 1)}
              </span>
              <strong>{name(seat.id)}</strong>
              <AccountLabel
                handle={room.members.find((m) => m.seatId === seat.id)?.handle}
              />
              <small>
                {seat.team === team ? 'Tu pareja' : 'Rival'} ·{' '}
                {state.cardCounts[seat.id]} cartas
                {seat.id === state.manoSeatId ? ' · Mano' : ''}
              </small>
            </div>
          ))}
        </div>
        <div className="felt-center">
          {state.seats.length === 2 && (
            <TableVira card={state.vira}>
              <PlayingCard card={state.vira} small />
            </TableVira>
          )}
          <div className="trick-zone">
            <div className="trick-progress">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={state.trickResults[index] ? 'resolved' : ''}
                >
                  {state.trickResults[index]
                    ? state.trickResults[index].parda
                      ? 'Parda'
                      : state.trickResults[index].winnerTeam === team
                        ? 'Nuestra'
                        : 'De ellos'
                    : `Vuelta ${index + 1}`}
                </span>
              ))}
            </div>
            <PlayedStacks
              key={state.handNumber}
              you={room.you}
              manoSeatId={state.manoSeatId}
              vira={state.vira}
              onPlayCard={
                !disabled && legal.includes('play-card')
                  ? (id) => {
                      if (game.private.hand.some((card) => cardId(card) === id))
                        void command({ type: 'PLAY_CARD', cardId: id });
                    }
                  : undefined
              }
              played={state.played}
              seats={state.seats}
              name={(id) => (id === room.you ? 'Tú' : name(id))}
              renderCard={(card) => <PlayingCard card={card} small />}
            />
          </div>
        </div>
        <output className="turn-line">
          {state.match.complete
            ? `${state.match.winner === team ? '¡Ganaron la partida!' : 'La partida es de los rivales.'}`
            : state.handComplete
              ? 'Base terminada'
              : pendingCall
                ? `${pendingCall} · esperando respuesta`
                : state.activeSeatId === room.you
                  ? 'Te toca. Elige tu carta.'
                  : `Turno de ${name(state.activeSeatId)}`}
        </output>
      </div>
      {state.handComplete ? (
        <div className="hand-finished">
          <div>
            <h3>
              {state.match.complete
                ? 'Se acabó el chico. Queda la sobremesa.'
                : 'Una base más en la cuenta.'}
            </h3>
            <p>
              {state.match.complete
                ? 'Pueden seguir conversando o volver al salón para otra partida.'
                : room.you === room.host
                  ? 'Reparte cuando todos estén listos para continuar.'
                  : 'El anfitrión reparte la siguiente base.'}
            </p>
          </div>
          {!state.match.complete && room.you === room.host && (
            <Button
              onClick={() =>
                void act({ type: 'next', gameVersion: state.gameVersion })
              }
              disabled={pending || !everyonePresent || !connected}
            >
              Siguiente base <ChevronRight size={16} />
            </Button>
          )}
        </div>
      ) : (
        <>
          <section className="player-console" aria-label="Tu mano y cantos">
            <div className="your-hand">
              <div className="hand-label">
                <p className="eyebrow">TU MANO</p>
                <AccountLabel
                  handle={
                    room.members.find((m) => m.seatId === room.you)?.handle
                  }
                />
                <strong>
                  {envidoScore(game.private.dealtHand, state.vira)} de envite
                </strong>
                {hasFlor(game.private.dealtHand, state.vira) && (
                  <span>
                    <Sparkles size={14} />
                    Tienes flor
                  </span>
                )}
              </div>
              <div className="online-hand-cards">
                {game.private.hand.map((card, index) => (
                  <button
                    key={cardId(card)}
                    {...cardDrag(
                      cardId(card),
                      !disabled && legal.includes('play-card'),
                    )}
                    className={`select-card ${selection.includes(cardId(card)) ? 'selected-card' : ''}`}
                    aria-label={`Seleccionar ${card.rank} de ${card.suit}`}
                    aria-pressed={selection.includes(cardId(card))}
                    disabled={
                      disabled || (!legal.includes('play-card') && !stack)
                    }
                    onClick={() => select(cardId(card))}
                  >
                    <PlayingCard card={card} />
                    <span className="card-index">{index + 1}</span>
                  </button>
                ))}
              </div>
              <Button
                className="play-card-button"
                onClick={play}
                disabled={
                  disabled ||
                  (stack ? selected.length !== 2 : selected.length !== 1)
                }
              >
                {stack ? 'Jugar apiladas' : 'Jugar carta'}
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className="call-tray" aria-label="Cantos y acciones">
              <CantoNotice
                state={state}
                you={room.you}
                name={(id) => (id === room.you ? 'Tú' : name(id))}
                canAnswer={legal.includes('answer-quiero')}
              />

              <div>
                <span className="eyebrow">CANTOS Y ACCIONES</span>
                <small>Elige un canto o juega una carta.</small>
              </div>
              <div className="call-buttons">
                {legal.includes('answer-quiero') && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      void command({ type: 'ANSWER_CALL', answer: 'quiero' })
                    }
                  >
                    Quiero
                  </Button>
                )}
                {legal.includes('answer-no-quiero') && (
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      void command({ type: 'ANSWER_CALL', answer: 'no-quiero' })
                    }
                  >
                    No quiero
                  </Button>
                )}
                {(legal.includes('call-truco') ||
                  legal.includes('raise-truco')) &&
                  nextCall != null &&
                  nextCall !== 'none' && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        setConfirmation({
                          title: `${state.truco.pending ? 'Quiero y ' : ''}${callName[nextCall]}`,
                          command: {
                            type: state.truco.pending
                              ? 'RAISE_TRUCO'
                              : 'CALL_TRUCO',
                            call: nextCall,
                          },
                        })
                      }
                    >
                      {state.truco.pending ? 'Quiero y ' : ''}
                      {callName[nextCall]}
                    </Button>
                  )}
                <CantoBranch
                  disabled={disabled}
                  title="Envido"
                  available={['call-envido', 'call-falta', 'raise-envido'].some(
                    (action) =>
                      legal.includes(action as (typeof legal)[number]),
                  )}
                >
                  {legal.includes('call-envido') && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        setConfirmation({
                          title: 'Envido',
                          command: { type: 'CALL_ENVIDO', amount: 2 },
                        })
                      }
                    >
                      Envido
                    </Button>
                  )}
                  {legal.includes('call-falta') && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        setConfirmation({
                          title: 'La falta',
                          command: { type: 'CALL_ENVIDO', amount: 'falta' },
                        })
                      }
                    >
                      La falta
                    </Button>
                  )}
                  {legal.includes('raise-envido') && (
                    <EnvidoRaises
                      disabled={disabled}
                      onSelect={(amount) =>
                        setConfirmation({
                          title:
                            amount === 'falta'
                              ? 'Quiero y la Falta'
                              : amount === 2
                                ? 'Quiero y Envido'
                                : `Quiero y ${amount} más`,
                          command: { type: 'RAISE_ENVIDO', amount },
                        })
                      }
                    />
                  )}
                </CantoBranch>
                <CantoBranch
                  disabled={disabled}
                  title="Flor"
                  available={
                    legal.includes('declare-flor') ||
                    legal.includes('call-flor-envida')
                  }
                >
                  {legal.includes('declare-flor') && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        setConfirmation({
                          title: 'Flor tengo',
                          command: { type: 'DECLARE_FLOR', mode: 'flor' },
                        })
                      }
                    >
                      Flor tengo
                    </Button>
                  )}
                  {legal.includes('declare-flor') &&
                    room.config.flor === 'a-ley' && (
                      <Button
                        variant="outline"
                        disabled={disabled}
                        onClick={() =>
                          setConfirmation({
                            title: 'A ley',
                            command: { type: 'DECLARE_FLOR', mode: 'a-ley' },
                          })
                        }
                      >
                        A ley
                      </Button>
                    )}
                  {legal.includes('call-flor-envida') && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        setConfirmation({
                          title: 'Mi flor envida',
                          command: { type: 'CALL_FLOR_ENVIDA' },
                        })
                      }
                    >
                      Mi flor envida
                    </Button>
                  )}
                </CantoBranch>
                {legal.includes('pass-card') && (
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      setConfirmation({
                        title: 'Pasar las tres cartas',
                        command: { type: 'PASS_CARDS' },
                      })
                    }
                  >
                    <Layers size={15} />
                    Pasar
                  </Button>
                )}
                {legal.includes('fold') && (
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      setConfirmation({
                        title: 'Irme al mazo',
                        command: { type: 'FOLD_HAND' },
                      })
                    }
                  >
                    <Flag size={15} />
                    Al mazo
                  </Button>
                )}
              </div>
              <details className="canto-help">
                <summary>¿Qué puedo cantar?</summary>
                <p>
                  Los cantos cambian según el turno y tu mano. Retruco, Vale
                  nueve y Vale juego aparecen al avanzar la apuesta; Flor,
                  cuando tienes flor.
                </p>
              </details>
            </div>
          </section>
        </>
      )}
      <details className="hand-log">
        <summary>Lo que pasó en la mesa</summary>
        <ol>
          {room.events.map((event, index) => (
            <li key={`${state.gameVersion}-${index}`}>{event}</li>
          ))}
        </ol>
      </details>
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿{confirmation?.title}?</DialogTitle>
            <DialogDescription>
              {confirmation?.command.type === 'FOLD_HAND'
                ? 'El equipo rival cobra el valor aceptado del Truco.'
                : 'La mesa recibirá este canto. Confirma para enviarlo.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={async () => {
                if (confirmation && (await command(confirmation.command)))
                  setConfirmation(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
