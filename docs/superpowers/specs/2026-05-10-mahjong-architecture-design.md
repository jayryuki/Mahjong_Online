# Mahjong Game — Architecture Design Spec

## 1. Architecture Overview

A pnpm monorepo with three packages and two apps:

```
/
├── apps/
│   ├── web/          # Vite + React + TypeScript client
│   └── server/       # Colyseus 0.16 + Express + TypeScript
├── packages/
│   ├── game-core/    # Pure TS: domain models, FSM, rules engine, scoring
│   └── ui/           # Shared design tokens, SVG tiles, React components
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

**Key principle**: `game-core` is a pure TypeScript package with zero framework dependencies. It contains all domain logic — tile definitions, hand validation, scoring, FSM transitions, move validation, rules presets. Both server and client import from it. The server is the single authority. The client consumes state and legal-action metadata.

## 2. Domain Model

### Core Types

```typescript
// Tile identity
type Suit = 'man' | 'pin' | 'sou';
type HonorType = 'wind' | 'dragon';
type WindName = 'east' | 'south' | 'west' | 'north';
type DragonName = 'haku' | 'hatsu' | 'chun';

interface TileDef {
  id: string;          // unique per instance: "man-1-0", "pin-3-1"
  suit?: Suit;
  rank?: number;       // 1-9 for suited
  honorType?: HonorType;
  honorName?: WindName | DragonName;
  isFlower: boolean;
  flowerIndex?: number;
}

interface Hand {
  concealed: TileDef[];
  melds: Meld[];
  flowers: TileDef[];
  riichi: boolean;
  riichiTileIndex?: number;
}

interface Meld {
  type: 'chi' | 'pon' | 'kan-open' | 'kan-closed' | 'kan-added';
  tiles: TileDef[];
  calledFromSeat?: number;
  isConcealed: boolean;
}

interface RiverEntry {
  tile: TileDef;
  calledBy?: number;   // seat index if claimed
  isRiichiDiscard?: boolean;
  isLastDiscard?: boolean;
}

interface River {
  entries: RiverEntry[];
}

interface Wall {
  tiles: TileDef[];
  deadWallStart: number;
  drawIndex: number;
}
```

### Canonical State Tree

The top-level state objects all layers share. `PlayerState` is the canonical shared player model — there is no separate `Player` interface.

```typescript
interface MatchState {
  roomId: string;
  roomCode: string;
  status: 'lobby' | 'in-progress' | 'finished';
  hostPlayerId: string;
  preset: RulesPreset;
  players: PlayerState[];
  spectators: SpectatorState[];
  scores: ScoreTrack;
  round: RoundState | null;
  phase: GamePhase;
  createdAt: number;
  updatedAt: number;
}

interface PlayerState {
  playerId: string;
  displayName: string;
  seatIndex: number;
  isConnected: boolean;
  isReady: boolean;
  isHost: boolean;
}

interface ScoreTrack {
  entries: PlayerScoreState[];
  startValue: number;           // e.g. 25000 for Riichi
}

interface PlayerScoreState {
  seatIndex: number;
  points: number;
  riichiDeposit: boolean;       // whether this player has a riichi stick on the table
}

interface SpectatorState {
  playerId: string;
  displayName: string;
  joinedAt: number;
}

interface RoundState {
  roundWind: 'east' | 'south' | 'west' | 'north';
  handNumber: number;
  honba: number;
  riichiSticks: number;
  dealerSeat: number;
  activeSeat: number;
  wall: WallState;
  deadWall: DeadWallState | null;
  dora: DoraState | null;
  reaction: ReactionState | null;
  seats: SeatRoundState[];
  eventLog: GameEvent[];
  lastEvent?: GameEvent;
  seedInfo: RoundSeedInfo;
}

interface WallState {
  remaining: number;            // tiles left to draw (not yet drawn)
  deadWallStart: number;        // index where dead wall begins
}

interface DeadWallState {
  replacementDrawsAvailable: number;
}

interface DoraState {
  indicators: TileDef[];        // face-up dora indicators
  uraIndicators?: TileDef[];    // revealed only on riichi win (Phase 2)
}

interface SeatRoundState {
  seatIndex: number;
  playerId: string | null;
  concealedTiles?: TileDef[];   // server/private only — never sent to other players
  concealedCount: number;       // public — other players see count, not tiles
  melds: Meld[];
  flowers: TileDef[];
  river: River;
  isRiichi: boolean;
  isConnected: boolean;
  hasPassedCurrentReaction?: boolean;
}

