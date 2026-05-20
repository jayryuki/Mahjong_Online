export type ActionType =
  | 'CREATE_ROOM' | 'JOIN_ROOM' | 'LEAVE_ROOM' | 'RECONNECT_PLAYER'
  | 'CHOOSE_SEAT' | 'TOGGLE_READY' | 'UPDATE_RULESET' | 'START_MATCH'
  | 'REMATCH' | 'KICK_PLAYER'
  | 'DRAW_TILE' | 'DISCARD_TILE' | 'PASS_REACTION'
  | 'CALL_CHI' | 'CALL_PON' | 'CALL_KAN_OPEN' | 'CALL_KAN_CLOSED' | 'CALL_KAN_ADDED'
  | 'DECLARE_RIICHI' | 'DECLARE_WIN_RON' | 'DECLARE_WIN_TSUMO' | 'DECLARE_WIN_RON_BLIND_KAN'
  | 'DECLARE_FLOWER' | 'ACK_ROUND_RESULT';

export interface ActionPayload {
  type: ActionType;
  playerId: string;
  roomId: string;
  timestamp: number;
  data: Record<string, unknown>;
}
