import { TileDef } from '../models/tile.js';
import { Meld } from '../models/meld.js';
import { PatternMatch } from './evaluator.js';
import { ScoreBreakdown, calculateScore } from './calculator.js';

export interface HandResult {
  winner: number;
  winType: 'ron' | 'tsumo';
  losingSeat?: number;
  hand: TileDef[];
  melds: Meld[];
  patterns: PatternMatch[];
  han: number;
  fu: number;
  score: ScoreBreakdown;
  settlement: PointTransfer[];
}

export interface PointTransfer {
  from: number;
  to: number;
  amount: number;
  reason: string;
}

export function settleHand(
  winner: number,
  winType: 'ron' | 'tsumo',
  losingSeat: number | undefined,
  patterns: PatternMatch[],
  fu: number,
  playerCount: number,
  isDealer: boolean,
): HandResult {
  const score = calculateScore(patterns, fu);
  const settlement: PointTransfer[] = [];

  if (winType === 'ron' && losingSeat !== undefined) {
    const total = isDealer ? score.total * 6 / 4 : score.total;
    const rounded = Math.ceil(total / 100) * 100;
    settlement.push({
      from: losingSeat,
      to: winner,
      amount: rounded,
      reason: `Ron payment (${score.han} han)`,
    });
    score.total = rounded;
  } else {
    const baseTotal = isDealer ? score.total : score.total;
    const perPlayer = Math.ceil((baseTotal / (playerCount - 1)) / 100) * 100;
    for (let i = 0; i < playerCount; i++) {
      if (i !== winner) {
        settlement.push({
          from: i,
          to: winner,
          amount: isDealer ? perPlayer : (i === ((winner + 0) % playerCount) ? perPlayer * 2 : perPlayer),
          reason: `Tsumo payment (${score.han} han)`,
        });
      }
    }
  }

  return {
    winner,
    winType,
    losingSeat,
    hand: [],
    melds: [],
    patterns,
    han: score.han,
    fu: score.fu,
    score,
    settlement,
  };
}