interface RoundSeedInfo {
  shuffleSeed: string;
  wallVersion: number;
}

interface RoundSummary {
  roundWind: 'east' | 'south' | 'west' | 'north';
  handNumber: number;
  honba: number;
  riichiSticks: number;
  result: HandResult | null;
  endReason: 'win' | 'exhaustive-draw';
  scoreChanges: PlayerScoreState[];
}
```

**`RoundSummary.result` and `endReason`:**
- When `endReason` is `'win'`, `result` contains the full `HandResult`.
- When `endReason` is `'exhaustive-draw'`, `result` is `null` — no winning hand.
- Phase 1 only supports these two end reasons. Additional cases (abortive draws, special terminations) will be added as new `endReason` variants in Phase 2.

### Deterministic Shuffle & Replay

- Wall generation is deterministic from a server-generated seed (`shuffleSeed`).
- Dealing, draws, replacement draws, and dead wall behavior all derive from the canonical generated wall order.
- The server never trusts the client for randomness.
- A round can be replayed from `seedInfo` + action log for debugging and deterministic validation.
- Tests replay rounds from seed + recorded actions.

### State Machine Phases

```
ROOM_OPEN → LOBBY → DEALING → TURN_DRAW → TURN_DECISION → 
REACTION_WINDOW → RESOLUTION → HAND_END → ROUND_END → MATCH_END
```

Each phase is a discriminated union member:

```typescript
type GamePhase =
  | { type: 'ROOM_OPEN' }
  | { type: 'LOBBY' }
  | { type: 'DEALING'; progress: number }
  | { type: 'TURN_DRAW'; activeSeat: number; wallRemaining: number }
  | { type: 'TURN_DECISION'; activeSeat: number; legalActions: ActionType[] }
  | { type: 'REACTION_WINDOW'; discardSeat: number; discardTile: TileDef; pendingSeats: number[] }
  | { type: 'RESOLUTION'; winner?: number; winType?: 'ron' | 'tsumo' }
  | { type: 'HAND_END'; endReason: 'win' | 'exhaustive-draw'; result: HandResult | null }
  | { type: 'ROUND_END'; summary: RoundSummary }
  | { type: 'MATCH_END'; finalScores: PlayerScoreState[] }
```

`HAND_END` is the immediate terminal state for a hand, regardless of whether the hand ended in a win or an exhaustive draw.

### GameEvent Model

A formal event log for debugging, UI history feeds, result context, and replay inspection:

```typescript
type GameEvent =
  | { type: 'room-created'; by: string; at: number }
  | { type: 'player-joined'; playerId: string; seatIndex?: number; at: number }
  | { type: 'player-left'; playerId: string; at: number }
  | { type: 'seat-chosen'; playerId: string; seatIndex: number; at: number }
  | { type: 'match-started'; by: string; at: number }
  | { type: 'tile-drawn'; seatIndex: number; at: number }
  | { type: 'tile-discarded'; seatIndex: number; tile: TileDef; at: number }
  | { type: 'reaction-opened'; reactionId: string; discardSeat: number; at: number }
  | { type: 'meld-called'; seatIndex: number; meld: Meld; at: number }
  | { type: 'riichi-declared'; seatIndex: number; at: number }
  | { type: 'win-declared'; seatIndex: number; winType: 'ron' | 'tsumo'; at: number }
  | { type: 'round-ended'; endReason: 'win' | 'exhaustive-draw'; result: HandResult | null; at: number };
```

## 3. State Visibility Model

The server holds full truth. Clients receive projections only.

```typescript
// Full server-side truth — never sent to clients in full
interface ServerMatchState extends MatchState {
  round: ServerRoundState | null;
  seatClaims: SeatClaim[];       // server-only reconnect ownership data
}

interface ServerSeatRoundState extends SeatRoundState {
  concealedTiles: TileDef[];     // guaranteed present — server always has full tile data
}

interface ServerRoundState extends Omit<RoundState, 'seats'> {
  seats: ServerSeatRoundState[]; // all seats carry full concealed tile data
}

