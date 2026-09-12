'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Eye,
  Flag,
  Info,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Redo2,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Smile,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import { EnvidoRaises } from '@/components/envido-raises';
import { manoAnnouncement, gameEventText, actionLabels } from '@/lib/game-copy';
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
import {
  beginNextHand,
  createEngineSnapshot,
  dealtHandForSeat,
  describeVira,
  legalActionsForSnapshot,
  nextDealer,
  reconnectSnapshot,
  restartCurrentHand,
  resumeSnapshot,
  transition,
  type EngineCommand,
  type EngineSnapshot,
  type ExecutableRules,
  type Seat,
  type SeatId,
} from '@/lib/truco-engine';
import {
  choosePracticeAiCommand,
  explainAiChoice,
  observeForAi,
  type PracticeDifficulty,
} from '@/lib/practice-ai';
import type { NetworkState, RoomConfig, RoomSummary } from '@/lib/product-types';
import {
  createSpanishDeck,
  envidoScore,
  getPieces,
  hasFlor,
  nextTrucoCall,
  sameCard,
  trucoAcceptedValue,
  trucoRejectedValue,
  trucoRank,
  type Suit,
  type TrucoCall,
  type TrucoCard,
} from '@/lib/truco-rules';

type GameTableProps = {
  room: RoomSummary;
  config: RoomConfig;
  practiceDifficulty: PracticeDifficulty;
  guidedPractice: boolean;
  resumeFromStorage: boolean;
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

const suitShort: Record<Suit, string> = {
  copas: 'CO',
  espadas: 'ES',
  bastos: 'BA',
  oros: 'OR',
};

const callLabels: Record<Exclude<TrucoCall, 'none'>, string> = {
  truco: 'Truco',
  retruco: 'Retruco',
  'vale-nueve': 'Vale nueve',
  'vale-juego': 'Vale Juego',
};

const roleLabels = ['Mano', 'Trasmano', 'Antepie', 'Pie'];

function cardId(card: TrucoCard) {
  return `${card.rank}-${card.suit}`;
}

function seededDeck(seed: number) {
  const deck = createSpanishDeck();
  let value = seed >>> 0;
  for (let index = deck.length - 1; index > 0; index -= 1) {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    const target = (value >>> 0) % (index + 1);
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
}

function seatsFor(config: RoomConfig): Seat[] {
  if (config.format === '1v1') {
    return [
      { id: 'opponent', team: 'B' },
      { id: 'human', team: 'A' },
    ];
  }
  return [
    { id: 'mariale', team: 'B' },
    { id: 'rafael', team: 'A' },
    { id: 'vale', team: 'B' },
    { id: 'human', team: 'A' },
  ];
}

function playerName(id: SeatId, config: RoomConfig) {
  return {
    opponent: config.opponent === 'ai' ? 'Truquito · IA' : 'Mariale',
    mariale: 'Mariale',
    rafael: 'Rafael C.',
    vale: 'Vale_23',
    human: 'Tú',
  }[id] ?? id;
}

function presentEvent(event: string, config: RoomConfig) {
  return gameEventText(event, Object.fromEntries(['opponent', 'human', 'mariale', 'rafael', 'vale'].map((id) => [id, playerName(id, config)])), 'human');
}

function presetLabel(preset: RoomConfig['preset']) {
  return preset === 'oriental'
    ? 'Oriental clásico'
    : preset === 'rapida'
      ? 'Mesa rápida'
      : 'Competitiva larga';
}

function rulesForConfig(config: RoomConfig): ExecutableRules {
  return {
    florMode: config.flor,
    pardaMode: config.parda,
    pardaEngine: config.pardaEngine,
    florPoints: Number(config.florPoints),
  };
}

function initialSnapshot(config: RoomConfig, resumeFromStorage: boolean) {
  if (resumeFromStorage && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('truco-active-table');
      const parsed = saved ? (JSON.parse(saved) as { engine?: EngineSnapshot }) : null;
      if (parsed?.engine && parsed.engine.format === config.format) {
        return reconnectSnapshot(resumeSnapshot(JSON.stringify(parsed.engine)));
      }
    } catch {
      // A stale practice snapshot should never block a fresh table.
    }
  }
  const seats = seatsFor(config);
  const snapshot = createEngineSnapshot({
    deck: seededDeck(crypto.getRandomValues(new Uint32Array(1))[0]),
    seats,
    dealerSeatId: 'human',
    target: Number(config.target),
    gamesToWin: config.match === 'mejor-de-tres' ? 2 : 1,
    rules: rulesForConfig(config),
  });
  return snapshot;
}

function commandPrompt(command: EngineCommand) {
  if (command.type === 'CALL_TRUCO' || command.type === 'RAISE_TRUCO') {
    return {
      eyebrow: 'Escalera de Truco',
      title:
        command.type === 'RAISE_TRUCO'
          ? `¿Quiero y ${callLabels[command.call]}?`
          : `¿Cantas ${callLabels[command.call]}?`,
      copy:
        command.call === 'vale-juego'
          ? 'Si se quiere, el ganador de esta base gana el chico; si se rechaza, se pagan 9 piedras.'
          : 'El aumento queda pendiente hasta un Quiero, No quiero o repique legal del equipo rival.',
      confirm:
        command.type === 'RAISE_TRUCO'
          ? `Quiero y ${callLabels[command.call]}`
          : `Cantar ${callLabels[command.call]}`,
    };
  }
  if (command.type === 'CALL_ENVIDO') {
    return {
      eyebrow: 'Envite prioritario',
      title: command.amount === 'falta' ? '¿Envidas la Falta?' : '¿Cantas Envido?',
      copy:
        command.amount === 'falta'
          ? 'La apuesta muestra su cantidad exacta al enviarse y se resuelve antes del Truco.'
          : 'Vale 2 si se quiere y 1 si no. Puede interrumpir una respuesta de Truco en la primera vuelta.',
      confirm: command.amount === 'falta' ? 'Envidar la Falta' : 'Cantar Envido',
    };
  }
  if (command.type === 'RAISE_ENVIDO') {
    return {
      eyebrow: 'Repique de Envite',
      title: command.amount === 'falta' ? '¿Quiero y la Falta?' : command.amount === 2 ? '¿Quiero y Envido?' : `¿Quiero y ${command.amount} más?`,
      copy:
        'El aumento acepta lo anterior. Si luego no se quiere, se paga la apuesta que ya estaba aceptada.',
      confirm: command.amount === 'falta' ? 'Quiero y la Falta' : command.amount === 2 ? 'Quiero y Envido' : `Quiero y ${command.amount} más`,
    };
  }
  if (command.type === 'DECLARE_FLOR' || command.type === 'CALL_FLOR_ENVIDA') {
    return {
      eyebrow: 'Flor venezolana',
      title: command.type === 'CALL_FLOR_ENVIDA' ? '¿Tu Flor envida?' : command.mode === 'a-ley' ? 'A ley' : 'Flor tengo',
      copy:
        'La Flor se acredita antes del Truco y anula el Envite normal. La Reservada siempre gana la comparación.',
      confirm: command.type === 'CALL_FLOR_ENVIDA' ? 'Mi Flor envida' : 'Declarar Flor',
    };
  }
  if (command.type === 'PASS_CARDS') {
    return {
      eyebrow: 'Cartas pasadas',
      title: '¿Pasas la primera?',
      copy:
        'Las tres quedan pasadas para el Truco, pero conservan su identidad al calcular el Envite.',
      confirm: 'Pasar las tres',
    };
  }
  if (command.type === 'FOLD_HAND') {
    return {
      eyebrow: 'Fin de la base',
      title: '¿Te vas al mazo?',
      copy: 'El equipo rival cobra el valor de Truco aceptado en esta base.',
      confirm: 'Irme al mazo',
    };
  }
  return null;
}

export function GameTable({
  room,
  config,
  practiceDifficulty,
  guidedPractice,
  resumeFromStorage,
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
  const rules = useMemo<ExecutableRules>(
    () => rulesForConfig(config),
    [config],
  );
  const [snapshot, setSnapshot] = useState(() => initialSnapshot(config, resumeFromStorage));
  const [undoStack, setUndoStack] = useState<EngineSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EngineSnapshot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<EngineCommand | null>(null);
  const [paused, setPaused] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [status, setStatus] = useState(
    config.opponent === 'ai'
      ? `${manoAnnouncement(playerName(snapshot.manoSeatId, config), snapshot.manoSeatId === 'human')} Truquito solo ve sus cartas y las que están sobre la mesa.`
      : 'La base está sincronizada. Mano abre la primera vuelta.',
  );
  const [history, setHistory] = useState<string[]>([
    `Vira: ${snapshot.vira.rank} de ${snapshot.vira.suit}.`,
    `${manoAnnouncement(playerName(snapshot.manoSeatId, config), snapshot.manoSeatId === 'human')}`,
  ]);
  const commandCounter = useRef(0);
  const aiTimer = useRef<number | null>(null);

  const seats = snapshot.seats;
  const humanHand = snapshot.hands.human ?? [];
  const humanDeal = dealtHandForSeat(snapshot, 'human');
  const selectedCard = humanHand.find((card) => cardId(card) === selected);
  const viraDescription = describeVira(snapshot.vira);
  const { perico, perica } = getPieces(snapshot.vira);
  const isPractice = config.opponent === 'ai';
  const currentTrickStart = (snapshot.trickNumber - 1) * seats.length;
  const visiblePlays = snapshot.played.slice(currentTrickStart);

  const roleBySeat = useMemo(() => {
    const start = seats.findIndex((seat) => seat.id === snapshot.manoSeatId);
    const order = Array.from(
      { length: seats.length },
      (_, offset) => seats[(start + offset) % seats.length].id,
    );
    return Object.fromEntries(
      order.map((id, index) => [
        id,
        config.format === '1v1' ? (index === 0 ? 'Mano' : 'Pie') : roleLabels[index],
      ]),
    ) as Record<SeatId, string>;
  }, [config.format, seats, snapshot.manoSeatId]);

  const humanLegal = useMemo(
    () => legalActionsForSnapshot(snapshot, 'human', rules),
    [rules, snapshot],
  );

  const persist = useCallback(
    (engine: EngineSnapshot) => {
      window.localStorage.setItem(
        'truco-active-table',
        JSON.stringify({
          room,
          config,
          practiceDifficulty,
          guidedPractice,
          engine,
          savedAt: Date.now(),
        }),
      );
    },
    [config, guidedPractice, practiceDifficulty, room],
  );

  useEffect(() => {
    persist(snapshot);
  }, [persist, snapshot]);

  const commit = useCallback(
    (
      previous: EngineSnapshot,
      next: EngineSnapshot,
      events: string[],
      explanation?: string,
    ) => {
      setUndoStack((current) => [...current.slice(-19), previous]);
      setRedoStack([]);
      setSnapshot(next);
      setSelected(null);
      setPendingCommand(null);
      const orderedEvents = events.map((event) => presentEvent(event, config)).reverse();
      setHistory((current) => [...orderedEvents, ...current].slice(0, 12));
      if (orderedEvents[0]) setStatus(orderedEvents[0]);
      if (explanation) setAiExplanation(explanation);
    },
    [config],
  );

  function humanCommand(command: EngineCommand) {
    if (paused) {
      setStatus('La práctica está en pausa. Pulsa Seguir para actuar.');
      return;
    }
    try {
      commandCounter.current += 1;
      const result = transition(
        snapshot,
        'human',
        command,
        rules,
        `human-${snapshot.gameVersion}-${commandCounter.current}`,
      );
      commit(snapshot, result.state, result.events);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Esa acción ya no es legal.');
    }
  }

  const automatedActor = useCallback((state: EngineSnapshot) => {
    if (state.match.complete || state.handComplete) return null;
    if (state.priority.active === 'play') {
      return state.activeSeatId === 'human' ? null : state.activeSeatId;
    }
    const pendingTeam =
      state.priority.active === 'truco'
        ? state.truco.pending?.by
        : state.envido.pending?.by;
    if (!pendingTeam) return null;
    const respondingTeam = pendingTeam === 'A' ? 'B' : 'A';
    if (respondingTeam === 'A') return null;
    return (
      state.seats.find((seat) => seat.team === respondingTeam && seat.id !== 'human')
        ?.id ?? null
    );
  }, []);

  const runAutomatedTurn = useCallback(() => {
    const actor = automatedActor(snapshot);
    if (!actor || paused) return;
    try {
      const observation = observeForAi(snapshot, actor, rules);
      const command = choosePracticeAiCommand(
        observation,
        isPractice ? practiceDifficulty : 'criollo',
        snapshot.gameVersion * 97 + snapshot.handNumber,
      );
      commandCounter.current += 1;
      const result = transition(
        snapshot,
        actor,
        command,
        rules,
        `auto-${snapshot.gameVersion}-${commandCounter.current}`,
      );
      commit(
        snapshot,
        result.state,
        result.events,
        isPractice ? explainAiChoice(observation, command) : undefined,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'La mesa rechazó la acción remota.',
      );
    }
  }, [
    automatedActor,
    commit,
    isPractice,
    paused,
    practiceDifficulty,
    rules,
    snapshot,
  ]);

  useEffect(() => {
    const actor = automatedActor(snapshot);
    if (!actor || paused || networkState === 'reconnecting') {
      return;
    }
    aiTimer.current = window.setTimeout(runAutomatedTurn, isPractice ? 480 : 680);
    return () => {
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
    };
  }, [
    automatedActor,
    isPractice,
    networkState,
    paused,
    runAutomatedTurn,
    snapshot,
  ]);

  function skipAiDelay() {
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    runAutomatedTurn();
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current.slice(-19), snapshot]);
    setSnapshot(previous);
    setPaused(true);
    setSelected(null);
    setPendingCommand(null);
    setStatus('Deshiciste una acción confirmada.');
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current.slice(-19), snapshot]);
    setSnapshot(next);
    setPaused(true);
    setStatus('Rehiciste la acción.');
  }

  function restartHand() {
    const restarted = restartCurrentHand(snapshot);
    setUndoStack((current) => [...current.slice(-19), snapshot]);
    setRedoStack([]);
    setSnapshot(restarted);
    setPaused(true);
    setSelected(null);
    setPendingCommand(null);
    setStatus('Base reiniciada con el mismo reparto.');
  }

  function startNewDeal() {
    const dealerSeatId = nextDealer(
      snapshot.seats.map((seat) => seat.id),
      snapshot.dealerSeatId,
    );
    const fresh = createEngineSnapshot({
      deck: seededDeck(snapshot.handNumber * 1_009 + snapshot.gameVersion),
      seats: snapshot.seats,
      dealerSeatId,
      target: snapshot.match.target,
      gamesToWin: snapshot.match.gamesToWin,
      rules,
    });
    fresh.match = { ...snapshot.match, score: { ...snapshot.match.score } };
    fresh.handStartScore = { ...snapshot.match.score };
    fresh.appliedCommandIds = [...snapshot.appliedCommandIds];
    fresh.handNumber = snapshot.handNumber + 1;
    fresh.gameVersion = snapshot.gameVersion + 1;
    setUndoStack((current) => [...current.slice(-19), snapshot]);
    setRedoStack([]);
    setSnapshot(fresh);
    setPaused(false);
    setSelected(null);
    setPendingCommand(null);
    setStatus(`Nuevo reparto. ${manoAnnouncement(playerName(fresh.manoSeatId, config), fresh.manoSeatId === 'human')}`);
    setHistory((current) => [
      `Nueva base ${fresh.handNumber}.`,
      ...current,
    ].slice(0, 12));
  }

  function continueAfterHand() {
    try {
      const next = beginNextHand(
        snapshot,
        seededDeck(snapshot.handNumber * 7_919 + snapshot.gameVersion),
      );
      setUndoStack((current) => [...current.slice(-19), snapshot]);
      setRedoStack([]);
      setSnapshot(next);
      setPaused(false);
      setSelected(null);
      setStatus(
        `Base ${next.handNumber}. ${manoAnnouncement(playerName(next.manoSeatId, config), next.manoSeatId === 'human')}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo repartir.');
    }
  }

  function resetMatch() {
    const fresh = createEngineSnapshot({
      deck: seededDeck(crypto.getRandomValues(new Uint32Array(1))[0]),
      seats: seatsFor(config),
      dealerSeatId: 'human',
      target: Number(config.target),
      gamesToWin: config.match === 'mejor-de-tres' ? 2 : 1,
      rules,
    });
    setSnapshot(fresh);
    setPaused(false);
    setUndoStack([]);
    setRedoStack([]);
    setStatus('Partido nuevo. Truquito vuelve a ser Mano.');
  }

  const prompt = pendingCommand ? commandPrompt(pendingCommand) : null;
  const nextCall = snapshot.truco.pending
    ? nextTrucoCall(snapshot.truco.pending.call)
    : nextTrucoCall(snapshot.truco.accepted);
  const acceptedStake = trucoAcceptedValue(snapshot.truco.accepted);
  const pendingStake = snapshot.truco.pending
    ? trucoRejectedValue(snapshot.truco.pending.call)
    : null;
  const legalCallLabels = humanLegal
    .filter(
      (action) =>
        !['play-card', 'play-stack', 'fold', 'pass-card'].includes(action),
    )
    .map((action) => actionLabels[action] ?? action);
  const formatLabel = config.format === '1v1' ? '1 contra 1' : '2 contra 2';
  const humanIsMano = snapshot.manoSeatId === 'human';
  const aiThinking = Boolean(
    automatedActor(snapshot) && !paused && networkState !== 'reconnecting',
  );
  const humanPiece = (card: TrucoCard) =>
    sameCard(card, perico)
      ? 'Perico'
      : sameCard(card, perica)
        ? 'Perica'
        : null;
  const orderedStack = [...humanHand].sort(
    (a, b) => trucoRank(b, snapshot.vira) - trucoRank(a, snapshot.vira),
  );

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            onClick={onLeave}
            variant="ghost"
            size="icon"
            aria-label="Salir de la partida"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="hidden h-6 w-px bg-border sm:block" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{room.name}</h1>
              <Badge
                variant="outline"
                className="hidden font-mono tracking-wider sm:inline-flex"
              >
                {isPractice ? 'PRÁCTICA' : 'CANTO7'}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Base {snapshot.handNumber} · Chico {snapshot.match.gameNumber} · {formatLabel} ·{' '}
              {presetLabel(config.preset)}
            </p>
          </div>
        </div>

        <div
          className="scoreboard"
          aria-label={`Marcador: tú ${snapshot.match.score.A}, rival ${snapshot.match.score.B}`}
        >
          <span>
            <small>{config.format === '1v1' ? 'Tú' : 'Nosotros'}</small>
            <strong>{snapshot.match.score.A}</strong>
          </span>
          <i>—</i>
          <span>
            <small>
              {config.format === '1v1' ? (isPractice ? 'IA' : 'Rival') : 'Ellos'}
            </small>
            <strong>{snapshot.match.score.B}</strong>
          </span>
          <em>/ {snapshot.match.target}</em>
          {snapshot.match.gamesToWin === 2 && (
            <em>
              chicos {snapshot.match.gameWins.A}–{snapshot.match.gameWins.B}
            </em>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            className="connection-chip"
            onClick={() =>
              onToast(
                isPractice
                  ? 'Práctica local guardada.'
                  : 'Todo sincronizado · Caracas 42 ms',
              )
            }
            aria-label={isPractice ? 'Práctica local guardada' : 'Estado de conexión'}
          >
            {networkState === 'reconnecting' ? <WifiOff /> : <Wifi />}
            <span className="hidden sm:inline">
              {isPractice
                ? 'Local'
                : networkState === 'online'
                  ? '42 ms'
                  : networkState === 'restored'
                    ? 'De vuelta'
                    : 'Reconectando'}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Opciones de la mesa" />
              }
            >
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{room.name}</DropdownMenuLabel>
                <DropdownMenuItem onClick={onOpenRules}>
                  <Info />
                  Reglas completas
                </DropdownMenuItem>
                {!isPractice && (
                  <DropdownMenuItem
                    onClick={() => onToast('Seña pública enviada a toda la mesa.')}
                  >
                    <Eye />
                    Enviar seña pública
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {!isPractice && (
                <DropdownMenuItem onClick={onOpenReport}>
                  <ShieldAlert />
                  Reportar o bloquear
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={onLeave}>
                <Flag />
                {isPractice ? 'Salir de práctica' : 'Abandonar partida'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {networkState === 'restored' && (
        <output className="restored-banner">
          <Check className="size-4" />
          Volviste a la mesa. Formato, Vira, turno y cantos quedaron intactos.
        </output>
      )}

      <div className="table-layout">
        <div className="player-play-area">
        <section
          className="table-stage"
          data-format={config.format}
          aria-label={`Mesa de juego ${formatLabel}`}
        >
          {seats
            .filter((seat) => seat.id !== 'human')
            .map((seat) => {
              const position =
                config.format === '1v1'
                  ? 'top'
                  : seat.id === 'mariale'
                    ? 'top'
                    : seat.id === 'rafael'
                      ? 'left'
                      : 'right';
              return (
                <div key={seat.id} className={`seat-position seat-${position}`}>
                  <PlayerSeat
                    name={playerName(seat.id, config)}
                    seatRole={`${roleBySeat[seat.id]} · ${seat.team === 'A' ? 'Pareja' : isPractice ? 'IA' : 'Rival'}`}
                    speaking={seat.id === 'mariale' && !isPractice}
                    bot={seat.id === 'opponent' && isPractice}
                  />
                </div>
              );
            })}

          <div className="felt">
            <div className="felt-status">
              <span
                className={`turn-dot ${snapshot.activeSeatId === 'human' ? 'is-active' : ''}`}
              />
              <p aria-live="polite">{paused ? 'Práctica en pausa.' : status}</p>
            </div>

            <div className="played-cards" aria-label="Cartas jugadas en esta vuelta">
              {visiblePlays.map(({ seatId, card }) => {
                const position =
                  seatId === 'human'
                    ? 'bottom'
                    : seatId === 'rafael'
                      ? 'left'
                      : seatId === 'vale'
                        ? 'right'
                        : 'top';
                return (
                  <div
                    key={`${seatId}-${cardId(card)}`}
                    className={`played-card played-${position}`}
                  >
                    <FaceCard card={card} compact />
                    <em>{playerName(seatId, config)}</em>
                  </div>
                );
              })}
            </div>


          </div>

          <div
            className="vira-deck"
            aria-label={`Vira visible: ${snapshot.vira.rank} de ${snapshot.vira.suit}`}
          >
            <div className="deck-stack" aria-hidden="true">
              <span />
              <span />
              <strong>MAZO</strong>
            </div>
            <div className="vira-card-wrap">
              <span className="vira-label">VIRA</span>
              <FaceCard card={snapshot.vira} vira />
            </div>
            <div className="vira-copy">
              <strong>
                {snapshot.vira.rank} de {snapshot.vira.suit}
              </strong>
              <span>{viraDescription.text}</span>
              <em>{viraDescription.substitution}</em>
            </div>
          </div>

          <div className="seat-position seat-bottom">
            <PlayerSeat
              name="Tú"
              seatRole={`${roleBySeat.human} · Tú`}
              you
              muted={muted || !voiceEnabled || isPractice}
            />
          </div>


        </section>

          <div className="player-console">
          <section className="hand-zone" aria-label="Tu mano">
            <div className="hand-heading">
              <span>
                <small>
                  Tu mano · Envite {envidoScore(humanDeal, snapshot.vira)}
                  {hasFlor(humanDeal, snapshot.vira) ? ' · Flor' : ''}
                </small>
                <strong>
                  {snapshot.match.complete
                    ? 'Partido terminado'
                    : snapshot.handComplete
                      ? 'Base terminada'
                      : selectedCard
                        ? `${selectedCard.rank} de ${selectedCard.suit}`
                        : humanLegal.includes('play-stack')
                          ? 'Parda: van las dos, mayor arriba'
                          : 'Elige una carta'}
                </strong>
              </span>
              <Badge
                variant={snapshot.activeSeatId === 'human' ? 'default' : 'secondary'}
              >
                {snapshot.match.complete
                  ? 'Final'
                  : snapshot.handComplete
                    ? 'Cierre'
                    : snapshot.activeSeatId === 'human'
                      ? 'Tu turno'
                      : aiThinking
                        ? 'Pensando…'
                        : 'Esperando'}
              </Badge>
            </div>
            <div className="hand-cards">
              {humanHand.map((card) => {
                const id = cardId(card);
                const piece = humanPiece(card);
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    disabled={
                      (!humanLegal.includes('play-card') &&
                        !humanLegal.includes('play-stack')) ||
                      paused
                    }
                    className={`game-card hand-card suit-${card.suit}${selected === id ? ' is-selected' : ''}${card.passed ? ' is-passed' : ''}`}
                    aria-pressed={selected === id}
                    aria-label={`${card.rank} de ${card.suit}${piece ? `, ${piece}` : ''}${card.passed ? ', pasada' : ''}`}
                  >
                    <span>
                      <b>{card.rank}</b>
                      <small>{suitShort[card.suit]}</small>
                    </span>
                    <em>{piece ?? card.suit}</em>
                  </button>
                );
              })}
              {humanHand.length === 0 && !snapshot.handComplete && (
                <p className="text-sm text-muted-foreground">
                  Ya jugaste tus tres cartas.
                </p>
              )}
            </div>
            {snapshot.match.complete ? (
              <Button
                onClick={resetMatch}
                className="play-card-button h-12 rounded-xl px-5"
              >
                Nueva partida
              </Button>
            ) : snapshot.handComplete ? (
              <Button
                onClick={continueAfterHand}
                className="play-card-button h-12 rounded-xl px-5"
              >
                {snapshot.match.gameComplete ? 'Siguiente chico' : 'Siguiente base'}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  humanLegal.includes('play-stack') && orderedStack.length === 2
                    ? humanCommand({
                        type: 'PLAY_STACK',
                        cardIds: [cardId(orderedStack[0]), cardId(orderedStack[1])],
                      })
                    : selectedCard &&
                      humanCommand({ type: 'PLAY_CARD', cardId: cardId(selectedCard) })
                }
                disabled={
                  paused ||
                  (humanLegal.includes('play-stack')
                    ? orderedStack.length !== 2
                    : !selectedCard || !humanLegal.includes('play-card'))
                }
                className="play-card-button h-12 rounded-xl px-6"
              >
                {humanLegal.includes('play-stack') ? 'Apilar las dos' : 'Jugar carta'}
              </Button>
            )}
          </section>
            {prompt && pendingCommand && (
              <section className="call-confirm" aria-label="Confirmar acción">
                <button
                  onClick={() => setPendingCommand(null)}
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
                    onClick={() => setPendingCommand(null)}
                    variant="outline"
                    className="h-11 rounded-xl"
                  >
                    Todavía no
                  </Button>
                  <Button
                    autoFocus
                    onClick={() => humanCommand(pendingCommand)}
                    className="h-11 rounded-xl"
                  >
                    {prompt.confirm}
                  </Button>
                </div>
              </section>
            )}
          <section className="call-dock">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Cantos y acciones
                </p>
                <h2 className="mt-1 text-sm font-semibold">
                  {snapshot.priority.active === 'play'
                    ? 'Elige tu canto'
                    : 'Respuesta pendiente'}
                </h2>
              </div>
              <Badge variant="outline">
                {humanIsMano ? 'Eres mano' : 'Eres pie'}
              </Badge>
            </div>
            <fieldset className="call-buttons" disabled={paused}>
              {humanLegal.includes('answer-quiero') && (
                <Button
                  onClick={() =>
                    humanCommand({ type: 'ANSWER_CALL', answer: 'quiero' })
                  }
                  className="h-11 rounded-xl"
                >
                  Quiero
                </Button>
              )}
              {humanLegal.includes('answer-no-quiero') && (
                <Button
                  onClick={() =>
                    humanCommand({ type: 'ANSWER_CALL', answer: 'no-quiero' })
                  }
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  No quiero
                </Button>
              )}
              {humanLegal.includes('raise-truco') &&
                nextCall &&
                nextCall !== 'none' && (
                  <Button
                    onClick={() =>
                      setPendingCommand({ type: 'RAISE_TRUCO', call: nextCall })
                    }
                    variant="secondary"
                    className="h-11 rounded-xl"
                  >
                    Quiero y {callLabels[nextCall]}
                  </Button>
                )}
              {humanLegal.includes('raise-envido') && <EnvidoRaises disabled={paused} onSelect={(amount) => setPendingCommand({ type: 'RAISE_ENVIDO', amount })} />}
              {humanLegal.includes('call-envido') && (
                <Button
                  onClick={() =>
                    setPendingCommand({ type: 'CALL_ENVIDO', amount: 2 })
                  }
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  Envido
                </Button>
              )}
              {humanLegal.includes('call-falta') && (
                <Button
                  onClick={() =>
                    setPendingCommand({ type: 'CALL_ENVIDO', amount: 'falta' })
                  }
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  Falta ·{' '}
                  {Math.max(
                    1,
                    snapshot.match.target -
                      Math.max(snapshot.match.score.A, snapshot.match.score.B),
                  )}
                </Button>
              )}
              {humanLegal.includes('declare-flor') && (
                <Button
                  onClick={() =>
                    setPendingCommand({ type: 'DECLARE_FLOR', mode: 'flor' })
                  }
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  Flor
                </Button>
              )}
              {humanLegal.includes('declare-flor') && config.flor === 'a-ley' && <Button variant="outline" onClick={() => setPendingCommand({ type: 'DECLARE_FLOR', mode: 'a-ley' })}>A ley</Button>}
              {humanLegal.includes('call-flor-envida') && (
                <Button
                  onClick={() => setPendingCommand({ type: 'CALL_FLOR_ENVIDA' })}
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  Mi Flor envida
                </Button>
              )}
              {humanLegal.includes('call-truco') &&
                nextCall &&
                nextCall !== 'none' && (
                  <Button
                    onClick={() =>
                      setPendingCommand({ type: 'CALL_TRUCO', call: nextCall })
                    }
                    className="h-11 rounded-xl"
                  >
                    {callLabels[nextCall]}
                  </Button>
                )}
              {humanLegal.includes('pass-card') && (
                <Button
                  onClick={() => setPendingCommand({ type: 'PASS_CARDS' })}
                  variant="secondary"
                  className="h-11 rounded-xl"
                >
                  Pasar cartas
                </Button>
              )}
              {humanLegal.includes('fold') && (
                <Button
                  onClick={() => setPendingCommand({ type: 'FOLD_HAND' })}
                  variant="ghost"
                  className="col-span-2 h-11 rounded-xl text-muted-foreground"
                >
                  Irme al mazo
                </Button>
              )}
              {humanLegal.length === 0 &&
                !snapshot.handComplete &&
                !snapshot.match.complete && (
                  <p className="col-span-2 py-2 text-xs leading-5 text-muted-foreground">
                    Esperando la jugada del rival.
                  </p>
                )}
            </fieldset>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Los cantos cambian según el turno y tu mano. Retruco, Vale nueve y Vale juego aparecen al avanzar la apuesta; Flor, cuando tienes flor.
            </p>
          </section>

          </div>
        </div>
        <aside className="game-side-panel">
          {isPractice && (
            <section className="practice-toolbar">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                    Sala de práctica
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold">
                    <Bot className="size-4" />
                    Truquito ·{' '}
                    {practiceDifficulty[0].toUpperCase() + practiceDifficulty.slice(1)}
                  </h2>
                </div>
                <Badge variant="outline">Sin puntos de clasificación</Badge>
              </div>
              <div className="practice-controls mt-3">
                <Button
                  onClick={() => setPaused((value) => !value)}
                  variant="outline"
                  size="sm"
                >
                  {paused ? <Play /> : <Pause />}
                  {paused ? 'Seguir' : 'Pausa'}
                </Button>
                <Button
                  onClick={undo}
                  variant="outline"
                  size="sm"
                  disabled={!undoStack.length}
                >
                  <Undo2 />
                  Deshacer
                </Button>
                <Button
                  onClick={redo}
                  variant="outline"
                  size="sm"
                  disabled={!redoStack.length}
                >
                  <Redo2 />
                  Rehacer
                </Button>
                <Button
                  onClick={restartHand}
                  variant="outline"
                  size="sm"
                  disabled={snapshot.match.gameComplete}
                >
                  <RotateCcw />
                  Reiniciar
                </Button>
                <Button
                  onClick={startNewDeal}
                  variant="outline"
                  size="sm"
                  disabled={snapshot.handComplete || snapshot.match.gameComplete}
                >
                  <RefreshCcw />
                  Nuevo reparto
                </Button>
                {aiThinking && (
                  <Button onClick={skipAiDelay} variant="secondary" size="sm">
                    <SkipForward />
                    Jugar ahora
                  </Button>
                )}
              </div>
            </section>
          )}

          <section className="table-rules-panel">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Reglas de esta mesa
                </p>
                <h2 className="mt-1 text-sm font-semibold">
                  {presetLabel(config.preset)} · {formatLabel}
                </h2>
              </div>
              <Button
                onClick={onOpenRules}
                variant="ghost"
                size="icon"
                aria-label="Abrir reglas completas"
              >
                <Info className="size-4" />
              </Button>
            </div>
            <dl className="live-rule-list mt-3">
              <div>
                <dt>Truco</dt>
                <dd>
                  {snapshot.truco.pending
                    ? `${callLabels[snapshot.truco.pending.call]} pendiente · rehúse ${pendingStake}`
                    : acceptedStake === 'game'
                      ? 'Vale Juego querido'
                      : `${acceptedStake} en juego`}
                </dd>
              </div>
              <div>
                <dt>Cantos disponibles</dt>
                <dd>
                  {legalCallLabels.length
                    ? legalCallLabels.join(' · ')
                    : 'Jugar / esperar'}
                </dd>
              </div>
              <div>
                <dt>Prioridad</dt>
                <dd>Flor / Envite / Prive → Truco</dd>
              </div>
              <div>
                <dt>Parda</dt>
                <dd>
                  {config.pardaEngine === 'apilada-clasica'
                    ? `Apilada · ${config.parda}`
                    : 'Tres vueltas · online'}
                </dd>
              </div>
              <div>
                <dt>Piezas</dt>
                <dd>
                  Perico {perico.rank} · Perica {perica.rank} de{' '}
                  {snapshot.vira.suit}
                </dd>
              </div>
            </dl>
            <ol className="call-history mt-3">
              {history.slice(0, 4).map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          </section>

          {isPractice && guidedPractice && (
            <section className="guided-panel">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Guía de la base</h2>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                La Vira es {snapshot.vira.rank} de {snapshot.vira.suit}.{' '}
                {viraDescription.substitution}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Tu Envite:{' '}
                <strong className="text-foreground">
                  {envidoScore(humanDeal, snapshot.vira)}
                </strong>
                .{' '}
                {hasFlor(humanDeal, snapshot.vira)
                  ? 'Tienes flor.'
                  : 'No tienes Flor en este reparto.'}
              </p>
              {snapshot.trickResults.at(-1) && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Última vuelta:{' '}
                  {snapshot.trickResults.at(-1)?.parda
                    ? 'parda; continúa la regla configurada.'
                    : `ganó el equipo ${snapshot.trickResults.at(-1)?.winnerTeam} por jerarquía de carta.`}
                </p>
              )}
              {aiExplanation && <p className="ai-reason mt-3">{aiExplanation}</p>}
            </section>
          )}

          {!isPractice && (
            <section className="voice-rail">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Radio className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">Voz de mesa</h2>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {voiceEnabled
                      ? `${config.format === '1v1' ? 2 : 4} conectados`
                      : 'Entra cuando quieras'}
                  </p>
                </div>
                {!voiceEnabled && (
                  <Button onClick={onOpenVoice} variant="outline" size="sm">
                    Activar
                  </Button>
                )}
              </div>
              <div className="voice-members">
                {snapshot.seats
                  .filter((seat) => seat.id !== 'human')
                  .map((seat) => (
                    <VoiceMember
                      key={seat.id}
                      name={playerName(seat.id, config)}
                      state={seat.id === 'mariale' ? 'speaking' : 'on'}
                    />
                  ))}
                <VoiceMember
                  name="Tú"
                  state={!voiceEnabled || muted ? 'muted' : 'on'}
                  you
                />
              </div>
              <div className="voice-controls">
                <Button
                  onClick={voiceEnabled ? onToggleMute : onOpenVoice}
                  variant={muted || !voiceEnabled ? 'secondary' : 'outline'}
                  className="h-11 rounded-xl"
                >
                  {muted || !voiceEnabled ? <MicOff /> : <Mic />}
                  {muted || !voiceEnabled ? 'Mic apagado' : 'Silenciar'}
                </Button>
                <Button
                  onClick={voiceEnabled ? onToggleDeafen : onOpenVoice}
                  variant={deafened ? 'secondary' : 'outline'}
                  className="h-11 rounded-xl"
                >
                  {deafened ? <VolumeX /> : <Volume2 />}
                  {deafened ? 'Sin audio' : 'Escuchar'}
                </Button>
              </div>
            </section>
          )}

          <section className="history-panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Registro</h2>
              </div>
              {!isPractice && (
                <Button
                  onClick={() =>
                    onToast(
                      `Seña pública enviada a ${config.format === '1v1' ? 'tu rival' : 'los cuatro jugadores'}.`,
                    )
                  }
                  variant="ghost"
                  size="sm"
                >
                  <Smile className="size-4" />
                  Seña
                </Button>
              )}
            </div>
            <ol className="mt-3 space-y-2" aria-live="polite">
              {history.slice(0, 8).map((entry, index) => (
                <li
                  key={`${entry}-${index}`}
                  className="text-xs leading-5 text-muted-foreground"
                >
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
              Vira, manos, formato, turno y canto pendiente permanecen en la última
              versión confirmada.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FaceCard({
  card,
  compact = false,
  vira = false,
}: {
  card: TrucoCard;
  compact?: boolean;
  vira?: boolean;
}) {
  return (
    <span
      className={`game-card ${compact ? 'game-card-compact' : ''} ${vira ? 'game-card-vira' : ''} suit-${card.suit}`}
    >
      <span>
        <b>{card.rank}</b>
        <small>{suitShort[card.suit]}</small>
      </span>
      <em>{vira ? card.suit : card.passed ? 'pasada' : card.suit}</em>
    </span>
  );
}

function PlayerSeat({
  name,
  seatRole,
  speaking = false,
  muted = false,
  you = false,
  bot = false,
}: {
  name: string;
  seatRole: string;
  speaking?: boolean;
  muted?: boolean;
  you?: boolean;
  bot?: boolean;
}) {
  return (
    <div className={`table-seat ${you ? 'table-seat-you' : ''}`}>
      <span
        className={`player-avatar player-avatar-sm ${speaking ? 'is-speaking' : ''}`}
        aria-hidden="true"
      >
        {bot ? <Bot className="size-3.5" /> : name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <strong>{name}</strong>
        <small>{seatRole}</small>
      </span>
      {speaking && (
        <Mic className="seat-audio text-emerald-600" aria-label="Está hablando" />
      )}
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
  state: 'speaking' | 'on' | 'muted';
  you?: boolean;
}) {
  return (
    <div className="voice-member">
      <span
        className={`voice-avatar ${state === 'speaking' ? 'is-speaking' : ''}`}
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
              : 'Escuchando'}
        </small>
      </span>
      <span className="ml-auto">
        {state === 'speaking' && <Mic className="size-4 text-emerald-600" />}
        {state === 'on' && <Mic className="size-4 text-muted-foreground" />}
        {state === 'muted' && <MicOff className="size-4 text-muted-foreground" />}
      </span>
    </div>
  );
}
