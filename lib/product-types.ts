export type AppView = 'lobby' | 'room' | 'game';

export type GameFormat = '2v2' | '1v1';
export type OpponentKind = 'human' | 'ai';

export type RoomSummary = {
  id: string;
  name: string;
  host: string;
  players: string;
  format: GameFormat;
  opponent: OpponentKind;
  score: string;
  rule: string;
  voice: number;
  tone: 'amber' | 'green' | 'blue';
  status: 'open' | 'playing' | 'private';
};

export type RoomConfig = {
  name: string;
  format: GameFormat;
  opponent: OpponentKind;
  preset: 'oriental' | 'rapida' | 'competitiva';
  target: '12' | '24' | '32';
  match: 'un-chico' | 'mejor-de-tres';
  flor: 'a-ley' | 'off' | 'por-derecho';
  florPoints: '3' | '4' | '5';
  reservada: 'condicionada' | 'cobra-todo';
  parda: 'abierta' | 'cerrada';
  pardaEngine: 'apilada-clasica' | 'secuencial-online';
  truco: 'abierto' | 'cerrado';
  envido: 'clasico' | 'escalera-online';
  cardPlay: 'visible' | 'matar-tapado';
  privando: boolean;
  voice: boolean;
  isPrivate: boolean;
};

export type NetworkState = 'online' | 'reconnecting' | 'restored';
