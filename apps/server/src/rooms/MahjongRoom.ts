import { Room, Client } from '@colyseus/core';
import { GameState, PlayerSchema, SeatRoundSchema } from './schema/GameState.js';
import {
  generateFullTileSet,
  buildWall,
  drawTile as wallDrawTile,
  drawReplacementTile,
  tileSortKey,
  RIICHI_PRESET,
  canTransition,
  createReaction,
  submitResponse,
  autoPassUnresponded,
  isAllResponded,
  isValidWinningShape,
  evaluatePatterns,
  settleHand,
  isTenpai,
} from '@mahjong/game-core';
import type {
  TileDef,
  Meld,
  ReactionState,
  ReactionResponse,
  GamePhase,
  ActionType,
  HandResult,
  WallState,
} from '@mahjong/game-core';

export class MahjongRoom extends Room<GameState> {
  maxClients = 4;

  // Server-authoritative state (not projected to clients for privacy)
  private wall: WallState | null = null;
  private concealedTiles: Map<number, TileDef[]> = new Map();
  private seatMelds: Map<number, Meld[]> = new Map();
  private seatRivers: Map<number, TileDef[]> = new Map();
  private doraIndicators: TileDef[] = [];
  private activeSeat = 0;
  private dealerSeat = 0;
  private gamePhase: GamePhase = { type: 'LOBBY' };
  private roundWind: 'east' | 'south' | 'west' | 'north' = 'east';
  private handNumber = 1;
  private honba = 0;
  private riichiSticks = 0;
  private scores: number[] = [25000, 25000, 25000, 25000];
  private reactionState: ReactionState | null = null;
  private handVersions: number[] = [0, 0, 0, 0];
  private botTimers: Map<string, NodeJS.Timeout> = new Map();

  // Session <-> seat mapping
  private sessionToSeat: Map<string, number> = new Map();
  private seatToSession: Map<number, string> = new Map();

  onCreate(options: { preset: string; hostPlayerId: string; roomCode: string }) {
    this.setState(new GameState());
    this.state.roomId = this.roomId;
    this.state.roomCode = options.roomCode;
    this.state.hostPlayerId = options.hostPlayerId;
    this.state.status = 'lobby';
    this.state.phase = 'LOBBY';

    // --- Lobby messages ---
    this.onMessage('choose-seat', (client, data: { seatIndex: number }) => {
      this.handleChooseSeat(client, data);
    });

    this.onMessage('toggle-ready', (client) => {
      this.handleToggleReady(client);
    });

    this.onMessage('start-match', (_client) => {
      this.startMatch();
    });

    // --- Gameplay messages ---
    this.onMessage('draw-tile', (client) => {
      this.handleDrawTile(client);
    });

    this.onMessage('discard-tile', (client, data: { tileId: string }) => {
      this.handleDiscardTile(client, data);
    });

    this.onMessage('pass-reaction', (client) => {
      this.handlePassReaction(client);
    });

    this.onMessage('call-pon', (client) => {
      this.handleCallPon(client);
    });

    this.onMessage('call-chi', (client, data: { tiles: [number, number] }) => {
      this.handleCallChi(client, data);
    });

    this.onMessage('declare-win-ron', (client) => {
      this.handleDeclareWinRon(client);
    });

    this.onMessage('declare-win-tsumo', (client) => {
      this.handleDeclareWinTsumo(client);
    });

    this.onMessage('request-hand', (client) => {
      this.handleRequestHand(client);
    });

    this.onMessage('declare-riichi', (client) => {
      this.handleDeclareRiichi(client);
    });

    this.onMessage('next-hand', () => {
      this.handleNextHand();
    });
  }

  onJoin(client: Client, options: { displayName: string }) {
    const player = new PlayerSchema();
    player.playerId = client.sessionId;
    player.displayName = options.displayName || 'Player';
    player.isConnected = true;
    // First player to join is the host
    player.isHost = this.state.players.size === 0;

    // Auto-assign the next available seat
    const occupiedSeats = new Set(Array.from(this.sessionToSeat.values()));
    for (let i = 0; i < 4; i++) {
      if (!occupiedSeats.has(i)) {
        player.seatIndex = i;
        this.sessionToSeat.set(client.sessionId, i);
        this.seatToSession.set(i, client.sessionId);
        break;
      }
    }

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, _consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isConnected = false;
    }
    // Clean up seat mapping
    const seat = this.sessionToSeat.get(client.sessionId);
    if (seat !== undefined) {
      this.seatToSession.delete(seat);
    }
    this.sessionToSeat.delete(client.sessionId);
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

  private handleRequestHand(client: Client) {
    const seat = this.sessionToSeat.get(client.sessionId);
    if (seat === undefined) return;
    if (this.gamePhase.type === 'LOBBY' || this.gamePhase.type === 'DEALING') return;

    const concealed = this.concealedTiles.get(seat) ?? [];
    const melds = this.seatMelds.get(seat) ?? [];

    client.send('hand-state', {
      tiles: concealed.map((t) => t.id),
      melds: melds.map((m) => ({
        type: m.type,
        tileIds: m.tiles.map((t) => t.id),
        isConcealed: m.isConcealed,
      })),
      handVersion: this.handVersions[seat],
    });
  }