// One player's view — includes their own concealed tiles and their personal prompts
interface PlayerViewState {
  match: PublicTableState;
  privateHand: TileDef[];           // this player's concealed tiles
  legalActions: ActionType[];       // actions this player may take right now
  reactionPrompt?: ReactionPrompt;  // if a reaction window is open for this player
}

// All shared visible information
interface PublicTableState {
  phase: GamePhase;
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  dealerSeat: number;
  activeSeat: number;
  wallRemaining: number;
  doraIndicators: TileDef[];
  seats: PublicSeatState[];         // no concealed tiles
  scores: ScoreTrack;
}

interface PublicSeatState {
  seatIndex: number;
  playerId: string | null;
  displayName: string;
  concealedCount: number;
  melds: Meld[];
  flowers: TileDef[];
  river: River;
  isRiichi: boolean;
  isConnected: boolean;
}

interface ReactionPrompt {
  reactionId: string;
  discardSeat: number;
  discardTile: TileDef;
  availableReactions: ('ron' | 'pon' | 'kan-open' | 'chi')[];
  deadline: number;
}

// Spectator view — same as public state, no concealed tiles, no privileged prompts
interface SpectatorViewState {
  match: PublicTableState;
}
```

**Visibility rules:**
- Clients never receive concealed hands of other players.
- Clients never receive the full `eligibleSeats` list for a reaction window.
- Clients only receive legal actions and prompts relevant to their own seat.
- Reconnect secrets and hashes are server-only and never sent to clients.
- The UI renders from projected state (`PlayerViewState` / `PublicTableState`), never raw server internals.

## 4. Rules Preset System

```typescript
interface RulesPreset {
  id: string;
  name: string;
  description: string;
  
  // Tile set
  playerCount: 3 | 4;
  flowersEnabled: boolean;
  
  // Win conditions
  minimumHan: number;
  minimumFu?: number;
  
  // Scoring
  scoringModel: 'riichi' | 'hong-kong';
  kiriageMangan: boolean;
  kazoeLimit: 'mangan' | 'haneman' | 'sanbaiman' | 'none';
  
  // Meld restrictions
  allowOpenHand: boolean;
  allowChi: boolean;
  allowPon: boolean;
  allowKan: boolean;
  
  // Riichi
  allowRiichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  
  // Reactions
  reactionPriority: ('ron' | 'pon' | 'kan-open' | 'chi')[];
  atamahane: boolean;
  
  // Timers
  turnTimerEnabled: boolean;
  turnTimerSeconds: number;
  reactionTimerSeconds: number;
  
  // QoL
  autoSortHand: boolean;
  confirmDiscard: boolean;
  scoreDisplayVerbosity: 'minimal' | 'standard' | 'detailed';
  
  // Future
  spectatorPolicy: 'none' | 'allow';
}

const PRESETS: Record<string, RulesPreset> = {
  riichi: { /* Japanese Riichi defaults */ },
  'hong-kong': { /* Hong Kong Old Style defaults */ },
  custom: { /* User-configurable, starts from riichi */ },
}
```

## 5. Move/Action Contract System

```typescript
type ActionType =
  // Lobby
  | 'CREATE_ROOM' | 'JOIN_ROOM' | 'LEAVE_ROOM' | 'RECONNECT_PLAYER'
  | 'CHOOSE_SEAT' | 'TOGGLE_READY' | 'UPDATE_RULESET' | 'START_MATCH'
  | 'REMATCH' | 'KICK_PLAYER'
  // Gameplay
  | 'DRAW_TILE' | 'DISCARD_TILE' | 'PASS_REACTION'
  | 'CALL_CHI' | 'CALL_PON' | 'CALL_KAN_OPEN' | 'CALL_KAN_CLOSED' | 'CALL_KAN_ADDED'
  | 'DECLARE_RIICHI' | 'DECLARE_WIN_RON' | 'DECLARE_WIN_TSUMO'
  | 'DECLARE_FLOWER' | 'ACK_ROUND_RESULT';
