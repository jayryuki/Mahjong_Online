export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function handValue(cards: Card[]): { hard: number; soft: number; isBlackjack: boolean; isBust: boolean } {
  let hard = 0;
  let aces = 0;

  for (const card of cards) {
    hard += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }

  // Convert aces from 11 to 1 as needed
  let soft = hard;
  while (soft > 21 && aces > 0) {
    soft -= 10;
    aces--;
  }

  const isBlackjack = cards.length === 2 && soft === 21;
  const isBust = soft > 21;

  return { hard, soft, isBlackjack, isBust };
}

export function displayValue(cards: Card[]): number {
  const { soft } = handValue(cards);
  return soft;
}

export function isSoft(cards: Card[]): boolean {
  const { hard, soft } = handValue(cards);
  return hard !== soft && soft <= 21;
}
