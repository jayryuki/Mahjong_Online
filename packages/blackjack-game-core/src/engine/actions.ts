import { Card } from '../models/card.js';

export type PlayerAction =
  | 'HIT'
  | 'STAND'
  | 'DOUBLE'
  | 'SPLIT'
  | 'SURRENDER';

export type GameAction =
  | { type: 'PLACE_BET'; seat: number; amount: number }
  | { type: 'PLAYER_ACTION'; seat: number; action: PlayerAction }
  | { type: 'DEALER_PLAY' }
  | { type: 'SETTLE' }
  | { type: 'NEXT_ROUND' };
