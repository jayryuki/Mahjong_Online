import { PatternMatch } from './evaluator.js';

export interface ScoreBreakdown {
  base: number;
  han: number;
  fu: number;
  multiplier: number;
  total: number;
  steps: string[];
}

const HAN_TO_POINTS: Record<number, number> = {
  1: 1000,
  2: 2000,
  3: 4000,
  4: 8000,
  5: 8000,
};

export function calculateScore(patterns: PatternMatch[], fu: number): ScoreBreakdown {
  const han = patterns.reduce((sum, p) => sum + p.hanValue, 0);
  const baseFu = fu || 30;

  let total: number;
  let multiplier: number;
  const steps: string[] = [];

  if (han >= 5) {
    total = 8000;
    multiplier = 1;
    steps.push(`${han} han = Mangan (8000)`);
  } else if (HAN_TO_POINTS[han] !== undefined) {
    total = HAN_TO_POINTS[han];
    multiplier = Math.pow(2, 2 + han);
    steps.push(`${han} han / ${baseFu} fu = ${total}`);
  } else {
    const raw = baseFu * Math.pow(2, 2 + han);
    total = Math.min(raw, 8000);
    multiplier = Math.pow(2, 2 + han);
    steps.push(`${han} han / ${baseFu} fu = ${baseFu} × ${multiplier} = ${total}`);
  }

  return { base: baseFu, han, fu: baseFu, multiplier, total, steps };
}
