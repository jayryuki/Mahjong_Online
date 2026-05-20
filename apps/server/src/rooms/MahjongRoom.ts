import { Room, Client } from '@colyseus/core';
import { GameState, PlayerSchema, SeatRoundSchema, ChatMessageSchema } from './schema/GameState.js';
import {
  generateFullTileSet,
  buildWall,
  drawTile as wallDrawTile,
  drawReplacementTile,
  tileSortKey,
  HONG_KONG_PRESET,
  canTransition,
  createReaction,
  submitResponse,
  autoPassUnresponded,
  isAllResponded,
  isValidWinningShape,
  decomposeWinningHand,
  evaluateHKPatterns,
  calculateHKScore,
  settleHand,
  isTenpai,
  canRonBlindKan,
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
  HKFanMatch,
  HKScoreBreakdown,
  HandDecomposition,
} from '@mahjong/game-core';

function findChiOptions(concealed: TileDef[], discardTile: TileDef): Array<[number, number]> {
  if (!discardTile.suit || !discardTile.rank) return [];
  const options: Array<[number, number]> = [];

  // Map same-suit tiles to their indices in the concealed array
  const sameSuitIndices: number[] = [];
  for (let ci = 0; ci < concealed.length; ci++) {
    const t = concealed[ci];
    if (t.suit === discardTile.suit && t.rank !== undefined) {
      sameSuitIndices.push(ci);
    }
  }

  for (let i = 0; i < sameSuitIndices.length; i++) {
    for (let j = i + 1; j < sameSuitIndices.length; j++) {
      const idx1 = sameSuitIndices[i];
      const idx2 = sameSuitIndices[j];
      const ranks = [concealed[idx1].rank!, concealed[idx2].rank!, discardTile.rank!].sort((a, b) => a - b);
      if (ranks[2] - ranks[0] === 2 && ranks[1] - ranks[0] === 1) {
        options.push([idx1, idx2]);
      }
    }
  }
  return options;
}

export class MahjongRoom extends Room<GameState> {
  maxClients = 4;

  // Server-authoritative state (not projected to clients for privacy)
  private wall: WallState | null = null;
  private concealedTiles: Map<number, TileDef[]> = new Map();
  private seatMelds: Map<number, Meld[]> = new Map();
  private seatRivers: Map<number, TileDef[]> = new Map();
  private doraIndicators: TileDef[] = [];
  private wildCardTile: TileDef | null = null;
  private activeSeat = 0;
  private dealerSeat = 0;
  private gamePhase: GamePhase = { type: 'LOBBY' };
  private roundWind: 'east' | 'south' | 'west' | 'north' = 'east';
  private handNumber = 1;
  private honba = 0;
  private riichiSticks = 0;
  private scores: number[] = [300, 300, 300, 300];
  private reactionState: ReactionState | null = null;
  private handVersions: number[] = [0, 0, 0, 0];
  private botTimers: Map<string, NodeJS.Timeout> = new Map();

  // Session <-> seat mapping
  private sessionToSeat: Map<string, number> = new Map();
  private seatToSession: Map<number, string> = new Map();

  // Spectator tracking
  private spectatorSessions: Set<string> = new Set();

  // Blind kan reaction state
  private blindKanReaction: {
    kanSeat: number;
    kanTile: TileDef;
    eligibleSeats: number[];
    responses: Record<number, { type: 'pass' | 'ron' } | null>;
  } | null = null;

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
      // Keep only the last 50 messages
      while (this.state.chatMessages.length > 50) {
        this.state.chatMessages.shift();
      }
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

    this.onMessage('call-chi', (client, data: { tileIds?: [string, string]; tiles?: [number, number] }) => {
      this.handleCallChi(client, data);
    });

    this.onMessage('call-kan-open', (client) => {
      this.handleCallKanOpen(client);
    });

    this.onMessage('call-kan-closed', (client, data: { tileId: string }) => {
      this.handleCallKanClosed(client, data);
    });

    this.onMessage('call-kan-added', (client, data: { tileId: string }) => {
      this.handleCallKanAdded(client, data);
    });

    this.onMessage('declare-win-tsumo', (client) => {
      this.handleDeclareWinTsumo(client);
    });

    this.onMessage('declare-win-ron-blind-kan', (client) => {
      this.handleDeclareWinRonBlindKan(client);
    });

    this.onMessage('request-hand', (client) => {
      this.handleRequestHand(client);
    });

    this.onMessage('next-hand', () => {
      this.handleNextHand();
    });