  private incrementHandVersion(seat: number) {
    this.handVersions[seat]++;
    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.handVersion = this.handVersions[seat];
  }

  private isBot(seat: number): boolean {
    const sessionId = this.seatToSession.get(seat);
    return sessionId !== undefined && sessionId.startsWith('bot-');
  }

  private setPhase(phase: GamePhase) {
    this.gamePhase = phase;
    this.state.phase = phase.type;

    switch (phase.type) {
      case 'TURN_DRAW':
        this.state.activeSeat = phase.activeSeat;
        this.state.wallRemaining = phase.wallRemaining;
        this.state.legalActions = '';
        break;
      case 'TURN_DECISION':
        this.state.activeSeat = phase.activeSeat;
        this.state.legalActions = phase.legalActions.join(',');
        break;
      case 'REACTION_WINDOW':
        this.state.lastDiscardSeat = phase.discardSeat;
        this.state.lastDiscardTileId = phase.discardTile.id;
        this.state.reactionEligibleSeats = phase.pendingSeats.join(',');
        this.state.legalActions = '';
        break;
      case 'RESOLUTION':
        if (phase.winner !== undefined) {
          this.state.lastDiscardSeat = phase.winner;
        }
        break;
      case 'HAND_END':
        this.state.legalActions = '';
        break;
    }
  }

  private updateSeatSchemas() {
    for (let i = 0; i < 4; i++) {
      let seatSchema = this.state.seats.get(String(i));
      if (!seatSchema) {
        seatSchema = new SeatRoundSchema();
        seatSchema.seatIndex = i;
        this.state.seats.set(String(i), seatSchema);
      }
      seatSchema.concealedCount = this.concealedTiles.get(i)?.length ?? 0;
      seatSchema.meldCount = this.seatMelds.get(i)?.length ?? 0;
      seatSchema.meldTypes = (this.seatMelds.get(i) ?? []).map((m) => m.type).join(',');
      seatSchema.riverTileIds = (this.seatRivers.get(i) ?? []).map((t) => t.id).join(',');
      seatSchema.score = this.scores[i];
      seatSchema.handVersion = this.handVersions[i];
    }
  }

  private syncSchemaFromInternal() {
    this.state.activeSeat = this.activeSeat;
    this.state.wallRemaining = this.wall?.remaining ?? 0;
    this.state.dealerSeat = this.dealerSeat;
    this.state.handNumber = this.handNumber;
    this.state.roundWind = this.roundWind;
    this.state.honba = this.honba;
    this.state.riichiSticks = this.riichiSticks;
    this.state.doraIndicators = this.doraIndicators.map((t) => t.id).join(',');
    this.updateSeatSchemas();
  }

  private static readonly SEAT_WINDS: ('east' | 'south' | 'west' | 'north')[] = [
    'east',
    'south',
    'west',
    'north',
  ];

  // ---------------------------------------------------------------------------
  // Lobby handlers
  // ---------------------------------------------------------------------------

