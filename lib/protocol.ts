/** Transport types mirror the authoritative engine; clients never choose their seat identity. */
export type { EngineCommand as TableCommand } from './truco-engine';
export type { RoomAction, RoomState, ChatMessage } from './room-model';
export type VersionedTableCommand = {
  type: 'command';
  id: string;
  gameVersion: number;
  command: import('./truco-engine').EngineCommand;
};
export type PublicTableState = ReturnType<
  typeof import('./truco-engine').projectPublic
>;
export type PrivateSeatState = ReturnType<
  typeof import('./truco-engine').projectPrivate
>;
export type VoiceJoinGrant = { serverUrl: string; token: string };
