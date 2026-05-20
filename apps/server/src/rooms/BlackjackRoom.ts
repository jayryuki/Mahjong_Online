import { Room, Client } from '@colyseus/core';
import { GameState, PlayerSchema, HandSchema, CardSchema, ChatMessageSchema } from './schema/BlackjackGameState.js';
import {
  type Card,
  type Hand,
  type HandStatus,
  type PlayerAction,
  createDeck,
  shuffleDeck,
  drawCard,
  handValue,
  createHand,
  addCardToHand,
  canSplit,
  canDouble,
  canSurrender,
  canHit,
  settleHand,
  canTransition,
  type GamePhase,
} from '@blackjack/game-core';

interface InternalHand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  isDoubled: boolean;
  isSplit: boolean;
  settled: boolean;
  payout: number;
}

interface InternalPlayer {
  bankroll: number;
  hands: InternalHand[];
  currentBet: number;
  hasBet: boolean;
}

export class BlackjackRoom extends Room<GameState> {
  maxClients = 7;

  private deck: ReturnType<typeof createDeck> | null = null;
  private dealerCards: Card[] = [];
  private internalState: Map<string, InternalPlayer> = new Map();
  private activeSeat = -1;
  private activeHandIndex = 0;
  private sessionToSeat: Map<string, number> = new Map();
  private seatToSession: Map<number, string> = new Map();
  private gamePhase: GamePhase = { type: 'LOBBY' };
  private botTimers: Map<string, NodeJS.Timeout> = new Map();

  onCreate(options: { preset: string; hostPlayerId: string; roomCode: string }) {
    this.setState(new GameState());
    this.state.roomId = this.roomId;
    this.state.roomCode = options.roomCode;
    this.state.hostPlayerId = options.hostPlayerId;
    this.state.status = 'lobby';
    this.state.phase = 'LOBBY';
    this.state.numDecks = 6;
    this.state.minBet = 10;
    this.state.maxBet = 500;

    // --- Lobby messages ---
    this.onMessage('choose-seat', (client, data: { seatIndex: number }) => {
      this.handleChooseSeat(client, data);
    });

    this.onMessage('toggle-ready', (client) => {
      this.handleToggleReady(client);
    });

    this.onMessage('start-round', (_client) => {
      // Only allow starting a new round from ROUND_END or LOBBY
      if (this.gamePhase.type !== 'ROUND_END' && this.gamePhase.type !== 'LOBBY') return;
      this.startBettingPhase();
    });

    this.onMessage('place-bet', (client, data: { amount: number }) => {
      this.handlePlaceBet(client, data);
    });

    this.onMessage('player-action', (client, data: { action: PlayerAction }) => {
      this.handlePlayerAction(client, data);
    });

    this.onMessage('chat', (client, data: { text: string }) => {
      if (!data.text || typeof data.text !== 'string') return;
      const text = data.text.slice(0, 200).trim();
      if (!text) return;
      const player = this.state.players.get(client.sessionId);
      const msg = new ChatMessageSchema();
      msg.senderId = client.sessionId;
      msg.senderName = player?.displayName ?? 'Player';
      msg.text = text;
      msg.timestamp = Date.now();
      this.state.chatMessages.push(msg);
      while (this.state.chatMessages.length > 50) {
        this.state.chatMessages.shift();
      }
    });
  }

  onJoin(client: Client, options: { displayName: string }) {
    const player = new PlayerSchema();
    player.playerId = client.sessionId;
    player.displayName = options.displayName || 'Player';
    player.isConnected = true;
    player.isHost = this.state.players.size === 0;
    player.bankroll = 1000;

    // Auto-assign next available seat
    const occupiedSeats = new Set(Array.from(this.sessionToSeat.values()));
    for (let i = 0; i < this.maxClients; i++) {
      if (!occupiedSeats.has(i)) {
        player.seatIndex = i;
        this.sessionToSeat.set(client.sessionId, i);
        this.seatToSession.set(i, client.sessionId);
        break;
      }
    }

    this.state.players.set(client.sessionId, player);
    this.internalState.set(client.sessionId, {
      bankroll: 1000,
      hands: [],
      currentBet: 0,
      hasBet: false,
    });
  }

