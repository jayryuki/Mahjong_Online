import { HKFanMatch } from './hk-evaluator.js';

export interface HKScoreBreakdown {
  fan: number;
  basePoints: number;
  gongMultiplier: number;
  totalPerPlayer: number;
  total: number;
  steps: string[];
}

// Fan → base points (doubling scale)
const FAN_TO_POINTS: Record<number, number> = {
  1: 2,
  2: 4,
  3: 8,
  4: 16,
  5: 32,
  6: 64,
};

export function calculateHKScore(
  patterns: HKFanMatch[],
  hasGong: boolean,
  isDealer: boolean,
): HKScoreBreakdown {
  const fan = patterns.reduce((sum, p) => sum + p.fanValue, 0);
  const steps: string[] = [];

  // Base points from fan
  let basePoints: number;
  if (fan >= 7) {
    basePoints = 128; // Limit hand
    steps.push(`${fan} fan = Limit (128 points)`);
  } else {
    basePoints = FAN_TO_POINTS[fan] ?? 1;
    steps.push(`${fan} fan = ${basePoints} base points`);
  }

  // GONG doubles the score
  const gongMultiplier = hasGong ? 2 : 1;
  if (hasGong) {
    steps.push(`GONG doubles: ${basePoints} × 2 = ${basePoints * gongMultiplier}`);
  }

  const doubledPoints = basePoints * gongMultiplier;

  // Dealer pays double, others pay base
  let totalPerPlayer: number;
  let total: number;

  if (isDealer) {
    // Dealer tsumo: all 3 non-dealers pay double the base
    totalPerPlayer = doubledPoints * 2;
    total = totalPerPlayer * 3;
    steps.push(`Dealer winner: 3 players × ${totalPerPlayer} = ${total}`);
  } else {
    // Non-dealer tsumo: dealer pays double, others pay base
    const dealerPays = doubledPoints * 2;
    const othersPay = doubledPoints;
    total = dealerPays + othersPay * 2; // dealer + 2 non-dealers
    totalPerPlayer = doubledPoints;
    steps.push(`Non-dealer winner: Dealer pays ${dealerPays}, others pay ${othersPay} each = ${total}`);
  }

  return { fan, basePoints, gongMultiplier, totalPerPlayer, total, steps };
}
