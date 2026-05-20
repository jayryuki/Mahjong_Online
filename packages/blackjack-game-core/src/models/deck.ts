import { Card, Suit, Rank, SUITS, RANKS } from './card.js';

export interface Deck {
  cards: Card[];
  dealtCount: number;
}

export function createDeck(numDecks: number = 6): Deck {
  const cards: Card[] = [];
  let id = 0;
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, id: `card-${id++}` });
      }
    }
  }
  return { cards, dealtCount: 0 };
}

export function shuffleDeck(deck: Deck, seed?: string): Deck {
  const cards = [...deck.cards];
  // Fisher-Yates shuffle with optional seed
  const random = seed ? seededRandom(seed) : Math.random;
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, dealtCount: 0 };
}

export function drawCard(deck: Deck): { card: Card; deck: Deck } | null {
  if (deck.dealtCount >= deck.cards.length) return null;
  const card = deck.cards[deck.dealtCount];
  return { card, deck: { ...deck, dealtCount: deck.dealtCount + 1 } };
}

export function cardsRemaining(deck: Deck): number {
  return deck.cards.length - deck.dealtCount;
}

export function shouldReshuffle(deck: Deck, penetration: number = 0.25): boolean {
  return cardsRemaining(deck) < deck.cards.length * penetration;
}

// Simple seeded PRNG (mulberry32)
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h |= 0;
    h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
