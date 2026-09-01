'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  Flag,
  Info,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  Radio,
  ShieldAlert,
  Smile,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { nextTrucoCall, type TrucoCall } from '@/lib/truco-rules';
import type { NetworkState } from '@/lib/product-types';

type Card = {
  id: string;
  rank: string;
  suit: 'copas' | 'espadas' | 'bastos' | 'oros';
  shortSuit: string;
  piece?: string;
  passed?: boolean;
};

type GameTableProps = {
  networkState: NetworkState;
  voiceEnabled: boolean;
  muted: boolean;
  deafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onOpenVoice: () => void;
  onOpenRules: () => void;
  onOpenReport: () => void;
  onLeave: () => void;
  onToast: (message: string) => void;
};

const initialHand: Card[] = [
  { id: 'perico', rank: '11', suit: 'copas', shortSuit: 'CO', piece: 'Perico' },
  { id: 'seven', rank: '7', suit: 'bastos', shortSuit: 'BA' },
  { id: 'four', rank: '4', suit: 'bastos', shortSuit: 'BA' },
];

const callLabels: Record<Exclude<TrucoCall, 'none'>, string> = {
  truco: 'Truco',
  retruco: 'Retruco',
  'vale-nueve': 'Vale nueve',
  'vale-juego': 'Vale juego',
};

type PendingAction = 'envido' | 'flor' | 'truco' | 'pasar' | 'mazo' | null;

