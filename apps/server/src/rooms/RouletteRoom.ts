// mahjong/apps/server/src/rooms/RouletteRoom.ts

import { Room, Client } from '@colyseus/core';
import {
  RouletteGameState,
  PlayerSchema,
  ChipSchema,
  ChatMessageSchema,
} from './schema/RouletteGameState.js';
import {
  assignChipColor,
  validateBet,
  calculatePayouts,
  calculateNetProfit,
  CHIP_COUNT,
} from '@roulette/game-core';
import type { PhaseType } from '@roulette/game-core';

interface InternalPlayer {
  bankroll: number;
  totalBetThisRound: number;
}

export class RouletteRoom extends Room<RouletteGameState> {
  maxClients = 8;

  private internalState = new Map<string, InternalPlayer>();
  private sessionToSeat = new Map<string, number>();
  private seatToSession = new Map<number, string>();
  private betTimer: NodeJS.Timeout | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private currentPhase: PhaseType = 'LOBBY';

  onCreate(options: { preset?: string; hostPlayerId: string; roomCode: string }) {
    this.setState(new RouletteGameState());
    this.state.roomId = this.roomId;
    this.state.roomCode = options.roomCode;
    this.state.hostPlayerId = options.hostPlayerId;
    this.state.status = 'lobby';
    this.state.phase = 'LOBBY';
    this.state.minBet = 1;
    this.state.maxBet = 1000;
    this.state.betTime = 30;
    this.state.maxPlayers = 8;

    // --- Lobby messages ---
    this.onMessage('choose-seat', (client, data: { seatIndex: number }) => {
      this.handleChooseSeat(client, data);
    });

    this.onMessage('swap-color', (client, data: { targetIndex: number }) => {
      this.handleSwapColor(client, data);
    });

    this.onMessage('toggle-ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.isReady = !player.isReady;
    });