  onLeave(client: Client) {
    const seat = this.sessionToSeat.get(client.sessionId);
    if (seat !== undefined) {
      this.seatToSession.delete(seat);
    }
    this.sessionToSeat.delete(client.sessionId);
    this.internalState.delete(client.sessionId);
    this.state.players.delete(client.sessionId);

    // If it was this player's turn, advance to the next player
    if (this.gamePhase.type === 'PLAYER_TURN' && seat === this.activeSeat) {
      this.startNextPlayerTurn();
    }

    // If waiting for bets and all remaining players have bet, deal
    if (this.gamePhase.type === 'BETTING') {
      this.checkAllBetsPlaced();
    }
  }

  onDispose() {
    for (const timer of this.botTimers.values()) {
      clearTimeout(timer);
    }
    this.botTimers.clear();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getSeatForClient(client: Client): number | null {
    return this.sessionToSeat.get(client.sessionId) ?? null;
  }

  private getClientForSeat(seat: number): Client | null {
    const sessionId = this.seatToSession.get(seat);
    if (!sessionId) return null;
    return this.clients.find((c) => c.sessionId === sessionId) ?? null;
  }

  private isBot(seat: number): boolean {
    const sessionId = this.seatToSession.get(seat);
    return sessionId !== undefined && sessionId.startsWith('bot-');
  }

  private setPhase(phase: GamePhase) {
    this.gamePhase = phase;
    this.state.phase = phase.type;
    this.state.activeSeat = this.activeSeat;
    this.state.activeHandIndex = this.activeHandIndex;
  }

  private cardToSchema(card: Card): CardSchema {
    const s = new CardSchema();
    s.suit = card.suit;
    s.rank = card.rank;
    s.id = card.id;
    return s;
  }

  private syncPlayerState(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const internal = this.internalState.get(sessionId);
    if (!player || !internal) return;

    player.bankroll = internal.bankroll;
    player.currentBet = internal.currentBet;
    player.hasBet = internal.hasBet;

    // Sync hands
    player.hands.clear();
    for (const hand of internal.hands) {
      const handSchema = new HandSchema();
      handSchema.bet = hand.bet;
      handSchema.status = hand.status;
      handSchema.isDoubled = hand.isDoubled;
      handSchema.isSplit = hand.isSplit;
      handSchema.settled = hand.settled;
      handSchema.payout = hand.payout;
      for (const card of hand.cards) {
        handSchema.cards.push(this.cardToSchema(card));
      }
      player.hands.push(handSchema);
    }
  }

  private syncDealerCards(revealed: boolean = false) {
    this.state.dealerCards.clear();
    if (this.dealerCards.length === 0) return;

    // First card always visible
    this.state.dealerCards.push(this.cardToSchema(this.dealerCards[0]));

    if (revealed || this.dealerCards.length >= 2) {
      if (revealed) {
        // Show all cards
        for (let i = 1; i < this.dealerCards.length; i++) {
          this.state.dealerCards.push(this.cardToSchema(this.dealerCards[i]));
        }
        this.state.dealerStatus = 'revealed';
      } else {
        // Hide second card (show back)
        const back = new CardSchema();
        back.suit = 'back';
        back.rank = 'back';
        back.id = 'hole-card';
        this.state.dealerCards.push(back);
        this.state.dealerStatus = 'hidden';
      }
    }
  }

  private syncAllPlayers() {
    for (const [sessionId] of this.internalState) {
      this.syncPlayerState(sessionId);
    }
  }

  private getOccupiedSeats(): number[] {
    const seats: number[] = [];
    for (let i = 0; i < this.maxClients; i++) {
      if (this.seatToSession.has(i)) {
        seats.push(i);
      }
    }
    return seats.sort((a, b) => a - b);
  }

  private getAvailableBankroll(internal: InternalPlayer, excludeHandIndex: number): number {
    let committed = 0;
    for (let i = 0; i < internal.hands.length; i++) {
      if (i !== excludeHandIndex) {
        committed += internal.hands[i].bet;
      }
    }
    return internal.bankroll - committed;
  }

  // ---------------------------------------------------------------------------
  // Lobby handlers
  // ---------------------------------------------------------------------------

  private handleChooseSeat(client: Client, data: { seatIndex: number }) {
    const seatIndex = data.seatIndex;
    if (seatIndex < 0 || seatIndex >= this.maxClients) return;

    const existingSession = this.seatToSession.get(seatIndex);
    if (existingSession && existingSession !== client.sessionId) return;

    const oldSeat = this.sessionToSeat.get(client.sessionId);
    if (oldSeat !== undefined) {
      this.seatToSession.delete(oldSeat);
    }

    this.sessionToSeat.set(client.sessionId, seatIndex);
    this.seatToSession.set(seatIndex, client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.seatIndex = seatIndex;
    }
  }

  private handleToggleReady(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isReady = !player.isReady;
    }
  }

