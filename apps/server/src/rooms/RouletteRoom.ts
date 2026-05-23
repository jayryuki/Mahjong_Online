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
  private phase: string = 'BETTING';

  onCreate(options: { preset?: string; hostPlayerId: string; roomCode: string }) {
    this.setState(new RouletteGameState());
    this.state.roomId = this.roomId;
    this.state.roomCode = options.roomCode;
    this.state.hostPlayerId = options.hostPlayerId;
    this.state.status = 'in-progress';
    this.state.phase = 'BETTING';
    this.state.minBet = 1;
    this.state.maxBet = 1000;
    this.state.betTime = 30;
    this.state.maxPlayers = 8;

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
      if (this.phase !== 'BETTING') return;
      this.closeBetting();
    });

    // --- Settings ---
    this.onMessage('update-settings', (client, data: {
      minBet?: number; maxBet?: number; maxPlayers?: number; betTime?: number;
    }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost) return;
      if (this.phase !== 'BETTING') return;
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

    // --- Swap color ---
    this.onMessage('swap-color', (client, data: { targetIndex: number }) => {
      if (data.targetIndex < 0 || data.targetIndex >= CHIP_COUNT) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      for (const [, p] of this.state.players) {
        if (p.playerId !== client.sessionId && p.chipColor === data.targetIndex) return;
      }
      player.chipColor = data.targetIndex;
    });

    // --- Kick ---
    this.onMessage('kick-player', (client, data: { targetId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost) return;
      if (!data.targetId || data.targetId === client.sessionId) return;
      const target = this.clients.find(c => c.sessionId === data.targetId);
      if (target) target.leave(4001, 'Kicked by host');
    });

    // Auto-start the first betting round after a short delay
    // (gives the creator a moment to connect)
    this.phaseTimer = setTimeout(() => this.startBettingPhase(), 1500);
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
    player.isReady = true;

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

  onLeave(client: Client, consented: boolean) {
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

    // If room is empty, clean up timers but keep room alive for reconnection window
    if (this.state.players.size === 0) {
      this.clearBetTimer();
      // Don't clear phaseTimer — keep the room alive so next join resumes
    }
  }

  onDispose() {
    this.clearPhaseTimer();
    this.clearBetTimer();
  }

  // ---------------------------------------------------------------------------
  // Betting phase
  // ---------------------------------------------------------------------------

  private startBettingPhase() {
    this.clearPhaseTimer();
    this.clearBetTimer();

    this.phase = 'BETTING';
    this.state.phase = 'BETTING';
    this.state.status = 'in-progress';

    // Reset round state
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
    if (this.phase !== 'BETTING') return;

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
    if (this.phase !== 'BETTING') return;

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
    if (this.phase !== 'BETTING') return;
    this.removePlayerChips(client.sessionId);
  }

  private removePlayerChips(sessionId: string) {
    const internal = this.internalState.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (internal && player) {
      internal.totalBetThisRound = 0;
      player.totalBetThisRound = 0;
    }

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
    this.clearPhaseTimer();
    this.phase = 'SPINNING';
    this.state.phase = 'SPINNING';

    const winningNumber = this.generateWinningNumber();
    this.state.winningNumber = winningNumber;

    this.state.lastResults.push(String(winningNumber));
    while (this.state.lastResults.length > 20) {
      this.state.lastResults.shift();
    }

    this.broadcast('spin-result', { number: winningNumber });

    // After 4s (wheel animation), settle
    this.phaseTimer = setTimeout(() => this.settleRound(), 4000);
  }

  private generateWinningNumber(): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % 38;
  }

  // ---------------------------------------------------------------------------
  // Settlement
  // ---------------------------------------------------------------------------

  private settleRound() {
    this.clearPhaseTimer();
    this.phase = 'SETTLEMENT';
    this.state.phase = 'SETTLEMENT';

    const winningNumber = this.state.winningNumber;

    const chips = this.state.chips.map(c => ({
      playerId: c.playerId,
      betType: c.betType,
      amount: c.amount,
    }));

    const results = calculatePayouts(chips, winningNumber);

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

    // After 4s showing results, auto-start next round
    this.phaseTimer = setTimeout(() => {
      this.startBettingPhase();
    }, 4000);
  }
}
