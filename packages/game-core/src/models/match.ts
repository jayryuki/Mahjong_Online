import { PlayerState, SpectatorState, ScoreTrack, PlayerScoreState } from './player.js';
import { RoundState, RoundSummary } from './round.js';
import { TileDef } from './tile.js';
import { RulesPreset } from '../rules/preset.js';
import { HandResult } from '../scoring/settlement.js';

export type { RulesPreset };

import type { ActionType } from '../engine/actions.js';

export interface MatchState {
  roomId: string;
  roomCode: string;
  status: 'lobby' | 'in-progress' | 'finished';
  hostPlayerId: string;
  preset: RulesPreset;
  players: PlayerState[];
  spectators: SpectatorState[];
  scores: ScoreTrack;
  round: RoundState | null;
  phase: GamePhase;
  createdAt: number;
  updatedAt: number;
}

export type GamePhase =
  | { type: 'ROOM_OPEN' }
  | { type: 'LOBBY' }
  | { type: 'DEALING'; progress: number }
  | { type: 'TURN_DRAW'; activeSeat: number; wallRemaining: number }
  | { type: 'TURN_DECISION'; activeSeat: number; legalActions: ActionType[] }
  | { type: 'REACTION_WINDOW'; discardSeat: number; discardTile: TileDef; pendingSeats: number[] }
  | { type: 'RESOLUTION'; winner?: number; winType?: 'ron' | 'tsumo' }
  | { type: 'HAND_END'; endReason: 'win' | 'exhaustive-draw'; result: HandResult | null }
  | { type: 'ROUND_END'; summary: RoundSummary }
  | { type: 'MATCH_END'; finalScores: PlayerScoreState[] };

export type GameEvent =
  | { type: 'room-created'; by: string; at: number }
  | { type: 'player-joined'; playerId: string; seatIndex?: number; at: number }
  | { type: 'player-left'; playerId: string; at: number }
  | { type: 'seat-chosen'; playerId: string; seatIndex: number; at: number }
  | { type: 'match-started'; by: string; at: number }
  | { type: 'tile-drawn'; seatIndex: number; at: number }
  | { type: 'tile-discarded'; seatIndex: number; tile: TileDef; at: number }
  | { type: 'reaction-opened'; reactionId: string; discardSeat: number; at: number }
  | { type: 'meld-called'; seatIndex: number; meld: unknown; at: number }
  | { type: 'riichi-declared'; seatIndex: number; at: number }
  | { type: 'win-declared'; seatIndex: number; winType: 'ron' | 'tsumo'; at: number }
  | { type: 'round-ended'; endReason: 'win' | 'exhaustive-draw'; result: HandResult | null; at: number };