  // ---------------------------------------------------------------------------
  // Betting phase
  // ---------------------------------------------------------------------------

  private startBettingPhase() {
    const players = Array.from(this.state.players.values());
    if (players.length < 1) return;

    const allSeated = players.every((p) => this.sessionToSeat.has(p.playerId));
    if (!allSeated) return;

    const allReady = players.every((p) => p.isReady);
    if (!allReady) return;

    this.state.status = 'in-progress';

    // Reset round state
    this.dealerCards = [];
    this.state.dealerCards.clear();
    this.state.dealerStatus = 'waiting';
    this.state.roundResult = '';
    this.activeSeat = 255;
    this.activeHandIndex = 0;

    // Reset all players for new round
    for (const [sessionId, internal] of this.internalState) {
      internal.hands = [];
      internal.currentBet = 0;
      internal.hasBet = false;
      const player = this.state.players.get(sessionId);
      if (player) {
        player.isReady = true;
      }
    }

    // Create and shuffle deck
    this.deck = shuffleDeck(createDeck(this.state.numDecks), `${this.roomId}-${Date.now()}`);

    // Set phase
    const phase: GamePhase = { type: 'BETTING' };
    this.setPhase(phase);
    this.syncAllPlayers();

    // Notify human players to place bets
    const occupied = this.getOccupiedSeats();
    for (const seat of occupied) {
      if (!this.isBot(seat)) {
        const client = this.getClientForSeat(seat);
        if (client) {
          client.send('place-your-bet', {
            minBet: this.state.minBet,
            maxBet: this.state.maxBet,
          });
        }
      }
    }
  }

  private handlePlaceBet(client: Client, data: { amount: number }) {
    if (this.gamePhase.type !== 'BETTING') return;

    const player = this.state.players.get(client.sessionId);
    const internal = this.internalState.get(client.sessionId);
    if (!player || !internal) return;

    const amount = Math.floor(data.amount);
    if (amount < this.state.minBet || amount > this.state.maxBet) return;
    if (amount > internal.bankroll) return;
    if (internal.hasBet) return;

    internal.currentBet = amount;
    internal.hasBet = true;
    this.syncPlayerState(client.sessionId);

    this.checkAllBetsPlaced();
  }

  private checkAllBetsPlaced() {
    const occupied = this.getOccupiedSeats();
    const allBet = occupied.every((seat) => {
      const sessionId = this.seatToSession.get(seat)!;
      const internal = this.internalState.get(sessionId)!;
      return internal.hasBet;
    });

    if (allBet) {
      this.dealCards();
    }
  }

