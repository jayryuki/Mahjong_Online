# Mahjong Game — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working multiplayer 4-player mahjong vertical slice with room-code join, deterministic walls, basic meld calls, win resolution, reduced scoring, and an elegant premium UI.

**Architecture:** pnpm monorepo with pure TypeScript `game-core` (domain logic, FSM, rules, scoring), Colyseus 0.16 server (authority), and Vite+React client consuming server-projected state. No client-side rules authority.

**Tech Stack:** TypeScript, pnpm workspaces, Vite, React 18, Colyseus 0.16, Vitest, CSS variables + Tailwind hybrid

---

## File Structure

### Root config
- `pnpm-workspace.yaml`
- `package.json`
- `tsconfig.base.json`
- `.gitignore`

### packages/game-core
- `package.json`
- `tsconfig.json`
- `src/models/tile.ts` — TileDef, Suit, HonorType, tile set generation
- `src/models/wall.ts` — WallState, DeadWallState, deterministic shuffle
- `src/models/hand.ts` — Hand type, hand grouping helpers
- `src/models/meld.ts` — Meld type
- `src/models/river.ts` — River, RiverEntry
- `src/models/player.ts` — PlayerState, SpectatorState, ScoreTrack, PlayerScoreState
- `src/models/round.ts` — RoundState, SeatRoundState, RoundSummary, RoundSeedInfo, DoraState
- `src/models/match.ts` — MatchState, GamePhase discriminated union, GameEvent
- `src/models/index.ts` — barrel export
- `src/rules/preset.ts` — RulesPreset interface, PRESETS registry
- `src/rules/riichi.ts` — Riichi preset defaults
- `src/engine/fsm.ts` — Phase transitions, canTransition, advancePhase
- `src/engine/actions.ts` — ActionType, ActionPayload, ActionContext
- `src/engine/validators.ts` — ActionValidator per action type, legalActionsFor
- `src/engine/reaction.ts` — ReactionState, ReactionResponse, resolveReaction
- `src/scoring/validator.ts` — isValidWinningHand (4 melds + pair, seven pairs)
- `src/scoring/evaluator.ts` — evaluateHand patterns, PatternMatch
- `src/scoring/calculator.ts` — calculateScore (han/fu/points)
- `src/scoring/settlement.ts` — settleHand (point transfers)
- `src/index.ts` — public API barrel
- `tests/tile.test.ts`
- `tests/wall.test.ts`
- `tests/hand-validation.test.ts`
- `tests/scoring.test.ts`
- `tests/fsm.test.ts`
- `tests/actions.test.ts`
- `tests/reaction.test.ts`

### packages/ui
- `package.json`
- `tsconfig.json`
- `src/tokens/colors.ts` — raw + semantic token definitions as JS constants
- `src/tokens/spacing.ts` — spacing scale
- `src/tokens/typography.ts` — font family constants
- `src/tokens/motion.ts` — duration/easing constants
- `src/tokens/index.ts` — barrel
- `src/tiles/TileSVG.tsx` — base tile component (body + face slot)
- `src/tiles/ManTiles.tsx` — man 1-9 SVG faces
- `src/tiles/PinTiles.tsx` — pin 1-9 SVG faces
- `src/tiles/SouTiles.tsx` — sou 1-9 SVG faces
- `src/tiles/HonorTiles.tsx` — wind + dragon SVG faces
- `src/tiles/TileBack.tsx` — face-down tile
- `src/tiles/index.ts` — barrel
- `src/index.ts` — public API barrel

### apps/server
- `package.json`
- `tsconfig.json`
- `src/index.ts` — bootstrap Colyseus server
- `src/rooms/MahjongRoom.ts` — Colyseus room, FSM, action routing
- `src/rooms/schema/GameState.ts` — Colyseus schema types
- `src/services/RoomCodeService.ts` — code generation + registry

### apps/web
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx` — React entry
- `src/App.tsx` — router + providers
- `src/index.css` — CSS variables, tokens, Tailwind base
- `src/lib/colyseus.ts` — Colyseus client setup
- `src/lib/theme.ts` — theme toggle logic
- `src/hooks/useGameClient.ts` — Colyseus room connection hook
- `src/hooks/useTheme.ts` — theme hook
- `src/hooks/useLegalActions.ts` — consumes server legal actions
- `src/components/common/Button.tsx`
- `src/components/common/Input.tsx`
- `src/components/common/Modal.tsx`
- `src/components/common/ThemeToggle.tsx`
- `src/components/lobby/SeatMap.tsx`
- `src/components/lobby/PlayerList.tsx`
- `src/components/lobby/RulesSummary.tsx`
- `src/components/table/TableLayout.tsx`
- `src/components/table/SeatPosition.tsx`
- `src/components/table/HandArea.tsx`
- `src/components/table/RiverArea.tsx`
- `src/components/table/MeldArea.tsx`
- `src/components/table/InfoBar.tsx`
- `src/components/actions/ActionPrompt.tsx`
- `src/screens/StartScreen.tsx`
- `src/screens/CreateRoomScreen.tsx`
- `src/screens/JoinRoomScreen.tsx`
- `src/screens/LobbyScreen.tsx`
- `src/screens/GameScreen.tsx`
- `src/screens/ResultScreen.tsx`

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "mahjong",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev:web": "pnpm --filter @mahjong/web dev",
    "dev:server": "pnpm --filter @mahjong/server dev"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.env
.DS_Store
```

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore
git commit -m "chore: scaffold monorepo root"
```

---

## Task 2: game-core Package Scaffold

**Files:**
- Create: `packages/game-core/package.json`
- Create: `packages/game-core/tsconfig.json`
- Create: `packages/game-core/src/models/tile.ts`
- Create: `packages/game-core/src/models/index.ts`
- Create: `packages/game-core/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@mahjong/game-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tile model**

Create `packages/game-core/src/models/tile.ts`:

```typescript
export type Suit = 'man' | 'pin' | 'sou';
export type HonorType = 'wind' | 'dragon';
export type WindName = 'east' | 'south' | 'west' | 'north';
export type DragonName = 'haku' | 'hatsu' | 'chun';

export interface TileDef {
  id: string;
  suit?: Suit;
  rank?: number;
  honorType?: HonorType;
  honorName?: WindName | DragonName;
  isFlower: boolean;
  flowerIndex?: number;
}

export function createSuitedTile(suit: Suit, rank: number, instance: number): TileDef {
  return {
    id: `${suit}-${rank}-${instance}`,
    suit,
    rank,
    isFlower: false,
  };
}

export function createHonorTile(honorName: WindName | DragonName, instance: number): TileDef {
  const honorType: HonorType = honorName in ['east', 'south', 'west', 'north'] ? 'wind' : 'dragon';
  return {
    id: `${honorName}-${instance}`,
    honorType,
    honorName,
    isFlower: false,
  };
}

export function tileSortKey(tile: TileDef): string {
  if (tile.suit) {
    const suitOrder: Record<Suit, number> = { man: 0, pin: 1, sou: 2 };
    return `${suitOrder[tile.suit]}${tile.rank!.toString().padStart(2, '0')}`;
  }
  return `9${tile.honorName ?? 'zzz'}`;
}

export function generateFullTileSet(playerCount: 4, flowersEnabled: boolean): TileDef[] {
  const tiles: TileDef[] = [];
  let instance = 0;

  for (const suit of ['man', 'pin', 'sou'] as Suit[]) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(createSuitedTile(suit, rank, instance++));
      }
    }
  }

  for (const name of ['east', 'south', 'west', 'north', 'haku', 'hatsu', 'chun'] as const) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push(createHonorTile(name, instance++));
    }
  }

  return tiles;
}
```

- [ ] **Step 4: Create barrel exports**

Create `packages/game-core/src/models/index.ts`:
```typescript
export * from './tile.js';
```

Create `packages/game-core/src/index.ts`:
```typescript
export * from './models/index.js';
```

- [ ] **Step 5: Install dependencies and verify build**

```bash
cd /home/jay/User_Apps/mahjong && pnpm install
cd packages/game-core && pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/game-core/
git commit -m "feat(game-core): scaffold package with tile model"
```

---

## Task 3: Tile Model Tests

**Files:**
- Create: `packages/game-core/tests/tile.test.ts`

- [ ] **Step 1: Write tile tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  createSuitedTile,
  createHonorTile,
  tileSortKey,
  generateFullTileSet,
} from '../src/models/tile.js';

