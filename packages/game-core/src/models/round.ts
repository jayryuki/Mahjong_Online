import { TileDef } from './tile.js';
import { Meld } from './meld.js';
import { River } from './river.js';
import { PlayerScoreState } from './player.js';
import { WallState, DeadWallState, RoundSeedInfo } from './wall.js';
import { ReactionState } from '../engine/reaction.js';

export interface DoraState {
  indicators: TileDef[];
  uraIndicators?: TileDef[];
}


export interface SeatRoundState {
  seatIndex: number;
  playerId: string | null;
  concealedTiles?: TileDef[];
  concealedCount: number;
  melds: Meld[];
  flowers: TileDef[];
  river: River;
  isRiichi: boolean;
  isConnected: boolean;
  hasPassedCurrentReaction?: boolean;
}

export interface RoundSummary {
  roundWind: 'east' | 'south' | 'west' | 'north';
  handNumber: number;
  honba: number;
  riichiSticks: number;
  // Placeholder for HandResult — will be defined in scoring/settlement.ts
  result: unknown;
  endReason: 'win' | 'exhaustive-draw';
  scoreChanges: PlayerScoreState[];
}

export interface RoundState {
  roundWind: 'east' | 'south' | 'west' | 'north';
  handNumber: number;
  honba: number;
  riichiSticks: number;
  dealerSeat: number;
  activeSeat: number;
  wall: WallState;
  deadWall: DeadWallState | null;
  dora: DoraState | null;
  reaction: ReactionState | null;
  seats: SeatRoundState[];
  // Placeholder for GameEvent — will be defined in models/match.ts
  eventLog: unknown[];
  lastEvent?: unknown;
  seedInfo: RoundSeedInfo;
}
