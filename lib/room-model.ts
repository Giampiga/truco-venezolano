import {
  beginNextHand,
  createEngineSnapshot,
  legalActionsForSnapshot,
  projectPrivate,
  projectPublic,
  transition,
  type EngineCommand,
  type EngineSnapshot,
  type ExecutableRules,
} from './truco-engine.ts';
import { createSpanishDeck } from './truco-rules.ts';
import type { RoomConfig, RoomSummary } from './product-types.ts';
import { validateCommand } from './command-validation.ts';

export const DEFAULT_CONFIG: RoomConfig = {
  name: 'La mesa de los panas',
  format: '2v2',
  opponent: 'human',
  preset: 'oriental',
  target: '24',
  match: 'un-chico',
  flor: 'a-ley',
  florPoints: '3',
  reservada: 'condicionada',
  parda: 'abierta',
  pardaEngine: 'apilada-clasica',
  truco: 'cerrado',
  envido: 'clasico',
  cardPlay: 'visible',
  privando: false,
  voice: true,
  camera: false,
  ranked: false,
  isPrivate: true,
};
export const presetName = (preset: RoomConfig['preset']) =>
  ({
    oriental: 'Oriental clásico',
    rapida: 'Mesa rápida',
    competitiva: 'Competitiva larga',
  })[preset];
export const roomRules = (config: RoomConfig): ExecutableRules => ({
  florMode: config.flor,
  pardaMode: config.parda,
  pardaEngine: config.pardaEngine,
  florPoints: Number(config.florPoints),
});
export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export type Member = {
  userId: string;
  seatId: string;
  name: string;
  ready: boolean;
  joinedAt: number;
  lastSeen: number;
  voiceId: string;
  left: boolean;
};
export type ChatMessage = {
  id: string;
  seatId: string;
  author: string;
  text: string;
  at: number;
};
export type StoredRoom = {
  id: string;
  code: string;
  config: RoomConfig;
  hostId: string;
  revision: number;
  createdAt: number;
  members: Member[];
  messages: ChatMessage[];
  engine: EngineSnapshot | null;
  events: string[];
  closed: boolean;
  commandIds: string[];
  voiceRevocations: string[];
};
export type RoomState = {
  serverTime: number;
  id: string;
  code: string;
  config: RoomConfig;
  revision: number;
  you: string;
  host: string;
  closed: boolean;
  members: Omit<Member, 'userId'>[];
  messages: ChatMessage[];
  events: string[];
  game: null | {
    public: ReturnType<typeof projectPublic>;
    private: ReturnType<typeof projectPrivate>;
    legal: ReturnType<typeof legalActionsForSnapshot>;
  };
};
export type RoomAction =
  | { type: 'join'; name: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'heartbeat' }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'claim-forfeit' }
  | { type: 'close' }
  | { type: 'chat'; text: string; id: string }
  | { type: 'next'; gameVersion: number }
  | {
      type: 'command';
      command: EngineCommand;
      id: string;
      gameVersion: number;
    };