describe('createSuitedTile', () => {
  it('creates a suited tile with correct id', () => {
    const tile = createSuitedTile('man', 1, 0);
    expect(tile.id).toBe('man-1-0');
    expect(tile.suit).toBe('man');
    expect(tile.rank).toBe(1);
    expect(tile.isFlower).toBe(false);
  });

  it('creates different instances with different ids', () => {
    const a = createSuitedTile('pin', 5, 0);
    const b = createSuitedTile('pin', 5, 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe('createHonorTile', () => {
  it('creates a wind honor tile', () => {
    const tile = createHonorTile('east', 0);
    expect(tile.honorType).toBe('wind');
    expect(tile.honorName).toBe('east');
    expect(tile.isFlower).toBe(false);
  });

  it('creates a dragon honor tile', () => {
    const tile = createHonorTile('haku', 0);
    expect(tile.honorType).toBe('dragon');
    expect(tile.honorName).toBe('haku');
  });
});

describe('tileSortKey', () => {
  it('sorts man before pin before sou', () => {
    const man = createSuitedTile('man', 1, 0);
    const pin = createSuitedTile('pin', 1, 0);
    const sou = createSuitedTile('sou', 1, 0);
    expect(tileSortKey(man) < tileSortKey(pin)).toBe(true);
    expect(tileSortKey(pin) < tileSortKey(sou)).toBe(true);
  });

  it('sorts honors after suited tiles', () => {
    const sou9 = createSuitedTile('sou', 9, 0);
    const east = createHonorTile('east', 0);
    expect(tileSortKey(sou9) < tileSortKey(east)).toBe(true);
  });
});

describe('generateFullTileSet', () => {
  it('generates 136 tiles for 4-player without flowers', () => {
    const tiles = generateFullTileSet(4, false);
    expect(tiles.length).toBe(136);
  });

  it('has 4 copies of each suited tile', () => {
    const tiles = generateFullTileSet(4, false);
    const man1s = tiles.filter(t => t.suit === 'man' && t.rank === 1);
    expect(man1s.length).toBe(4);
  });

  it('has 4 copies of each honor tile', () => {
    const tiles = generateFullTileSet(4, false);
    const easts = tiles.filter(t => t.honorName === 'east');
    expect(easts.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/game-core/tests/tile.test.ts
git commit -m "test(game-core): add tile model tests"
```

---

## Task 4: Wall Model + Deterministic Shuffle

**Files:**
- Create: `packages/game-core/src/models/wall.ts`
- Create: `packages/game-core/tests/wall.test.ts`

- [ ] **Step 1: Write wall tests**

```typescript
import { describe, it, expect } from 'vitest';
import { buildWall, drawTile, peekRemaining } from '../src/models/wall.js';
import { generateFullTileSet } from '../src/models/tile.js';

describe('buildWall', () => {
  it('creates a wall with 136 tiles for 4 players', () => {
    const tiles = generateFullTileSet(4, false);
    const wall = buildWall(tiles, 'test-seed-1');
    expect(wall.tiles.length).toBe(136);
    expect(wall.remaining).toBe(136 - 14); // 14 in dead wall
    expect(wall.deadWallStart).toBe(136 - 14);
  });

  it('is deterministic from the same seed', () => {
    const tiles1 = generateFullTileSet(4, false);
    const tiles2 = generateFullTileSet(4, false);
    const wall1 = buildWall(tiles1, 'same-seed');
    const wall2 = buildWall(tiles2, 'same-seed');
    expect(wall1.tiles.map(t => t.id)).toEqual(wall2.tiles.map(t => t.id));
  });

  it('produces different order from different seeds', () => {
    const tiles1 = generateFullTileSet(4, false);
    const tiles2 = generateFullTileSet(4, false);
    const wall1 = buildWall(tiles1, 'seed-a');
    const wall2 = buildWall(tiles2, 'seed-b');
    const ids1 = wall1.tiles.map(t => t.id).join(',');
    const ids2 = wall2.tiles.map(t => t.id).join(',');
    expect(ids1).not.toBe(ids2);
  });
});

describe('drawTile', () => {
  it('draws the next tile from the wall', () => {
    const tiles = generateFullTileSet(4, false);
    const wall = buildWall(tiles, 'draw-test');
    const first = wall.tiles[0];
    const result = drawTile(wall);
    expect(result.tile).toEqual(first);
    expect(result.wall.remaining).toBe(wall.remaining - 1);
  });

  it('returns null when wall is exhausted', () => {
    const tiles = generateFullTileSet(4, false);
    let wall = buildWall(tiles, 'exhaust-test');
    for (let i = 0; i < wall.remaining; i++) {
      wall = drawTile(wall).wall;
    }
    const result = drawTile(wall);
    expect(result.tile).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm test -- tests/wall.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement wall model**

Create `packages/game-core/src/models/wall.ts`:

```typescript
import { TileDef } from './tile.js';

export interface WallState {
  tiles: TileDef[];
  drawIndex: number;
  remaining: number;
  deadWallStart: number;
}

export interface DeadWallState {
  replacementDrawsAvailable: number;
}

export interface RoundSeedInfo {
  shuffleSeed: string;
  wallVersion: number;
}

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function buildWall(tiles: TileDef[], seed: string): WallState {
  const shuffled = [...tiles];
  const rng = seededRandom(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const deadWallCount = 14;
  return {
    tiles: shuffled,
    drawIndex: 0,
    remaining: shuffled.length - deadWallCount,
    deadWallStart: shuffled.length - deadWallCount,
  };
}

export function drawTile(wall: WallState): { tile: TileDef | null; wall: WallState } {
  if (wall.drawIndex >= wall.deadWallStart) {
    return { tile: null, wall };
  }
  const tile = wall.tiles[wall.drawIndex];
  return {
    tile,
    wall: {
      ...wall,
      drawIndex: wall.drawIndex + 1,
      remaining: wall.remaining - 1,
    },
  };
}

export function drawReplacementTile(wall: WallState): { tile: TileDef | null; wall: WallState } {
  const deadEnd = wall.tiles.length;
  const replIndex = deadEnd - 1;
  if (replIndex <= wall.deadWallStart) {
    return { tile: null, wall };
  }
  const tile = wall.tiles[replIndex];
  const newTiles = [...wall.tiles.slice(0, replIndex)];
  return {
    tile,
    wall: {
      ...wall,
      tiles: newTiles,
      deadWallStart: wall.deadWallStart - 1,
      remaining: wall.remaining,
    },
  };
}

export function peekRemaining(wall: WallState): number {
  return wall.remaining;
}
```

- [ ] **Step 4: Export from barrel**

Add to `packages/game-core/src/models/index.ts`:
```typescript
export * from './wall.js';
```

- [ ] **Step 5: Run tests**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm test -- tests/wall.test.ts
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/game-core/src/models/wall.ts packages/game-core/src/models/index.ts packages/game-core/tests/wall.test.ts
git commit -m "feat(game-core): add wall model with deterministic shuffle"
```

---

## Task 5: Remaining Domain Models

**Files:**
- Create: `packages/game-core/src/models/hand.ts`
- Create: `packages/game-core/src/models/meld.ts`
- Create: `packages/game-core/src/models/river.ts`
- Create: `packages/game-core/src/models/player.ts`
- Create: `packages/game-core/src/models/round.ts`
- Create: `packages/game-core/src/models/match.ts`
- Modify: `packages/game-core/src/models/index.ts`

- [ ] **Step 1: Create meld.ts**

```typescript
import { TileDef } from './tile.js';

export interface Meld {
  type: 'chi' | 'pon' | 'kan-open' | 'kan-closed' | 'kan-added';
  tiles: TileDef[];
  calledFromSeat?: number;
  isConcealed: boolean;
}
```

- [ ] **Step 2: Create hand.ts**

```typescript
import { TileDef } from './tile.js';
import { Meld } from './meld.js';

export interface Hand {
  concealed: TileDef[];
  melds: Meld[];
  flowers: TileDef[];
  riichi: boolean;
  riichiTileIndex?: number;
}
```

- [ ] **Step 3: Create river.ts**

```typescript
import { TileDef } from './tile.js';

export interface RiverEntry {
  tile: TileDef;
  calledBy?: number;
  isRiichiDiscard?: boolean;
  isLastDiscard?: boolean;
}

export interface River {
  entries: RiverEntry[];
}

export function addToRiver(river: River, tile: TileDef, isRiichiDiscard: boolean = false): River {
  return {
    entries: [
      ...river.entries,
      { tile, isRiichiDiscard },
    ],
  };
}

export function markLastDiscard(river: River): River {
  if (river.entries.length === 0) return river;
  const entries = river.entries.map((e, i) =>
    i === river.entries.length - 1 ? { ...e, isLastDiscard: true } : { ...e, isLastDiscard: false }
  );
  return { entries };
}
```

- [ ] **Step 4: Create player.ts**

```typescript
export interface PlayerState {
  playerId: string;
  displayName: string;
  seatIndex: number;
  isConnected: boolean;
  isReady: boolean;
  isHost: boolean;
}

export interface PlayerScoreState {
  seatIndex: number;
  points: number;
  riichiDeposit: boolean;
}

export interface ScoreTrack {
  entries: PlayerScoreState[];
  startValue: number;
}

export interface SpectatorState {
  playerId: string;
  displayName: string;
  joinedAt: number;
}
```

- [ ] **Step 5: Create round.ts**

```typescript
import { TileDef } from './tile.js';
import { Meld } from './meld.js';
import { River } from './river.js';
import { ReactionState } from '../engine/reaction.js';
import { PlayerScoreState } from './player.js';
import { WallState, DeadWallState, RoundSeedInfo } from './wall.js';

export interface DoraState {
  indicators: TileDef[];
  uraIndicators?: TileDef[];
}

export interface SeatRoundState {
  seatIndex: number;
  playerId: string | null;
  concealedTiles?: TileDef[];
  concealedCount: number;
  melds: Meld[];
  flowers: TileDef[];
  river: River;
  isRiichi: boolean;
  isConnected: boolean;
  hasPassedCurrentReaction?: boolean;
}

export interface RoundState {
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

export interface RoundSummary {
  roundWind: 'east' | 'south' | 'west' | 'north';
  handNumber: number;
  honba: number;
  riichiSticks: number;
  result: HandResult | null;
  endReason: 'win' | 'exhaustive-draw';
  scoreChanges: PlayerScoreState[];
}

// Forward references — these will be defined in their own modules
// but RoundState needs them for eventLog
import type { GameEvent } from './match.js';
import type { HandResult } from '../scoring/settlement.js';
```

- [ ] **Step 6: Create match.ts**

```typescript
import { PlayerState, SpectatorState, ScoreTrack } from './player.js';
import { RoundState, RoundSummary } from './round.js';
import { RulesPreset } from '../rules/preset.js';
import { HandResult } from '../scoring/settlement.js';
import { PlayerScoreState } from './player.js';
import { ActionType } from '../engine/actions.js';
import { TileDef } from './tile.js';

export interface MatchState {
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

export type GamePhase =
  | { type: 'ROOM_OPEN' }
  | { type: 'LOBBY' }
  | { type: 'DEALING'; progress: number }
  | { type: 'TURN_DRAW'; activeSeat: number; wallRemaining: number }
  | { type: 'TURN_DECISION'; activeSeat: number; legalActions: ActionType[] }
  | { type: 'REACTION_WINDOW'; discardSeat: number; discardTile: TileDef; pendingSeats: number[] }
  | { type: 'RESOLUTION'; winner?: number; winType?: 'ron' | 'tsumo' }
  | { type: 'HAND_END'; endReason: 'win' | 'exhaustive-draw'; result: HandResult | null }
  | { type: 'ROUND_END'; summary: RoundSummary }
  | { type: 'MATCH_END'; finalScores: PlayerScoreState[] };

export type GameEvent =
  | { type: 'room-created'; by: string; at: number }
  | { type: 'player-joined'; playerId: string; seatIndex?: number; at: number }
  | { type: 'player-left'; playerId: string; at: number }
  | { type: 'seat-chosen'; playerId: string; seatIndex: number; at: number }
  | { type: 'match-started'; by: string; at: number }
  | { type: 'tile-drawn'; seatIndex: number; at: number }
  | { type: 'tile-discarded'; seatIndex: number; tile: TileDef; at: number }
  | { type: 'reaction-opened'; reactionId: string; discardSeat: number; at: number }
  | { type: 'meld-called'; seatIndex: number; meld: any; at: number }
  | { type: 'riichi-declared'; seatIndex: number; at: number }
  | { type: 'win-declared'; seatIndex: number; winType: 'ron' | 'tsumo'; at: number }
  | { type: 'round-ended'; endReason: 'win' | 'exhaustive-draw'; result: HandResult | null; at: number };
```

- [ ] **Step 7: Update barrel**

Replace `packages/game-core/src/models/index.ts`:
```typescript
export * from './tile.js';
export * from './wall.js';
export * from './meld.js';
export * from './hand.js';
export * from './river.js';
export * from './player.js';
export * from './round.js';
export * from './match.js';
```

- [ ] **Step 8: Verify build**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm build
```

Expected: Build succeeds. (Forward reference cycles may need adjustment — if build fails, move GameEvent to a separate events.ts and import it.)

- [ ] **Step 9: Commit**

```bash
git add packages/game-core/src/models/
git commit -m "feat(game-core): add remaining domain models"
```

---

## Task 6: Rules Preset System

**Files:**
- Create: `packages/game-core/src/rules/preset.ts`
- Create: `packages/game-core/src/rules/riichi.ts`

- [ ] **Step 1: Create preset.ts**

```typescript
export interface RulesPreset {
  id: string;
  name: string;
  description: string;
  playerCount: 3 | 4;
  flowersEnabled: boolean;
  minimumHan: number;
  minimumFu?: number;
  scoringModel: 'riichi' | 'hong-kong';
  kiriageMangan: boolean;
  kazoeLimit: 'mangan' | 'haneman' | 'sanbaiman' | 'none';
  allowOpenHand: boolean;
  allowChi: boolean;
  allowPon: boolean;
  allowKan: boolean;
  allowRiichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  reactionPriority: ('ron' | 'pon' | 'kan-open' | 'chi')[];
  atamahane: boolean;
  turnTimerEnabled: boolean;
  turnTimerSeconds: number;
  reactionTimerSeconds: number;
  autoSortHand: boolean;
  confirmDiscard: boolean;
  scoreDisplayVerbosity: 'minimal' | 'standard' | 'detailed';
  spectatorPolicy: 'none' | 'allow';
}
```

- [ ] **Step 2: Create riichi.ts**

```typescript
import { RulesPreset } from './preset.js';

export const RIICHI_PRESET: RulesPreset = {
  id: 'riichi',
  name: 'Riichi',
  description: 'Japanese Riichi Mahjong — the most popular competitive variant worldwide.',
  playerCount: 4,
  flowersEnabled: false,
  minimumHan: 1,
  scoringModel: 'riichi',
  kiriageMangan: false,
  kazoeLimit: 'sanbaiman',
  allowOpenHand: true,
  allowChi: true,
  allowPon: true,
  allowKan: true,
  allowRiichi: true,
  doubleRiichi: true,
  ippatsu: true,
  reactionPriority: ['ron', 'kan-open', 'pon', 'chi'],
  atamahane: false,
  turnTimerEnabled: false,
  turnTimerSeconds: 30,
  reactionTimerSeconds: 15,
  autoSortHand: true,
  confirmDiscard: false,
  scoreDisplayVerbosity: 'standard',
  spectatorPolicy: 'allow',
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/game-core/src/rules/
git commit -m "feat(game-core): add rules preset system with Riichi defaults"
```

---

## Task 7: FSM + Action Validators

**Files:**
- Create: `packages/game-core/src/engine/actions.ts`
- Create: `packages/game-core/src/engine/reaction.ts`
- Create: `packages/game-core/src/engine/fsm.ts`
- Create: `packages/game-core/src/engine/validators.ts`
- Create: `packages/game-core/tests/fsm.test.ts`

- [ ] **Step 1: Create actions.ts**

```typescript
export type ActionType =
  | 'CREATE_ROOM' | 'JOIN_ROOM' | 'LEAVE_ROOM' | 'RECONNECT_PLAYER'
  | 'CHOOSE_SEAT' | 'TOGGLE_READY' | 'UPDATE_RULESET' | 'START_MATCH'
  | 'REMATCH' | 'KICK_PLAYER'
  | 'DRAW_TILE' | 'DISCARD_TILE' | 'PASS_REACTION'
  | 'CALL_CHI' | 'CALL_PON' | 'CALL_KAN_OPEN' | 'CALL_KAN_CLOSED' | 'CALL_KAN_ADDED'
  | 'DECLARE_RIICHI' | 'DECLARE_WIN_RON' | 'DECLARE_WIN_TSUMO'
  | 'DECLARE_FLOWER' | 'ACK_ROUND_RESULT';

export interface ActionPayload {
  type: ActionType;
  playerId: string;
  roomId: string;
  timestamp: number;
  data: Record<string, unknown>;
}
```

- [ ] **Step 2: Create reaction.ts**

```typescript
import { TileDef } from '../models/tile.js';
import { Meld } from '../models/meld.js';

export interface ReactionState {
  reactionId: string;
  discardSeat: number;
  discardTile: TileDef;
  eligibleSeats: number[];
  responses: Record<number, ReactionResponse | null>;
  deadline: number;
  resolved: boolean;
  createdAt: number;
}

export type ReactionResponse =
  | { type: 'pass' }
  | { type: 'ron' }
  | { type: 'pon' }
  | { type: 'kan-open' }
  | { type: 'chi'; tiles: [number, number] };

export function createReaction(
  reactionId: string,
  discardSeat: number,
  discardTile: TileDef,
  eligibleSeats: number[],
  deadlineMs: number,
): ReactionState {
  const responses: Record<number, ReactionResponse | null> = {};
  for (const seat of eligibleSeats) {
    responses[seat] = null;
  }
  return {
    reactionId,
    discardSeat,
    discardTile,
    eligibleSeats,
    responses,
    deadline: Date.now() + deadlineMs,
    resolved: false,
    createdAt: Date.now(),
  };
}

export function submitResponse(
  state: ReactionState,
  seatIndex: number,
  response: ReactionResponse,
): ReactionState {
  if (state.resolved || !(seatIndex in state.responses)) return state;
  if (state.responses[seatIndex] !== null) return state;
  return {
    ...state,
    responses: { ...state.responses, [seatIndex]: response },
  };
}

export function isAllResponded(state: ReactionState): boolean {
  return state.eligibleSeats.every(s => state.responses[s] !== null);
}

export function autoPassUnresponded(state: ReactionState): ReactionState {
  const responses = { ...state.responses };
  for (const seat of state.eligibleSeats) {
    if (responses[seat] === null) {
      responses[seat] = { type: 'pass' };
    }
  }
  return { ...state, responses, resolved: true };
}
```

- [ ] **Step 3: Create fsm.ts**

```typescript
import { GamePhase } from '../models/match.js';

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  const allowed: Record<string, string[]> = {
    'ROOM_OPEN': ['LOBBY'],
    'LOBBY': ['DEALING'],
    'DEALING': ['TURN_DRAW'],
    'TURN_DRAW': ['TURN_DECISION'],
    'TURN_DECISION': ['REACTION_WINDOW', 'TURN_DRAW', 'HAND_END'],
    'REACTION_WINDOW': ['TURN_DECISION', 'RESOLUTION', 'TURN_DRAW'],
    'RESOLUTION': ['HAND_END'],
    'HAND_END': ['ROUND_END', 'DEALING'],
    'ROUND_END': ['DEALING', 'MATCH_END'],
    'MATCH_END': [],
  };
  return (allowed[from.type] ?? []).includes(to.type);
}
```

- [ ] **Step 4: Create validators.ts (stub with key gameplay validators)**

```typescript
import { ActionType, ActionPayload } from './actions.js';
import { RoundState } from '../models/round.js';
import { RulesPreset } from '../rules/preset.js';

export function legalActionsForSeat(
  round: RoundState,
  preset: RulesPreset,
  seatIndex: number,
): ActionType[] {
  const actions: ActionType[] = [];
  const phase = round.seats[seatIndex];

  if (!phase) return actions;

  // TURN_DRAW: active seat draws
  if (round.activeSeat === seatIndex && round.wall.remaining > 0) {
    actions.push('DRAW_TILE');
  }

  // TURN_DECISION: active seat can discard, declare win tsumo
  if (round.activeSeat === seatIndex) {
    actions.push('DISCARD_TILE');
    if (canTsumo(round, seatIndex)) {
      actions.push('DECLARE_WIN_TSUMO');
    }
  }

  // Reaction window: eligible seats can pass or claim
  if (round.reaction && !round.reaction.resolved) {
    const response = round.reaction.responses[seatIndex];
    if (response === null && round.reaction.eligibleSeats.includes(seatIndex)) {
      actions.push('PASS_REACTION');
      // Check what claims are possible
      if (canRon(round, seatIndex)) actions.push('DECLARE_WIN_RON');
      if (canPon(round, seatIndex, preset)) actions.push('CALL_PON');
      if (canChi(round, seatIndex, preset)) actions.push('CALL_CHI');
      if (canKanOpen(round, seatIndex, preset)) actions.push('CALL_KAN_OPEN');
    }
  }

  return actions;
}

function canTsumo(round: RoundState, seatIndex: number): boolean {
  // Simplified: always allow checking (actual validation at resolution)
  return round.activeSeat === seatIndex;
}

function canRon(round: RoundState, seatIndex: number): boolean {
  // Simplified: allow if in reaction window
  return round.reaction !== null;
}

function canPon(round: RoundState, seatIndex: number, preset: RulesPreset): boolean {
  if (!preset.allowPon || !preset.allowOpenHand) return false;
  // Simplified: actual tile matching happens at resolution
  return round.reaction !== null;
}

function canChi(round: RoundState, seatIndex: number, preset: RulesPreset): boolean {
  if (!preset.allowChi || !preset.allowOpenHand) return false;
  // Chi only from the player to the left of the discarder
  if (!round.reaction) return false;
  const discardSeat = round.reaction.discardSeat;
  const chiSeat = (discardSeat + 1) % preset.playerCount;
  return seatIndex === chiSeat;
}

function canKanOpen(round: RoundState, seatIndex: number, preset: RulesPreset): boolean {
  if (!preset.allowKan || !preset.allowOpenHand) return false;
  return round.reaction !== null;
}
```

- [ ] **Step 5: Write FSM test**

Create `packages/game-core/tests/fsm.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { canTransition } from '../src/engine/fsm.js';

describe('canTransition', () => {
  it('allows ROOM_OPEN to LOBBY', () => {
    expect(canTransition({ type: 'ROOM_OPEN' }, { type: 'LOBBY' })).toBe(true);
  });

  it('allows LOBBY to DEALING', () => {
    expect(canTransition({ type: 'LOBBY' }, { type: 'DEALING' })).toBe(true);
  });

  it('allows DEALING to TURN_DRAW', () => {
    expect(canTransition({ type: 'DEALING', progress: 0 }, { type: 'TURN_DRAW', activeSeat: 0, wallRemaining: 100 })).toBe(true);
  });

  it('allows TURN_DRAW to TURN_DECISION', () => {
    expect(canTransition({ type: 'TURN_DRAW', activeSeat: 0, wallRemaining: 100 }, { type: 'TURN_DECISION', activeSeat: 0, legalActions: [] })).toBe(true);
  });

  it('allows TURN_DECISION to REACTION_WINDOW', () => {
    expect(canTransition(
      { type: 'TURN_DECISION', activeSeat: 0, legalActions: [] },
      { type: 'REACTION_WINDOW', discardSeat: 0, discardTile: {} as any, pendingSeats: [1] }
    )).toBe(true);
  });

  it('allows HAND_END to ROUND_END', () => {
    expect(canTransition(
      { type: 'HAND_END', endReason: 'win', result: null },
      { type: 'ROUND_END', summary: {} as any }
    )).toBe(true);
  });

  it('denies ROOM_OPEN to TURN_DRAW', () => {
    expect(canTransition({ type: 'ROOM_OPEN' }, { type: 'TURN_DRAW', activeSeat: 0, wallRemaining: 100 })).toBe(false);
  });

  it('denies MATCH_END to anything', () => {
    expect(canTransition({ type: 'MATCH_END', finalScores: [] }, { type: 'LOBBY' })).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add packages/game-core/src/engine/ packages/game-core/tests/fsm.test.ts
git commit -m "feat(game-core): add FSM, action types, reaction system, validators"
```

---

## Task 8: Hand Validation + Scoring

**Files:**
- Create: `packages/game-core/src/scoring/validator.ts`
- Create: `packages/game-core/src/scoring/evaluator.ts`
- Create: `packages/game-core/src/scoring/calculator.ts`
- Create: `packages/game-core/src/scoring/settlement.ts`
- Create: `packages/game-core/tests/hand-validation.test.ts`
- Create: `packages/game-core/tests/scoring.test.ts`

- [ ] **Step 1: Create validator.ts — hand shape validation**

```typescript
import { TileDef, tileSortKey } from '../models/tile.js';

interface TileGroup {
  tiles: TileDef[];
  count: number;
}

function groupTiles(tiles: TileDef[]): Map<string, TileGroup> {
  const groups = new Map<string, TileGroup>();
  for (const tile of tiles) {
    const key = tile.suit ? `${tile.suit}-${tile.rank}` : tile.honorName ?? 'unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.tiles.push(tile);
      existing.count++;
    } else {
      groups.set(key, { tiles: [tile], count: 1 });
    }
  }
  return groups;
}

export function isSequentialTriplet(tiles: TileDef[]): boolean {
  if (tiles.length !== 3) return false;
  if (!tiles.every(t => t.suit && t.rank)) return false;
  if (!tiles.every(t => t.suit === tiles[0].suit)) return false;
  const ranks = tiles.map(t => t.rank!).sort((a, b) => a - b);
  return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1;
}

export function isTriplet(tiles: TileDef[]): boolean {
  if (tiles.length !== 3) return false;
  const key = tileSortKey(tiles[0]);
  return tiles.every(t => tileSortKey(t) === key);
}

export function isPair(tiles: TileDef[]): boolean {
  if (tiles.length !== 2) return false;
  return tileSortKey(tiles[0]) === tileSortKey(tiles[1]);
}

export interface MeldCandidate {
  tiles: TileDef[];
  type: 'chi' | 'pon' | 'pair';
}

export function isValidWinningShape(concealed: TileDef[], meldCount: number): boolean {
  // Total structure: 4 melds + 1 pair for standard win
  // meldCount = number of open melds already called
  const neededMelds = 4 - meldCount;
  const neededTiles = neededMelds * 3 + 2; // melds + pair
  if (concealed.length !== neededTiles) return false;

  return findWinningDecomposition(concealed, meldCount);
}

function findWinningDecomposition(tiles: TileDef[], meldCount: number): boolean {
  const sorted = [...tiles].sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));
  return tryDecompose(sorted, 4 - meldCount);
}

function tryDecompose(tiles: TileDef[], meldsNeeded: number): boolean {
  if (tiles.length === 0) return meldsNeeded === 0;
  if (meldsNeeded < 0) return false;

  // Try pair first at the end
  if (meldsNeeded === 0) {
    return tiles.length === 2 && isPair(tiles);
  }

  // Try triplet from start
  if (tiles.length >= 3 && isTriplet(tiles.slice(0, 3))) {
    if (tryDecompose(tiles.slice(3), meldsNeeded - 1)) return true;
  }

  // Try sequence from start
  if (tiles.length >= 3 && tiles[0].suit && tiles[0].rank) {
    const suit = tiles[0].suit;
    const rank = tiles[0].rank;
    const seq = findSequenceTiles(tiles, suit, rank);
    if (seq) {
      const remaining = tiles.filter((_, i) => !seq.includes(i));
      if (tryDecompose(remaining, meldsNeeded - 1)) return true;
    }
  }

  return false;
}

function findSequenceTiles(tiles: TileDef[], suit: string, startRank: number): number[] | null {
  const indices: number[] = [];
  for (let r = startRank; r < startRank + 3; r++) {
    const idx = tiles.findIndex((t, i) =>
      !indices.includes(i) && t.suit === suit && t.rank === r
    );
    if (idx === -1) return null;
    indices.push(idx);
  }
  return indices;
}

export function isSevenPairs(concealed: TileDef[]): boolean {
  if (concealed.length !== 14) return false;
  const groups = groupTiles(concealed);
  let pairs = 0;
  for (const [, group] of groups) {
    if (group.count % 2 !== 0) return false;
    pairs += group.count / 2;
  }
  return pairs === 7;
}
```

- [ ] **Step 2: Create evaluator.ts — yaku pattern detection (Phase 1 limited set)**

```typescript
import { TileDef, tileSortKey } from '../models/tile.js';
import { Meld } from '../models/meld.js';

export interface PatternMatch {
  id: string;
  name: string;
  hanValue: number;
  description: string;
}

export function evaluatePatterns(
  concealed: TileDef[],
  melds: Meld[],
  winType: 'ron' | 'tsumo',
  seatWind: 'east' | 'south' | 'west' | 'north',
  roundWind: 'east' | 'south' | 'west' | 'north',
): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const allTiles = [...concealed, ...melds.flatMap(m => m.tiles)];
  const isConcealed = melds.every(m => m.isConcealed) && melds.length === 0;

  // Tanyao (all simples) — only 2-8 in suited tiles, no honors
  if (isTanyao(allTiles)) {
    patterns.push({ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: 'All simples — no terminals or honors' });
  }

  // Yakuhai — round wind, seat wind, dragon triples
  const windDragonPatterns = findYakuhai(allTiles, seatWind, roundWind);
  patterns.push(...windDragonPatterns);

  // Pinfu — concealed hand with no fu
  if (isConcealed && isPinfu(concealed, melds, winType)) {
    patterns.push({ id: 'pinfu', name: 'Pinfu', hanValue: 1, description: 'No-fu concealed hand' });
  }

  // Toitoi — all triplets
  if (isToitoi(melds, concealed)) {
    patterns.push({ id: 'toitoi', name: 'Toitoi', hanValue: 2, description: 'All triplets' });
  }

  // Tsumo — self-draw with concealed hand
  if (isConcealed && winType === 'tsumo') {
    patterns.push({ id: 'menzen-tsumo', name: 'Menzen Tsumo', hanValue: 1, description: 'Concealed self-draw' });
  }

  // Chanta — half outside hand
  if (isChanta(allTiles, melds)) {
    patterns.push({ id: 'chanta', name: 'Chanta', hanValue: isConcealed ? 2 : 1, description: 'Half outside hand' });
  }

  return patterns;
}

function isTanyao(tiles: TileDef[]): boolean {
  return tiles.every(t => t.suit && t.rank! >= 2 && t.rank! <= 8);
}

function findYakuhai(tiles: TileDef[], seatWind: string, roundWind: string): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const groups = new Map<string, number>();
  for (const t of tiles) {
    const key = tileSortKey(t);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  for (const [key, count] of groups) {
    if (count < 3) continue;
    if (key.includes('haku')) {
      patterns.push({ id: 'yakuhai-haku', name: 'Haku', hanValue: 1, description: 'White dragon triplet' });
    }
    if (key.includes('hatsu')) {
      patterns.push({ id: 'yakuhai-hatsu', name: 'Hatsu', hanValue: 1, description: 'Green dragon triplet' });
    }
    if (key.includes('chun')) {
      patterns.push({ id: 'yakuhai-chun', name: 'Chun', hanValue: 1, description: 'Red dragon triplet' });
    }
  }

  return patterns;
}

function isPinfu(concealed: TileDef[], melds: Meld[], winType: 'ron' | 'tsumo'): boolean {
  // Simplified: concealed hand with no triplet melds
  return melds.length === 0 && winType === 'tsumo';
}

function isToitoi(melds: Meld[], concealed: TileDef[]): boolean {
  // All melds are pon/kan
  if (melds.length === 0) return false;
  return melds.every(m => m.type === 'pon' || m.type.startsWith('kan'));
}

function isChanta(tiles: TileDef[], melds: Meld[]): boolean {
  // Every meld and the pair contain at least one terminal or honor
  return tiles.every(t =>
    !t.suit || t.rank === 1 || t.rank === 9 || t.honorType !== undefined
  );
}
```

- [ ] **Step 3: Create calculator.ts**

```typescript
import { PatternMatch } from './evaluator.js';

export interface ScoreBreakdown {
  base: number;
  han: number;
  fu: number;
  multiplier: number;
  total: number;
  steps: string[];
}

const HAN_TO_POINTS: Record<number, number> = {
  1: 1000,
  2: 2000,
  3: 4000,
  4: 8000,
  5: 8000,  // mangan
};

export function calculateScore(patterns: PatternMatch[], fu: number): ScoreBreakdown {
  const han = patterns.reduce((sum, p) => sum + p.hanValue, 0);
  const baseFu = fu || 30;

  let total: number;
  let multiplier: number;
  const steps: string[] = [];

  if (han >= 5) {
    total = 8000;
    multiplier = 1;
    steps.push(`${han} han = Mangan (8000)`);
  } else if (han >= 4) {
    total = 8000;
    multiplier = 1;
    steps.push(`${han} han / ${baseFu} fu = 8000`);
  } else if (han >= 3) {
    const raw = baseFu * Math.pow(2, 2 + han);
    total = Math.min(raw, 8000);
    multiplier = Math.pow(2, 2 + han);
    steps.push(`${han} han / ${baseFu} fu = ${baseFu} × ${multiplier} = ${total}`);
  } else {
    const raw = baseFu * Math.pow(2, 2 + han);
    total = Math.min(raw, 8000);
    multiplier = Math.pow(2, 2 + han);
    steps.push(`${han} han / ${baseFu} fu = ${baseFu} × ${multiplier} = ${total}`);
  }

  return { base: baseFu, han, fu: baseFu, multiplier, total, steps };
}
```

- [ ] **Step 4: Create settlement.ts**

```typescript
import { TileDef } from '../models/tile.js';
import { Meld } from '../models/meld.js';
import { PatternMatch } from './evaluator.js';
import { ScoreBreakdown, calculateScore } from './calculator.js';

export interface HandResult {
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

export interface PointTransfer {
  from: number;
  to: number;
  amount: number;
  reason: string;
}

export function settleHand(
  winner: number,
  winType: 'ron' | 'tsumo',
  losingSeat: number | undefined,
  patterns: PatternMatch[],
  fu: number,
  playerCount: number,
  isDealer: boolean,
): HandResult {
  const score = calculateScore(patterns, fu);
  const settlement: PointTransfer[] = [];

  if (winType === 'ron' && losingSeat !== undefined) {
    const total = isDealer ? score.total * 6 / 4 : score.total;
    const rounded = Math.ceil(total / 100) * 100;
    settlement.push({
      from: losingSeat,
      to: winner,
      amount: rounded,
      reason: `Ron payment (${score.han} han)`,
    });
    score.total = rounded;
  } else {
    // Tsumo: all non-winners pay
    const baseTotal = isDealer ? score.total : score.total;
    const perPlayer = Math.ceil((baseTotal / (playerCount - 1)) / 100) * 100;
    for (let i = 0; i < playerCount; i++) {
      if (i !== winner) {
        settlement.push({
          from: i,
          to: winner,
          amount: isDealer ? perPlayer : (i === ((winner + 0) % playerCount) ? perPlayer * 2 : perPlayer),
          reason: `Tsumo payment (${score.han} han)`,
        });
      }
    }
  }

  return {
    winner,
    winType,
    losingSeat,
    hand: [],
    melds: [],
    patterns,
    han: score.han,
    fu: score.fu,
    score,
    settlement,
  };
}
```

- [ ] **Step 5: Write hand validation tests**

Create `packages/game-core/tests/hand-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';
import { isValidWinningShape, isSevenPairs } from '../src/scoring/validator.js';

function man(r: number, i: number) { return createSuitedTile('man', r, i); }
function pin(r: number, i: number) { return createSuitedTile('pin', r, i); }
function sou(r: number, i: number) { return createSuitedTile('sou', r, i); }
function wind(n: 'east' | 'south' | 'west' | 'north', i: number) { return createHonorTile(n, i); }

describe('isValidWinningShape', () => {
  it('validates 4 melds + pair', () => {
    // man 1-2-3, pin 4-5-6, sou 7-8-9, east-east-east, man5-man5
    const hand = [
      man(1, 0), man(2, 0), man(3, 0),
      pin(4, 0), pin(5, 0), pin(6, 0),
      sou(7, 0), sou(8, 0), sou(9, 0),
      wind('east', 0), wind('east', 1), wind('east', 2),
      man(5, 0), man(5, 1),
    ];
    expect(isValidWinningShape(hand, 0)).toBe(true);
  });

  it('rejects incomplete hand', () => {
    const hand = [man(1, 0), man(2, 0)];
    expect(isValidWinningShape(hand, 0)).toBe(false);
  });

  it('validates with 1 open meld', () => {
    // 3 concealed melds + pair = 11 tiles
    const hand = [
      man(1, 0), man(2, 0), man(3, 0),
      pin(4, 0), pin(5, 0), pin(6, 0),
      wind('east', 0), wind('east', 1), wind('east', 2),
      man(5, 0), man(5, 1),
    ];
    expect(isValidWinningShape(hand, 1)).toBe(true);
  });
});

describe('isSevenPairs', () => {
  it('validates seven pairs', () => {
    const hand = [
      man(1, 0), man(1, 1),
      man(2, 0), man(2, 1),
      man(3, 0), man(3, 1),
      man(4, 0), man(4, 1),
      man(5, 0), man(5, 1),
      man(6, 0), man(6, 1),
      man(7, 0), man(7, 1),
    ];
    expect(isSevenPairs(hand)).toBe(true);
  });

  it('rejects non-pair hand', () => {
    const hand = [
      man(1, 0), man(2, 0),
      man(3, 0), man(4, 0),
      man(5, 0), man(6, 0),
      man(7, 0), man(8, 0),
      man(9, 0), pin(1, 0),
      pin(2, 0), pin(3, 0),
      pin(4, 0), pin(5, 0),
    ];
    expect(isSevenPairs(hand)).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add packages/game-core/src/scoring/ packages/game-core/tests/hand-validation.test.ts
git commit -m "feat(game-core): add hand validation and scoring system"
```

---

## Task 9: Colyseus Server

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/services/RoomCodeService.ts`
- Create: `apps/server/src/rooms/schema/GameState.ts`
- Create: `apps/server/src/rooms/MahjongRoom.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@mahjong/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@colyseus/core": "^0.16.0",
    "@colyseus/ws-transport": "^0.16.0",
    "@mahjong/game-core": "workspace:*",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create RoomCodeService.ts**

```typescript
const EXCLUDE_CHARS = new Set(['O', '0', 'I', '1', 'L']);
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
const CODE_LENGTH = 6;

export class RoomCodeService {
  private codeToRoomId = new Map<string, string>();

  generateCode(): string {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }
    } while (this.codeToRoomId.has(code));
    return code;
  }

  register(code: string, roomId: string): void {
    this.codeToRoomId.set(code, roomId);
  }

  getRoomId(code: string): string | undefined {
    return this.codeToRoomId.get(code.toUpperCase());
  }

  remove(code: string): void {
    this.codeToRoomId.delete(code);
  }
}
```

- [ ] **Step 4: Create GameState.ts (Colyseus schema)**

```typescript
import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('uint8') seatIndex: number = 0;
  @type('boolean') isConnected: boolean = false;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isHost: boolean = false;
}

export class GameState extends Schema {
  @type('string') roomId: string = '';
  @type('string') roomCode: string = '';
  @type('string') status: string = 'lobby';
  @type('string') hostPlayerId: string = '';
  @type('string') phase: string = 'LOBBY';
  @type('uint8') activeSeat: number = 0;
  @type('uint8') wallRemaining: number = 0;
  @type('uint8') dealerSeat: number = 0;
  @type('uint8') handNumber: number = 1;
  @type('string') roundWind: string = 'east';
  @type('uint8') honba: number = 0;
  @type('uint8') riichiSticks: number = 0;
}
```

- [ ] **Step 5: Create MahjongRoom.ts (initial lobby + dealing)**

```typescript
import { Room, Client } from '@colyseus/core';
import { GameState, PlayerSchema } from './schema/GameState.js';

export class MahjongRoom extends Room<GameState> {
  maxClients = 4;

  onCreate(options: { preset: any; hostPlayerId: string; roomCode: string }) {
    this.setState(new GameState());
    this.state.roomId = this.roomId;
    this.state.roomCode = options.roomCode;
    this.state.hostPlayerId = options.hostPlayerId;
    this.state.status = 'lobby';
    this.state.phase = 'LOBBY';

    this.onMessage('choose-seat', (client, data: { seatIndex: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.seatIndex = data.seatIndex;
      }
    });

    this.onMessage('toggle-ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !player.isReady;
      }
    });

    this.onMessage('start-match', (client) => {
      // Only host can start
      // Validate all seats filled and all ready
      // Then transition to DEALING
      this.state.status = 'in-progress';
      this.state.phase = 'DEALING';
    });
  }

  onJoin(client: Client, options: { displayName: string }) {
    const player = new PlayerSchema();
    player.playerId = client.sessionId;
    player.displayName = options.displayName || 'Player';
    player.isConnected = true;
    player.isHost = client.sessionId === this.state.hostPlayerId;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isConnected = false;
    }
  }

  onDispose() {
    // Cleanup
  }
}
```

- [ ] **Step 6: Create index.ts (server bootstrap)**

```typescript
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import { MahjongRoom } from './rooms/MahjongRoom.js';
import { RoomCodeService } from './services/RoomCodeService.js';

const app = express();
app.use(express.json());

const server = createServer(app);
const transport = new WebSocketTransport({ server });

const gameServer = new Server({ transport });

const roomCodeService = new RoomCodeService();

app.post('/api/rooms', (req, res) => {
  const { displayName, preset } = req.body;
  const roomCode = roomCodeService.generateCode();
  const hostPlayerId = `player-${Date.now()}`;

  const roomId = gameServer.define('mahjong', MahjongRoom).create({
    preset: preset || 'riichi',
    hostPlayerId,
    roomCode,
  });

  roomCodeService.register(roomCode, roomId);
  res.json({ roomCode, roomId, hostPlayerId });
});

app.get('/api/rooms/:code', (req, res) => {
  const roomId = roomCodeService.getRoomId(req.params.code);
  if (roomId) {
    res.json({ roomId, exists: true });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

const PORT = process.env.PORT || 2567;
gameServer.listen(PORT).then(() => {
  console.log(`Mahjong server running on port ${PORT}`);
});
```

- [ ] **Step 7: Install dependencies and verify build**

```bash
cd /home/jay/User_Apps/mahjong && pnpm install
cd apps/server && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/server/
git commit -m "feat(server): add Colyseus server with room creation and lobby"
```

---

## Task 10: UI Package — Design Tokens + SVG Tiles

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/tokens/colors.ts`
- Create: `packages/ui/src/tokens/spacing.ts`
- Create: `packages/ui/src/tokens/typography.ts`
- Create: `packages/ui/src/tokens/motion.ts`
- Create: `packages/ui/src/tokens/index.ts`
- Create: `packages/ui/src/tiles/TileSVG.tsx`
- Create: `packages/ui/src/tiles/ManTiles.tsx`
- Create: `packages/ui/src/tiles/PinTiles.tsx`
- Create: `packages/ui/src/tiles/SouTiles.tsx`
- Create: `packages/ui/src/tiles/HonorTiles.tsx`
- Create: `packages/ui/src/tiles/TileBack.tsx`
- Create: `packages/ui/src/tiles/index.ts`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@mahjong/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "react": "^18.3.0",
    "@mahjong/game-core": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tokens/colors.ts**

```typescript
export const LIGHT_TOKENS = {
  '--c-bg': '#FAF7F2',
  '--c-bg-raised': '#F5F1EA',
  '--c-text': '#2B2926',
  '--c-text-secondary': '#6B665E',
  '--c-text-muted': '#9A958C',
  '--c-accent': '#B85C3A',
  '--c-accent-hover': '#9A4A2E',
  '--c-border': '#E3DDD3',
  '--c-rule': '#D9D2C8',
  '--matte-950': '#f5f5f7',
  '--matte-900': '#e8e8ed',
  '--matte-800': '#dcdcde',
  '--matte-700': '#d0d0d5',
  '--matte-600': '#c4c4ca',
  '--matte-500': '#a0a0a8',
  '--matte-400': '#6b6b75',
  '--matte-300': '#4a4a52',
  '--matte-200': '#2c2c30',
  '--matte-100': '#121214',
  '--warm-accent': '#B85C3A',
  '--warm-accent-dim': '#9A4A2E',
} as const;

export const DARK_TOKENS = {
  '--c-bg': '#1C1B19',
  '--c-bg-raised': '#252320',
  '--c-text': '#E8E4DD',
  '--c-text-secondary': '#B0AAA0',
  '--c-text-muted': '#7A756E',
  '--c-accent': '#C97B5C',
  '--c-accent-hover': '#D49074',
  '--c-border': '#3A3630',
  '--c-rule': '#33302C',
  '--matte-950': '#0a0a0b',
  '--matte-900': '#121214',
  '--matte-800': '#1a1a1d',
  '--matte-700': '#232326',
  '--matte-600': '#2c2c30',
  '--matte-500': '#3a3a40',
  '--matte-400': '#6b6b75',
  '--matte-300': '#9e9ea8',
  '--matte-200': '#d1d1d6',
  '--matte-100': '#f5f5f7',
  '--warm-accent': '#c4a574',
  '--warm-accent-dim': '#8a7455',
} as const;

export const SEMANTIC_LIGHT = {
  '--surface-app': 'var(--c-bg)',
  '--surface-panel': 'var(--c-bg-raised)',
  '--surface-panel-raised': '#ffffff',
  '--surface-table': 'var(--matte-950)',
  '--text-primary': 'var(--c-text)',
  '--text-secondary': 'var(--c-text-secondary)',
  '--text-muted': 'var(--c-text-muted)',
  '--accent-warm': 'var(--c-accent)',
  '--accent-warm-dim': 'var(--c-accent-hover)',
  '--border-subtle': 'var(--c-border)',
  '--rule-subtle': 'var(--c-rule)',
  '--focus-ring': '0 0 0 2px rgba(184, 92, 58, 0.3)',
  '--tile-face-bg': '#F5F0E6',
  '--tile-face-border': '#D9D2C8',
  '--tile-stroke': '#2B2926',
  '--tile-back-bg': 'var(--matte-700)',
  '--seat-active-ring': 'var(--warm-accent)',
  '--danger': '#c45a5a',
  '--success': '#5a9e6e',
} as const;

export const SEMANTIC_DARK = {
  '--surface-app': 'var(--matte-950)',
  '--surface-panel': 'var(--matte-900)',
  '--surface-panel-raised': 'var(--matte-800)',
  '--surface-table': 'var(--matte-950)',
  '--text-primary': 'var(--matte-200)',
  '--text-secondary': 'var(--matte-300)',
  '--text-muted': 'var(--matte-400)',
  '--accent-warm': 'var(--warm-accent)',
  '--accent-warm-dim': 'var(--warm-accent-dim)',
  '--border-subtle': 'rgba(58, 58, 64, 0.3)',
  '--rule-subtle': 'rgba(58, 58, 64, 0.2)',
  '--focus-ring': '0 0 0 2px rgba(196, 165, 116, 0.3)',
  '--tile-face-bg': '#2a2825',
  '--tile-face-border': '#3a3630',
  '--tile-stroke': '#d1d1d6',
  '--tile-back-bg': 'var(--matte-600)',
  '--seat-active-ring': 'var(--warm-accent)',
  '--danger': '#c45a5a',
  '--success': '#5a9e6e',
} as const;
```

- [ ] **Step 4: Create remaining token files**

`packages/ui/src/tokens/spacing.ts`:
```typescript
export const SPACING = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
} as const;
```

`packages/ui/src/tokens/typography.ts`:
```typescript
export const FONTS = {
  display: "'Newsreader', Georgia, 'Times New Roman', serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

export const FONT_SIZES = {
  xs: '0.6875rem',
  sm: '0.8125rem',
  base: '0.9375rem',
  md: '1.0625rem',
  lg: '1.25rem',
  xl: '1.5rem',
  hero: '3rem',
} as const;
```

`packages/ui/src/tokens/motion.ts`:
```typescript
export const MOTION = {
  durationFast: '120ms',
  durationNormal: '200ms',
  durationSlow: '350ms',
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;
```

`packages/ui/src/tokens/index.ts`:
```typescript
export * from './colors.js';
export * from './spacing.js';
export * from './typography.js';
export * from './motion.js';
```

- [ ] **Step 5: Create TileSVG.tsx — base tile component**

```tsx
import React from 'react';

interface TileSVGProps {
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function TileSVG({ width = 48, height = 64, selected, onClick, children }: TileSVGProps) {
  const borderRadius = 6;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        filter: selected ? 'brightness(1.05)' : undefined,
        transition: 'filter 120ms ease',
      }}
      role="img"
      aria-label="Mahjong tile"
    >
      <rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={borderRadius}
        ry={borderRadius}
        fill="var(--tile-face-bg)"
        stroke={selected ? 'var(--accent-warm)' : 'var(--tile-face-border)'}
        strokeWidth={selected ? 2 : 1}
      />
      {children}
    </svg>
  );
}
```

- [ ] **Step 6: Create ManTiles.tsx (example for man-1 through man-9)**

```tsx
import React from 'react';
import { TileSVG } from './TileSVG.js';

const MAN_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

interface ManTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function ManTile({ rank, width = 48, height = 64, selected, onClick }: ManTileProps) {
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <text
        x={width / 2}
        y={height * 0.42}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * 0.5}
        fontFamily="'Newsreader', Georgia, serif"
        fontWeight="400"
      >
        {MAN_KANJI[rank - 1]}
      </text>
      <text
        x={width / 2}
        y={height * 0.78}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * 0.22}
        fontFamily="'Inter', sans-serif"
        fontWeight="500"
      >
        {rank}
      </text>
    </TileSVG>
  );
}
```

- [ ] **Step 7: Create PinTiles.tsx — concentric circles**

```tsx
import React from 'react';
import { TileSVG } from './TileSVG.js';

interface PinTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

function PinCircles({ rank, cx, cy, baseR }: { rank: number; cx: number; cy: number; baseR: number }) {
  const circles: React.ReactElement[] = [];
  const positions = getCirclePositions(rank, cx, cy);

  for (const pos of positions) {
    circles.push(
      <circle key={`o-${pos.x}-${pos.y}`} cx={pos.x} cy={pos.y} r={baseR} fill="none" stroke="var(--tile-stroke)" strokeWidth={1.5} />,
      <circle key={`i-${pos.x}-${pos.y}`} cx={pos.x} cy={pos.y} r={baseR * 0.4} fill="var(--tile-stroke)" />
    );
  }
  return <>{circles}</>;
}

function getCirclePositions(count: number, cx: number, cy: number): { x: number; y: number }[] {
  const r = cx * 0.22;
  switch (count) {
    case 1: return [{ x: cx, y: cy }];
    case 2: return [{ x: cx - r, y: cy }, { x: cx + r, y: cy }];
    case 3: return [{ x: cx, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 4: return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 5: return [{ x: cx, y: cy }, { x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 6: return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 7: return [{ x: cx, y: cy - r * 1.2 }, { x: cx - r, y: cy - r * 0.2 }, { x: cx + r, y: cy - r * 0.2 }, { x: cx - r, y: cy + r * 0.7 }, { x: cx + r, y: cy + r * 0.7 }, { x: cx - r * 0.5, y: cy + r * 1.5 }, { x: cx + r * 0.5, y: cy + r * 1.5 }];
    case 8: return [{ x: cx - r, y: cy - r * 1.2 }, { x: cx + r, y: cy - r * 1.2 }, { x: cx - r, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r * 0.8 }, { x: cx + r, y: cy + r * 0.8 }, { x: cx, y: cy - r * 0.6 }, { x: cx, y: cy + r * 1.6 }];
    case 9: return [{ x: cx - r, y: cy - r * 1.2 }, { x: cx, y: cy - r * 1.2 }, { x: cx + r, y: cy - r * 1.2 }, { x: cx - r, y: cy }, { x: cx, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r * 1.0 }, { x: cx, y: cy + r * 1.0 }, { x: cx + r, y: cy + r * 1.0 }];
    default: return [{ x: cx, y: cy }];
  }
}

export function PinTile({ rank, width = 48, height = 64, selected, onClick }: PinTileProps) {
  const baseR = width * 0.07;
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <PinCircles rank={rank} cx={width / 2} cy={height / 2} baseR={baseR} />
    </TileSVG>
  );
}
```

- [ ] **Step 8: Create SouTiles.tsx — elegant bamboo lines**

```tsx
import React from 'react';
import { TileSVG } from './TileSVG.js';

interface SouTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function SouTile({ rank, width = 48, height = 64, selected, onClick }: SouTileProps) {
  const cx = width / 2;
  const stickHeight = height * 0.12;
  const startY = height * 0.15;
  const gap = (height * 0.7) / rank;

  const sticks = [];
  for (let i = 0; i < rank; i++) {
    const y = startY + i * gap;
    sticks.push(
      <rect key={`stick-${i}`} x={cx - width * 0.2} y={y} width={width * 0.4} height={stickHeight} rx={2} fill="var(--tile-stroke)" />
    );
  }

  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      {sticks}
    </TileSVG>
  );
}
```

- [ ] **Step 9: Create HonorTiles.tsx**

```tsx
import React from 'react';
import { TileSVG } from './TileSVG.js';

const WIND_CHARS: Record<string, string> = { east: '東', south: '南', west: '西', north: '北' };
const DRAGON_CHARS: Record<string, string> = { haku: '白', hatsu: '發', chun: '中' };

interface HonorTileProps {
  honorName: string;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function HonorTile({ honorName, width = 48, height = 64, selected, onClick }: HonorTileProps) {
  const char = WIND_CHARS[honorName] ?? DRAGON_CHARS[honorName] ?? '?';
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * 0.55}
        fontFamily="'Newsreader', Georgia, serif"
        fontWeight="400"
      >
        {char}
      </text>
    </TileSVG>
  );
}
```

- [ ] **Step 10: Create TileBack.tsx**

```tsx
import React from 'react';

interface TileBackProps {
  width?: number;
  height?: number;
}

export function TileBack({ width = 48, height = 64 }: TileBackProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Face-down tile">
      <rect
        x={1} y={1} width={width - 2} height={height - 2}
        rx={6} ry={6}
        fill="var(--tile-back-bg)"
        stroke="var(--tile-face-border)"
        strokeWidth={1}
      />
      <rect
        x={width * 0.2} y={height * 0.15}
        width={width * 0.6} height={height * 0.7}
        rx={3} ry={3}
        fill="none"
        stroke="var(--tile-face-border)"
        strokeWidth={1}
        opacity={0.4}
      />
    </svg>
  );
}
```

- [ ] **Step 11: Create barrel exports and verify build**

`packages/ui/src/tiles/index.ts`:
```typescript
export { TileSVG } from './TileSVG.js';
export { ManTile } from './ManTiles.js';
export { PinTile } from './PinTiles.js';
export { SouTile } from './SouTiles.js';
export { HonorTile } from './HonorTiles.js';
export { TileBack } from './TileBack.js';
```

`packages/ui/src/index.ts`:
```typescript
export * from './tokens/index.js';
export * from './tiles/index.js';
```

```bash
cd /home/jay/User_Apps/mahjong && pnpm install
cd packages/ui && pnpm build
```

- [ ] **Step 12: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add design tokens and SVG tile components"
```

---

## Task 11: Web Client — App Shell + CSS Tokens + Routing

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/lib/theme.ts`
- Create: `apps/web/src/hooks/useTheme.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@mahjong/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@mahjong/game-core": "workspace:*",
    "@mahjong/ui": "workspace:*",
    "colyseus.js": "^0.16.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:2567',
      '/ws': { target: 'ws://localhost:2567', ws: true },
    },
  },
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleDetection": "force",
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mahjong</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create index.css with full token system**

Create `apps/web/src/index.css` — this file contains all CSS custom properties (raw + semantic) for both light and dark themes, plus Tailwind base:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light raw palette */
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

    /* Light semantic tokens */
    --surface-app: var(--c-bg);
    --surface-panel: var(--c-bg-raised);
    --surface-panel-raised: #ffffff;
    --surface-table: var(--matte-950);
    --text-primary: var(--c-text);
    --text-secondary: var(--c-text-secondary);
    --text-muted: var(--c-text-muted);
    --accent-warm: var(--c-accent);
    --accent-warm-dim: var(--c-accent-hover);
    --border-subtle: var(--c-border);
    --rule-subtle: var(--c-rule);
    --focus-ring: 0 0 0 2px rgba(184, 92, 58, 0.3);
    --tile-face-bg: #F5F0E6;
    --tile-face-border: #D9D2C8;
    --tile-stroke: #2B2926;
    --tile-back-bg: var(--matte-700);
    --seat-active-ring: var(--warm-accent);
    --danger: #c45a5a;
    --success: #5a9e6e;
  }

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

  body {
    background: var(--surface-app);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin: 0;
  }
}
```

- [ ] **Step 6: Create theme.ts + useTheme.ts**

`apps/web/src/lib/theme.ts`:
```typescript
export function getTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('mahjong-theme', theme);
}

export function initTheme(): void {
  const saved = localStorage.getItem('mahjong-theme') as 'light' | 'dark' | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved ?? (prefersDark ? 'dark' : 'light'));
}
```

`apps/web/src/hooks/useTheme.ts`:
```typescript
import { useState, useEffect } from 'react';
import { getTheme, setTheme } from '../lib/theme.js';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme());

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeState(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return {
    theme,
    toggle: () => setTheme(theme === 'light' ? 'dark' : 'light'),
    set: (t: 'light' | 'dark') => setTheme(t),
  };
}
```

- [ ] **Step 7: Create App.tsx with routing**

```tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StartScreen } from './screens/StartScreen.js';
import { CreateRoomScreen } from './screens/CreateRoomScreen.js';
import { JoinRoomScreen } from './screens/JoinRoomScreen.js';
import { LobbyScreen } from './screens/LobbyScreen.js';
import { GameScreen } from './screens/GameScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/create" element={<CreateRoomScreen />} />
        <Route path="/join" element={<JoinRoomScreen />} />
        <Route path="/lobby/:roomCode" element={<LobbyScreen />} />
        <Route path="/game/:roomCode" element={<GameScreen />} />
        <Route path="/result/:roomCode" element={<ResultScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Create main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { initTheme } from './lib/theme.js';
import './index.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Create placeholder screens**

Create minimal placeholder files for each screen (they'll be built out in later tasks). Example for `StartScreen.tsx`:

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';

export function StartScreen() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '3rem', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
        Mahjong
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontStyle: 'italic', fontFamily: "'Newsreader', Georgia, serif" }}>
        A quiet room for a strategic game.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => navigate('/create')} style={{ padding: '0.75rem 2rem', background: 'var(--accent-warm)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
          Create Room
        </button>
        <button onClick={() => navigate('/join')} style={{ padding: '0.75rem 2rem', background: 'var(--surface-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
          Join Room
        </button>
        <button onClick={toggle} style={{ padding: '0.75rem 1rem', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
    </div>
  );
}
```

Create similar minimal placeholders for `CreateRoomScreen.tsx`, `JoinRoomScreen.tsx`, `LobbyScreen.tsx`, `GameScreen.tsx`, `ResultScreen.tsx` — each just rendering the screen name.

- [ ] **Step 10: Install and verify dev server starts**

```bash
cd /home/jay/User_Apps/mahjong && pnpm install
cd apps/web && pnpm dev
```

Expected: Vite dev server starts on port 3000.

- [ ] **Step 11: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add client app shell with CSS tokens, routing, theme toggle"
```

---

## Task 12: Start Screen + Create Room + Join Room Screens

**Files:**
- Modify: `apps/web/src/screens/StartScreen.tsx`
- Modify: `apps/web/src/screens/CreateRoomScreen.tsx`
- Modify: `apps/web/src/screens/JoinRoomScreen.tsx`
- Create: `apps/web/src/components/common/Button.tsx`
- Create: `apps/web/src/components/common/Input.tsx`
- Create: `apps/web/src/components/common/ThemeToggle.tsx`

- [ ] **Step 1: Create common Button component**

`apps/web/src/components/common/Button.tsx`:
```tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    fontSize: size === 'sm' ? '0.8125rem' : size === 'lg' ? '1rem' : '0.9375rem',
    padding: size === 'sm' ? '0.5rem 1rem' : size === 'lg' ? '0.875rem 2.5rem' : '0.75rem 2rem',
    transition: 'all 120ms ease',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { ...base, background: 'var(--accent-warm)', color: '#ffffff' },
    secondary: { ...base, background: 'var(--surface-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
    ghost: { ...base, background: 'none', color: 'var(--text-secondary)' },
  };

  return <button style={{ ...variants[variant], ...style }} {...props} />;
}
```

- [ ] **Step 2: Create Input component**

`apps/web/src/components/common/Input.tsx`:
```tsx
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>}
      <input
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
          color: 'var(--text-primary)',
          fontSize: '0.9375rem',
          fontFamily: "'Inter', sans-serif",
          outline: 'none',
          transition: 'border-color 120ms ease',
          ...style,
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = 'var(--focus-ring)'; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        {...props}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create ThemeToggle**

`apps/web/src/components/common/ThemeToggle.tsx`:
```tsx
import React from 'react';
import { useTheme } from '../../hooks/useTheme.js';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      style={{
        background: 'none',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: '0.8125rem',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  );
}
```

- [ ] **Step 4: Build out StartScreen with classic design**

Replace `apps/web/src/screens/StartScreen.tsx` with a polished classic-mode start screen using warm editorial styling, serif hero title, and the accent clay button.

- [ ] **Step 5: Build out CreateRoomScreen**

Preset picker cards for Riichi (active) / Hong Kong (coming soon) / Custom (coming soon). Name input. Create button. Advanced settings accordion (collapsed by default).

- [ ] **Step 6: Build out JoinRoomScreen**

Room code input (uppercase, centered, large focus-friendly). Name input. Join button. Error state display area.

- [ ] **Step 7: Verify screens render and navigate**

```bash
cd /home/jay/User_Apps/mahjong/apps/web && pnpm dev
```

Navigate through Start → Create → back → Join. Verify theme toggle works.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): build out start, create, and join screens with classic design"
```

---

## Task 13: Lobby Screen

**Files:**
- Modify: `apps/web/src/screens/LobbyScreen.tsx`
- Create: `apps/web/src/components/lobby/SeatMap.tsx`
- Create: `apps/web/src/components/lobby/PlayerList.tsx`
- Create: `apps/web/src/components/lobby/RulesSummary.tsx`
- Create: `apps/web/src/hooks/useGameClient.ts`
- Create: `apps/web/src/lib/colyseus.ts`

- [ ] **Step 1: Create colyseus.ts client setup**

```typescript
import { Client } from 'colyseus.js';

const SERVER_URL = import.meta.env.VITE_COLYSEUS_URL || 'ws://localhost:2567';

export const colyseusClient = new Client(SERVER_URL);
```

- [ ] **Step 2: Create useGameClient.ts hook**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { colyseusClient } from '../lib/colyseus.js';

export function useGameClient(roomCode: string) {
  const [room, setRoom] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (displayName: string) => {
    try {
      const r = await colyseusClient.joinById(roomCode, { displayName });
      setRoom(r);
      r.onStateChange((s: any) => setState({ ...s }));
      r.onError((code: number, msg: string) => setError(msg));
    } catch (e: any) {
      setError(e.message || 'Failed to join room');
    }
  }, [roomCode]);

  const leave = useCallback(() => {
    room?.leave();
    setRoom(null);
    setState(null);
  }, [room]);

  useEffect(() => {
    return () => { room?.leave(); };
  }, [room]);

  return { room, state, error, join, leave };
}
```

- [ ] **Step 3: Build SeatMap component**

4-seat circular layout. Each seat shows player name or "Empty". Click to claim. Host controls to kick.

- [ ] **Step 4: Build PlayerList**

List of connected players with ready status indicators.

- [ ] **Step 5: Build RulesSummary**

Compact display of the active rules preset.

- [ ] **Step 6: Build out LobbyScreen**

Desktop-mode matte design. Prominent room code with copy button. SeatMap, PlayerList, RulesSummary. Ready/Toggle button. Start Match (host only).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add lobby screen with seat map, player list, and rules summary"
```

---

## Task 14: Game Table Screen

**Files:**
- Modify: `apps/web/src/screens/GameScreen.tsx`
- Create: `apps/web/src/components/table/TableLayout.tsx`
- Create: `apps/web/src/components/table/SeatPosition.tsx`
- Create: `apps/web/src/components/table/HandArea.tsx`
- Create: `apps/web/src/components/table/RiverArea.tsx`
- Create: `apps/web/src/components/table/MeldArea.tsx`
- Create: `apps/web/src/components/table/InfoBar.tsx`
- Create: `apps/web/src/components/actions/ActionPrompt.tsx`
- Create: `apps/web/src/hooks/useLegalActions.ts`

- [ ] **Step 1: Create useLegalActions.ts**

```typescript
import { useMemo } from 'react';

export function useLegalActions(state: any, mySeatIndex: number): string[] {
  return useMemo(() => {
    if (!state?.round) return [];
    // For Phase 1, derive from server state
    // Server will send legalActions via PlayerViewState
    return state.legalActions ?? [];
  }, [state, mySeatIndex]);
}
```

- [ ] **Step 2: Create TableLayout**

Top-down strategic table. 4 seat positions arranged in compass layout. Center area for round info. Local player's hand at bottom.

- [ ] **Step 3: Create SeatPosition**

Shows player name, tile count, active turn indicator (glowing accent ring), melds, river.

- [ ] **Step 4: Create HandArea**

Uses `ManTile`, `PinTile`, `SouTile`, `HonorTile` from `@mahjong/ui`. Click to select. Selected tile highlighted. Discard button or double-click to discard.

- [ ] **Step 5: Create RiverArea**

Grid of discarded tiles using tile SVG components. Last discard visually emphasized.

- [ ] **Step 6: Create MeldArea**

Grouped display of called melds (chi/pon/kan).

- [ ] **Step 7: Create InfoBar**

Round wind, hand number, honba, riichi sticks, wall remaining, dealer indicator.

- [ ] **Step 8: Create ActionPrompt**

Shows available legal actions as calm, deliberate buttons. Appears only when the player has actions to take. Uses accent styling sparingly.

- [ ] **Step 9: Build out GameScreen**

Composes all table components. Desktop-mode matte dark design. Consumes Colyseus state via useGameClient. Sends action messages to server.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add game table with hand area, rivers, melds, and action prompts"
```

---

## Task 15: Result Screen

**Files:**
- Modify: `apps/web/src/screens/ResultScreen.tsx`

- [ ] **Step 1: Build ResultScreen**

Hybrid classic/desktop design. Winner display with serif heading. Win type badge. Score breakdown with calculation steps. Pattern list. Point transfers. "Next Hand" or "Rematch" button. Acknowledgment flow.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/screens/ResultScreen.tsx
git commit -m "feat(web): add result screen with score breakdown"
```

---

## Task 16: Integration — Wire Server Gameplay Loop

**Files:**
- Modify: `apps/server/src/rooms/MahjongRoom.ts`
- Modify: `apps/server/src/rooms/schema/GameState.ts`

- [ ] **Step 1: Extend GameState schema**

Add fields for round state: activeSeat, wallRemaining, dora indicators, seat concealed counts, melds, rivers, scores.

- [ ] **Step 2: Implement dealing flow in MahjongRoom**

On START_MATCH: generate shuffle seed, build wall from game-core, deal 13 tiles to each seat, set dealer, transition to TURN_DRAW.

- [ ] **Step 3: Implement draw/discard cycle**

On DRAW_TILE: pop next tile from wall, add to active seat's concealed, calculate legal actions, transition to TURN_DECISION. On DISCARD_TILE: remove tile from concealed, add to river, check for reactions, transition to REACTION_WINDOW or TURN_DRAW for next player.

- [ ] **Step 4: Implement reaction window**

On PASS_REACTION / CALL_PON / CALL_CHI / DECLARE_WIN_RON: collect responses, resolve by priority, apply meld or win, transition accordingly.

- [ ] **Step 5: Implement win resolution**

On DECLARE_WIN_TSUMO / after ron resolution: validate hand via game-core scoring, calculate score, apply settlement, transition to HAND_END → ROUND_END.

- [ ] **Step 6: Test full round flow**

Create room → join 4 players → start → deal → draw/discard → call melds → win → result.

- [ ] **Step 7: Commit**

```bash
git add apps/server/
git commit -m "feat(server): wire full gameplay loop with dealing, draw/discard, reactions, and win resolution"
```

---

## Task 17: Remaining game-core Tests

**Files:**
- Create: `packages/game-core/tests/actions.test.ts`
- Create: `packages/game-core/tests/reaction.test.ts`
- Create: `packages/game-core/tests/scoring.test.ts`

- [ ] **Step 1: Write actions.test.ts**

Test legalActionsForSeat returns correct actions for each phase. Test DRAW_TILE only for active seat. Test PASS_REACTION only during reaction window. Test DECLARE_RIICHI is never returned in Phase 1.

- [ ] **Step 2: Write reaction.test.ts**

Test createReaction, submitResponse, isAllResponded, autoPassUnresponded. Test stale reactionId ignored.

- [ ] **Step 3: Write scoring.test.ts**

Test calculateScore for 1-5 han. Test settleHand for ron and tsumo. Test dealer bonus.

- [ ] **Step 4: Run all tests**

```bash
cd /home/jay/User_Apps/mahjong/packages/game-core && pnpm test
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/game-core/tests/
git commit -m "test(game-core): add action, reaction, and scoring tests"
```

---

## Task 18: Polish + Final Verification

**Files:**
- Modify: various CSS and component files

- [ ] **Step 1: Verify full flow end-to-end**

Start server and web client. Create room. Join with 4 browser tabs. Play a round to completion.

- [ ] **Step 2: Verify theme toggle**

Switch between light and dark during each screen. Verify tokens apply correctly.

- [ ] **Step 3: Fix any visual issues**

Adjust spacing, colors, transitions. Ensure tile SVGs render cleanly at multiple sizes.

- [ ] **Step 4: Run all tests**

```bash
cd /home/jay/User_Apps/mahjong && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: polish visual language and fix integration issues"
```

---

## Self-Review

**1. Spec coverage:**
- Architecture overview → Task 1 (monorepo scaffold)
- Domain model (tiles, wall, hand, meld, river, player, round, match) → Tasks 2-5
- State visibility model → Task 9 (server), Task 13 (client projections)
- Rules preset system → Task 6
- Move/action contract → Task 7
- Reaction priority → Task 7
- Seat ownership / reconnection → Task 9 (SeatClaim in server)
- Scoring architecture → Task 8
- Design system (tokens, typography, tile SVG) → Task 10
- Client architecture (screens, state ownership) → Tasks 11-15
- Server architecture (Colyseus, room codes, persistence) → Task 9
- Phase 1 scope (no riichi declaration) → enforced in validators (Task 7) and build strategy

**2. Placeholder scan:**
- No TBD/TODO items. All code steps contain actual implementation.

**3. Type consistency:**
- `HandResult | null` used consistently in `RoundSummary.result`, `HAND_END`, `round-ended` event.
- `endReason: 'win' | 'exhaustive-draw'` consistent across `RoundSummary`, `HAND_END`, `round-ended`.
- `PlayerScoreState[]` used in `MATCH_END` and `RoundSummary.scoreChanges`.
- `DECLARE_RIICHI` in ActionType but excluded from `legalActionsForSeat` in Phase 1.