export function GameTable({
  networkState,
  voiceEnabled,
  muted,
  deafened,
  onToggleMute,
  onToggleDeafen,
  onOpenVoice,
  onOpenRules,
  onOpenReport,
  onLeave,
  onToast,
}: GameTableProps) {
  const [hand, setHand] = useState(initialHand);
  const [selected, setSelected] = useState<string | null>(null);
  const [played, setPlayed] = useState<{ owner: string; card: Card }[]>([
    {
      owner: 'Mariale',
      card: { id: 'm-three', rank: '3', suit: 'oros', shortSuit: 'OR' },
    },
  ]);
  const [status, setStatus] = useState('Tienes la voz. Juega una carta o canta.');
  const [turn, setTurn] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [trucoCall, setTrucoCall] = useState<TrucoCall>('none');
  const [scoreUs, setScoreUs] = useState(12);
  const [scoreThem] = useState(9);
  const [history, setHistory] = useState([
    'Mariale abrió con 3 de oros.',
    'Tienes la voz.',
  ]);

  const nextCall = nextTrucoCall(trucoCall) as Exclude<TrucoCall, 'none'> | null;
  const selectedCard = hand.find((card) => card.id === selected);
  const firstRound = hand.length === 3;

  const prompt = useMemo(() => {
    if (pendingAction === 'truco' && nextCall) {
      return {
        eyebrow: 'Canto de Truco',
        title: '¿Cantas ' + callLabels[nextCall] + '?',
        copy: 'La voz de mesa no juega por ti. Este botón envía el canto válido al servidor.',
        confirm: 'Cantar ' + callLabels[nextCall],
      };
    }
    if (pendingAction === 'envido') {
      return {
        eyebrow: 'Canto de Envido',
        title: '¿Cantas Envido?',
        copy: 'Se resuelve antes de cualquier Truco pendiente. Si no quieren, vale 1 piedra.',
        confirm: 'Cantar Envido',
      };
    }
    if (pendingAction === 'flor') {
      return {
        eyebrow: 'Declaración',
        title: 'Flor tengo',
        copy: 'Tu mano cumple Flor: Perico y dos cartas de bastos. Se acredita antes del Truco.',
        confirm: 'Declarar Flor',
      };
    }
    if (pendingAction === 'pasar') {
      return {
        eyebrow: 'Carta pasada',
        title: '¿Pasas la primera?',
        copy: 'Si pasas la primera carta, las tres quedan pasadas. Aún cuentan para el Envido.',
        confirm: 'Pasar las tres',
      };
    }
    if (pendingAction === 'mazo') {
      return {
        eyebrow: 'Fin de la base',
        title: '¿Te vas al mazo?',
        copy: 'La pareja contraria cobra el valor aceptado de esta base.',
        confirm: 'Irme al mazo',
      };
    }
    return null;
  }, [nextCall, pendingAction]);

  function addHistory(entry: string) {
    setHistory((current) => [entry, ...current].slice(0, 6));
  }

  function playSelectedCard() {
    if (!selectedCard || !turn) return;
    setHand((current) => current.filter((card) => card.id !== selectedCard.id));
    setPlayed((current) => [...current, { owner: 'CantoClaro', card: selectedCard }]);
    setSelected(null);
    setTurn(false);
    setStatus('Carta jugada. Esperando a Trasmano…');
    addHistory('Jugaste ' + selectedCard.rank + ' de ' + selectedCard.suit + '.');

    window.setTimeout(() => {
      const isFirst = hand.length === 3;
      const response: Card = {
        id: 'rafael-' + Date.now(),
        rank: isFirst ? '6' : '1',
        suit: isFirst ? 'copas' : 'oros',
        shortSuit: isFirst ? 'CO' : 'OR',
      };
      setPlayed((current) => [...current, { owner: 'Rafael C.', card: response }]);
      setTurn(true);
      setStatus(isFirst ? 'Primera en casa. Vuelves a tener la voz.' : 'Tienes la voz.');
      addHistory('Rafael C. jugó ' + response.rank + ' de ' + response.suit + '.');
    }, 700);
  }

  function confirmAction() {
    if (pendingAction === 'truco' && nextCall) {
      const label = callLabels[nextCall];
      setTrucoCall(nextCall);
      setStatus(label + '. ¿Se quiere?');
      addHistory('Cantaste ' + label + '.');
      setPendingAction(null);
      window.setTimeout(() => {
        setStatus('Quiero. Tienes la voz.');
        addHistory('Mariale: “Quiero”.');
      }, 700);
      return;
    }
    if (pendingAction === 'envido') {
      setPendingAction(null);
      setStatus('El Envido va primero; luego resolvemos el Truco.');
      addHistory('Cantaste Envido.');
      window.setTimeout(() => {
        setScoreUs((score) => score + 2);
        setStatus('Son buenas. Nosotros sumamos 2 piedras.');
        addHistory('Envido: 37 son buenas. +2 para nosotros.');
      }, 750);
      return;
    }
    if (pendingAction === 'flor') {
      setPendingAction(null);
      setScoreUs((score) => score + 3);
      setStatus('Flor tengo. Tu pareja suma 3 piedras.');
      addHistory('Declaraste Flor. +3 para nosotros.');
      return;
    }
    if (pendingAction === 'pasar') {
      setPendingAction(null);
      setHand((current) => current.map((card) => ({ ...card, passed: true })));
      setStatus('Tus cartas quedaron pasadas. Conservan su valor para el Envido.');
      addHistory('Pasaste la primera: tu mano queda pasada.');
      return;
    }
    if (pendingAction === 'mazo') {
      setPendingAction(null);
      setStatus('Te fuiste al mazo. Nueva base en 3…');
      addHistory('Te fuiste al mazo.');
    }
  }

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button onClick={onLeave} variant="ghost" size="icon" aria-label="Salir de la partida">
            <ArrowLeft className="size-4" />
          </Button>
          <span className="hidden h-6 w-px bg-border sm:block" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">Mesa Las Acacias</h1>
              <Badge variant="outline" className="hidden font-mono tracking-wider sm:inline-flex">
                CANTO7
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Base 7 · Oriental clásico · A 24
            </p>
          </div>
        </div>

        <div className="scoreboard" aria-label={'Marcador: nosotros ' + scoreUs + ', ellos ' + scoreThem}>
          <span>
            <small>Nosotros</small>
            <strong>{scoreUs}</strong>
          </span>
          <i>—</i>
          <span>
            <small>Ellos</small>
            <strong>{scoreThem}</strong>
          </span>
          <em>/ 24</em>
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            className="connection-chip"
            onClick={() => onToast('Todo sincronizado · Caracas 42 ms')}
            aria-label={
              networkState === 'online'
                ? 'Conexión estable, 42 milisegundos'
                : 'Estado de reconexión'
            }
          >
            {networkState === 'reconnecting' ? <WifiOff /> : <Wifi />}
            <span className="hidden sm:inline">
              {networkState === 'online'
                ? '42 ms'
                : networkState === 'restored'
                  ? 'De vuelta'
                  : 'Reconectando'}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Opciones de la mesa" />}
            >
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Mesa Las Acacias</DropdownMenuLabel>
                <DropdownMenuItem onClick={onOpenRules}>
                  <Info />
                  Ver reglas acordadas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToast('Seña pública enviada a toda la mesa.')}>
                  <Eye />
                  Enviar seña pública
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenReport}>
                <ShieldAlert />
                Reportar o bloquear
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onLeave}>
                <Flag />
                Abandonar partida
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {networkState === 'restored' && (
        <output className="restored-banner">
          <Check className="size-4" />
          Volviste a la mesa. La base quedó exactamente donde estaba.
        </output>
      )}

      <div className="table-layout">
        <section className="table-stage" aria-label="Mesa de juego">
          <div className="seat-position seat-top">
            <PlayerSeat name="Mariale" seatRole="Mano · Ellos" speaking />
          </div>
          <div className="seat-position seat-left">
            <PlayerSeat name="Rafael C." seatRole="Trasmano · Pareja" />
          </div>
          <div className="seat-position seat-right">
            <PlayerSeat name="Vale_23" seatRole="Antepie · Ellos" deafened />
          </div>

          <div className="felt">
            <div className="felt-status">
              <span className={'turn-dot ' + (turn ? 'is-active' : '')} />
              <p aria-live="polite">{status}</p>
            </div>

            <div className="vira-note">
              <span className="mini-card mini-card-copas">6</span>
              <span>
                <small>Vira</small>
                <strong>6 de copas</strong>
                <em>Perico 11 · Perica 10</em>
              </span>
            </div>

            <div className="played-cards" aria-label="Cartas jugadas en esta baza">
              {played.map(({ owner, card }, index) => (
                <div key={card.id + '-' + index} className={'played-card played-' + (index % 4)}>
                  <span className={'game-card suit-' + card.suit}>
                    <b>{card.rank}</b>
                    <small>{card.shortSuit}</small>
                  </span>
                  <em>{owner}</em>
                </div>
              ))}
            </div>

            {prompt && (
              <section className="call-confirm" aria-label="Confirmar acción">
                <button
                  onClick={() => setPendingAction(null)}
                  className="call-confirm-close"
                  aria-label="Cancelar acción"
                >
                  <X className="size-4" />
                </button>
                <p>{prompt.eyebrow}</p>
                <h2>{prompt.title}</h2>
                <span>{prompt.copy}</span>
                <div>
                  <Button
                    onClick={() => setPendingAction(null)}
                    variant="outline"
                    className="h-11 rounded-xl"
                  >
                    Todavía no
                  </Button>
                  <Button onClick={confirmAction} className="h-11 rounded-xl">
                    {prompt.confirm}
                  </Button>
                </div>
              </section>
            )}
          </div>

          <div className="seat-position seat-bottom">
            <PlayerSeat name="CantoClaro" seatRole="Pie · Tú" you muted={muted || !voiceEnabled} />
          </div>

          <section className="hand-zone" aria-label="Tu mano">
            <div className="hand-heading">
              <span>
                <small>Tu mano · Envido 37 · Flor</small>
                <strong>
                  {selectedCard
                    ? selectedCard.rank + ' de ' + selectedCard.suit
                    : 'Elige una carta'}
                </strong>
              </span>
              <Badge variant={turn ? 'default' : 'secondary'}>
                {turn ? 'Tu turno' : 'Esperando'}
              </Badge>
            </div>
            <div className="hand-cards">
              {hand.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelected(card.id)}
                  disabled={!turn}
                  className={
                    'game-card hand-card suit-' +
                    card.suit +
                    (selected === card.id ? ' is-selected' : '') +
                    (card.passed ? ' is-passed' : '')
                  }
                  aria-pressed={selected === card.id}
                  aria-label={
                    card.rank +
                    ' de ' +
                    card.suit +
                    (card.piece ? ', ' + card.piece : '') +
                    (card.passed ? ', pasada' : '')
                  }
                >
                  <span>
                    <b>{card.rank}</b>
                    <small>{card.shortSuit}</small>
                  </span>
                  <em>{card.piece ?? card.suit}</em>
                </button>
              ))}
              {hand.length === 0 && (
                <p className="text-sm text-muted-foreground">Ya jugaste tus tres cartas.</p>
              )}
            </div>
            <Button
              onClick={playSelectedCard}
              disabled={!selectedCard || !turn}
              className="play-card-button h-12 rounded-xl px-6"
            >
              Jugar carta
            </Button>
          </section>
        </section>

        <aside className="game-side-panel">
          <section className="call-dock">
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Cantos y acciones
              </p>
              <h2 className="mt-1 text-sm font-semibold">Confirma cada jugada</h2>
            </div>
            <div className="call-buttons">
              <Button
                onClick={() => setPendingAction('envido')}
                variant="outline"
                disabled={!turn || !firstRound}
                className="h-11 rounded-xl"
              >
                Envido
              </Button>
              <Button
                onClick={() => setPendingAction('flor')}
                variant="outline"
                disabled={!turn || !firstRound}
                className="h-11 rounded-xl"
              >
                Flor
              </Button>
              <Button
                onClick={() => setPendingAction('truco')}
                disabled={!turn || !nextCall}
                className="h-11 rounded-xl"
              >
                {nextCall ? callLabels[nextCall] : 'Vale juego'}
              </Button>
              <Button
                onClick={() => setPendingAction('pasar')}
                variant="secondary"
                disabled={!turn || !firstRound}
                className="h-11 rounded-xl"
              >
                Pasar carta
              </Button>
              <Button
                onClick={() => setPendingAction('mazo')}
                variant="ghost"
                className="col-span-2 h-11 rounded-xl text-muted-foreground"
              >
                Irme al mazo
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              La voz de mesa no juega por ti. Los botones son la acción válida.
            </p>
          </section>

          <section className="voice-rail">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Radio className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Voz de mesa</h2>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {voiceEnabled ? '4 conectados' : 'Entra cuando quieras'}
                </p>
              </div>
              {!voiceEnabled && (
                <Button onClick={onOpenVoice} variant="outline" size="sm">
                  Activar
                </Button>
              )}
            </div>
            <div className="voice-members">
              <VoiceMember name="Mariale" state="speaking" />
              <VoiceMember name="Rafael C." state="on" />
              <VoiceMember name="Vale_23" state="deafened" />
              <VoiceMember
                name="CantoClaro"
                state={!voiceEnabled || muted ? 'muted' : 'on'}
                you
              />
            </div>
            <div className="voice-controls">
              <Button
                onClick={voiceEnabled ? onToggleMute : onOpenVoice}
                variant={muted || !voiceEnabled ? 'secondary' : 'outline'}
                className="h-11 rounded-xl"
                aria-pressed={voiceEnabled ? muted : undefined}
              >
                {muted || !voiceEnabled ? <MicOff /> : <Mic />}
                {muted || !voiceEnabled ? 'Mic apagado' : 'Silenciar'}
              </Button>
              <Button
                onClick={voiceEnabled ? onToggleDeafen : onOpenVoice}
                variant={deafened ? 'secondary' : 'outline'}
                className="h-11 rounded-xl"
                aria-pressed={voiceEnabled ? deafened : undefined}
              >
                {deafened ? <VolumeX /> : <Volume2 />}
                {deafened ? 'Sin audio' : 'Escuchar'}
              </Button>
            </div>
          </section>

          <section className="history-panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Mesa</h2>
              </div>
              <Button
                onClick={() => onToast('Seña pública enviada a los cuatro jugadores.')}
                variant="ghost"
                size="sm"
              >
                <Smile className="size-4" />
                Seña pública
              </Button>
            </div>
            <ol className="mt-3 space-y-2" aria-live="polite">
              {history.map((entry, index) => (
                <li key={entry + '-' + index} className="text-xs leading-5 text-muted-foreground">
                  {entry}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {networkState === 'reconnecting' && (
        <div
          className="reconnect-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reconnect-title"
        >
          <div className="reconnect-card">
            <span className="reconnect-pulse">
              <WifiOff className="size-5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Guardando tu asiento
            </p>
            <h2 id="reconnect-title" className="mt-2 font-display text-3xl font-bold">
              Volviendo a la mesa…
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No juegues otra carta todavía. Estamos recuperando la última versión confirmada de la base.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="status-dot" />
              Intento 1 de 4 · tu turno queda protegido
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerSeat({
  name,
  seatRole,
  speaking = false,
  deafened = false,
  muted = false,
  you = false,
}: {
  name: string;
  seatRole: string;
  speaking?: boolean;
  deafened?: boolean;
  muted?: boolean;
  you?: boolean;
}) {
  return (
    <div className={'table-seat ' + (you ? 'table-seat-you' : '')}>
      <span
        className={'player-avatar player-avatar-sm ' + (speaking ? 'is-speaking' : '')}
        aria-hidden="true"
      >
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <strong>{name}</strong>
        <small>{seatRole}</small>
      </span>
      {speaking && <Mic className="seat-audio text-emerald-600" aria-label="Está hablando" />}
      {deafened && <VolumeX className="seat-audio" aria-label="Audio desactivado" />}
      {muted && <MicOff className="seat-audio" aria-label="Micrófono apagado" />}
    </div>
  );
}

function VoiceMember({
  name,
  state,
  you = false,
}: {
  name: string;
  state: 'speaking' | 'on' | 'muted' | 'deafened';
  you?: boolean;
}) {
  return (
    <div className="voice-member">
      <span
        className={'voice-avatar ' + (state === 'speaking' ? 'is-speaking' : '')}
        aria-hidden="true"
      >
        {name.slice(0, 1)}
      </span>
      <span>
        <strong>
          {name}
          {you ? ' · Tú' : ''}
        </strong>
        <small>
          {state === 'speaking'
            ? 'Hablando'
            : state === 'muted'
              ? 'Mic apagado'
              : state === 'deafened'
                ? 'No está escuchando'
                : 'Escuchando'}
        </small>
      </span>
      <span className="ml-auto">
        {state === 'speaking' && <Mic className="size-4 text-emerald-600" />}
        {state === 'on' && <Mic className="size-4 text-muted-foreground" />}
        {state === 'muted' && <MicOff className="size-4 text-muted-foreground" />}
        {state === 'deafened' && <VolumeX className="size-4 text-muted-foreground" />}
      </span>
    </div>
  );
}