    this.onMessage('spectator-join-seat', (client, data: { seatIndex: number }) => {
      this.handleSpectatorJoinSeat(client, data);
    });
  }

  onJoin(client: Client, options: { displayName: string }) {
    const player = new PlayerSchema();
    player.playerId = client.sessionId;
    player.displayName = options.displayName || 'Player';
    player.isConnected = true;
    player.isHost = this.state.players.size === 0;

    // If game is already in progress, join as spectator
    if (this.state.status === 'in-progress') {
      player.isSpectator = true;
      player.seatIndex = 255; // no seat
      this.spectatorSessions.add(client.sessionId);
      this.state.players.set(client.sessionId, player);
      return;
    }

    // Lobby: auto-assign the next available seat
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
    this.spectatorSessions.delete(client.sessionId);
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
    if (this.gamePhase.type === 'LOBBY' || this.gamePhase.type === 'DEALING') return;

    // Spectators get to see ALL hands
    if (this.spectatorSessions.has(client.sessionId)) {
      const allHands: Record<number, { tiles: string[]; melds: Array<{ type: string; tileIds: string[]; isConcealed: boolean }> }> = {};
      for (let i = 0; i < 4; i++) {
        const concealed = this.concealedTiles.get(i) ?? [];
        const melds = this.seatMelds.get(i) ?? [];
        allHands[i] = {
          tiles: concealed.map((t) => t.id),
          melds: melds.map((m) => ({
            type: m.type,
            tileIds: m.tiles.map((t) => t.id),
            isConcealed: m.isConcealed,
          })),
        };
      }
      client.send('spectator-hand-state', {
        allHands,
        phase: this.gamePhase.type,
        activeSeat: this.activeSeat,
        wildCardTileId: this.wildCardTile?.id ?? null,
      });
      return;
    }

    const seat = this.sessionToSeat.get(client.sessionId);
    if (seat === undefined) return;

    const concealed = this.concealedTiles.get(seat) ?? [];
    const melds = this.seatMelds.get(seat) ?? [];

    // Include current phase info so client can reconstruct its available actions
    let activeSeat = this.activeSeat;
    let legalActions: string[] = [];

    if (this.gamePhase.type === 'TURN_DRAW' && seat === this.activeSeat) {
      legalActions = ['DRAW_TILE'];
    } else if (this.gamePhase.type === 'TURN_DECISION' && seat === this.activeSeat) {
      legalActions = this.gamePhase.legalActions;
    } else if (this.gamePhase.type === 'REACTION_WINDOW' && this.reactionState) {
      // Re-derive this seat's reaction options
      if (this.reactionState.eligibleSeats.includes(seat) && this.reactionState.responses[seat] === null) {
        const discardedTile = this.reactionState.discardTile;
        legalActions = ['PASS_REACTION'];
        const testConcealed = [...concealed, discardedTile];
        if (isValidWinningShape(testConcealed, melds.length)) {
          legalActions.push('DECLARE_WIN_RON');
        }
        const matchCount = concealed.filter((t) => tileSortKey(t) === tileSortKey(discardedTile)).length;
        if (matchCount >= 3 && HONG_KONG_PRESET.allowKan) legalActions.push('CALL_KAN_OPEN');
        if (matchCount >= 2) legalActions.push('CALL_PON');
        if (this.reactionState.discardSeat === (seat + 3) % 4 && discardedTile.suit) {
          legalActions.push('CALL_CHI');
        }
      }
    } else if (this.gamePhase.type === 'BLIND_KAN_REACTION' && this.blindKanReaction) {
      // Re-derive this seat's blind kan reaction options
      if (this.blindKanReaction.eligibleSeats.includes(seat) && this.blindKanReaction.responses[seat] === null) {
        legalActions = ['PASS_REACTION', 'DECLARE_WIN_RON_BLIND_KAN'];
      }
    }

    client.send('hand-state', {
      tiles: concealed.map((t) => t.id),
      melds: melds.map((m) => ({
        type: m.type,
        tileIds: m.tiles.map((t) => t.id),
        isConcealed: m.isConcealed,
      })),
      handVersion: this.handVersions[seat],
      phase: this.gamePhase.type,
      activeSeat,
      legalActions,
      wildCardTileId: this.wildCardTile?.id ?? null,
    });
  }

  private incrementHandVersion(seat: number) {
    this.handVersions[seat]++;
    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.handVersion = this.handVersions[seat];
  }

  private markWildCards(tiles: TileDef[]) {
    if (!this.wildCardTile) return;
    for (const tile of tiles) {
      tile.isWild = tileSortKey(tile) === tileSortKey(this.wildCardTile);
    }
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
      seatSchema.meldTileIds = (this.seatMelds.get(i) ?? []).map((m) => m.tiles.map((t) => t.id).join('|')).join(',');
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
    this.state.wildCardTileId = this.wildCardTile?.id ?? '';
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
    this.scores = [300, 300, 300, 300];
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

    // Wild card: draw the next tile after dealing and mark all copies as wild
    this.wildCardTile = null;
    if (HONG_KONG_PRESET.wildCardEnabled) {
      const wildFlipResult = wallDrawTile(this.wall);
      if (wildFlipResult.tile) {
        this.wall = wildFlipResult.wall;
        this.wildCardTile = wildFlipResult.tile;
      }
    }

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

      // Reset per-seat schema flags for new hand
      const seatSchema = this.state.seats.get(String(i));
      if (seatSchema) {
        seatSchema.isRiichi = false;
        seatSchema.hasPassedReaction = false;
      }
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

    // Sort each player's hand and mark wild cards
    for (let i = 0; i < 4; i++) {
      this.markWildCards(this.concealedTiles.get(i)!);
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
          wildCardTileId: this.wildCardTile?.id ?? null,
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

    // Mark wild card if applicable
    if (this.wildCardTile) {
      tile.isWild = tileSortKey(tile) === tileSortKey(this.wildCardTile);
    }

    // Add to concealed
    this.concealedTiles.get(seat)!.push(tile);
    this.incrementHandVersion(seat);

    // Calculate legal actions for this seat
    const actions: ActionType[] = ['DISCARD_TILE'];

    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    // Check for tsumo win
    if (isValidWinningShape([...concealed], melds.length)) {
      actions.push('DECLARE_WIN_TSUMO');
    }

    // Check for kan-closed: 4 of the same tile in concealed hand
    if (HONG_KONG_PRESET.allowKan) {
      const tileCounts = new Map<string, number>();
      for (const t of concealed) {
        const key = tileSortKey(t);
        tileCounts.set(key, (tileCounts.get(key) ?? 0) + 1);
      }
      for (const [, count] of tileCounts) {
        if (count === 4) {
          actions.push('CALL_KAN_CLOSED');
          break;
        }
      }

      // Check for kan-added: drawn tile completes an existing pon
      for (const meld of melds) {
        if (meld.type === 'pon') {
          const ponKey = tileSortKey(meld.tiles[0]);
          if (concealed.some((t) => tileSortKey(t) === ponKey)) {
            actions.push('CALL_KAN_ADDED');
            break;
          }
        }
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
    // Prevent discarding wild card tiles
    if (this.wildCardTile && tileSortKey(concealed[tileIndex]) === tileSortKey(this.wildCardTile)) return;

    const [discardedTile] = concealed.splice(tileIndex, 1);
    this.incrementHandVersion(seat);
    this.seatRivers.get(seat)!.push(discardedTile);

    this.checkAndOpenReactionWindow(seat, discardedTile);
  }

  // ---------------------------------------------------------------------------
  // Shared reaction window (used by both human and bot discards)
  // ---------------------------------------------------------------------------

  private checkAndOpenReactionWindow(discardSeat: number, discardedTile: TileDef) {
    const eligibleSeats: number[] = [];

    for (let i = 0; i < 4; i++) {
      if (i === discardSeat) continue;

      const otherConcealed = this.concealedTiles.get(i)!;

      const matchingCount = otherConcealed.filter(
        (t) => tileSortKey(t) === tileSortKey(discardedTile),
      ).length;
      // Kan-open: player has 3 of the discarded tile (4 total with the discard)
      if (matchingCount >= 3 && HONG_KONG_PRESET.allowKan && HONG_KONG_PRESET.allowOpenHand) {
        eligibleSeats.push(i);
        continue;
      }
      if (matchingCount >= 2 && HONG_KONG_PRESET.allowPon && HONG_KONG_PRESET.allowOpenHand) {
        eligibleSeats.push(i);
        continue;
      }

      if (
        i === (discardSeat + 1) % 4 &&
        HONG_KONG_PRESET.allowChi &&
        HONG_KONG_PRESET.allowOpenHand &&
        discardedTile.suit
      ) {
        const chiOptions = findChiOptions(otherConcealed, discardedTile);
        if (chiOptions.length > 0) {
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
        HONG_KONG_PRESET.reactionTimerSeconds * 1000,
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
            let chiTileOptions: string[][] = [];
            const matchCount2 = this.concealedTiles
              .get(eligibleSeat)!
              .filter((t) => tileSortKey(t) === tileSortKey(discardedTile)).length;
            if (matchCount2 >= 3 && HONG_KONG_PRESET.allowKan) seatActions.push('CALL_KAN_OPEN');
            if (matchCount2 >= 2) seatActions.push('CALL_PON');
            if (eligibleSeat === (discardSeat + 1) % 4 && discardedTile.suit) {
              const chiOptions = findChiOptions(this.concealedTiles.get(eligibleSeat)!, discardedTile);
              if (chiOptions.length > 0) {
                seatActions.push('CALL_CHI');
                chiTileOptions = chiOptions.map(([i, j]) => [this.concealedTiles.get(eligibleSeat)![i].id, this.concealedTiles.get(eligibleSeat)![j].id]);
              }
            }
            eligibleClient.send('reaction-options', {
              discardSeat,
              discardTileId: discardedTile.id,
              actions: seatActions,
              chiOptions: chiTileOptions,
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

    // Check for kan-closed / kan-added
    if (HONG_KONG_PRESET.allowKan) {
      const tileCounts = new Map<string, number>();
      for (const t of concealed) {
        const key = tileSortKey(t);
        tileCounts.set(key, (tileCounts.get(key) ?? 0) + 1);
      }
      for (const [, count] of tileCounts) {
        if (count === 4) {
          actions.push('CALL_KAN_CLOSED');
          break;
        }
      }
      for (const meld of melds) {
        if (meld.type === 'pon') {
          const ponKey = tileSortKey(meld.tiles[0]);
          if (concealed.some((t) => tileSortKey(t) === ponKey)) {
            actions.push('CALL_KAN_ADDED');
            break;
          }
        }
      }
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

    const discardIndex = this.chooseBotDiscard(seat);
    const discardedTile = concealed[discardIndex];
    if (!discardedTile) return;

    concealed.splice(discardIndex, 1);
    this.incrementHandVersion(seat);
    this.seatRivers.get(seat)!.push(discardedTile);

    this.checkAndOpenReactionWindow(seat, discardedTile);
  }

  private chooseBotDiscard(seat: number): number {
    const concealed = this.concealedTiles.get(seat)!;
    if (concealed.length === 0) return 0;

    const scores = concealed.map((tile, idx) => {
      // Never discard wild cards — they are the most valuable tiles
      if (this.wildCardTile && tileSortKey(tile) === tileSortKey(this.wildCardTile)) {
        return 1000;
      }

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

    const decomposition = decomposeWinningHand([...concealed], melds.length);
    if (!decomposition) return;

    const seatWind = MahjongRoom.SEAT_WINDS[seat];
    const patterns = evaluateHKPatterns(concealed, melds, 'tsumo', seatWind, this.roundWind);
    const hasGong = melds.some(m => m.type.startsWith('kan'));
    const isDealer = seat === this.dealerSeat;
    const scoreResult = calculateHKScore(patterns, hasGong, isDealer);
    this.applyHKWinResult(seat, 'tsumo', patterns, scoreResult, hasGong, decomposition);
  }

  private executeBotReaction(seat: number) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    if (!this.reactionState.eligibleSeats.includes(seat)) return;
    if (this.reactionState.responses[seat] !== null) return;

    const discardedTile = this.reactionState.discardTile;
    const otherConcealed = this.concealedTiles.get(seat)!;

    const matchCount = otherConcealed.filter(
      (t) => tileSortKey(t) === tileSortKey(discardedTile),
    ).length;

    // 70% chance to call kan-open (having 3 of a kind is very strong)
    if (matchCount >= 3 && Math.random() < 0.7) {
      this.reactionState = submitResponse(this.reactionState, seat, { type: 'kan-open' });
      this.checkReactionResolution();
      return;
    }

    // 30% chance to call pon
    if (matchCount >= 2 && Math.random() < 0.3) {
      this.reactionState = submitResponse(this.reactionState, seat, { type: 'pon' });
      this.checkReactionResolution();
      return;
    }

    // 30% chance to call chi (only for left-seat player)
    if (
      seat === (this.reactionState.discardSeat + 1) % 4 &&
      Math.random() < 0.3
    ) {
      const chiOptions = findChiOptions(otherConcealed, discardedTile);
      if (chiOptions.length > 0) {
        const pick = chiOptions[Math.floor(Math.random() * chiOptions.length)];
        this.reactionState = submitResponse(this.reactionState, seat, { type: 'chi', tiles: pick });
        this.checkReactionResolution();
        return;
      }
    }

    // Pass
    this.reactionState = submitResponse(this.reactionState, seat, { type: 'pass' });
    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.hasPassedReaction = true;
    this.checkReactionResolution();
  }

  // ---------------------------------------------------------------------------
  // Reaction handlers
  // ---------------------------------------------------------------------------

  private handlePassReaction(client: Client) {
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    // Handle blind kan reaction pass
    if (this.gamePhase.type === 'BLIND_KAN_REACTION' && this.blindKanReaction) {
      if (this.blindKanReaction.eligibleSeats.includes(seat) && this.blindKanReaction.responses[seat] === null) {
        this.blindKanReaction.responses[seat] = { type: 'pass' };
        const seatSchema = this.state.seats.get(String(seat));
        if (seatSchema) seatSchema.hasPassedReaction = true;
        this.checkBlindKanReactionResolution();
      }
      return;
    }

    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;

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

  private handleCallChi(client: Client, data: { tileIds?: [string, string]; tiles?: [number, number] }) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    // Convert tile IDs to indices if provided
    let tileIndices: [number, number];
    if (data.tileIds) {
      const concealed = this.concealedTiles.get(seat)!;
      const idx1 = concealed.findIndex(t => t.id === data.tileIds![0]);
      const idx2 = concealed.findIndex(t => t.id === data.tileIds![1]);
      if (idx1 === -1 || idx2 === -1) return;
      tileIndices = [idx1, idx2];
    } else if (data.tiles) {
      tileIndices = data.tiles;
    } else {
      return;
    }

    this.reactionState = submitResponse(this.reactionState, seat, {
      type: 'chi',
      tiles: tileIndices,
    });
    this.checkReactionResolution();
  }

  private handleCallKanOpen(client: Client) {
    if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;

    this.reactionState = submitResponse(this.reactionState, seat, { type: 'kan-open' });
    this.checkReactionResolution();
  }

  private handleCallKanClosed(client: Client, data: { tileId: string }) {
    if (this.gamePhase.type !== 'TURN_DECISION') return;
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;

    const concealed = this.concealedTiles.get(seat)!;
    const tileIndex = concealed.findIndex((t) => t.id === data.tileId);
    if (tileIndex === -1) return;

    const targetTile = concealed[tileIndex];
    // Verify player has all 4 of this tile in hand
    const matchingCount = concealed.filter((t) => tileSortKey(t) === tileSortKey(targetTile)).length;
    if (matchingCount < 4) return;

    this.applyKanClosed(seat, targetTile);
  }

  private handleCallKanAdded(client: Client, data: { tileId: string }) {
    if (this.gamePhase.type !== 'TURN_DECISION') return;
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;

    const concealed = this.concealedTiles.get(seat)!;
    const tileIndex = concealed.findIndex((t) => t.id === data.tileId);
    if (tileIndex === -1) return;

    const targetTile = concealed[tileIndex];
    const melds = this.seatMelds.get(seat)!;

    // Find a pon meld that matches this tile
    const ponMeldIndex = melds.findIndex(
      (m) => m.type === 'pon' && m.tiles.some((t) => tileSortKey(t) === tileSortKey(targetTile)),
    );
    if (ponMeldIndex === -1) return;

    this.applyKanAdded(seat, ponMeldIndex, targetTile);
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

    // Resolve by priority: kan-open > pon > chi (no ron in HK rules)
    const priority = HONG_KONG_PRESET.reactionPriority;
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
      case 'kan-open':
        this.applyKanOpen(winnerSeat, reaction.discardSeat, reaction.discardTile);
        break;
      case 'pon':
        this.applyPon(winnerSeat, reaction.discardSeat, reaction.discardTile);
        break;
      case 'chi':
        this.applyChi(winnerSeat, reaction.discardSeat, reaction.discardTile, response.tiles);
        break;
      default:
        this.advanceToNextPlayer(reaction.discardSeat);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Blind Kan reaction
  // ---------------------------------------------------------------------------

  private checkBlindKanReactionResolution() {
    if (!this.blindKanReaction) return;
    const allResponded = this.blindKanReaction.eligibleSeats.every(
      (s) => this.blindKanReaction!.responses[s] !== null,
    );
    if (allResponded) {
      this.resolveBlindKanReaction();
    }
  }

  private resolveBlindKanReaction() {
    if (!this.blindKanReaction) return;
    const reaction = this.blindKanReaction;
    this.blindKanReaction = null;

    // Reset hasPassedReaction flags
    for (let i = 0; i < 4; i++) {
      const seatSchema = this.state.seats.get(String(i));
      if (seatSchema) seatSchema.hasPassedReaction = false;
    }

    // Check if anyone claimed ron
    for (const seat of reaction.eligibleSeats) {
      const resp = reaction.responses[seat];
      if (resp && resp.type === 'ron') {
        this.resolveBlindKanRon(seat, reaction.kanSeat, reaction.kanTile);
        return;
      }
    }

    // All passed — continue with replacement draw for the kan player
    const kanMelds = this.seatMelds.get(reaction.kanSeat) ?? [];
    const lastMeld = kanMelds[kanMelds.length - 1];
    this.drawReplacementAndContinue(reaction.kanSeat, lastMeld);
  }

  private resolveBlindKanRon(winnerSeat: number, kanSeat: number, kanTile: TileDef) {
    const winnerConcealed = this.concealedTiles.get(winnerSeat) ?? [];
    const winnerMelds = this.seatMelds.get(winnerSeat) ?? [];
    const decomposition = decomposeWinningHand([...winnerConcealed, kanTile], winnerMelds.length);
    if (!decomposition) return;

    const seatWind = MahjongRoom.SEAT_WINDS[winnerSeat];
    const patterns = evaluateHKPatterns([...winnerConcealed, kanTile], winnerMelds, 'ron', seatWind, this.roundWind);
    const hasGong = winnerMelds.some(m => m.type.startsWith('kan'));
    const isDealer = winnerSeat === this.dealerSeat;
    const scoreResult = calculateHKScore(patterns, hasGong, isDealer);

    // Blind Kan ron: kan player pays the full amount alone
    const totalScore = scoreResult.total;

    // Update scores — kan player pays 100%
    this.scores[winnerSeat] += totalScore;
    this.scores[kanSeat] -= totalScore;

    // Transition to HAND_END
    const handEndPhase: GamePhase = {
      type: 'HAND_END',
      endReason: 'win',
      result: null as any,
    };
    if (canTransition(this.gamePhase, handEndPhase)) {
      this.setPhase(handEndPhase);
      this.state.winInfo = JSON.stringify({
        winner: winnerSeat,
        winType: 'ron',
        fan: scoreResult.fan,
        total: totalScore,
        hasGong,
        gongMultiplier: scoreResult.gongMultiplier,
        patterns: patterns.map((p) => ({ id: p.id, name: p.name, fanValue: p.fanValue })),
        blindKanRon: true,
        losingSeat: kanSeat,
      });
      this.syncSchemaFromInternal();

      this.broadcast('hand-result', {
        winner: winnerSeat,
        winType: 'ron',
        fan: scoreResult.fan,
        total: totalScore,
        hasGong,
        gongMultiplier: scoreResult.gongMultiplier,
        patterns: patterns.map((p) => ({ id: p.id, name: p.name, fanValue: p.fanValue })),
        winnerTiles: winnerConcealed
          .sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)))
          .map(t => t.id),
        winnerMelds: winnerMelds.map(m => ({ type: m.type, tileIds: m.tiles.map(t => t.id) })),
        blindKanRon: true,
        losingSeat: kanSeat,
        fromPlayer: kanSeat,
        toPlayer: winnerSeat,
        scores: this.scores.map((score, i) => ({ seatIndex: i, points: score })),
      });
    }
  }

  private handleDeclareWinRonBlindKan(client: Client) {
    if (this.gamePhase.type !== 'BLIND_KAN_REACTION' || !this.blindKanReaction) return;
    const seat = this.getSeatForClient(client);
    if (seat === null) return;
    if (!this.blindKanReaction.eligibleSeats.includes(seat)) return;
    if (this.blindKanReaction.responses[seat] !== null) return;

    this.blindKanReaction.responses[seat] = { type: 'ron' };
    this.checkBlindKanReactionResolution();
  }

  // ---------------------------------------------------------------------------
  // Spectator join
  // ---------------------------------------------------------------------------

  private handleSpectatorJoinSeat(client: Client, data: { seatIndex: number }) {
    if (!this.spectatorSessions.has(client.sessionId)) return;
    if (this.gamePhase.type !== 'HAND_END' && this.gamePhase.type !== 'ROUND_END' && this.gamePhase.type !== 'MATCH_END') return;

    const requestedSeat = data.seatIndex;
    if (requestedSeat < 0 || requestedSeat >= 4) return;

    // Check if the seat is occupied by a bot (no real session)
    const sessionForSeat = this.seatToSession.get(requestedSeat);
    if (sessionForSeat !== undefined) {
      // Seat is occupied by a real player
      client.send('seat-join-error', { reason: 'Seat is occupied by a player' });
      return;
    }

    // Check if there's a player schema for this seat
    const existingPlayer = Array.from(this.state.players.values()).find(
      (p) => p.seatIndex === requestedSeat && !p.isSpectator,
    );
    if (existingPlayer && existingPlayer.isConnected) {
      client.send('seat-join-error', { reason: 'Seat is occupied' });
      return;
    }

    // Move spectator to the seat
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Remove old player if they were disconnected bot
    if (existingPlayer) {
      this.state.players.delete(existingPlayer.playerId);
    }

    player.isSpectator = false;
    player.seatIndex = requestedSeat;
    player.isReady = true;
    this.sessionToSeat.set(client.sessionId, requestedSeat);
    this.seatToSession.set(requestedSeat, client.sessionId);
    this.spectatorSessions.delete(client.sessionId);

    client.send('seat-joined', { seatIndex: requestedSeat });
  }

  // ---------------------------------------------------------------------------
  // Win resolution
  // ---------------------------------------------------------------------------

  private handleDeclareWinTsumo(client: Client) {
    const seat = this.getSeatForClient(client);
    if (seat === null || seat !== this.activeSeat) return;
    if (this.gamePhase.type !== 'TURN_DECISION') return;

    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    // Validate with decomposition
    const decomposition = decomposeWinningHand([...concealed], melds.length);
    if (!decomposition) return;

    const seatWind = MahjongRoom.SEAT_WINDS[seat];
    const patterns = evaluateHKPatterns(concealed, melds, 'tsumo', seatWind, this.roundWind);
    const hasGong = melds.some(m => m.type.startsWith('kan'));
    const isDealer = seat === this.dealerSeat;
    const scoreResult = calculateHKScore(patterns, hasGong, isDealer);

    this.applyHKWinResult(seat, 'tsumo', patterns, scoreResult, hasGong, decomposition);
  }

  private applyHKWinResult(
    winnerSeat: number,
    winType: 'tsumo',
    patterns: HKFanMatch[],
    scoreResult: HKScoreBreakdown,
    hasGong: boolean,
    decomposition: HandDecomposition,
  ) {
    // Apply score transfers: winner gets paid by all others
    const isDealer = winnerSeat === this.dealerSeat;
    for (let i = 0; i < 4; i++) {
      if (i === winnerSeat) continue;
      let payAmount: number;
      if (isDealer) {
        // Dealer tsumo: all non-dealers pay the same (already doubled in calculator)
        payAmount = scoreResult.totalPerPlayer;
      } else {
        // Non-dealer tsumo: dealer pays double, others pay base
        payAmount = i === this.dealerSeat ? scoreResult.totalPerPlayer * 2 : scoreResult.totalPerPlayer;
      }
      this.scores[i] -= payAmount;
      this.scores[winnerSeat] += payAmount;
    }

    // Transition directly to HAND_END
    const handEndPhase: GamePhase = {
      type: 'HAND_END',
      endReason: 'win',
      result: null as any,
    };
    if (canTransition(this.gamePhase, handEndPhase)) {
      this.setPhase(handEndPhase);
      this.state.winInfo = JSON.stringify({
        winner: winnerSeat,
        winType,
        fan: scoreResult.fan,
        total: scoreResult.total,
        hasGong,
        gongMultiplier: scoreResult.gongMultiplier,
        patterns: patterns.map((p) => ({ id: p.id, name: p.name, fanValue: p.fanValue })),
      });
      this.syncSchemaFromInternal();

      const winnerMelds = this.seatMelds.get(winnerSeat) ?? [];
      // Build sorted decomposed groups: concealed melds + pair, then open melds
      const concealedGroups = decomposition.melds.map(m => ({
        type: m.type,
        tileIds: m.tiles.sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b))).map(t => t.id),
      }));
      if (decomposition.pair.length > 0) {
        concealedGroups.push({
          type: 'pair',
          tileIds: decomposition.pair.sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b))).map(t => t.id),
        });
      }
      const openMeldGroups = winnerMelds.map(m => ({
        type: m.type,
        tileIds: m.tiles.sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b))).map(t => t.id),
      }));
      this.broadcast('hand-result', {
        winner: winnerSeat,
        winType,
        fan: scoreResult.fan,
        total: scoreResult.total,
        hasGong,
        gongMultiplier: scoreResult.gongMultiplier,
        patterns: patterns.map((p) => ({ id: p.id, name: p.name, fanValue: p.fanValue })),
        winnerTiles: (this.concealedTiles.get(winnerSeat) ?? [])
          .sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)))
          .map(t => t.id),
        winnerMelds: winnerMelds.map(m => ({ type: m.type, tileIds: m.tiles.map(t => t.id) })),
        handGroups: [...concealedGroups, ...openMeldGroups],
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
      // Dealer stays, honba increments (renchan)
      nextHonba = this.honba + 1;
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

    // Validate the three tiles form a consecutive sequence in the same suit
    if (!discardTile.suit || !discardTile.rank || tile1.suit !== discardTile.suit || tile2.suit !== discardTile.suit) return;
    const ranks = [tile1.rank!, tile2.rank!, discardTile.rank!].sort((a, b) => a - b);
    if (ranks[2] - ranks[0] !== 2 || ranks[1] - ranks[0] !== 1) return;

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

  private applyKanOpen(callerSeat: number, discardSeat: number, discardTile: TileDef) {
    const concealed = this.concealedTiles.get(callerSeat)!;

    // Find 3 matching tiles in concealed hand
    const matching: TileDef[] = [];
    const remaining: TileDef[] = [];
    let found = 0;

    for (const tile of concealed) {
      if (found < 3 && tileSortKey(tile) === tileSortKey(discardTile)) {
        matching.push(tile);
        found++;
      } else {
        remaining.push(tile);
      }
    }

    if (found < 3) return; // Safety check

    this.concealedTiles.set(callerSeat, remaining);

    const meld: Meld = {
      type: 'kan-open',
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

    // Draw a replacement tile from the dead wall
    this.drawReplacementAndContinue(callerSeat, meld);
  }

  private applyKanClosed(seat: number, targetTile: TileDef) {
    const concealed = this.concealedTiles.get(seat)!;

    // Remove all 4 matching tiles from concealed
    const remaining = concealed.filter(
      (t) => tileSortKey(t) !== tileSortKey(targetTile),
    );
    this.concealedTiles.set(seat, remaining);

    // Create 4 tiles for the kan (use the actual tile objects from concealed)
    const matching = concealed.filter(
      (t) => tileSortKey(t) === tileSortKey(targetTile),
    );

    const meld: Meld = {
      type: 'kan-closed',
      tiles: matching.slice(0, 4),
      isConcealed: true,
    };
    this.seatMelds.get(seat)!.push(meld);
    this.incrementHandVersion(seat);

    // Blind Kan ron check: check if any other player can win off this tile
    const eligibleSeats: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (i === seat) continue;
      const otherConcealed = this.concealedTiles.get(i) ?? [];
      const otherMelds = this.seatMelds.get(i) ?? [];
      if (canRonBlindKan(otherConcealed, otherMelds.length, targetTile)) {
        eligibleSeats.push(i);
      }
    }

    if (eligibleSeats.length > 0) {
      // Open blind kan reaction window
      const responses: Record<number, { type: 'pass' | 'ron' } | null> = {};
      for (const s of eligibleSeats) responses[s] = null;

      this.blindKanReaction = {
        kanSeat: seat,
        kanTile: targetTile,
        eligibleSeats,
        responses,
      };

      this.gamePhase = {
        type: 'BLIND_KAN_REACTION',
        kanSeat: seat,
        kanTile: targetTile,
        pendingSeats: eligibleSeats,
      };

      // Send reaction options to eligible seats
      for (const s of eligibleSeats) {
        const sess = this.seatToSession.get(s);
        if (sess) {
          const c = this.clients.getById(sess);
          if (c) {
            c.send('blind-kan-reaction-options', {
              kanSeat: seat,
              kanTileId: targetTile.id,
              actions: ['PASS_REACTION', 'DECLARE_WIN_RON_BLIND_KAN'],
            });
          }
        }
      }

      return; // Don't draw replacement yet — wait for reaction resolution
    }

    // No one can win off it — draw replacement tile from dead wall
    this.drawReplacementAndContinue(seat, meld);
  }

  private applyKanAdded(seat: number, ponMeldIndex: number, addedTile: TileDef) {
    const concealed = this.concealedTiles.get(seat)!;
    const melds = this.seatMelds.get(seat)!;

    // Remove the added tile from concealed
    const tileIndex = concealed.findIndex((t) => t.id === addedTile.id);
    if (tileIndex === -1) return;
    concealed.splice(tileIndex, 1);
    this.incrementHandVersion(seat);

    // Upgrade the pon meld to a kan-added
    const ponMeld = melds[ponMeldIndex];
    melds[ponMeldIndex] = {
      type: 'kan-added',
      tiles: [...ponMeld.tiles, addedTile],
      calledFromSeat: ponMeld.calledFromSeat,
      isConcealed: false,
    };

    // Draw a replacement tile from the dead wall
    this.drawReplacementAndContinue(seat, melds[ponMeldIndex]);
  }

  private drawReplacementAndContinue(seat: number, meld: Meld) {
    if (!this.wall) return;

    // Draw replacement tile from the dead wall
    const replResult = drawReplacementTile(this.wall);
    if (replResult.tile) {
      this.wall = replResult.wall;
      const replTile = replResult.tile;
      if (this.wildCardTile) {
        replTile.isWild = tileSortKey(replTile) === tileSortKey(this.wildCardTile);
      }
      this.concealedTiles.get(seat)!.push(replTile);
    }

    // Add a new dora indicator after kan
    const newDoraIndex = this.wall.deadWallStart;
    if (newDoraIndex < this.wall.tiles.length && !this.doraIndicators.some(t => tileSortKey(t) === tileSortKey(this.wall!.tiles[newDoraIndex]))) {
      this.doraIndicators.push(this.wall.tiles[newDoraIndex]);
    }

    this.activeSeat = seat;
    this.setPhase({
      type: 'TURN_DECISION',
      activeSeat: seat,
      legalActions: ['DISCARD_TILE'],
    });
    this.syncSchemaFromInternal();

    const callerClient = this.getClientForSeat(seat);
    if (callerClient) {
      callerClient.send('legal-actions', { actions: ['DISCARD_TILE'] });
      callerClient.send('meld-applied', {
        meld: { type: meld.type, tileIds: meld.tiles.map((t) => t.id) },
        handVersion: this.handVersions[seat],
      });
      if (replResult.tile) {
        callerClient.send('tile-drawn', { tileId: replResult.tile.id, handVersion: this.handVersions[seat] });
      }
    }

    if (this.isBot(seat)) {
      this.scheduleBotAction(seat);
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
