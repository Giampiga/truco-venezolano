import type { TrucoCard, TrucoCall } from './truco-rules';

export type TableCommand =
  | { type: 'PLAY_CARD'; payload: { cardId: string; passed: boolean } }
  | { type: 'CALL_ENVIDO'; payload: { amount: number | 'falta' } }
  | { type: 'CALL_FLOR'; payload: { mode: 'flor' | 'a-ley' } }
  | { type: 'CALL_TRUCO'; payload: { call: Exclude<TrucoCall, 'none'> } }
  | { type: 'ANSWER_CALL'; payload: { answer: 'quiero' | 'no-quiero' } }
  | { type: 'FOLD_HAND'; payload: Record<string, never> }
  | { type: 'SET_READY'; payload: { ready: boolean } };

export type VersionedTableCommand = TableCommand & {
  commandId: string;
  idempotencyKey: string;
  tableId: string;
  seatId: string;
  expectedGameVersion: number;
  issuedAt: string;
};

export type PublicTableState = {
  gameVersion: number;
  tableId: string;
  baseNumber: number;
  activeSeatId: string;
  score: { teamA: number; teamB: number; target: number };
  acceptedTruco: TrucoCall;
  pendingCall: null | {
    type: 'envido' | 'flor' | 'truco';
    calledBySeatId: string;
  };
  playedCards: Array<{
    seatId: string;
    card: TrucoCard;
  }>;
};

export type PrivateSeatState = {
  gameVersion: number;
  seatId: string;
  hand: TrucoCard[];
  reconnectToken: string;
};

export type VoiceJoinGrant = {
  provider: 'livekit-cloud';
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  token: string;
  expiresAt: string;
  permissions: {
    canSubscribe: true;
    canPublishAudio: true;
    canPublishVideo: false;
  };
};