  // ---------------------------------------------------------------------------
  // Deal
  // ---------------------------------------------------------------------------

  private dealCards() {
    if (!this.deck) return;

    const phase: GamePhase = { type: 'DEALING' };
    this.setPhase(phase);

    const occupied = this.getOccupiedSeats();

    // Deduct bets and create hands
    for (const seat of occupied) {
      const sessionId = this.seatToSession.get(seat)!;
      const internal = this.internalState.get(sessionId)!;
      internal.bankroll -= internal.currentBet;
      internal.hands = [{
        cards: [],
        bet: internal.currentBet,
        status: 'playing',
        isDoubled: false,
        isSplit: false,
        settled: false,
        payout: 0,
      }];
    }

    // Deal cards one at a time with delays
    this.dealCardSequence(occupied, 0);
  }

  private dealCardSequence(occupied: number[], cardIndex: number) {
    if (!this.deck) return;

    // cardIndex 0 = first card to each player, 1 = second card to each player
    // cardIndex 2 = dealer first card, 3 = dealer second card

    if (cardIndex < 2) {
      // Deal to players
      for (const seat of occupied) {
        const sessionId = this.seatToSession.get(seat);
        if (!sessionId) continue; // Player disconnected mid-deal
        const internal = this.internalState.get(sessionId);
        if (!internal || internal.hands.length === 0) continue;
        const hand = internal.hands[0];
        const result = drawCard(this.deck!);
        if (result) {
          this.deck = result.deck;
          hand.cards.push(result.card);
        }
        this.syncPlayerState(sessionId);
      }
      this.syncAllPlayers();

      setTimeout(() => this.dealCardSequence(occupied, cardIndex + 1), 600);
    } else if (cardIndex === 2) {
      // Dealer first card (face up)
      const result = drawCard(this.deck!);
      if (result) {
        this.deck = result.deck;
        this.dealerCards.push(result.card);
      }
      this.syncDealerCards(false);
      this.syncAllPlayers();

      setTimeout(() => this.dealCardSequence(occupied, cardIndex + 1), 600);
    } else if (cardIndex === 3) {
      // Dealer second card (face down)
      const result = drawCard(this.deck!);
      if (result) {
        this.deck = result.deck;
        this.dealerCards.push(result.card);
      }
      this.syncDealerCards(false);
      this.syncAllPlayers();

      // After dealing is complete, check for blackjacks
      setTimeout(() => this.afterDeal(occupied), 800);
    }
  }

  private afterDeal(occupied: number[]) {
    // Filter to only still-connected players
    const connected = occupied.filter((seat) => this.seatToSession.has(seat));

    // Check for blackjack for each player
    for (const seat of connected) {
      const sessionId = this.seatToSession.get(seat)!;
      const internal = this.internalState.get(sessionId);
      if (!internal || internal.hands.length === 0) continue;
      const hand = internal.hands[0];
      const val = handValue(hand.cards);
      if (val.isBlackjack) {
        hand.status = 'blackjack';
      }
      this.syncPlayerState(sessionId);
    }

    // Check dealer blackjack
    const dealerVal = handValue(this.dealerCards);

    if (dealerVal.isBlackjack) {
      // Reveal dealer blackjack, settle
      this.syncDealerCards(true);
      this.syncAllPlayers();
      setTimeout(() => this.settleRound(), 1000);
      return;
    }

    // Check if all players have blackjack
    const allBlackjack = connected.length > 0 && connected.every((seat) => {
      const sessionId = this.seatToSession.get(seat)!;
      const internal = this.internalState.get(sessionId)!;
      return internal.hands.length === 1 && internal.hands[0].status === 'blackjack';
    });

    if (allBlackjack) {
      this.syncDealerCards(true);
      this.syncAllPlayers();
      setTimeout(() => this.settleRound(), 1000);
      return;
    }

    // Start player turns
    this.startNextPlayerTurn();
  }