  private handleChooseSeat(client: Client, data: { seatIndex: number }) {
    const seatIndex = data.seatIndex;
    if (seatIndex < 0 || seatIndex >= 4) return;

    // Check if seat is already taken by another player
    const existingSession = this.seatToSession.get(seatIndex);
    if (existingSession && existingSession !== client.sessionId) return;

    // Remove from old seat if switching
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
  // Match start
  // ---------------------------------------------------------------------------

  private startMatch() {
    // Validate: need at least 1 player, all seated and ready
    const players = Array.from(this.state.players.values());
    if (players.length < 1) return;

    const allSeated = players.every((p) => this.sessionToSeat.has(p.playerId));
    if (!allSeated) return;

    const allReady = players.every((p) => p.isReady);
    if (!allReady) return;

    // Fill empty seats with bot placeholders
    const occupiedSeats = new Set(players.map((p) => this.sessionToSeat.get(p.playerId)!));
    for (let i = 0; i < 4; i++) {
      if (!occupiedSeats.has(i)) {
        const botId = `bot-${i}`;
        const player = new PlayerSchema();
        player.playerId = botId;
        player.displayName = `Bot ${i + 1}`;
        player.isConnected = true;
        player.isReady = true;
        player.isHost = false;
        player.seatIndex = i;
        this.state.players.set(botId, player);
        this.sessionToSeat.set(botId, i);
        this.seatToSession.set(i, botId);
      }
    }

    this.state.status = 'in-progress';

    // Initialize match state
    this.scores = [25000, 25000, 25000, 25000];
    this.dealerSeat = 0;
    this.roundWind = 'east';
    this.handNumber = 1;
    this.honba = 0;
    this.riichiSticks = 0;

    this.dealHand();
  }

  private dealHand() {
    // Generate and shuffle the wall
    const tileSet = generateFullTileSet(4, false);
    const seed = `${this.roomId}-${this.handNumber}-${Date.now()}`;
    this.wall = buildWall(tileSet, seed);

    // Dora indicator: first tile of the dead wall
    this.doraIndicators = [this.wall.tiles[this.wall.deadWallStart]];

    // Initialize per-seat state
    this.concealedTiles.clear();
    this.seatMelds.clear();
    this.seatRivers.clear();
    this.reactionState = null;
    this.handVersions = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
      this.concealedTiles.set(i, []);
      this.seatMelds.set(i, []);
      this.seatRivers.set(i, []);
    }

    // Deal 13 tiles to each seat
    for (let round = 0; round < 13; round++) {
      for (let seat = 0; seat < 4; seat++) {
        const result = wallDrawTile(this.wall);
        if (result.tile) {
          this.wall = result.wall;
          this.concealedTiles.get(seat)!.push(result.tile);
        }
      }
    }

    // Sort each player's hand
    for (let i = 0; i < 4; i++) {
      this.concealedTiles
        .get(i)!
        .sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));
    }

    // Active seat = dealer
    this.activeSeat = this.dealerSeat;

    // Transition: LOBBY -> DEALING -> TURN_DRAW
    this.setPhase({ type: 'DEALING', progress: 100 });
    this.syncSchemaFromInternal();

    // Send each player their concealed tiles privately
    for (let i = 0; i < 4; i++) {
      this.incrementHandVersion(i);
      const client = this.getClientForSeat(i);
      if (client) {
        client.send('deal', {
          tiles: this.concealedTiles.get(i)!.map((t) => t.id),
          handVersion: this.handVersions[i],
        });
      }
    }

    // Transition to TURN_DRAW for dealer
    const targetPhase: GamePhase = {
      type: 'TURN_DRAW',
      activeSeat: this.activeSeat,
      wallRemaining: this.wall.remaining,
    };
    if (canTransition(this.gamePhase, targetPhase)) {
      this.setPhase(targetPhase);
      this.syncSchemaFromInternal();

      const activeClient = this.getClientForSeat(this.activeSeat);
      if (activeClient) {
        activeClient.send('your-turn-draw', { seat: this.activeSeat });
      }

      if (this.isBot(this.activeSeat)) {
        this.scheduleBotAction(this.activeSeat);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  private handleDrawTile(client: Client) {
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;
    if (this.gamePhase.type !== 'TURN_DRAW') return;
    if (!this.wall) return;

    // Draw from wall
    const result = wallDrawTile(this.wall);
    if (!result.tile) {
      // Wall exhausted — exhaustive draw
      this.handleExhaustiveDraw();
      return;
    }

    this.wall = result.wall;
    const tile = result.tile;

    // Add to concealed
    this.concealedTiles.get(seat)!.push(tile);
    this.incrementHandVersion(seat);

    // Calculate legal actions for this seat
    const actions: ActionType[] = ['DISCARD_TILE'];

    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    if (this.seatIsRiichi(seat)) {
      // Riichi player: only discard and tsumo
      if (isValidWinningShape([...concealed], melds.length)) {
        actions.push('DECLARE_WIN_TSUMO');
      }
    } else {
      if (isValidWinningShape([...concealed], melds.length)) {
        actions.push('DECLARE_WIN_TSUMO');
      }
      if (this.canDeclareRiichi(seat)) {
        actions.push('DECLARE_RIICHI');
      }
    }

    // Transition to TURN_DECISION
    const targetPhase: GamePhase = {
      type: 'TURN_DECISION',
      activeSeat: seat,
      legalActions: actions,
    };
    if (canTransition(this.gamePhase, targetPhase)) {
      this.setPhase(targetPhase);
      this.syncSchemaFromInternal();

      // Send drawn tile to player privately
      client.send('tile-drawn', { tileId: tile.id, handVersion: this.handVersions[seat] });

      // Send legal actions
      client.send('legal-actions', { actions });
    }
  }

  // ---------------------------------------------------------------------------
  // Discard
  // ---------------------------------------------------------------------------

  private handleDiscardTile(client: Client, data: { tileId: string }) {
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;
    if (this.gamePhase.type !== 'TURN_DECISION') return;

    const concealed = this.concealedTiles.get(seat)!;
    const tileIndex = concealed.findIndex((t) => t.id === data.tileId);
    if (tileIndex === -1) return;

    const [discardedTile] = concealed.splice(tileIndex, 1);
    this.incrementHandVersion(seat);
    this.seatRivers.get(seat)!.push(discardedTile);

    if (this.seatIsRiichi(seat)) {
      const seatSchema = this.state.seats.get(String(seat));
      if (seatSchema) seatSchema.isRiichi = true;
    }

    this.checkAndOpenReactionWindow(seat, discardedTile);
  }

  // ---------------------------------------------------------------------------
  // Shared reaction window (used by both human and bot discards)
  // ---------------------------------------------------------------------------

  private checkAndOpenReactionWindow(discardSeat: number, discardedTile: TileDef) {
    const eligibleSeats: number[] = [];

    for (let i = 0; i < 4; i++) {
      if (i === discardSeat) continue;
      if (this.seatIsRiichi(i)) {
        const testConcealed = [...(this.concealedTiles.get(i) ?? []), discardedTile];
        if (isValidWinningShape(testConcealed, this.seatMelds.get(i)!.length)) {
          eligibleSeats.push(i);
        }
        continue;
      }

      const otherConcealed = this.concealedTiles.get(i)!;
      const otherMelds = this.seatMelds.get(i)!;

      const testConcealed = [...otherConcealed, discardedTile];
      if (isValidWinningShape(testConcealed, otherMelds.length)) {
        eligibleSeats.push(i);
        continue;
      }

      const matchingCount = otherConcealed.filter(
        (t) => tileSortKey(t) === tileSortKey(discardedTile),
      ).length;
      if (matchingCount >= 2 && RIICHI_PRESET.allowPon && RIICHI_PRESET.allowOpenHand) {
        eligibleSeats.push(i);
        continue;
      }

      if (
        i === (discardSeat + 1) % 4 &&
        RIICHI_PRESET.allowChi &&
        RIICHI_PRESET.allowOpenHand &&
        discardedTile.suit
      ) {
        const sameSuit = otherConcealed.filter((t) => t.suit === discardedTile.suit);
        if (sameSuit.length >= 2) {
          eligibleSeats.push(i);
        }
      }
    }

    if (eligibleSeats.length > 0) {
      this.reactionState = createReaction(
        `reaction-${Date.now()}`,
        discardSeat,
        discardedTile,
        eligibleSeats,
        RIICHI_PRESET.reactionTimerSeconds * 1000,
      );

      const targetPhase: GamePhase = {
        type: 'REACTION_WINDOW',
        discardSeat,
        discardTile: discardedTile,
        pendingSeats: eligibleSeats,
      };

      if (canTransition(this.gamePhase, targetPhase)) {
        this.setPhase(targetPhase);
        this.syncSchemaFromInternal();

        for (const eligibleSeat of eligibleSeats) {
          if (this.isBot(eligibleSeat)) continue;

          const eligibleClient = this.getClientForSeat(eligibleSeat);
          if (eligibleClient) {
            const seatActions: string[] = ['PASS_REACTION'];
            const testConcealed = [
              ...(this.concealedTiles.get(eligibleSeat) ?? []),
              discardedTile,
            ];
            if (isValidWinningShape(testConcealed, this.seatMelds.get(eligibleSeat)!.length)) {
              seatActions.push('DECLARE_WIN_RON');
            }
            const matchCount2 = this.concealedTiles
              .get(eligibleSeat)!
              .filter((t) => tileSortKey(t) === tileSortKey(discardedTile)).length;
            if (matchCount2 >= 2) seatActions.push('CALL_PON');
            if (eligibleSeat === (discardSeat + 1) % 4 && discardedTile.suit) {
              seatActions.push('CALL_CHI');
            }
            eligibleClient.send('reaction-options', {
              discardSeat,
              discardTileId: discardedTile.id,
              actions: seatActions,
            });
          }
        }

        // Schedule bot reactions
        for (const eligibleSeat of eligibleSeats) {
          if (this.isBot(eligibleSeat)) {
            const delay = 300 + Math.random() * 500;
            const timer = setTimeout(() => {
              this.executeBotReaction(eligibleSeat);
            }, delay);
            this.botTimers.set(`reaction-${eligibleSeat}`, timer);
          }
        }
      }
    } else {
      this.advanceToNextPlayer(discardSeat);
    }
  }

  // ---------------------------------------------------------------------------
  // Bot AI
  // ---------------------------------------------------------------------------

  private scheduleBotAction(seat: number) {
    if (!this.isBot(seat)) return;

    const timerId = `bot-${seat}`;
    const existing = this.botTimers.get(timerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.botTimers.delete(timerId);
      this.executeBotAction(seat);
    }, 500 + Math.random() * 300);

    this.botTimers.set(timerId, timer);
  }

  private executeBotAction(seat: number) {
    if (!this.isBot(seat)) return;

    switch (this.gamePhase.type) {
      case 'TURN_DRAW':
        if (seat === this.activeSeat) {
          this.executeBotDraw(seat);
        }
        break;
      case 'TURN_DECISION':
        if (seat === this.activeSeat) {
          this.executeBotDecision(seat);
        }
        break;
      case 'REACTION_WINDOW':
        this.executeBotReaction(seat);
        break;
    }
  }

  private executeBotDraw(seat: number) {
    if (!this.wall) return;

    const result = wallDrawTile(this.wall);
    if (!result.tile) {
      this.handleExhaustiveDraw();
      return;
    }

    this.wall = result.wall;
    const tile = result.tile;
    this.concealedTiles.get(seat)!.push(tile);
    this.incrementHandVersion(seat);

    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    const actions: ActionType[] = ['DISCARD_TILE'];
    if (isValidWinningShape([...concealed], melds.length)) {
      actions.push('DECLARE_WIN_TSUMO');
    }

    if (this.canDeclareRiichi(seat)) {
      actions.push('DECLARE_RIICHI');
    }

    this.setPhase({
      type: 'TURN_DECISION',
      activeSeat: seat,
      legalActions: actions,
    });
    this.syncSchemaFromInternal();

    // Bot always declares tsumo if possible
    if (actions.includes('DECLARE_WIN_TSUMO')) {
      setTimeout(() => {
        this.handleBotTsumo(seat);
      }, 300);
      return;
    }

    this.scheduleBotAction(seat);
  }

  private executeBotDecision(seat: number) {
    const concealed = this.concealedTiles.get(seat)!;

    // Check if bot should declare riichi
    const currentPhase = this.gamePhase;
    if (
      currentPhase.type === 'TURN_DECISION' &&
      currentPhase.legalActions.includes('DECLARE_RIICHI') &&
      !this.seatIsRiichi(seat)
    ) {
      this.applyRiichiDeclaration(seat);
    }

    const discardIndex = this.chooseBotDiscard(seat);
    const discardedTile = concealed[discardIndex];
    if (!discardedTile) return;

    concealed.splice(discardIndex, 1);
    this.incrementHandVersion(seat);
    this.seatRivers.get(seat)!.push(discardedTile);

    if (this.seatIsRiichi(seat)) {
      const seatSchema = this.state.seats.get(String(seat));
      if (seatSchema) seatSchema.isRiichi = true;
    }

    this.checkAndOpenReactionWindow(seat, discardedTile);
  }

  private chooseBotDiscard(seat: number): number {
    const concealed = this.concealedTiles.get(seat)!;
    if (concealed.length === 0) return 0;

    const scores = concealed.map((tile, idx) => {
      let score = 0;

      const sameCount = concealed.filter(t => tileSortKey(t) === tileSortKey(tile)).length;
      if (sameCount >= 2) score += 10;
      if (sameCount >= 3) score += 10;

      if (tile.suit && tile.rank) {
        const hasAdjacent = concealed.some(t =>
          t.suit === tile.suit &&
          t.rank !== undefined &&
          Math.abs(t.rank - tile.rank!) === 1
        );
        if (hasAdjacent) score += 5;

        const hasNearby = concealed.some(t =>
          t.suit === tile.suit &&
          t.rank !== undefined &&
          Math.abs(t.rank - tile.rank!) === 2
        );
        if (hasNearby) score += 2;

        if (tile.rank >= 3 && tile.rank <= 7) score += 1;
      } else {
        if (sameCount === 1) score -= 2;
      }

      return score;
    });

    let minScore = Infinity;
    let minIdx = 0;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] < minScore) {
        minScore = scores[i];
        minIdx = i;
      }
    }
    return minIdx;
  }

  private handleBotTsumo(seat: number) {
    if (this.gamePhase.type !== 'TURN_DECISION') return;

    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    if (!isValidWinningShape([...concealed], melds.length)) return;

    const seatWind = MahjongRoom.SEAT_WINDS[seat];
    const patterns = evaluatePatterns(concealed, melds, 'tsumo', seatWind, this.roundWind);
    if (patterns.length === 0) return;

    const isDealer = seat === this.dealerSeat;
    const result = settleHand(seat, 'tsumo', undefined, patterns, 30, 4, isDealer);
    this.applyWinResult(seat, 'tsumo', result);
  }

  private executeBotReaction(seat: number) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    if (!this.reactionState.eligibleSeats.includes(seat)) return;
    if (this.reactionState.responses[seat] !== null) return;

    const discardedTile = this.reactionState.discardTile;
    const otherConcealed = this.concealedTiles.get(seat)!;
    const otherMelds = this.seatMelds.get(seat)!;

    // Always declare ron if possible
    const testConcealed = [...otherConcealed, discardedTile];
    if (isValidWinningShape(testConcealed, otherMelds.length)) {
      const seatWind = MahjongRoom.SEAT_WINDS[seat];
      const patterns = evaluatePatterns(testConcealed, otherMelds, 'ron', seatWind, this.roundWind);
      if (patterns.length > 0) {
        this.reactionState = submitResponse(this.reactionState, seat, { type: 'ron' });
        this.resolveReaction();
        return;
      }
    }

    // 30% chance to call pon
    const matchCount = otherConcealed.filter(
      (t) => tileSortKey(t) === tileSortKey(discardedTile),
    ).length;
    if (matchCount >= 2 && Math.random() < 0.3 && !this.seatIsRiichi(seat)) {
      this.reactionState = submitResponse(this.reactionState, seat, { type: 'pon' });
      this.checkReactionResolution();
      return;
    }

    // Pass
    this.reactionState = submitResponse(this.reactionState, seat, { type: 'pass' });
    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.hasPassedReaction = true;
    this.checkReactionResolution();
  }

  // ---------------------------------------------------------------------------
  // Riichi helpers
  // ---------------------------------------------------------------------------

  private seatIsRiichi(seat: number): boolean {
    return this.state.seats.get(String(seat))?.isRiichi ?? false;
  }

  private canDeclareRiichi(seat: number): boolean {
    if (this.seatIsRiichi(seat)) return false;
    if (this.seatMelds.get(seat)!.some(m => !m.isConcealed)) return false;

    const concealed = this.concealedTiles.get(seat)!;
    const meldCount = this.seatMelds.get(seat)!.length;

    for (let i = 0; i < concealed.length; i++) {
      const remaining = concealed.filter((_, idx) => idx !== i);
      if (isTenpai(remaining, meldCount)) {
        return true;
      }
    }
    return false;
  }

  private applyRiichiDeclaration(seat: number) {
    this.scores[seat] -= 1000;
    this.riichiSticks++;

    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.isRiichi = true;

    this.syncSchemaFromInternal();
  }

  private handleDeclareRiichi(client: Client) {
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;
    if (this.gamePhase.type !== 'TURN_DECISION') return;
    if (!this.canDeclareRiichi(seat)) return;

    this.applyRiichiDeclaration(seat);

    this.setPhase({
      type: 'TURN_DECISION',
      activeSeat: seat,
      legalActions: ['DISCARD_TILE'],
    });
    this.syncSchemaFromInternal();

    client.send('legal-actions', { actions: ['DISCARD_TILE'] });
    client.send('riichi-confirmed', { seat });
    this.broadcast('riichi-declared', { seat });
  }

  // ---------------------------------------------------------------------------
  // Reaction handlers
  // ---------------------------------------------------------------------------

  private handlePassReaction(client: Client) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    this.reactionState = submitResponse(this.reactionState, seat, { type: 'pass' });

    // Mark on schema
    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.hasPassedReaction = true;

    this.checkReactionResolution();
  }

  private handleCallPon(client: Client) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    this.reactionState = submitResponse(this.reactionState, seat, { type: 'pon' });
    this.checkReactionResolution();
  }

  private handleCallChi(client: Client, data: { tiles: [number, number] }) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    this.reactionState = submitResponse(this.reactionState, seat, {
      type: 'chi',
      tiles: data.tiles,
    });
    this.checkReactionResolution();
  }

  private handleDeclareWinRon(client: Client) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    this.reactionState = submitResponse(this.reactionState, seat, { type: 'ron' });

    // Ron has highest priority — resolve immediately
    this.resolveReaction();
  }

  private checkReactionResolution() {
    if (!this.reactionState) return;

    if (isAllResponded(this.reactionState)) {
      this.reactionState = autoPassUnresponded(this.reactionState);
      this.resolveReaction();
    }
  }

  private resolveReaction() {
    if (!this.reactionState) return;

    const reaction = this.reactionState;
    this.reactionState = null;

    // Reset hasPassedReaction flags on schema
    for (let i = 0; i < 4; i++) {
      const seatSchema = this.state.seats.get(String(i));
      if (seatSchema) seatSchema.hasPassedReaction = false;
    }

    // Resolve by priority: ron > kan-open > pon > chi
    const priority = RIICHI_PRESET.reactionPriority;
    let winningResponse: { seat: number; response: ReactionResponse } | null = null;

    for (const pType of priority) {
      for (const seat of reaction.eligibleSeats) {
        const resp = reaction.responses[seat];
        if (resp && resp.type === pType) {
          winningResponse = { seat, response: resp };
          break;
        }
      }
      if (winningResponse) break;
    }

    if (!winningResponse) {
      // All passed — advance to next player
      this.advanceToNextPlayer(reaction.discardSeat);
      return;
    }

    const { seat: winnerSeat, response } = winningResponse;

    switch (response.type) {
      case 'ron':
        this.handleRonWin(winnerSeat, reaction.discardSeat, reaction.discardTile);
        break;
      case 'pon':
        this.applyPon(winnerSeat, reaction.discardSeat, reaction.discardTile);
        break;
      case 'chi':
        this.applyChi(winnerSeat, reaction.discardSeat, reaction.discardTile, response.tiles);
        break;
      case 'kan-open':
        // Simplified: treat like pon for Phase 1
        this.applyPon(winnerSeat, reaction.discardSeat, reaction.discardTile);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Win resolution
  // ---------------------------------------------------------------------------

  private handleRonWin(winnerSeat: number, discardSeat: number, discardTile: TileDef) {
    const concealed = [...this.concealedTiles.get(winnerSeat)!, discardTile];
    const melds = this.seatMelds.get(winnerSeat)!;

    if (!isValidWinningShape(concealed, melds.length)) return;

    const seatWind = MahjongRoom.SEAT_WINDS[winnerSeat];
    const patterns = evaluatePatterns(concealed, melds, 'ron', seatWind, this.roundWind);

    if (patterns.length === 0) return; // No yaku = invalid win declaration

    const isDealer = winnerSeat === this.dealerSeat;
    const result = settleHand(winnerSeat, 'ron', discardSeat, patterns, 30, 4, isDealer);

    this.applyWinResult(winnerSeat, 'ron', result);
  }

  private handleDeclareWinTsumo(client: Client) {
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;
    if (this.gamePhase.type !== 'TURN_DECISION') return;

    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    if (!isValidWinningShape([...concealed], melds.length)) return;

    const seatWind = MahjongRoom.SEAT_WINDS[seat];
    const patterns = evaluatePatterns(concealed, melds, 'tsumo', seatWind, this.roundWind);

    if (patterns.length === 0) return; // No yaku

    const isDealer = seat === this.dealerSeat;
    const result = settleHand(seat, 'tsumo', undefined, patterns, 30, 4, isDealer);

    this.applyWinResult(seat, 'tsumo', result);
  }

  private applyWinResult(winnerSeat: number, winType: 'ron' | 'tsumo', result: HandResult) {
    // Apply score transfers
    for (const transfer of result.settlement) {
      this.scores[transfer.from] -= transfer.amount;
      this.scores[transfer.to] += transfer.amount;
    }

    // RESOLUTION -> HAND_END
    const resolutionPhase: GamePhase = {
      type: 'RESOLUTION',
      winner: winnerSeat,
      winType,
    };
    if (canTransition(this.gamePhase, resolutionPhase)) {
      this.setPhase(resolutionPhase);
    }

    const handEndPhase: GamePhase = {
      type: 'HAND_END',
      endReason: 'win',
      result,
    };
    if (canTransition(this.gamePhase, handEndPhase)) {
      this.setPhase(handEndPhase);
      this.state.winInfo = JSON.stringify({
        winner: winnerSeat,
        winType,
        han: result.han,
        fu: result.fu,
        total: result.score.total,
        patterns: result.patterns.map((p) => ({ id: p.id, name: p.name, hanValue: p.hanValue })),
        settlement: result.settlement,
      });
      this.syncSchemaFromInternal();

      // Broadcast win result to all clients
      this.broadcast('hand-result', {
        winner: winnerSeat,
        winType,
        han: result.han,
        fu: result.fu,
        total: result.score.total,
        patterns: result.patterns.map((p) => ({ id: p.id, name: p.name, hanValue: p.hanValue })),
        settlement: result.settlement,
      });
    }
  }

  private handleExhaustiveDraw() {
    const handEndPhase: GamePhase = {
      type: 'HAND_END',
      endReason: 'exhaustive-draw',
      result: null,
    };
    if (canTransition(this.gamePhase, handEndPhase)) {
      this.setPhase(handEndPhase);
      this.syncSchemaFromInternal();

      this.broadcast('hand-result', { endReason: 'exhaustive-draw' });
    }

    this.honba++;
  }

  private handleNextHand() {
    if (this.gamePhase.type !== 'HAND_END') return;

    // For now: end after East round (4 hands with rotating dealer)
    // If dealer has rotated all the way back, match ends
    const winInfo = this.state.winInfo ? JSON.parse(this.state.winInfo) : null;
    const dealerWon = winInfo && winInfo.winner === this.dealerSeat;
    const wasExhaustiveDraw = !winInfo;

    let nextDealerSeat = this.dealerSeat;
    let nextHonba = this.honba;

    if (dealerWon) {
      // Dealer stays
      nextHonba = this.honba;
    } else if (wasExhaustiveDraw) {
      // Exhaustive draw — dealer stays, honba already incremented
      nextHonba = this.honba;
    } else {
      // Non-dealer wins — dealer rotates
      nextDealerSeat = (this.dealerSeat + 1) % 4;
      nextHonba = 0;

      // If dealer would rotate back to seat 0, match ends (East Round complete)
      if (nextDealerSeat === 0) {
        const matchEndPhase: GamePhase = {
          type: 'MATCH_END',
          finalScores: this.scores.map((score, i) => ({
            seatIndex: i,
            points: score,
            riichiDeposit: false,
          })),
        };
        if (canTransition(this.gamePhase, matchEndPhase)) {
          this.setPhase(matchEndPhase);
          this.state.status = 'finished';
          this.syncSchemaFromInternal();
          this.broadcast('match-end', {
            finalScores: this.scores.map((score, i) => ({ seatIndex: i, points: score })),
          });
        }
        return;
      }
    }

    this.dealerSeat = nextDealerSeat;
    this.handNumber++;
    this.honba = nextHonba;

    const roundEndPhase: GamePhase = {
      type: 'ROUND_END',
      summary: {
        roundWind: this.roundWind,
        handNumber: this.handNumber,
        honba: this.honba,
        riichiSticks: this.riichiSticks,
        result: null,
        endReason: 'win' as const,
        scoreChanges: [],
      },
    };

    if (canTransition(this.gamePhase, roundEndPhase)) {
      this.setPhase(roundEndPhase);
      this.dealHand();
    }
  }

  // ---------------------------------------------------------------------------
  // Meld application
  // ---------------------------------------------------------------------------

  private applyPon(callerSeat: number, discardSeat: number, discardTile: TileDef) {
    const concealed = this.concealedTiles.get(callerSeat)!;

    // Find 2 matching tiles in concealed
    const matching: TileDef[] = [];
    const remaining: TileDef[] = [];
    let found = 0;

    for (const tile of concealed) {
      if (found < 2 && tileSortKey(tile) === tileSortKey(discardTile)) {
        matching.push(tile);
        found++;
      } else {
        remaining.push(tile);
      }
    }

    if (found < 2) return; // Safety check

    this.concealedTiles.set(callerSeat, remaining);

    const meld: Meld = {
      type: 'pon',
      tiles: [...matching, discardTile],
      calledFromSeat: discardSeat,
      isConcealed: false,
    };
    this.seatMelds.get(callerSeat)!.push(meld);
    this.incrementHandVersion(callerSeat);

    // Remove the called tile from the discarder's river
    const river = this.seatRivers.get(discardSeat)!;
    if (river.length > 0) {
      river.pop();
    }

    // Transition: caller must discard
    this.activeSeat = callerSeat;
    this.setPhase({
      type: 'TURN_DECISION',
      activeSeat: callerSeat,
      legalActions: ['DISCARD_TILE'],
    });
    this.syncSchemaFromInternal();

    const callerClient = this.getClientForSeat(callerSeat);
    if (callerClient) {
      callerClient.send('legal-actions', { actions: ['DISCARD_TILE'] });
      callerClient.send('meld-applied', {
        meld: { type: meld.type, tileIds: meld.tiles.map((t) => t.id) },
        handVersion: this.handVersions[callerSeat],
      });
    }

    if (this.isBot(callerSeat)) {
      this.scheduleBotAction(callerSeat);
    }
  }

  private applyChi(
    callerSeat: number,
    discardSeat: number,
    discardTile: TileDef,
    tileIndices: [number, number],
  ) {
    const concealed = this.concealedTiles.get(callerSeat)!;

    const tile1 = concealed[tileIndices[0]];
    const tile2 = concealed[tileIndices[1]];
    if (!tile1 || !tile2) return;

    const remaining = concealed.filter(
      (_, i) => i !== tileIndices[0] && i !== tileIndices[1],
    );
    this.concealedTiles.set(callerSeat, remaining);

    const meld: Meld = {
      type: 'chi',
      tiles: [tile1, tile2, discardTile].sort((a, b) =>
        tileSortKey(a).localeCompare(tileSortKey(b)),
      ),
      calledFromSeat: discardSeat,
      isConcealed: false,
    };
    this.seatMelds.get(callerSeat)!.push(meld);
    this.incrementHandVersion(callerSeat);

    // Remove from discarder's river
    const river = this.seatRivers.get(discardSeat)!;
    if (river.length > 0) {
      river.pop();
    }

    this.activeSeat = callerSeat;
    this.setPhase({
      type: 'TURN_DECISION',
      activeSeat: callerSeat,
      legalActions: ['DISCARD_TILE'],
    });
    this.syncSchemaFromInternal();

    const callerClient = this.getClientForSeat(callerSeat);
    if (callerClient) {
      callerClient.send('legal-actions', { actions: ['DISCARD_TILE'] });
      callerClient.send('meld-applied', {
        meld: { type: meld.type, tileIds: meld.tiles.map((t) => t.id) },
        handVersion: this.handVersions[callerSeat],
      });
    }

    if (this.isBot(callerSeat)) {
      this.scheduleBotAction(callerSeat);
    }
  }

  // ---------------------------------------------------------------------------
  // Turn advancement
  // ---------------------------------------------------------------------------

  private advanceToNextPlayer(fromSeat: number) {
    const nextSeat = (fromSeat + 1) % 4;
    this.activeSeat = nextSeat;

    // Check if wall is exhausted
    if (this.wall && this.wall.remaining <= 0) {
      this.handleExhaustiveDraw();
      return;
    }

    const targetPhase: GamePhase = {
      type: 'TURN_DRAW',
      activeSeat: nextSeat,
      wallRemaining: this.wall?.remaining ?? 0,
    };
    if (canTransition(this.gamePhase, targetPhase)) {
      this.setPhase(targetPhase);
      this.syncSchemaFromInternal();

      const nextClient = this.getClientForSeat(nextSeat);
      if (nextClient) {
        nextClient.send('your-turn-draw', { seat: nextSeat });
      }

      if (this.isBot(nextSeat)) {
        this.scheduleBotAction(nextSeat);
      }
    }
  }
}