```

**`DECLARE_RIICHI` is included in the action contract for forward compatibility, but Riichi declaration is NOT enabled in Phase 1 gameplay, UI, or validation.** It will not appear as a legal action, will not be validated, and will not be shown in the Phase 1 interface. Phase 1 is a reduced Riichi-flavored vertical slice with partial rules/scoring coverage.

```typescript
interface ActionPayload {
  type: ActionType;
  playerId: string;
  roomId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface ActionContext {
  phase: GamePhase;
  preset: RulesPreset;
  playerSeat: number;
  activeSeat: number;
  hand: Hand;
  wall: Wall;
  rivers: River[];
  melds: Meld[];
}
```

Each action has a validator function in `game-core`:
```typescript
interface ActionValidator {
  canIssue(ctx: ActionContext, payload: ActionPayload): boolean;
  validate(ctx: ActionContext, payload: ActionPayload): ValidationResult;
  apply(ctx: ActionContext, payload: ActionPayload): GameStateDelta;
  legalActionsFor(ctx: ActionContext, seatIndex: number): ActionType[];
}
```

## 6. Reaction Priority System

After a discard, the server:
1. Determines which players have potential reactions (ron, pon, kan, chi)
2. Sends reaction prompts to eligible players (without revealing who else was prompted)
3. Collects responses within a configurable window
4. Resolves by priority order defined in the preset
5. If highest-priority claim exists, apply it
6. Otherwise, check next priority, etc.
7. If all pass, continue to next turn

```typescript
interface ReactionState {
  reactionId: string;         // unique per reaction instance — clients must echo this
  discardSeat: number;
  discardTile: TileDef;
  eligibleSeats: number[];    // who CAN react (hidden from clients)
  responses: Record<number, ReactionResponse | null>;  // null = not yet responded
  deadline: number;           // timestamp
  resolved: boolean;
  createdAt: number;
}

type ReactionResponse = 
  | { type: 'pass' }
  | { type: 'ron' }
  | { type: 'pon' }
  | { type: 'kan-open' }
  | { type: 'chi'; tiles: [number, number] };
```

**Stale-response safety:**
- Clients must include the `reactionId` when responding.
- Late responses for an old `reactionId` are silently ignored.
- On reaction timeout, all unresponded seats auto-pass (Phase 1 behavior).
- The server is the only arbiter of resolution order and outcome.

## 7. Seat Ownership & Reconnection Security

### Seat Claim Model

```typescript
interface SeatClaim {
  seatIndex: number;
  playerId: string;                // stable identity within the room
  reconnectSecretHash: string;     // server-only — never sent to clients
  claimedAt: number;
}
```

`SeatClaim` lives in `ServerMatchState.seatClaims`. It is server-only. `reconnectSecretHash` is never included in any client projection.

**Rules:**
- Seat ownership is identity-based (`playerId`), not name-based. Display names are cosmetic only.
- On room join, the server issues a `reconnectSecret` to the client. The server stores only the hash.
- Reconnection requires a valid `reconnectSecret` — not a player name or session ID alone.
- If practical, the secret rotates after a successful reconnect to prevent replay.
- `playerId` is stable within the room lifetime. It does not change on reconnect.
- No seat theft is possible: a reconnect can only reclaim the seat bound to that `playerId`.

### Disconnect Policies

| Scenario | Behavior |
|----------|----------|
| Host disconnects in lobby | Automatic host transfer to the longest-connected seated player. Room survives. |
| Host disconnects mid-game | Host role transfers. Game continues. Host controls are available to new host between hands only. |
| Active player disconnects during their turn | Game pauses. A reconnect window opens (configurable duration). If reconnect fails before timeout, the server auto-discards the most recently drawn tile (tsumogiri). Play continues. |
| Non-active player disconnects during reaction window | Seat marked disconnected. Reaction timeout = auto-pass for that seat. Game continues. |
| Non-active player disconnects (not in reaction) | Seat marked disconnected. Game continues. Reconnect window opens. |
| All players disconnect | Room enters grace period. If no one reconnects within the period, room closes. |

### Room Expiration

- Rooms expire after 2 hours of inactivity in lobby, or 30 minutes after all players disconnect mid-game.
- These durations are configurable server-side.
- Room code registry is cleaned up on expiration.

## 8. Scoring Architecture

Separate concerns:
1. **Hand Validator** — checks if a hand is a valid winning shape (4 melds + pair, or seven pairs, etc.)
2. **Pattern Evaluator** — identifies yaku/fan/patterns in the hand
3. **Score Calculator** — converts patterns to han/fu, then to point value per the preset's scoring model
4. **Settlement** — determines point transfers between players
5. **Result Renderer** — produces structured explanation for the UI

```typescript
interface HandResult {
  winner: number;
  winType: 'ron' | 'tsumo';
  losingSeat?: number;
  hand: TileDef[];
  melds: Meld[];
  patterns: PatternMatch[];
  han: number;
  fu: number;
  score: ScoreBreakdown;
  settlement: PointTransfer[];
}

interface PatternMatch {
  id: string;
  name: string;
  hanValue: number;
  description: string;
  contributingTiles: TileDef[];
}

interface ScoreBreakdown {
  base: number;
  han: number;
  fu: number;
  multiplier: number;
  total: number;
  steps: string[];
}

interface PointTransfer {
  from: number;
  to: number;
  amount: number;
  reason: string;
}
```

## 9. Design System

### Raw Palette Tokens

Light and dark raw tokens are scoped to their respective theme selectors. Raw tokens define the palette. Semantic tokens consume them.

The `--matte-*` scale exists in both light and dark themes and provides a neutral structural ladder for component depth, borders, and surfaces. In light mode, the matte ladder runs from near-white (950) to dark (100), supporting subtle component layering without introducing generic gray dashboard aesthetics — the warm `--c-*` tokens and semantic mappings keep the visual direction editorial and classic.

**Light (Classic) palette** — `[data-theme="light"]` or `:root` default:
```css
:root {
  --c-bg: #FAF7F2;
  --c-bg-raised: #F5F1EA;
  --c-text: #2B2926;
  --c-text-secondary: #6B665E;
  --c-text-muted: #9A958C;
  --c-accent: #B85C3A;
  --c-accent-hover: #9A4A2E;
  --c-border: #E3DDD3;
  --c-rule: #D9D2C8;

  --matte-950: #f5f5f7;
  --matte-900: #e8e8ed;
  --matte-800: #dcdcde;
  --matte-700: #d0d0d5;
  --matte-600: #c4c4ca;
  --matte-500: #a0a0a8;
  --matte-400: #6b6b75;
  --matte-300: #4a4a52;
  --matte-200: #2c2c30;
  --matte-100: #121214;
  --warm-accent: #B85C3A;
  --warm-accent-dim: #9A4A2E;
}
```

**Dark (Desktop) palette** — `.dark` or `[data-theme="dark"]`:
```css
.dark {
  --c-bg: #1C1B19;
  --c-bg-raised: #252320;
  --c-text: #E8E4DD;
  --c-text-secondary: #B0AAA0;
  --c-text-muted: #7A756E;
  --c-accent: #C97B5C;
  --c-accent-hover: #D49074;
  --c-border: #3A3630;
  --c-rule: #33302C;

  --matte-950: #0a0a0b;
  --matte-900: #121214;
  --matte-800: #1a1a1d;
  --matte-700: #232326;
  --matte-600: #2c2c30;
  --matte-500: #3a3a40;
  --matte-400: #6b6b75;
  --matte-300: #9e9ea8;
  --matte-200: #d1d1d6;
  --matte-100: #f5f5f7;
  --warm-accent: #c4a574;
  --warm-accent-dim: #8a7455;
}
```

### Semantic Tokens

Components consume semantic tokens, not raw palette values. Semantic tokens map to palette values per theme.

```css
:root {
  /* Surfaces */
  --surface-app: var(--c-bg);
  --surface-panel: var(--c-bg-raised);
  --surface-panel-raised: #ffffff;
  --surface-table: var(--matte-950);

  /* Text */
  --text-primary: var(--c-text);
  --text-secondary: var(--c-text-secondary);
  --text-muted: var(--c-text-muted);

  /* Accent */
  --accent-warm: var(--c-accent);
  --accent-warm-dim: var(--c-accent-hover);

  /* Borders & rules */
  --border-subtle: var(--c-border);
  --rule-subtle: var(--c-rule);

  /* Focus */
  --focus-ring: 0 0 0 2px rgba(184, 92, 58, 0.3);

  /* Tiles */
  --tile-face-bg: #F5F0E6;
  --tile-face-border: #D9D2C8;
  --tile-stroke: #2B2926;
  --tile-back-bg: var(--matte-700);

  /* Game-specific */
  --seat-active-ring: var(--warm-accent);
  --danger: #c45a5a;
  --success: #5a9e6e;
}

.dark {
  --surface-app: var(--matte-950);
  --surface-panel: var(--matte-900);
  --surface-panel-raised: var(--matte-800);
  --surface-table: var(--matte-950);

  --text-primary: var(--matte-200);
  --text-secondary: var(--matte-300);
  --text-muted: var(--matte-400);

  --accent-warm: var(--warm-accent);
  --accent-warm-dim: var(--warm-accent-dim);

  --border-subtle: rgba(58, 58, 64, 0.3);
  --rule-subtle: rgba(58, 58, 64, 0.2);

  --focus-ring: 0 0 0 2px rgba(196, 165, 116, 0.3);

  --tile-face-bg: #2a2825;
  --tile-face-border: #3a3630;
  --tile-stroke: #d1d1d6;
  --tile-back-bg: var(--matte-600);

  --seat-active-ring: var(--warm-accent);
  --danger: #c45a5a;
  --success: #5a9e6e;
}
```

**Rule:** Raw palette tokens define the color palette. Semantic tokens map palette to usage. Components consume semantic tokens only. This prevents raw-color sprawl and keeps light/dark themes consistent.

### Typography

- **Display**: `Newsreader` (Google Fonts) — elegant serif for major headings and section titles only.
- **Body/UI**: `Inter` — for all dense UI, controls, metadata, gameplay labels, timers, room code surfaces, and body copy.
- Serif must not appear in cramped gameplay microtext. It is reserved for spacious editorial moments.

### Tile SVG Language

- Consistent 2px stroke at 48px base
- Minimalist line-art, lots of negative space
- Man (characters): Systematized kanji numerals with clean strokes
- Pin (circles): Abstract concentric circles, not literal dots
- Sou (bamboo): Linear, elegant vertical lines
- Honor: Iconic, architectural symbols
- Warm ivory body in light mode, smoked slate body in dark mode

## 10. Client Architecture

### Screen Breakdown

1. **StartScreen** — Classic mode. Create/Join/Settings/Theme
2. **CreateRoomScreen** — Classic mode. Preset picker, name input, advanced settings accordion
3. **JoinRoomScreen** — Classic mode. Room code input, name input
4. **LobbyScreen** — Desktop mode. Room code display, seat map, ready states, rules summary
5. **GameScreen** — Desktop mode. Table layout with four seats, hand, rivers, melds, HUD
6. **ResultScreen** — Hybrid. Score breakdown, pattern list, continuation flow

### State Ownership

| State layer | Owner | Mutation rule |
|-------------|-------|---------------|
| Canonical game state | Server (Colyseus sync) | Client never mutates. Server is sole authority. |
| Legal actions / prompts | Server (sent via `PlayerViewState.legalActions`) | Client consumes, never recomputes rule logic. |
| Theme / preferences | React context | Client-side only. |
| Connection / session shell | React context | Client-side only. |
| Ephemeral UI state (hover, selection, animation) | Local component state | Client-side only, presentation only. |

**`useLegalActions()`** consumes server-provided legal actions. It does not recreate full rule logic client-side. Any client-side derived state is for presentation only — never for authority.

No client-side mutation or rules authority is allowed.

### Component Hierarchy

```
App
├── ThemeProvider
├── GameClient (Colyseus connection manager)
├── Router
│   ├── StartScreen
│   ├── CreateRoomScreen
│   ├── JoinRoomScreen
│   ├── LobbyScreen
│   ├── GameScreen
│   │   ├── TableLayout
│   │   │   ├── SeatPosition × 4
│   │   │   ├── HandArea (local player)
│   │   │   ├── RiverArea × 4
│   │   │   ├── MeldArea × 4
│   │   │   └── InfoBar (round/wind/dealer/wall)
│   │   ├── ActionPrompt (reactions, discards)
│   │   └── ResultOverlay
│   └── ResultScreen
```

## 11. Server Architecture

### Colyseus Room

```typescript
class MahjongRoom extends Room {
  // State schema (Colyseus @type decorators)
  // FSM controller
  // Action handler
  // Reaction collector
  // Timer management
}
```

The room delegates all game logic to `game-core`:
- Receives client messages → maps to ActionPayload
- Calls `validate()` from game-core
- If valid, calls `apply()` from game-core
- Broadcasts updated state (Colyseus handles delta sync)
- Projects state per-player before sending (see State Visibility Model)

### Room Code Generation

- 6-character uppercase alphanumeric (excluding ambiguous: 0/O, 1/I/L)
- In-memory map of code → room ID
- Collision checking
- Auto-cleanup of expired rooms

### Persistence Model (Phase 1)

- Single-process, in-memory room registry and active match state.
- Server restart ends all rooms. No recovery.
- Persistence (Redis, database) is a Phase 2 enhancement.
- Code should be structured so a persistence layer can be swapped in later without changing game-core — only the server's room registry and state storage would change.

## 12. Folder Structure (Detailed)

```
/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── StartScreen.tsx
│   │   │   │   ├── CreateRoomScreen.tsx
│   │   │   │   ├── JoinRoomScreen.tsx
│   │   │   │   ├── LobbyScreen.tsx
│   │   │   │   ├── GameScreen.tsx
│   │   │   │   └── ResultScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── table/
│   │   │   │   │   ├── TableLayout.tsx
│   │   │   │   │   ├── SeatPosition.tsx
│   │   │   │   │   ├── HandArea.tsx
│   │   │   │   │   ├── RiverArea.tsx
│   │   │   │   │   ├── MeldArea.tsx
│   │   │   │   │   └── InfoBar.tsx
│   │   │   │   ├── lobby/
│   │   │   │   │   ├── SeatMap.tsx
│   │   │   │   │   ├── PlayerList.tsx
│   │   │   │   │   └── RulesSummary.tsx
│   │   │   │   ├── actions/
│   │   │   │   │   └── ActionPrompt.tsx
│   │   │   │   └── common/
│   │   │   │       ├── Button.tsx
│   │   │   │       ├── Input.tsx
│   │   │   │       ├── Modal.tsx
│   │   │   │       └── ThemeToggle.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useGameClient.ts
│   │   │   │   ├── useTheme.ts
│   │   │   │   └── useLegalActions.ts
│   │   │   ├── lib/
│   │   │   │   ├── colyseus.ts
│   │   │   │   └── theme.ts
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── server/
│       ├── src/
│       │   ├── rooms/
│       │   │   ├── MahjongRoom.ts
│       │   │   └── schema/
│       │   │       └── GameState.ts
│       │   ├── services/
│       │   │   └── RoomCodeService.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── game-core/
│   │   ├── src/
│   │   │   ├── models/
│   │   │   │   ├── tile.ts
│   │   │   │   ├── hand.ts
│   │   │   │   ├── meld.ts
│   │   │   │   ├── wall.ts
│   │   │   │   ├── river.ts
│   │   │   │   └── player.ts
│   │   │   ├── engine/
│   │   │   │   ├── fsm.ts
│   │   │   │   ├── actions.ts
│   │   │   │   ├── validators.ts
│   │   │   │   └── reaction.ts
│   │   │   ├── rules/
│   │   │   │   ├── preset.ts
│   │   │   │   ├── riichi.ts
│   │   │   │   ├── hongkong.ts
│   │   │   │   └── custom.ts
│   │   │   ├── scoring/
│   │   │   │   ├── validator.ts
│   │   │   │   ├── evaluator.ts
│   │   │   │   ├── calculator.ts
│   │   │   │   └── settlement.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── hand-validation.test.ts
│   │   │   ├── scoring.test.ts
│   │   │   ├── fsm.test.ts
│   │   │   ├── actions.test.ts
│   │   │   └── reaction.test.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── ui/
│       ├── src/
│       │   ├── tokens/
│       │   │   ├── colors.ts
│       │   │   ├── spacing.ts
│       │   │   ├── typography.ts
│       │   │   └── motion.ts
│       │   ├── tiles/
│       │   │   ├── TileSVG.tsx
│   │   │   │   ├── ManTiles.tsx
│       │   │   │   ├── PinTiles.tsx
│       │   │   │   ├── SouTiles.tsx
│       │   │   │   ├── HonorTiles.tsx
│       │   │   │   └── TileBack.tsx
│       │   ├── components/
│       │   │   └── ... (shared UI components)
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

## 13. Build Strategy: Phase 1 Scope

### Phase 1 — Honest Vertical Slice

A reduced Riichi-flavored vertical slice with architecture extensible for full coverage later. The preset is named "Riichi" but scoring/rules coverage is intentionally partial.

**`DECLARE_RIICHI` is NOT enabled in Phase 1 gameplay, UI, or validation.** The action type exists in the contract for forward compatibility, but riichi declaration is not wired, not legal, and not offered to players in Phase 1. No riichi button, no riichi deposit, no furiten, no ippatsu, no ura-dora. These are all Phase 2. Phase 1 players play draw/discard mahjong with meld calls and basic win resolution.

**In scope:**
- Full monorepo scaffold
- Design system with semantic tokens, themes, SVG tile language
- Room creation / join / lobby / seat selection / ready flow
- One working multiplayer 4-player round loop
- Deal / draw / discard / basic melds (chi, pon, kan)
- Reaction window with server-mediated resolution
- Basic win resolution (ron, tsumo)
- Deterministic seeded walls
- Dora indicators (face-up only, no ura-dora)
- Reduced scoring: a limited yaku set covering the most common patterns (e.g. all simples, tanyao, honor pairs, triples, straight, mixed/true chii, pinfu, toitoi, etc.)
- Result display with score breakdown
- Light/dark theme
- Explicit in-memory server lifecycle
- Tests for game-core core flows (hand validation, scoring, FSM, actions, reactions)

**Explicitly deferred to Phase 2:**
- Riichi declaration gameplay (`DECLARE_RIICHI` not wired, not legal, not shown in Phase 1 UI)
- Furiten tracking
- Ippatsu
- Ura-dora
- Rinshan (replacement draw after kan) and chankan edge cases
- Abortive draw rules (four riichi, four wind, nine terminals, etc.)
- Complete exhaustive draw handling (nagashi mangan, etc.)
- Advanced yaku coverage (kokushi, chuuren, suuankou, etc.)
- Hong Kong preset implementation
- Custom preset editor
- Spectator mode
- Reconnect polish (basic reconnect architecture exists; full UX flow is Phase 2)
- Timer enforcement
- Mobile-optimized layout
- Persistence
- Replay viewer

The Phase 1 goal is a truthful vertical slice, not fake completeness.

### Phase 2 — Extended Features

- Full Riichi scoring coverage and rule enforcement, including wiring `DECLARE_RIICHI`
- Hong Kong preset with dedicated evaluator
- Custom preset editor UI
- Spectator mode
- Reconnect polish and timeout UX
- Timer enforcement
- Mobile-optimized layout
- Persistence layer
- Replay viewer
- Deeper rules edge cases

## 14. Key Technical Decisions

1. **Colyseus 0.16** with schema-based state sync — server is authority, clients receive deltas
2. **CSS variables + Tailwind hybrid** — semantic tokens in CSS custom properties, Tailwind for layout/spacing only, never for color/typography directly
3. **game-core is pure** — no React, no Colyseus, no Node.js APIs. Just TypeScript with types and functions.
4. **FSM is explicit** — every state transition is a typed function call, not ad-hoc mutations
5. **Reaction window is server-mediated** — clients never know who else was prompted, only that "the table is waiting"
6. **Reaction IDs prevent stale responses** — every reaction instance has a unique ID; late or mismatched responses are ignored
7. **Deterministic walls from seed** — all wall behavior derives from a server-generated seed for debuggability and replay
8. **Tile rendering is SVG component library** — each tile face is a React SVG component using shared stroke/fill tokens
9. **Room codes are 6-char** — uppercase alphanumeric excluding O/0/I/1/L to avoid ambiguity
10. **Seat ownership is identity-based** — reconnect requires a secret token stored server-side only, never sent to clients. Display names are cosmetic.
11. **In-memory Phase 1** — single-process, no persistence. Structured so persistence can be added later.
12. **Semantic tokens only** — components consume semantic tokens, never raw palette values.

## 15. How to Extend Later

- **New ruleset**: Create a new preset config + optional evaluator module. Register in PRESETS map. UI auto-generates from config.
- **Spectator mode**: SpectatorState already exists in the state model. Colyseus room supports multiple client types. Add spectator connection handling and SpectatorViewState projection.
- **Reconnection**: SeatClaim exists in server-only state. Add reconnect UX flow and timeout handling in Phase 2.
- **3-player mode**: `preset.playerCount = 3`. Wall and seat logic parameterized on player count.
- **Persistence**: Swap in-memory room registry for Redis/database adapter. game-core is unaffected — only server-side storage changes.
- **Full Riichi**: Wire `DECLARE_RIICHI` action, add furiten tracking, ura-dora, ippatsu, abortive draws, exhaustive draw handling, and advanced yaku to the evaluator.