  // ---------------------------------------------------------------------------
  // Player turns
  // ---------------------------------------------------------------------------

  private startNextPlayerTurn() {
    const occupied = this.getOccupiedSeats();

    // Find next seat that still has a playing hand
    while (true) {
      // Find the first seat with an active hand
      let found = false;
      for (const seat of occupied) {
        const sessionId = this.seatToSession.get(seat)!;
        const internal = this.internalState.get(sessionId)!;

        for (let hi = 0; hi < internal.hands.length; hi++) {
          const hand = internal.hands[hi];
          if (hand.status === 'playing') {
            this.activeSeat = seat;
            this.activeHandIndex = hi;

            const availableBankroll = this.getAvailableBankroll(internal, hi);
            const phase: GamePhase = {
              type: 'PLAYER_TURN',
              activeSeat: seat,
              handIndex: hi,
              canHit: canHit(hand),
              canStand: true,
              canDouble: canDouble(hand, availableBankroll),
              canSplit: canSplit(hand, availableBankroll),
              canSurrender: canSurrender(hand),
            };
            this.setPhase(phase);
            this.syncAllPlayers();

            if (this.isBot(seat)) {
              this.scheduleBotAction(seat);
            } else {
              const client = this.getClientForSeat(seat);
              if (client) {
                client.send('your-turn', {
                  seat,
                  handIndex: hi,
                  canHit: canHit(hand),
                  canStand: true,
                  canDouble: canDouble(hand, availableBankroll),
                  canSplit: canSplit(hand, availableBankroll),
                  canSurrender: canSurrender(hand),
                });
              }
            }
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) break;

      // No more playing hands — move to dealer turn
      this.startDealerTurn();
      return;
    }
  }

  private handlePlayerAction(client: Client, data: { action: PlayerAction }) {
    if (this.gamePhase.type !== 'PLAYER_TURN') return;

    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;

    const sessionId = client.sessionId;
    const internal = this.internalState.get(sessionId);
    if (!internal) return;

    const hand = internal.hands[this.activeHandIndex];
    if (!hand || hand.status !== 'playing') return;

    this.executeAction(seat, sessionId, this.activeHandIndex, data.action);
  }

  private executeAction(seat: number, sessionId: string, handIndex: number, action: PlayerAction) {
    const internal = this.internalState.get(sessionId)!;
    const hand = internal.hands[handIndex];
    if (!hand || hand.status !== 'playing') return;

    switch (action) {
      case 'HIT': {
        const result = drawCard(this.deck!);
        if (result) {
          this.deck = result.deck;
          hand.cards.push(result.card);
          const val = handValue(hand.cards);
          if (val.isBust) {
            hand.status = 'bust';
          } else if (val.soft === 21) {
            hand.status = 'standing';
          }
        }
        this.syncPlayerState(sessionId);
        this.syncAllPlayers();

        if (hand.status === 'playing') {
          // Player can act again
          const availableBankroll = this.getAvailableBankroll(internal, handIndex);
          const phase: GamePhase = {
            type: 'PLAYER_TURN',
            activeSeat: seat,
            handIndex,
            canHit: canHit(hand),
            canStand: true,
            canDouble: canDouble(hand, availableBankroll),
            canSplit: false, // Can't split after hitting
            canSurrender: false,
          };
          this.setPhase(phase);

          if (this.isBot(seat)) {
            this.scheduleBotAction(seat);
          } else {
            const client = this.getClientForSeat(seat);
            if (client) {
              client.send('your-turn', {
                seat,
                handIndex,
                canHit: canHit(hand),
                canStand: true,
                canDouble: canDouble(hand, availableBankroll),
                canSplit: false,
                canSurrender: false,
              });
            }
          }
        } else {
          // Hand is done (bust or 21)
          this.advanceHandOrNextPlayer(seat, sessionId);
        }
        break;
      }

      case 'STAND': {
        hand.status = 'standing';
        this.syncPlayerState(sessionId);
        this.advanceHandOrNextPlayer(seat, sessionId);
        break;
      }

      case 'DOUBLE': {
        if (!canDouble(hand, this.getAvailableBankroll(internal, handIndex))) return;
        // Deduct the extra bet for doubling
        internal.bankroll -= hand.bet;
        hand.bet *= 2;
        hand.isDoubled = true;
        const result = drawCard(this.deck!);
        if (result) {
          this.deck = result.deck;
          hand.cards.push(result.card);
          const val = handValue(hand.cards);
          hand.status = val.isBust ? 'bust' : 'standing';
        }
        this.syncPlayerState(sessionId);
        this.advanceHandOrNextPlayer(seat, sessionId);
        break;
      }

      case 'SPLIT': {
        if (!canSplit(hand, internal.bankroll)) return;

        const card1 = hand.cards[0];
        const card2 = hand.cards[1];

        // Deduct the extra bet for the split hand from bankroll
        internal.bankroll -= hand.bet;

        // Create two new hands
        const hand1: InternalHand = {
          cards: [card1],
          bet: hand.bet,
          status: 'playing',
          isDoubled: false,
          isSplit: true,
          settled: false,
          payout: 0,
        };
        const hand2: InternalHand = {
          cards: [card2],
          bet: hand.bet,
          status: 'playing',
          isDoubled: false,
          isSplit: true,
          settled: false,
          payout: 0,
        };

        // Draw one card for each hand
        const r1 = drawCard(this.deck!);
        if (r1) {
          this.deck = r1.deck;
          hand1.cards.push(r1.card);
          const v1 = handValue(hand1.cards);
          if (v1.isBlackjack) hand1.status = 'blackjack';
          else if (v1.isBust) hand1.status = 'bust';
        }

        const r2 = drawCard(this.deck!);
        if (r2) {
          this.deck = r2.deck;
          hand2.cards.push(r2.card);
          const v2 = handValue(hand2.cards);
          if (v2.isBlackjack) hand2.status = 'blackjack';
          else if (v2.isBust) hand2.status = 'bust';
        }

        internal.hands = [hand1, hand2];
        this.syncPlayerState(sessionId);
        this.syncAllPlayers();

        // Play first hand
        this.activeHandIndex = 0;
        if (hand1.status === 'playing') {
          const availableBankroll = this.getAvailableBankroll(internal, 0);
          const phase: GamePhase = {
            type: 'PLAYER_TURN',
            activeSeat: seat,
            handIndex: 0,
            canHit: canHit(hand1),
            canStand: true,
            canDouble: canDouble(hand1, availableBankroll),
            canSplit: false,
            canSurrender: false,
          };
          this.setPhase(phase);

          if (this.isBot(seat)) {
            this.scheduleBotAction(seat);
          } else {
            const client = this.getClientForSeat(seat);
            if (client) {
              client.send('your-turn', {
                seat,
                handIndex: 0,
                canHit: canHit(hand1),
                canStand: true,
                canDouble: canDouble(hand1, availableBankroll),
                canSplit: false,
                canSurrender: false,
              });
            }
          }
        } else {
          this.activeHandIndex = 1;
          if (hand2.status === 'playing') {
            const availableBankroll = this.getAvailableBankroll(internal, 1);
            const phase: GamePhase = {
              type: 'PLAYER_TURN',
              activeSeat: seat,
              handIndex: 1,
              canHit: canHit(hand2),
              canStand: true,
              canDouble: canDouble(hand2, availableBankroll),
              canSplit: false,
              canSurrender: false,
            };
            this.setPhase(phase);

            if (this.isBot(seat)) {
              this.scheduleBotAction(seat);
            } else {
              const client = this.getClientForSeat(seat);
              if (client) {
                client.send('your-turn', {
                  seat,
                  handIndex: 1,
                  canHit: canHit(hand2),
                  canStand: true,
                  canDouble: canDouble(hand2, availableBankroll),
                  canSplit: false,
                  canSurrender: false,
                });
              }
            }
          } else {
            this.startNextPlayerTurn();
          }
        }
        break;
      }

      case 'SURRENDER': {
        if (!canSurrender(hand)) return;
        hand.status = 'surrender';
        this.syncPlayerState(sessionId);
        this.advanceHandOrNextPlayer(seat, sessionId);
        break;
      }
    }
  }

  private advanceHandOrNextPlayer(seat: number, sessionId: string) {
    const internal = this.internalState.get(sessionId)!;

    // Check if there's another hand to play (from split)
    const nextHandIndex = this.activeHandIndex + 1;
    if (nextHandIndex < internal.hands.length) {
      const nextHand = internal.hands[nextHandIndex];
      if (nextHand.status === 'playing') {
        this.activeHandIndex = nextHandIndex;
        const availableBankroll = this.getAvailableBankroll(internal, nextHandIndex);
        const phase: GamePhase = {
          type: 'PLAYER_TURN',
          activeSeat: seat,
          handIndex: nextHandIndex,
          canHit: canHit(nextHand),
          canStand: true,
          canDouble: canDouble(nextHand, availableBankroll),
          canSplit: false,
          canSurrender: false,
        };
        this.setPhase(phase);
        this.syncAllPlayers();

        if (this.isBot(seat)) {
          this.scheduleBotAction(seat);
        } else {
          const client = this.getClientForSeat(seat);
          if (client) {
            client.send('your-turn', {
              seat,
              handIndex: nextHandIndex,
              canHit: canHit(nextHand),
              canStand: true,
              canDouble: canDouble(nextHand, availableBankroll),
              canSplit: false,
              canSurrender: false,
            });
          }
        }
        return;
      }
    }

    // Move to next player
    this.startNextPlayerTurn();
  }

  // ---------------------------------------------------------------------------
  // Dealer turn
  // ---------------------------------------------------------------------------

  private startDealerTurn() {
    const phase: GamePhase = { type: 'DEALER_TURN' };
    this.setPhase(phase);

    // Reveal dealer hole card with a delay
    setTimeout(() => {
      this.syncDealerCards(true);
      this.syncAllPlayers();

      // Check if any player has a non-bust hand (dealer only plays if needed)
      const occupied = this.getOccupiedSeats();
      const anyActiveHand = occupied.some((seat) => {
        const sessionId = this.seatToSession.get(seat)!;
        const internal = this.internalState.get(sessionId)!;
        return internal.hands.some((h) =>
          h.status === 'standing' || h.status === 'blackjack'
        );
      });

      if (!anyActiveHand) {
        // All players busted or surrendered — skip dealer play
        setTimeout(() => this.settleRound(), 800);
        return;
      }

      // Start drawing with delays
      setTimeout(() => this.dealerDrawLoop(), 800);
    }, 800);
  }

  private dealerDrawLoop() {
    if (!this.deck) return;

    const dealerVal = handValue(this.dealerCards);

    // Dealer stands on 17 or higher (including soft 17 in most casinos)
    if (dealerVal.soft >= 17) {
      setTimeout(() => this.settleRound(), 800);
      return;
    }

    const result = drawCard(this.deck);
    if (result) {
      this.deck = result.deck;
      this.dealerCards.push(result.card);
      this.syncDealerCards(true);
      this.syncAllPlayers();
    }

    // Continue drawing with delay
    setTimeout(() => this.dealerDrawLoop(), 800);
  }

  // ---------------------------------------------------------------------------
  // Settlement
  // ---------------------------------------------------------------------------

  private settleRound() {
    const phase: GamePhase = { type: 'SETTLEMENT' };
    this.setPhase(phase);
    this.syncAllPlayers();

    const dealerVal = handValue(this.dealerCards);
    const dealerBlackjack = dealerVal.isBlackjack;
    const dealerBust = dealerVal.isBust;
    const dealerPoints = dealerVal.soft;

    const occupied = this.getOccupiedSeats();
    const results: Array<{ seat: number; handIndex: number; payout: number; status: string }> = [];

    for (const seat of occupied) {
      const sessionId = this.seatToSession.get(seat)!;
      const internal = this.internalState.get(sessionId)!;

      for (let hi = 0; hi < internal.hands.length; hi++) {
        const hand = internal.hands[hi];
        const settled = settleHand(hand, dealerPoints, dealerBlackjack);
        internal.hands[hi] = settled;
        internal.bankroll += settled.payout;

        // Net profit: payout minus the bet that was already deducted
        const netProfit = settled.payout - hand.bet;
        results.push({
          seat,
          handIndex: hi,
          payout: netProfit,
          status: settled.status,
        });
      }

      this.syncPlayerState(sessionId);
    }

    // Build round result summary
    const resultSummary = results.map((r) => {
      const sessionId = this.seatToSession.get(r.seat)!;
      const player = this.state.players.get(sessionId);
      return {
        seat: r.seat,
        name: player?.displayName ?? 'Player',
        handIndex: r.handIndex,
        payout: r.payout,
        status: r.status,
      };
    });

    this.state.roundResult = JSON.stringify({
      dealerPoints,
      dealerBlackjack,
      dealerBust,
      results: resultSummary,
    });

    this.syncAllPlayers();

    // Broadcast result with updated bankrolls
    const bankrolls: Record<string, number> = {};
    for (const [sessionId, internal] of this.internalState) {
      bankrolls[sessionId] = internal.bankroll;
    }
    this.broadcast('round-result', {
      dealerPoints,
      dealerBlackjack,
      dealerBust,
      results: resultSummary,
      bankrolls,
    });

    // Move to round end after a short delay
    setTimeout(() => {
      const endPhase: GamePhase = { type: 'ROUND_END' };
      this.setPhase(endPhase);

      // Re-ready all players for the next round
      for (const [sessionId] of this.internalState) {
        const player = this.state.players.get(sessionId);
        if (player) {
          player.isReady = true;
        }
      }
    }, 1000);
  }

  // ---------------------------------------------------------------------------
  // Bot AI
  // ---------------------------------------------------------------------------

  private scheduleBotAction(seat: number) {
    const timerId = `bot-${seat}`;
    const existing = this.botTimers.get(timerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.botTimers.delete(timerId);
      this.executeBotAction(seat);
    }, 1500 + Math.random() * 1000);

    this.botTimers.set(timerId, timer);
  }

  private executeBotAction(seat: number) {
    if (this.gamePhase.type !== 'PLAYER_TURN') return;
    if (seat !== this.activeSeat) return;

    const sessionId = this.seatToSession.get(seat)!;
    const internal = this.internalState.get(sessionId)!;
    const hand = internal.hands[this.activeHandIndex];
    if (!hand || hand.status !== 'playing') return;

    const val = handValue(hand.cards);
    const points = val.soft;
    const dealerUpCard = this.dealerCards[0];
    const dealerUpValue = dealerUpCard ? handValue([dealerUpCard]).soft : 0;

    // Simple basic strategy
    let action: PlayerAction = 'STAND';

    if (points <= 11) {
      action = 'HIT';
    } else if (points >= 17) {
      action = 'STAND';
    } else if (points >= 13 && points <= 16) {
      // Stand if dealer shows 2-6, otherwise hit
      action = (dealerUpValue >= 2 && dealerUpValue <= 6) ? 'STAND' : 'HIT';
    } else if (points === 12) {
      action = (dealerUpValue >= 4 && dealerUpValue <= 6) ? 'STAND' : 'HIT';
    }

    this.executeAction(seat, sessionId, this.activeHandIndex, action);
  }
}