    this.onMessage('start-round', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost) return;
      if (this.currentPhase !== 'LOBBY' && this.currentPhase !== 'ROUND_END') return;
      this.startBettingPhase();
    });

    // --- Betting messages ---
    this.onMessage('place-bet', (client, data: { betType: string; amount: number }) => {
      this.handlePlaceBet(client, data);
    });

    this.onMessage('remove-bet', (client, data: { chipIndex: number }) => {
      this.handleRemoveBet(client, data);
    });

    this.onMessage('clear-bets', (client) => {
      this.handleClearBets(client);
    });

    this.onMessage('spin-now', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost) return;
      if (this.currentPhase !== 'BETTING') return;
      this.closeBetting();
    });

    // --- Settings ---
    this.onMessage('update-settings', (client, data: {
      minBet?: number; maxBet?: number; maxPlayers?: number; betTime?: number;
    }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost) return;
      if (this.currentPhase !== 'LOBBY') return;
      if (data.minBet !== undefined && data.minBet >= 1) this.state.minBet = data.minBet;
      if (data.maxBet !== undefined && data.maxBet <= 10000) this.state.maxBet = data.maxBet;
      if (data.maxPlayers !== undefined && data.maxPlayers >= 2 && data.maxPlayers <= 8) {
        this.state.maxPlayers = data.maxPlayers;
        this.maxClients = data.maxPlayers;
      }
      if (data.betTime !== undefined && data.betTime >= 10 && data.betTime <= 120) {
        this.state.betTime = data.betTime;
      }
    });

    // --- Chat ---
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

    // --- Kick ---
    this.onMessage('kick-player', (client, data: { targetId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost) return;
      if (!data.targetId || data.targetId === client.sessionId) return;
      const target = this.clients.find(c => c.sessionId === data.targetId);
      if (target) target.leave(4001, 'Kicked by host');
    });
  }

  // ---------------------------------------------------------------------------
  // Join / Leave
  // ---------------------------------------------------------------------------

  onJoin(client: Client, options: { displayName: string }) {
    const player = new PlayerSchema();
    player.playerId = client.sessionId;
    player.displayName = options.displayName || 'Player';
    player.isConnected = true;
    player.isHost = this.state.players.size === 0;

    // Auto-assign seat
    const occupiedSeats = new Set(this.sessionToSeat.values());
    for (let i = 0; i < this.maxClients; i++) {
      if (!occupiedSeats.has(i)) {
        player.seatIndex = i;
        this.sessionToSeat.set(client.sessionId, i);
        this.seatToSession.set(i, client.sessionId);
        break;
      }
    }

    // Assign chip color
    const takenColors = new Set<number>();
    for (const [, p] of this.state.players) {
      if (p.chipColor < CHIP_COUNT) takenColors.add(p.chipColor);
    }
    player.chipColor = assignChipColor(takenColors);

    this.state.players.set(client.sessionId, player);
    this.internalState.set(client.sessionId, {
      bankroll: 1000,
      totalBetThisRound: 0,
    });
  }

  onLeave(client: Client) {
    this.clearPhaseTimer();
    const seat = this.sessionToSeat.get(client.sessionId);
    if (seat !== undefined) this.seatToSession.delete(seat);
    this.sessionToSeat.delete(client.sessionId);
    this.internalState.delete(client.sessionId);
    this.state.players.delete(client.sessionId);

    // Transfer host
    if (client.sessionId === this.state.hostPlayerId) {
      const remaining = Array.from(this.state.players.values());
      if (remaining.length > 0) {
        this.state.hostPlayerId = remaining[0].playerId;
        remaining[0].isHost = true;
      }
    }

    // Remove this player's chips from the table
    this.removePlayerChips(client.sessionId);
  }

  onDispose() {
    this.clearPhaseTimer();
    this.clearBetTimer();
  }

  // ---------------------------------------------------------------------------
  // Lobby handlers
  // ---------------------------------------------------------------------------

  private handleChooseSeat(client: Client, data: { seatIndex: number }) {
    const idx = data.seatIndex;
    if (idx < 0 || idx >= this.maxClients) return;
    const existing = this.seatToSession.get(idx);
    if (existing && existing !== client.sessionId) return;

    const oldSeat = this.sessionToSeat.get(client.sessionId);
    if (oldSeat !== undefined) this.seatToSession.delete(oldSeat);

    this.sessionToSeat.set(client.sessionId, idx);
    this.seatToSession.set(idx, client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) player.seatIndex = idx;
  }

  private handleSwapColor(client: Client, data: { targetIndex: number }) {
    if (data.targetIndex < 0 || data.targetIndex >= CHIP_COUNT) return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Check if target color is taken by someone else
    for (const [, p] of this.state.players) {
      if (p.playerId !== client.sessionId && p.chipColor === data.targetIndex) return;
    }

    player.chipColor = data.targetIndex;
  }

  // ---------------------------------------------------------------------------
  // Betting phase
  // ---------------------------------------------------------------------------

  private startBettingPhase() {
    this.clearPhaseTimer();

    const players = Array.from(this.state.players.values());
    if (players.length < 1) return;
    const allSeated = players.every(p => this.sessionToSeat.has(p.playerId));
    if (!allSeated) return;

    // In LOBBY, require all players to be ready.
    // In ROUND_END, auto-ready everyone (they already chose to stay).
    if (this.currentPhase === 'ROUND_END') {
      for (const p of players) {
        p.isReady = true;
      }
    }

    const allReady = players.every(p => p.isReady);
    if (!allReady) return;

    this.state.status = 'in-progress';
    this.currentPhase = 'BETTING';
    this.state.phase = 'BETTING';

    // Reset round
    this.state.chips.clear();
    this.state.winningNumber = -1;
    this.state.roundResult = '';
    for (const [sessionId, internal] of this.internalState) {
      internal.totalBetThisRound = 0;
      const p = this.state.players.get(sessionId);
      if (p) p.totalBetThisRound = 0;
    }

    // Start countdown
    this.state.timerSeconds = this.state.betTime;

    this.betTimer = setInterval(() => {
      this.state.timerSeconds--;
      if (this.state.timerSeconds <= 0) {
        this.clearBetTimer();
        this.closeBetting();
      }
    }, 1000);

    this.broadcast('place-your-bets', { timerSeconds: this.state.betTime });
  }

  private handlePlaceBet(client: Client, data: { betType: string; amount: number }) {
    if (this.currentPhase !== 'BETTING') return;

    const player = this.state.players.get(client.sessionId);
    const internal = this.internalState.get(client.sessionId);
    if (!player || !internal) return;

    const amount = Math.floor(data.amount);
    if (amount < this.state.minBet || amount > this.state.maxBet) return;
    if (!validateBet(data.betType)) return;

    const availableBankroll = internal.bankroll - internal.totalBetThisRound;
    if (amount > availableBankroll) return;

    internal.totalBetThisRound += amount;
    player.totalBetThisRound = internal.totalBetThisRound;

    const chip = new ChipSchema();
    chip.playerId = client.sessionId;
    chip.chipColor = player.chipColor;
    chip.amount = amount;
    chip.betType = data.betType;
    this.state.chips.push(chip);
  }

  private handleRemoveBet(client: Client, data: { chipIndex: number }) {
    if (this.currentPhase !== 'BETTING') return;

    const chip = this.state.chips[data.chipIndex];
    if (!chip || chip.playerId !== client.sessionId) return;

    const internal = this.internalState.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (internal && player) {
      internal.totalBetThisRound -= chip.amount;
      player.totalBetThisRound = internal.totalBetThisRound;
    }

    this.state.chips.splice(data.chipIndex, 1);
  }

  private handleClearBets(client: Client) {
    if (this.currentPhase !== 'BETTING') return;
    this.removePlayerChips(client.sessionId);
  }

  private removePlayerChips(sessionId: string) {
    const internal = this.internalState.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (internal && player) {
      internal.totalBetThisRound = 0;
      player.totalBetThisRound = 0;
    }

    // Remove all chips for this player (iterate backwards since we splice)
    for (let i = this.state.chips.length - 1; i >= 0; i--) {
      if (this.state.chips[i].playerId === sessionId) {
        this.state.chips.splice(i, 1);
      }
    }
  }

  private clearBetTimer() {
    if (this.betTimer) {
      clearInterval(this.betTimer);
      this.betTimer = null;
    }
  }

  private clearPhaseTimer() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Spinning phase
  // ---------------------------------------------------------------------------

  private closeBetting() {
    this.clearBetTimer();
    this.currentPhase = 'SPINNING';
    this.state.phase = 'SPINNING';

    // Generate winning number (0-37, 37=00) using crypto
    const winningNumber = this.generateWinningNumber();
    this.state.winningNumber = winningNumber;

    // Track in last results
    this.state.lastResults.push(String(winningNumber));
    while (this.state.lastResults.length > 20) {
      this.state.lastResults.shift();
    }

    this.broadcast('spin-result', { number: winningNumber });

    // After 5 seconds (wheel animation), move to settlement
    this.phaseTimer = setTimeout(() => this.settleRound(), 5000);
  }

  private generateWinningNumber(): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % 38; // 0-37, 37 = 00
  }

  // ---------------------------------------------------------------------------
  // Settlement
  // ---------------------------------------------------------------------------

  private settleRound() {
    this.clearPhaseTimer();
    this.currentPhase = 'SETTLEMENT';
    this.state.phase = 'SETTLEMENT';

    const winningNumber = this.state.winningNumber;

    // Convert schema chips to plain objects
    const chips = this.state.chips.map(c => ({
      playerId: c.playerId,
      betType: c.betType,
      amount: c.amount,
    }));

    const results = calculatePayouts(chips, winningNumber);

    // Update bankrolls
    for (const [sessionId, internal] of this.internalState) {
      const netProfit = calculateNetProfit(results, sessionId);
      internal.bankroll += netProfit;
      internal.totalBetThisRound = 0;

      const player = this.state.players.get(sessionId);
      if (player) {
        player.bankroll = internal.bankroll;
        player.totalBetThisRound = 0;
      }
    }

    // Build result summary for client display
    const resultSummary = results.map(r => {
      const player = this.state.players.get(r.playerId);
      return {
        playerId: r.playerId,
        name: player?.displayName ?? 'Player',
        betType: r.betType,
        amount: r.amount,
        won: r.won,
        payout: r.payout,
      };
    });

    this.state.roundResult = JSON.stringify({
      winningNumber,
      results: resultSummary,
    });

    this.state.chips.clear();

    const bankrolls: Record<string, number> = {};
    for (const [sessionId, internal] of this.internalState) {
      bankrolls[sessionId] = internal.bankroll;
    }

    this.broadcast('round-result', {
      winningNumber,
      results: resultSummary,
      bankrolls,
    });

    // After 5s display, move to ROUND_END
    this.phaseTimer = setTimeout(() => {
      this.currentPhase = 'ROUND_END';
      this.state.phase = 'ROUND_END';

      // Auto-restart after 10s
      this.phaseTimer = setTimeout(() => {
        this.startBettingPhase();
      }, 10000);
    }, 5000);
  }
}
