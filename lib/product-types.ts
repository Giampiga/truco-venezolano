export type AppView = 'lobby' | 'room' | 'game';

export type RoomSummary = {
  id: string;
  name: string;
  host: string;
  players: string;
  format: string;
  score: string;
  rule: string;
  voice: number;
  tone: 'amber' | 'green' | 'blue';
  status: 'open' | 'playing' | 'private';
};

export type RoomConfig = {
  name: string;
  preset: 'oriental' | 'rapida';
  target: '24' | '12';
  flor: 'a-ley' | 'off' | 'por-derecho';
  parda: 'abierta' | 'cerrada';
  voice: boolean;
  isPrivate: boolean;
};

export type NetworkState = 'online' | 'reconnecting' | 'restored';
