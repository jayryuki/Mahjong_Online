export type GamePhaseType =
  | 'LOBBY'
  | 'BETTING'
  | 'DEALING'
  | 'PLAYER_TURN'
  | 'DEALER_TURN'
  | 'SETTLEMENT'
  | 'ROUND_END';

export interface LobbyPhase { type: 'LOBBY' }
export interface BettingPhase { type: 'BETTING' }
export interface DealingPhase { type: 'DEALING' }
export interface PlayerTurnPhase {
  type: 'PLAYER_TURN';
  activeSeat: number;
  handIndex: number;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
}
export interface DealerTurnPhase { type: 'DEALER_TURN' }
export interface SettlementPhase { type: 'SETTLEMENT' }
export interface RoundEndPhase { type: 'ROUND_END' }

export type GamePhase =
  | LobbyPhase
  | BettingPhase
  | DealingPhase
  | PlayerTurnPhase
  | DealerTurnPhase
  | SettlementPhase
  | RoundEndPhase;

const VALID_TRANSITIONS: Record<GamePhaseType, GamePhaseType[]> = {
  LOBBY: ['BETTING'],
  BETTING: ['DEALING'],
  DEALING: ['PLAYER_TURN', 'DEALER_TURN', 'SETTLEMENT'],
  PLAYER_TURN: ['PLAYER_TURN', 'DEALER_TURN', 'SETTLEMENT'],
  DEALER_TURN: ['SETTLEMENT'],
  SETTLEMENT: ['ROUND_END'],
  ROUND_END: ['BETTING', 'LOBBY'],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  const allowed = VALID_TRANSITIONS[from.type];
  return allowed?.includes(to.type) ?? false;
}
