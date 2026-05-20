import { Card, handValue } from './card.js';

export type HandStatus = 'playing' | 'standing' | 'bust' | 'blackjack' | 'surrender';

export interface Hand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  isDoubled: boolean;
  isSplit: boolean;
  settled: boolean;
  payout: number;
}

export function createHand(bet: number): Hand {
  return {
    cards: [],
    bet,
    status: 'playing',
    isDoubled: false,
    isSplit: false,
    settled: false,
    payout: 0,
  };
}

export function addCardToHand(hand: Hand, card: Card): Hand {
  const newHand = { ...hand, cards: [...hand.cards, card] };
  const value = handValue(newHand.cards);
  if (value.isBust) newHand.status = 'bust';
  return newHand;
}

export function canSplit(hand: Hand, bankroll: number): boolean {
  if (hand.cards.length !== 2) return false;
  if (hand.isSplit) return false; // Only allow one split per hand
  if (bankroll < hand.bet) return false;
  return hand.cards[0].rank === hand.cards[1].rank ||
    (handValue([hand.cards[0]]).soft === 10 && handValue([hand.cards[1]]).soft === 10);
}

export function canDouble(hand: Hand, bankroll: number): boolean {
  if (hand.cards.length !== 2) return false;
  if (hand.status !== 'playing') return false;
  return bankroll >= hand.bet;
}

export function canSurrender(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.isSplit && hand.status === 'playing';
}

export function canHit(hand: Hand): boolean {
  return hand.status === 'playing' && handValue(hand.cards).soft < 21;
}

// Returns total payout (bet returned + profit).
// The bet was already deducted from bankroll when the hand was dealt,
// so adding this payout restores the bet and adds any profit.
export function settleHand(hand: Hand, dealerValue: number, dealerBlackjack: boolean): Hand {
  if (hand.status === 'surrender') {
    // Surrender: get half the bet back
    return { ...hand, settled: true, payout: Math.floor(hand.bet / 2) };
  }
  if (hand.status === 'bust') {
    // Bust: lose entire bet (payout = 0, bet already deducted)
    return { ...hand, settled: true, payout: 0 };
  }

  const playerVal = handValue(hand.cards);
  const playerBlackjack = playerVal.isBlackjack;

  if (playerBlackjack && dealerBlackjack) {
    // Both blackjack: push, bet returned
    return { ...hand, settled: true, payout: hand.bet };
  }
  if (playerBlackjack) {
    // Player blackjack: bet back + 1.5x profit
    return { ...hand, settled: true, payout: hand.bet + Math.floor(hand.bet * 3 / 2) };
  }
  if (dealerBlackjack) {
    // Dealer blackjack: lose bet
    return { ...hand, settled: true, payout: 0 };
  }

  const pv = playerVal.soft;
  if (pv > 21) return { ...hand, settled: true, payout: 0 }; // bust
  if (dealerValue > 21) return { ...hand, settled: true, payout: hand.bet * 2 }; // dealer bust, player wins
  if (pv > dealerValue) return { ...hand, settled: true, payout: hand.bet * 2 }; // player wins
  if (pv < dealerValue) return { ...hand, settled: true, payout: 0 }; // player loses
  return { ...hand, settled: true, payout: hand.bet }; // push, bet returned
}