const stripControls = (input: string) =>
  Array.from(input)
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join('');
export function cleanName(input: unknown) {
  if (typeof input !== 'string')
    throw new RoomError('Escribe tu nombre para entrar.');
  const name = stripControls(input.trim()).slice(0, 24);
  if (name.length < 2)
    throw new RoomError('Tu nombre debe tener al menos 2 caracteres.');
  return name;
}
export function validateConfig(input: unknown): RoomConfig {
  if (!input || typeof input !== 'object')
    throw new RoomError('Configuración inválida.');
  const source = input as Record<string, unknown>;
  const config = { ...DEFAULT_CONFIG };
  const choices = {
    format: ['1v1', '2v2'],
    preset: ['oriental', 'rapida', 'competitiva'],
    target: ['12', '24', '32'],
    match: ['un-chico', 'mejor-de-tres'],
    flor: ['off', 'a-ley', 'por-derecho'],
    florPoints: ['3', '4', '5'],
    parda: ['abierta', 'cerrada'],
    pardaEngine: ['apilada-clasica', 'secuencial-online'],
  };
  for (const [key, values] of Object.entries(choices)) {
    if (!values.includes(source[key] as string))
      throw new RoomError(`Ajuste inválido: ${key}.`);
    Object.assign(config, { [key]: source[key] });
  }
  if (
    typeof source.voice !== 'boolean' ||
    typeof source.isPrivate !== 'boolean'
  )
    throw new RoomError('Configuración de sala inválida.');
  if (typeof source.name !== 'string' || source.name.trim().length < 2)
    throw new RoomError('Escribe un nombre para la mesa.');
  config.name = stripControls(source.name.trim()).slice(0, 36);
  for (const key of ['camera', 'ranked']) {
    if (source[key] !== undefined && typeof source[key] !== 'boolean')
      throw new RoomError('Configuración de sala inválida.');
  }
  config.camera = source.camera === true && source.voice;
  config.ranked = source.ranked === true;
  if (config.ranked)
    Object.assign(config, {
      preset: 'oriental',
      target: '24',
      match: 'un-chico',
      flor: 'a-ley',
      florPoints: '3',
      parda: 'abierta',
      pardaEngine: 'apilada-clasica',
    });
  config.voice = source.voice;
  config.isPrivate = source.isPrivate;
  return config;
}
export function shuffledDeck() {
  const deck = createSpanishDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const size = i + 1;
    const limit = Math.floor(0x100000000 / size) * size;
    let random: number;
    do {
      random = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (random >= limit);
    const j = random % size;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function newRoom(
  id: string,
  code: string,
  userId: string,
  name: string,
  config: RoomConfig,
  now = Date.now(),
): StoredRoom {
  return {
    id,
    code,
    config,
    hostId: userId,
    revision: 0,
    createdAt: now,
    members: [
      {
        userId,
        seatId: 'p0',
        name: cleanName(name),
        ready: false,
        joinedAt: now,
        lastSeen: now,
        voiceId: crypto.randomUUID(),
        left: false,
      },
    ],
    messages: [],
    engine: null,
    events: [],
    closed: false,
    commandIds: [],
    voiceRevocations: [],
  };
}
export function requireMember(room: StoredRoom, userId: string) {
  const member = room.members.find((m) => m.userId === userId && !m.left);
  if (!member) throw new RoomError('No tienes un asiento en esta mesa.', 403);
  return member;
}
export function projectRoom(room: StoredRoom, userId: string): RoomState {
  const member = requireMember(room, userId);
  return {
    serverTime: Date.now(),
    id: room.id,
    code: room.code,
    config: room.config,
    revision: room.revision,
    you: member.seatId,
    host: room.members.find((m) => m.userId === room.hostId)?.seatId ?? '',
    closed: room.closed,
    members: room.members.map(
      ({ userId: _privateId, ...publicMember }) => publicMember,
    ),
    messages: room.messages,
    events: room.events,
    game: room.engine
      ? {
          public: projectPublic(room.engine),
          private: projectPrivate(room.engine, member.seatId),
          legal: legalActionsForSnapshot(
            room.engine,
            member.seatId,
            roomRules(room.config),
          ),
        }
      : null,
  };
}
export function roomSummary(room: StoredRoom): RoomSummary {
  return {
    id: room.id,
    name: room.config.name,
    host:
      room.members.find((m) => m.userId === room.hostId)?.name ?? 'Anfitrión',
    players: `${room.members.filter((m) => !m.left).length}/${room.config.format === '1v1' ? 2 : 4}`,
    format: room.config.format,
    opponent: 'human',
    score: `A ${room.config.target} piedras`,
    rule: presetName(room.config.preset),
    voice: room.config.voice ? 1 : 0,
    camera: !!room.config.camera,
    ranked: !!room.config.ranked,
    tone: 'green',
    status: room.engine
      ? 'playing'
      : room.config.isPrivate
        ? 'private'
        : 'open',
  };
}
export function applyRoomAction(
  previous: StoredRoom,
  userId: string,
  action: RoomAction,
  now = Date.now(),
): StoredRoom {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string')
    throw new RoomError('Acción inválida.');
  if (previous.closed) {
    requireMember(previous, userId);
    if (action.type === 'heartbeat' || action.type === 'close') return previous;
    throw new RoomError('Esta mesa ya está cerrada.', 410);
  }
  const room = structuredClone(previous);
  const capacity = room.config.format === '1v1' ? 2 : 4;
  if (action.type === 'join') {
    const member = room.members.find((m) => m.userId === userId);
    if (member) {
      member.left = false;
      member.lastSeen = now;
    } else {
      if (room.engine) throw new RoomError('La partida ya comenzó.', 409);
      if (room.members.length >= capacity)
        throw new RoomError('La mesa está llena.', 409);
      const seatId = Array.from({ length: capacity }, (_, i) => `p${i}`).find(
        (id) => !room.members.some((m) => m.seatId === id),
      )!;
      room.members.push({
        userId,
        seatId,
        name: cleanName(action.name),
        ready: false,
        joinedAt: now,
        lastSeen: now,
        voiceId: crypto.randomUUID(),
        left: false,
      });
    }
  } else {
    const member = requireMember(room, userId);
    member.lastSeen = now;
    switch (action.type) {
      case 'heartbeat':
        break;
      case 'ready':
        if (room.engine || typeof action.ready !== 'boolean')
          throw new RoomError('No puedes cambiar tu estado ahora.');
        member.ready = action.ready;
        break;
      case 'claim-forfeit': {
        if (!room.config.ranked || !room.engine || room.engine.match.complete)
          throw new RoomError('No hay una partida competitiva en curso.');
        const team = room.engine.seats.find(
          (s) => s.id === member.seatId,
        )!.team;
        const absent = room.members.find(
          (m) =>
            now - m.lastSeen >= 120_000 &&
            room.engine!.seats.find((s) => s.id === m.seatId)?.team !== team,
        );
        if (!absent)
          throw new RoomError(
            'El rival tiene dos minutos para reconectarse.',
            409,
          );
        room.engine.match.complete = true;
        room.engine.match.winner = team;
        room.engine.handComplete = true;
        room.engine.gameVersion++;
        room.events.unshift('Partida resuelta por desconexión del rival.');
        break;
      }
      case 'leave':
        if (room.config.ranked && room.engine && !room.engine.match.complete) {
          const team = room.engine.seats.find(
            (s) => s.id === member.seatId,
          )!.team;
          room.engine.match.complete = true;
          room.engine.match.winner = team === 'A' ? 'B' : 'A';
          room.engine.handComplete = true;
          room.engine.gameVersion++;
          room.events.unshift(
            `${member.name} abandonó. Su equipo pierde la partida.`,
          );
        }
        room.voiceRevocations = [
          ...(room.voiceRevocations ?? []),
          member.voiceId,
        ];
        if (room.engine) member.left = true;
        else room.members = room.members.filter((m) => m.userId !== userId);
        if (!room.members.some((m) => !m.left)) room.closed = true;
        if (room.hostId === userId)
          room.hostId = room.members.find((m) => !m.left)?.userId ?? userId;
        break;
      case 'close':
        if (room.config.ranked && room.engine && !room.engine.match.complete)
          throw new RoomError(
            'Una competitiva en curso no se puede cancelar. Salir cuenta como derrota.',
          );
        if (room.hostId !== userId)
          throw new RoomError('Solo el anfitrión puede cerrar la mesa.', 403);
        room.voiceRevocations = room.members.map((m) => m.voiceId);
        room.closed = true;
        break;
      case 'start': {
        if (room.hostId !== userId)
          throw new RoomError('Solo el anfitrión puede repartir.', 403);
        if (room.engine) throw new RoomError('La partida ya empezó.', 409);
        if (
          room.members.length !== capacity ||
          room.members.some(
            (m) => !m.ready || m.left || now - m.lastSeen > 45_000,
          )
        )
          throw new RoomError('Todos deben estar conectados y listos.');
        const members = [...room.members].sort((a, b) =>
          a.seatId.localeCompare(b.seatId),
        );
        room.engine = createEngineSnapshot({
          deck: shuffledDeck(),
          seats: members.map((m, i) => ({
            id: m.seatId,
            team: i % 2 === 0 ? 'A' : 'B',
          })),
          dealerSeatId: members.at(-1)!.seatId,
          target: Number(room.config.target),
          gamesToWin: room.config.match === 'mejor-de-tres' ? 2 : 1,
          rules: roomRules(room.config),
        });
        room.events = ['Primera base. ¡A jugar!'];
        break;
      }
      case 'chat': {
        if (
          typeof action.text !== 'string' ||
          typeof action.id !== 'string' ||
          action.id.length > 80
        )
          throw new RoomError('Mensaje inválido.');
        if (room.messages.some((m) => m.id === `${member.seatId}:${action.id}`))
          return previous;
        const text = stripControls(action.text.trim()).slice(0, 300);
        if (!text) throw new RoomError('Escribe un mensaje.');
        const last = room.messages.findLast((m) => m.seatId === member.seatId);
        if (last && now - last.at < 800)
          throw new RoomError(
            'Espera un momento antes de enviar otro mensaje.',
            429,
          );
        room.messages = [
          ...room.messages,
          {
            id: `${member.seatId}:${action.id}`,
            seatId: member.seatId,
            author: member.name,
            text,
            at: now,
          },
        ].slice(-80);
        break;
      }
      case 'next':
      case 'command': {
        if (!room.engine)
          throw new RoomError('La partida todavía no ha empezado.');
        const id =
          action.type === 'command'
            ? `${member.seatId}:${action.id}`
            : `next:${action.gameVersion}`;
        if (
          action.type === 'command' &&
          (typeof action.id !== 'string' || action.id.length > 80)
        )
          throw new RoomError('Identificador inválido.');
        if (room.commandIds.includes(id)) return previous;
        if (room.engine.gameVersion !== action.gameVersion)
          throw new RoomError(
            'La mesa cambió. Revisa la jugada y vuelve a intentarlo.',
            409,
          );
        if (room.members.some((m) => m.left || now - m.lastSeen > 45_000))
          throw new RoomError('Esperando que todos vuelvan a la mesa.', 409);
        if (action.type === 'next') {
          if (userId !== room.hostId)
            throw new RoomError('El anfitrión reparte la siguiente base.', 403);
          room.engine = beginNextHand(room.engine, shuffledDeck());
          room.events = [
            `Base ${room.engine.handNumber}.`,
            ...room.events,
          ].slice(0, 24);
        } else {
          const result = transition(
            room.engine,
            member.seatId,
            validateCommand(action.command),
            roomRules(room.config),
            id,
          );
          room.engine = result.state;
          room.engine.appliedCommandIds =
            room.engine.appliedCommandIds.slice(-256);
          room.events = [
            ...result.events.map((e) => `${member.name}: ${e}`).reverse(),
            ...room.events,
          ].slice(0, 24);
        }
        room.commandIds = [...room.commandIds, id].slice(-256);
        break;
      }
      default:
        throw new RoomError('Acción desconocida.');
    }
  }
  room.revision += 1;
  return room;
}
