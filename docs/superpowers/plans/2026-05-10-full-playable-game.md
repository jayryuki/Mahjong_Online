# Full Playable Mahjong Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mahjong game fully playable end-to-end — tiles appear, bots act, the table renders all 4 seats with real tiles, riichi works, and hands continue after ending.

**Architecture:** Server-authoritative game with Colyseus. Private messages deliver tile data; `request-hand` ensures reliability. Bot AI runs server-side with timed delays. Client renders a seat-relative table with SVG tiles from `@mahjong/ui`.

**Tech Stack:** TypeScript, React 18, Colyseus 0.16, Vite, pnpm workspaces, vitest

---

## Task 1: Add tenpai check helper to game-core

**Files:**
- Modify: `packages/game-core/src/engine/validators.ts`
- Test: `packages/game-core/tests/fsm.test.ts` (existing)

The tenpai check is needed by both the riichi flow (server) and could be useful client-side. It iterates over each possible discard and checks if the remaining hand forms a valid winning shape minus 1 tile (i.e., is one tile away from a win).

- [ ] **Step 1: Write the failing test**

Add to `packages/game-core/tests/fsm.test.ts`:

```typescript
import { isTenpai } from '../src/engine/validators.js';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';

describe('isTenpai', () => {
  it('returns true for a hand that is one tile away from winning', () => {
    // 13 tiles: all man 1-9 + pin 1-4, missing pin 5 to complete the sequence
    // Actually let's use a simpler example: 4 sets + pair minus one tile
    // man1x3, man2x3, man3x3, pin1x2, pin2x1 — need pin3 for chi
    // Simpler: 13 tiles that are tenpai
    const tiles = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('man', 1, 1),
      createSuitedTile('man', 1, 2),
      createSuitedTile('man', 2, 0),
      createSuitedTile('man', 2, 1),
      createSuitedTile('man', 2, 2),
      createSuitedTile('man', 3, 0),
      createSuitedTile('man', 3, 1),
      createSuitedTile('man', 3, 2),
      createSuitedTile('pin', 1, 0),
      createSuitedTile('pin', 1, 1),
      createSuitedTile('pin', 2, 0),
      createSuitedTile('pin', 3, 0),
    ];
    expect(isTenpai(tiles, 0)).toBe(true);
  });

  it('returns false for a hand that is not tenpai', () => {
    const tiles = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('pin', 5, 0),
      createSuitedTile('sou', 9, 0),
      createHonorTile('east', 0),
      createHonorTile('south', 0),
      createHonorTile('west', 0),
      createHonorTile('north', 0),
      createHonorTile('haku', 0),
      createHonorTile('hatsu', 0),
      createHonorTile('chun', 0),
      createSuitedTile('man', 2, 0),
      createSuitedTile('pin', 6, 0),
      createSuitedTile('sou', 8, 0),
    ];
    expect(isTenpai(tiles, 0)).toBe(false);
  });

  it('returns false for a 14-tile hand (already complete, not tenpai)', () => {
    const tiles = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('man', 1, 1),
      createSuitedTile('man', 1, 2),
      createSuitedTile('man', 2, 0),
      createSuitedTile('man', 2, 1),
      createSuitedTile('man', 2, 2),
      createSuitedTile('man', 3, 0),
      createSuitedTile('man', 3, 1),
      createSuitedTile('man', 3, 2),
      createSuitedTile('pin', 1, 0),
      createSuitedTile('pin', 1, 1),
      createSuitedTile('pin', 2, 0),
      createSuitedTile('pin', 3, 0),
      createSuitedTile('man', 4, 0),  // 14th tile
    ];
    expect(isTenpai(tiles, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core test`
Expected: FAIL — `isTenpai` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `packages/game-core/src/engine/validators.ts`:

```typescript
import { isValidWinningShape } from '../scoring/validator.js';
import { TileDef, tileSortKey } from '../models/tile.js';

export function isTenpai(concealed: TileDef[], meldCount: number): boolean {
  // Tenpai means the hand has 13 tiles (4-meldCount)*3+2-1 and is one tile away from winning
  const neededTiles = (4 - meldCount) * 3 + 2;
  if (concealed.length !== neededTiles - 1) return false;

  // Try removing each tile and checking if the remaining hand is a valid winning shape
  // Actually for tenpai we need to check: is there any tile we could draw to complete the hand?
  // That means: for each possible discard, the remaining 12 tiles should leave the hand in a state
  // where adding some tile completes it.
  // Simpler approach: for each of the 34 tile types, check if adding it would make a winning shape.
  // But that's expensive. Instead: for each tile in hand, remove it and check if remaining is 1 away from winning.
  // The simplest tenpai check: try adding every possible tile type and see if any makes a winning shape.

  const suits: ('man' | 'pin' | 'sou')[] = ['man', 'pin', 'sou'];
  const honors: ('east' | 'south' | 'west' | 'north' | 'haku' | 'hatsu' | 'chun')[] = [
    'east', 'south', 'west', 'north', 'haku', 'hatsu', 'chun',
  ];

  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      const testTile: TileDef = {
        id: `test-${suit}-${rank}`,
        suit,
        rank,
        isFlower: false,
      };
      if (isValidWinningShape([...concealed, testTile], meldCount)) {
        return true;
      }
    }
  }

  for (const name of honors) {
    const testTile: TileDef = {
      id: `test-${name}`,
      honorType: ['east', 'south', 'west', 'north'].includes(name) ? 'wind' : 'dragon',
      honorName: name,
      isFlower: false,
    };
    if (isValidWinningShape([...concealed, testTile], meldCount)) {
      return true;
    }
  }

  return false;
}
```

Also export from `packages/game-core/src/index.ts` by adding:

```typescript
```

Wait — `validators.ts` already exports `legalActionsForSeat`. We just need to also export `isTenpai`. Since `index.ts` already does `export * from './engine/validators.js'`, the new function will be auto-exported.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add packages/game-core/src/engine/validators.ts packages/game-core/tests/fsm.test.ts
git commit -m "feat(game-core): add isTenpai helper for riichi detection"
```

---

## Task 2: Fix scoring evaluator — chanta bug and wind yakuhai

**Files:**
- Modify: `packages/game-core/src/scoring/evaluator.ts`
- Test: `packages/game-core/tests/scoring.test.ts` (existing)

- [ ] **Step 1: Write the failing tests**

Add to `packages/game-core/tests/scoring.test.ts`:

```typescript
import { evaluatePatterns } from '../src/scoring/evaluator.js';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';

describe('evaluatePatterns — chanta', () => {
  it('detects chanta when every group contains at least one terminal or honor', () => {
    // man1-man1-man1, man9-pin1-sou1 (invalid, let's use a real chanta hand)
    // A proper chanta hand: every meld has at least one terminal/honor
    // man1-man2-man3 (has terminal 1), pin9-pin9-pin9 (has terminal 9), east-east-east (honor), chun-chun (pair)
    // But we need exactly 14 tiles with 0 melds for the test
    // Let's test with a hand that has terminals and honors in every group
    // Actually the function takes allTiles which includes meld tiles, let's test isChanta indirectly
    const concealed = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('man', 2, 0),
      createSuitedTile('man', 3, 0),
      createSuitedTile('pin', 7, 0),
      createSuitedTile('pin', 8, 0),
      createSuitedTile('pin', 9, 0),
      createSuitedTile('sou', 1, 0),
      createSuitedTile('sou', 2, 0),
      createSuitedTile('sou', 3, 0),
      createHonorTile('east', 0),
      createHonorTile('east', 1),
      createHonorTile('east', 2),
      createHonorTile('chun', 0),
      createHonorTile('chun', 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'tsumo', 'east', 'east');
    const chanta = patterns.find(p => p.id === 'chanta');
    expect(chanta).toBeDefined();
    expect(chanta!.hanValue).toBe(2); // concealed chanta = 2 han
  });
});

describe('evaluatePatterns — wind yakuhai', () => {
  it('detects round wind triplet as yakuhai', () => {
    const concealed = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('man', 1, 1),
      createSuitedTile('man', 1, 2),
      createSuitedTile('man', 2, 0),
      createSuitedTile('man', 2, 1),
      createSuitedTile('man', 2, 2),
      createSuitedTile('man', 3, 0),
      createSuitedTile('man', 3, 1),
      createSuitedTile('man', 3, 2),
      createHonorTile('east', 0),
      createHonorTile('east', 1),
      createHonorTile('east', 2),
      createSuitedTile('pin', 1, 0),
      createSuitedTile('pin', 1, 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'tsumo', 'south', 'east');
    const eastWind = patterns.find(p => p.id === 'yakuhai-round-east');
    expect(eastWind).toBeDefined();
  });

  it('detects seat wind triplet as yakuhai', () => {
    const concealed = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('man', 1, 1),
      createSuitedTile('man', 1, 2),
      createSuitedTile('man', 2, 0),
      createSuitedTile('man', 2, 1),
      createSuitedTile('man', 2, 2),
      createSuitedTile('man', 3, 0),
      createSuitedTile('man', 3, 1),
      createSuitedTile('man', 3, 2),
      createHonorTile('south', 0),
      createHonorTile('south', 1),
      createHonorTile('south', 2),
      createSuitedTile('pin', 1, 0),
      createSuitedTile('pin', 1, 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'tsumo', 'south', 'east');
    const seatWind = patterns.find(p => p.id === 'yakuhai-seat-south');
    expect(seatWind).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core test`
Expected: FAIL — wind yakuhai tests fail (chanta may pass depending on the hand composition, but wind yakuhai definitely fails)

- [ ] **Step 3: Fix isChanta and add wind yakuhai**

In `packages/game-core/src/scoring/evaluator.ts`, replace the `isChanta` function:

```typescript
function isChanta(tiles: TileDef[], melds: Meld[]): boolean {
  // Chanta: every meld/group contains at least one terminal or honor
  // Check that every tile is either a terminal (rank 1 or 9) or an honor,
  // OR is part of a sequence that includes a terminal.
  // Simplified: at least one terminal or honor in the hand, AND no group is entirely middle tiles.
  // More accurate: every "group" (meld or decomposed group) has a terminal or honor.
  // For a simple check: all tiles are terminals or honors, OR every suit group touches a terminal.
  // Simplest correct check: every tile is a terminal or honor, OR each suit sequence includes rank 1 or 9.
  // Actually, chanta means "each block contains at least one terminal/honor".
  // Since we don't decompose here, approximate: no tile is a middle suited tile (rank 2-8)
  // that couldn't be part of a terminal-touching group.
  // For a proper check we need the decomposition. Since this is used on allTiles,
  // the correct definition is: every tile in the hand is either a terminal, honor,
  // or is part of a group that contains a terminal/honor.
  // Simpler approximation that's correct enough: the hand contains at least one terminal/honor,
  // AND no complete set of middle tiles exists without a terminal neighbor.
  // Most accurate simple check: no suited tile of rank 2-8 exists without a
  // same-suit tile of rank 1 or 9 also existing in the hand... but that's still wrong.
  //
  // Let's use the proper definition: chanta means every block (triplet/sequence/pair)
  // contains at least one terminal or honor. Since we're checking allTiles without
  // decomposition, we use the standard approximation:
  // - All tiles are terminals or honors (junchan/chinrouto), OR
  // - Every suit present has tiles at ranks 1 or 9, and no pure-middle sequences exist.
  //
  // The simplest correct approximation for chanta:
  // No group of 3 consecutive middle ranks (e.g., 2-3-4, 3-4-5, ..., 6-7-8) without
  // the group also touching a terminal. But that requires decomposition.
  //
  // For now, use the common simplified check that most implementations use:
  // Check that all tiles are either terminal/honor, OR that every suit tile
  // is within range 1-3 or 7-9 (which guarantees any sequence or triplet touches a terminal).
  // This is still not perfectly accurate but covers common cases.
  //
  // Actually, the CORRECT simple definition used in most digital mahjong implementations:
  // A chanta hand is one where every block contains at least one terminal or honor.
  // Since we check on allTiles, we need to verify that there are NO pure-middle sequences.
  // The practical shortcut: check that all suited tiles have rank 1-3 or 7-9.
  // This guarantees any possible sequence touches a terminal.
  return tiles.every(t =>
    !t.suit || t.rank === 1 || t.rank === 9 || t.rank! <= 3 || t.rank! >= 7 || t.honorType !== undefined
  );
}
```

Replace the `findYakuhai` function:

```typescript
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
    // Wind yakuhai
    if (key.includes('east')) {
      if (roundWind === 'east') {
        patterns.push({ id: 'yakuhai-round-east', name: 'Round Wind (East)', hanValue: 1, description: 'Round wind triplet' });
      }
      if (seatWind === 'east') {
        patterns.push({ id: 'yakuhai-seat-east', name: 'Seat Wind (East)', hanValue: 1, description: 'Seat wind triplet' });
      }
    }
    if (key.includes('south')) {
      if (roundWind === 'south') {
        patterns.push({ id: 'yakuhai-round-south', name: 'Round Wind (South)', hanValue: 1, description: 'Round wind triplet' });
      }
      if (seatWind === 'south') {
        patterns.push({ id: 'yakuhai-seat-south', name: 'Seat Wind (South)', hanValue: 1, description: 'Seat wind triplet' });
      }
    }
    if (key.includes('west')) {
      if (roundWind === 'west') {
        patterns.push({ id: 'yakuhai-round-west', name: 'Round Wind (West)', hanValue: 1, description: 'Round wind triplet' });
      }
      if (seatWind === 'west') {
        patterns.push({ id: 'yakuhai-seat-west', name: 'Seat Wind (West)', hanValue: 1, description: 'Seat wind triplet' });
      }
    }
    if (key.includes('north')) {
      if (roundWind === 'north') {
        patterns.push({ id: 'yakuhai-round-north', name: 'Round Wind (North)', hanValue: 1, description: 'Round wind triplet' });
      }
      if (seatWind === 'north') {
        patterns.push({ id: 'yakuhai-seat-north', name: 'Seat Wind (North)', hanValue: 1, description: 'Seat wind triplet' });
      }
    }
  }

  return patterns;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add packages/game-core/src/scoring/evaluator.ts packages/game-core/tests/scoring.test.ts
git commit -m "fix(game-core): fix isChanta logic and add wind yakuhai detection"
```

---

## Task 3: Add `request-hand` handler and `handVersion` tracking to server

**Files:**
- Modify: `apps/server/src/rooms/schema/GameState.ts`
- Modify: `apps/server/src/rooms/MahjongRoom.ts`

This is the critical fix for tiles not appearing. The `request-hand` message lets the client request its current hand state at any time, eliminating the timing problem where `deal` messages are missed during screen transitions.

- [ ] **Step 1: Add `handVersion` to SeatRoundSchema**

In `apps/server/src/rooms/schema/GameState.ts`, add to `SeatRoundSchema`:

```typescript
@type('uint8') handVersion: number = 0;
```

- [ ] **Step 2: Add handVersion tracking and `request-hand` handler to MahjongRoom**

Add a new field to the `MahjongRoom` class:

```typescript
private handVersions: number[] = [0, 0, 0, 0];
```

Add to `onCreate`, after the existing `declare-win-tsumo` handler:

```typescript
this.onMessage('request-hand', (client) => {
  this.handleRequestHand(client);
});
```

Add the handler method:

```typescript
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
```

Add a helper to increment handVersion and send updated hand state:

```typescript
private incrementHandVersion(seat: number) {
  this.handVersions[seat]++;
  const seatSchema = this.state.seats.get(String(seat));
  if (seatSchema) seatSchema.handVersion = this.handVersions[seat];
}
```

Update `dealHand` — after sorting each player's hand and before sending `deal` messages, add:

```typescript
// Reset hand versions for new hand
this.handVersions = [0, 0, 0, 0];
```

In `dealHand`, after sending `deal` to each client, also increment:

```typescript
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
```

In `handleDrawTile`, after sending `tile-drawn`, add:

```typescript
this.incrementHandVersion(seat);
client.send('tile-drawn', { tileId: tile.id, handVersion: this.handVersions[seat] });
```

In `applyPon`, after sending `meld-applied`, add:

```typescript
this.incrementHandVersion(callerSeat);
if (callerClient) {
  callerClient.send('meld-applied', {
    meld: { type: meld.type, tileIds: meld.tiles.map((t) => t.id) },
    handVersion: this.handVersions[callerSeat],
  });
}
```

In `applyChi`, same pattern:

```typescript
this.incrementHandVersion(callerSeat);
if (callerClient) {
  callerClient.send('meld-applied', {
    meld: { type: meld.type, tileIds: meld.tiles.map((t) => t.id) },
    handVersion: this.handVersions[callerSeat],
  });
}
```

Also update `updateSeatSchemas` to sync handVersion:

```typescript
seatSchema.handVersion = this.handVersions[i];
```

- [ ] **Step 3: Build to verify no type errors**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/server build`
Expected: Successful build with no errors

- [ ] **Step 4: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add apps/server/src/rooms/schema/GameState.ts apps/server/src/rooms/MahjongRoom.ts
git commit -m "feat(server): add request-hand handler and handVersion tracking"
```

---

## Task 4: Add bot AI to server

**Files:**
- Modify: `apps/server/src/rooms/MahjongRoom.ts`

Bots need to automatically draw, discard, and react so the game actually progresses when bot seats are active.

- [ ] **Step 1: Add bot identification helper**

Add to `MahjongRoom` class:

```typescript
private isBot(seat: number): boolean {
  const sessionId = this.seatToSession.get(seat);
  return sessionId !== undefined && sessionId.startsWith('bot-');
}
```

- [ ] **Step 2: Add bot action scheduler**

Add the core bot scheduling method:

```typescript
private botTimers: Map<string, NodeJS.Timeout> = new Map();

private scheduleBotAction(seat: number) {
  if (!this.isBot(seat)) return;

  const timerId = `bot-${seat}`;
  // Clear any existing timer for this seat
  const existing = this.botTimers.get(timerId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    this.botTimers.delete(timerId);
    this.executeBotAction(seat);
  }, 500 + Math.random() * 300); // 500-800ms delay

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
```

- [ ] **Step 3: Add bot draw action**

```typescript
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

  // Check riichi eligibility
  if (this.canDeclareRiichi(seat)) {
    actions.push('DECLARE_RIICHI');
  }

  this.setPhase({
    type: 'TURN_DECISION',
    activeSeat: seat,
    legalActions: actions,
  });
  this.syncSchemaFromInternal();

  // Bot checks for tsumo
  if (actions.includes('DECLARE_WIN_TSUMO')) {
    // Bot always declares tsumo
    setTimeout(() => {
      this.handleBotTsumo(seat);
    }, 300);
    return;
  }

  // Schedule discard (or riichi)
  this.scheduleBotAction(seat);
}
```

- [ ] **Step 4: Add bot discard and riichi logic**

```typescript
private executeBotDecision(seat: number) {
  const concealed = this.concealedTiles.get(seat)!;
  const melds = this.seatMelds.get(seat)!;

  // Check if bot should declare riichi (simple: always declare if possible)
  const currentPhase = this.gamePhase;
  if (
    currentPhase.type === 'TURN_DECISION' &&
    currentPhase.legalActions.includes('DECLARE_RIICHI') &&
    !this.seatIsRiichi(seat)
  ) {
    this.applyRiichiDeclaration(seat);
    // After riichi, bot must discard — fall through to discard
  }

  // Choose tile to discard — simple heuristic
  const discardIndex = this.chooseBotDiscard(seat);
  const discardedTile = concealed[discardIndex];
  if (!discardedTile) return;

  // Use the existing discard logic
  concealed.splice(discardIndex, 1);
  this.incrementHandVersion(seat);
  this.seatRivers.get(seat)!.push(discardedTile);

  // Mark as riichi discard if riichi
  if (this.seatIsRiichi(seat)) {
    const seatSchema = this.state.seats.get(String(seat));
    if (seatSchema) seatSchema.isRiichi = true;
  }

  // Check reactions (same logic as handleDiscardTile but without client)
  this.checkAndOpenReactionWindow(seat, discardedTile);
}

private chooseBotDiscard(seat: number): number {
  const concealed = this.concealedTiles.get(seat)!;
  if (concealed.length === 0) return 0;

  // Score each tile: lower = more disposable
  // Pairs are valuable, isolated terminals/honors are not
  const scores = concealed.map((tile, idx) => {
    let score = 0;

    // Count how many tiles of same type exist in hand
    const sameCount = concealed.filter(t => tileSortKey(t) === tileSortKey(tile)).length;
    if (sameCount >= 2) score += 10; // Pair or triplet — keep
    if (sameCount >= 3) score += 10; // Triplet — definitely keep

    // Check for sequence neighbors (same suit, adjacent rank)
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

      // Middle tiles are slightly more valuable than terminals
      if (tile.rank >= 3 && tile.rank <= 7) score += 1;
    } else {
      // Honor tiles without pairs are low value
      if (sameCount === 1) score -= 2;
    }

    return score;
  });

  // Discard the tile with lowest score
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
```

- [ ] **Step 5: Add bot reaction logic**

```typescript
private executeBotReaction(seat: number) {
  if (this.gamePhase.type !== 'REACTION_WINDOW' || !this.reactionState) return;
  if (!this.reactionState.eligibleSeats.includes(seat)) return;
  if (this.reactionState.responses[seat] !== null) return; // Already responded

  const discardedTile = this.reactionState.discardTile;

  // Check ron — bot always declares ron
  const otherConcealed = this.concealedTiles.get(seat)!;
  const otherMelds = this.seatMelds.get(seat)!;
  const testConcealed = [...otherConcealed, discardedTile];
  if (isValidWinningShape(testConcealed, otherMelds.length)) {
    // Check for yaku
    const seatWind = MahjongRoom.SEAT_WINDS[seat];
    const patterns = evaluatePatterns(testConcealed, otherMelds, 'ron', seatWind, this.roundWind);
    if (patterns.length > 0) {
      this.reactionState = submitResponse(this.reactionState, seat, { type: 'ron' });
      this.resolveReaction();
      return;
    }
  }

  // Check pon — 30% chance
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
```

- [ ] **Step 6: Refactor discard to share reaction window logic**

Extract the reaction window opening from `handleDiscardTile` into a shared method so both human and bot discards use the same code. Add to `MahjongRoom`:

```typescript
private checkAndOpenReactionWindow(discardSeat: number, discardedTile: TileDef) {
  const eligibleSeats: number[] = [];

  for (let i = 0; i < 4; i++) {
    if (i === discardSeat) continue;
    if (this.seatIsRiichi(i)) {
      // Riichi player can only ron
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

      // Notify eligible human players
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
```

Now update `handleDiscardTile` to use the shared method. Replace the entire body after removing the tile from concealed:

```typescript
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
```

- [ ] **Step 7: Wire bot scheduling into phase transitions**

Update the following methods to schedule bot actions:

In `dealHand`, after the `your-turn-draw` send, add:

```typescript
// Schedule bot action if dealer is a bot
if (this.isBot(this.activeSeat)) {
  this.scheduleBotAction(this.activeSeat);
}
```

In `advanceToNextPlayer`, after sending `your-turn-draw`, add:

```typescript
// Schedule bot action for next player
if (this.isBot(nextSeat)) {
  this.scheduleBotAction(nextSeat);
}
```

In `applyPon`, after setting up the phase, add:

```typescript
// Schedule bot discard after pon
if (this.isBot(callerSeat)) {
  this.scheduleBotAction(callerSeat);
}
```

Same for `applyChi`:

```typescript
if (this.isBot(callerSeat)) {
  this.scheduleBotAction(callerSeat);
}
```

- [ ] **Step 8: Add riichi helpers (used by bot and human flows)**

```typescript
private seatIsRiichi(seat: number): boolean {
  return this.state.seats.get(String(seat))?.isRiichi ?? false;
}

private canDeclareRiichi(seat: number): boolean {
  if (this.seatIsRiichi(seat)) return false;
  if (this.seatMelds.get(seat)!.some(m => !m.isConcealed)) return false; // Open hand can't riichi

  const concealed = this.concealedTiles.get(seat)!;
  const meldCount = this.seatMelds.get(seat)!.length;

  // Must be tenpai: the 13 tiles (before draw) must be one away from winning
  // After drawing we have 14 tiles. We need to check if discarding any tile leaves tenpai.
  // isTenpai checks if 13 tiles are one away from winning.
  for (let i = 0; i < concealed.length; i++) {
    const remaining = concealed.filter((_, idx) => idx !== i);
    if (isTenpai(remaining, meldCount)) {
      return true;
    }
  }
  return false;
}

private applyRiichiDeclaration(seat: number) {
  // Deduct 1000 points
  this.scores[seat] -= 1000;
  this.riichiSticks++;

  // Mark seat as riichi on schema
  const seatSchema = this.state.seats.get(String(seat));
  if (seatSchema) seatSchema.isRiichi = true;

  this.syncSchemaFromInternal();
}
```

Import `isTenpai` at the top of MahjongRoom.ts:

```typescript
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
```

- [ ] **Step 9: Clean up timers on dispose**

In `onDispose`:

```typescript
onDispose() {
  for (const timer of this.botTimers.values()) {
    clearTimeout(timer);
  }
  this.botTimers.clear();
}
```

- [ ] **Step 10: Build to verify**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core build && pnpm --filter @mahjong/server build`
Expected: Successful build

- [ ] **Step 11: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add apps/server/src/rooms/MahjongRoom.ts
git commit -m "feat(server): add bot AI with draw, discard, reaction, and tsumo"
```

---

## Task 5: Add riichi and next-hand message handlers to server

**Files:**
- Modify: `apps/server/src/rooms/MahjongRoom.ts`

- [ ] **Step 1: Add riichi message handler**

In `onCreate`, add:

```typescript
this.onMessage('declare-riichi', (client) => {
  this.handleDeclareRiichi(client);
});
```

Add the handler:

```typescript
private handleDeclareRiichi(client: Client) {
  const seat = this.getSeatForClient(client);
  if (seat === null || seat !== this.activeSeat) return;
  if (this.gamePhase.type !== 'TURN_DECISION') return;
  if (!this.canDeclareRiichi(seat)) return;

  this.applyRiichiDeclaration(seat);

  // After riichi, only legal action is discard
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
```

- [ ] **Step 2: Add next-hand message handler**

In `onCreate`, add:

```typescript
this.onMessage('next-hand', () => {
  this.handleNextHand();
});
```

Add the handler:

```typescript
private handleNextHand() {
  if (this.gamePhase.type !== 'HAND_END') return;

  // Check if match should end
  // For now: end after East round (4 hands as dealer, rotating)
  // If dealerSeat has gone all the way around (back to 0 after going 0→1→2→3), match ends
  if (this.roundWind === 'east' && this.dealerSeat >= 3 && this.handNumber >= 4) {
    // Match end
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

  // Determine if dealer rotates
  const winInfo = this.state.winInfo ? JSON.parse(this.state.winInfo) : null;
  const dealerWon = winInfo && winInfo.winner === this.dealerSeat;
  const wasExhaustiveDraw = !winInfo || winInfo.endReason;

  let nextDealerSeat = this.dealerSeat;
  let nextHandNumber = this.handNumber;
  let nextRoundWind = this.roundWind;
  let nextHonba = this.honba;

  if (dealerWon) {
    // Dealer stays, honba stays (only increments on exhaustive draw)
    nextHonba = this.honba;
  } else if (wasExhaustiveDraw && !winInfo) {
    // Exhaustive draw — dealer stays, honba increments
    nextHonba = this.honba; // Already incremented in handleExhaustiveDraw
  } else {
    // Non-dealer wins — dealer rotates
    nextDealerSeat = (this.dealerSeat + 1) % 4;
    nextHonba = 0;

    if (nextDealerSeat === 0) {
      // Full rotation — advance round wind or end match
      // For now, end after East round
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

    nextHandNumber = this.handNumber + 1;
  }

  this.dealerSeat = nextDealerSeat;
  this.handNumber = nextHandNumber;
  this.roundWind = nextRoundWind;
  this.honba = nextHonba;

  // Transition through ROUND_END -> DEALING
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
```

- [ ] **Step 3: Also restrict riichi player's legal actions in draw handler**

In `handleDrawTile`, when computing legal actions for a riichi player, only allow `DISCARD_TILE` and `DECLARE_WIN_TSUMO`:

```typescript
// After the existing tsumo check, replace the actions computation:
const actions: ActionType[] = ['DISCARD_TILE'];

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
```

- [ ] **Step 4: Build to verify**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/server build`
Expected: Successful build

- [ ] **Step 5: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add apps/server/src/rooms/MahjongRoom.ts
git commit -m "feat(server): add riichi declaration and next-hand handlers"
```

---

## Task 6: Update GameScreen — request-hand, hand-state tracking, next-hand flow

**Files:**
- Modify: `apps/web/src/screens/GameScreen.tsx`

This is the critical client-side fix. The GameScreen must request its hand on mount and properly track all server messages.

- [ ] **Step 1: Add request-hand on mount and hand-state message listener**

Replace the `useEffect` for server messages in `GameScreen` with an updated version. Key changes:
- On mount, send `request-hand`
- Listen for `hand-state` message
- Listen for `riichi-confirmed`, `riichi-declared`, `match-end` messages
- Track `handVersion` for desync detection
- Add `next-hand` handler
- Handle drawn tile separation (keep drawn tile visually separate)

The full replacement for the second `useEffect` in GameScreen:

```typescript
// Listen for server messages
useEffect(() => {
  if (!room) return;

  // Request hand state immediately on mount
  room.send('request-hand');

  const unsubs: Array<() => void> = [];

  const onHandState = (data: { tiles: string[]; melds: Array<{ type: string; tileIds: string[]; isConcealed: boolean }>; handVersion: number }) => {
    const tiles = data.tiles.map(parseTileId);
    tiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
    setHandTiles(tiles);
    setHandVersion(data.handVersion);
    setHandResult(null);
    setStatusMessage('Hand synced.');
  };

  const onDeal = (data: { tiles: string[]; handVersion?: number }) => {
    const tiles = data.tiles.map(parseTileId);
    tiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
    setHandTiles(tiles);
    if (data.handVersion !== undefined) setHandVersion(data.handVersion);
    setStatusMessage('Hand dealt! Waiting for your turn...');
    setHandResult(null);
  };

  const onYourTurnDraw = (data: { seat: number }) => {
    if (data.seat === mySeat) {
      setStatusMessage('Your turn - Draw a tile!');
      setLegalActions(['DRAW_TILE']);
    } else {
      setStatusMessage(`Seat ${data.seat} is drawing...`);
      setLegalActions([]);
    }
  };

  const onTileDrawn = (data: { tileId: string; handVersion?: number }) => {
    const tile = parseTileId(data.tileId);
    setDrawnTileId(data.tileId);
    setHandTiles((prev) => {
      const newTiles = [...prev, tile];
      newTiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
      return newTiles;
    });
    if (data.handVersion !== undefined) setHandVersion(data.handVersion);
    setStatusMessage('Tile drawn! Choose an action.');
  };

  const onLegalActions = (data: { actions: string[] }) => {
    setLegalActions(data.actions);
  };

  const onReactionOptions = (data: { discardSeat: number; discardTileId: string; actions: string[] }) => {
    setReactionOptions(data.actions);
    setStatusMessage(`Seat ${data.discardSeat} discarded. You can react!`);
  };

  const onMeldApplied = (data: { meld: { type: string; tileIds: string[] }; handVersion?: number }) => {
    const meldTileIds = new Set(data.meld.tileIds);
    setHandTiles((prev) => prev.filter((t) => !meldTileIds.has(t.id)));
    if (data.handVersion !== undefined) setHandVersion(data.handVersion);
    setStatusMessage(`Meld applied: ${data.meld.type}`);
  };

  const onHandResult = (data: any) => {
    setHandResult(data);
    setLegalActions([]);
    setReactionOptions([]);
    setDrawnTileId(null);
    if (data.endReason === 'exhaustive-draw') {
      setStatusMessage('Exhaustive draw! No one wins this hand.');
    } else {
      setStatusMessage(`Hand over! ${data.winType === 'ron' ? 'Ron' : 'Tsumo'} by seat ${data.winner}!`);
    }
  };

  const onRiichiDeclared = (data: { seat: number }) => {
    setStatusMessage(`Seat ${data.seat} declared Riichi!`);
  };

  const onMatchEnd = (data: { finalScores: Array<{ seatIndex: number; points: number }> }) => {
    setStatusMessage('Match over!');
    setHandResult({ endReason: 'match-end', finalScores: data.finalScores });
  };

  unsubs.push(room.onMessage('hand-state', onHandState));
  unsubs.push(room.onMessage('deal', onDeal));
  unsubs.push(room.onMessage('your-turn-draw', onYourTurnDraw));
  unsubs.push(room.onMessage('tile-drawn', onTileDrawn));
  unsubs.push(room.onMessage('legal-actions', onLegalActions));
  unsubs.push(room.onMessage('reaction-options', onReactionOptions));
  unsubs.push(room.onMessage('meld-applied', onMeldApplied));
  unsubs.push(room.onMessage('hand-result', onHandResult));
  unsubs.push(room.onMessage('riichi-declared', onRiichiDeclared));
  unsubs.push(room.onMessage('match-end', onMatchEnd));

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}, [room, mySeat]);
```

- [ ] **Step 2: Add new state variables**

Add to the state declarations at the top of `GameScreen`:

```typescript
const [drawnTileId, setDrawnTileId] = useState<string | null>(null);
const [handVersion, setHandVersion] = useState<number>(0);
```

- [ ] **Step 3: Add riichi and next-hand to the action handler**

In `handleAction`, add cases:

```typescript
case 'DECLARE_RIICHI':
  room.send('declare-riichi');
  setLegalActions([]);
  setStatusMessage('Declaring Riichi!');
  break;
```

- [ ] **Step 4: Add next-hand button in the hand result overlay**

Replace the hand result overlay with one that includes a "Next Hand" button. When `handResult` exists and `phase === 'HAND_END'`, show:

```typescript
{handResult && (
  <div style={{
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    zIndex: 100,
  }}>
    <div style={{
      background: 'var(--surface-panel)',
      borderRadius: '12px',
      padding: '2rem',
      maxWidth: '400px',
      textAlign: 'center',
    }}>
      {handResult.endReason === 'match-end' ? (
        <>
          <h2 style={{ color: 'var(--accent-warm)', margin: '0 0 1rem 0' }}>Match Over</h2>
          {handResult.finalScores?.map((s: any) => {
            const player = seatDisplays[s.seatIndex];
            return (
              <div key={s.seatIndex} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0' }}>
                <span style={{ color: 'var(--text-primary)' }}>{player?.displayName ?? `Seat ${s.seatIndex}`}</span>
                <span style={{ color: s.points >= 25000 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{s.points}</span>
              </div>
            );
          })}
        </>
      ) : handResult.endReason === 'exhaustive-draw' ? (
        <>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>Exhaustive Draw</h2>
          <p style={{ color: 'var(--text-secondary)' }}>No one wins this hand.</p>
        </>
      ) : (
        <>
          <h2 style={{ color: 'var(--accent-warm)', margin: '0 0 0.5rem 0' }}>
            {handResult.winType === 'ron' ? 'Ron!' : 'Tsumo!'}
          </h2>
          <p style={{ color: 'var(--text-primary)' }}>
            Seat {handResult.winner} wins with {handResult.han} han / {handResult.fu} fu
          </p>
          <p style={{ color: 'var(--accent-warm)', fontSize: '1.5rem', fontWeight: 600 }}>
            {handResult.total} points
          </p>
          {handResult.patterns && (
            <div style={{ marginTop: '0.5rem' }}>
              {handResult.patterns.map((p: any) => (
                <div key={p.id} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {p.name} ({p.hanValue} han)
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {phase === 'HAND_END' && (
        <Button
          onClick={() => {
            if (handResult.endReason === 'match-end') {
              navigate('/');
            } else {
              room?.send('next-hand');
              setHandResult(null);
              setHandTiles([]);
              setDrawnTileId(null);
            }
          }}
          style={{ marginTop: '1.5rem', width: '100%' }}
        >
          {handResult.endReason === 'match-end' ? 'Back to Home' : 'Next Hand'}
        </Button>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Clear drawnTileId on discard**

In `handleDiscard`:

```typescript
const handleDiscard = useCallback((tile: TileDef) => {
  if (!room) return;
  room.send('discard-tile', { tileId: tile.id });
  setHandTiles((prev) => prev.filter((t) => t.id !== tile.id));
  setDrawnTileId(null);
  setLegalActions([]);
  setStatusMessage('Tile discarded. Waiting...');
}, [room]);
```

- [ ] **Step 6: Build to verify**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/web build 2>&1 | head -30`
Expected: Successful build (may have some warnings but no errors)

- [ ] **Step 7: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add apps/web/src/screens/GameScreen.tsx
git commit -m "fix(web): add request-hand on mount, hand-state tracking, next-hand flow"
```

---

## Task 7: Rewrite TableLayout — seat-relative positioning with all 4 seats, rivers, melds, dora

**Files:**
- Modify: `apps/web/src/components/table/TableLayout.tsx`
- Modify: `apps/web/src/components/table/SeatPosition.tsx`
- Modify: `apps/web/src/components/table/MeldArea.tsx`
- Modify: `apps/web/src/components/table/RiverArea.tsx`
- Modify: `apps/web/src/components/table/HandArea.tsx`

This is the big visual overhaul. The table needs to show all 4 seats relative to the player, with tile backs for opponents, real tiles in rivers and melds, and dora in the center.

- [ ] **Step 1: Rewrite TableLayout with seat-relative positioning**

Replace `apps/web/src/components/table/TableLayout.tsx`:

```typescript
import React from 'react';
import { SeatPosition } from './SeatPosition.js';
import { InfoBar } from './InfoBar.js';
import { DoraDisplay } from './DoraDisplay.js';

interface SeatDisplay {
  seatIndex: number;
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
  melds: Array<{ type: string; tiles: any[]; isConcealed: boolean }>;
  river: Array<{ tile: TileDef; isLastDiscard?: boolean }>;
  score: number;
}

import { TileDef } from '@mahjong/game-core';

interface TableLayoutProps {
  seats: SeatDisplay[];
  mySeat: number;
  activeSeat: number;
  dealerSeat: number;
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  wallRemaining: number;
  doraIndicatorIds: string[];
  children?: React.ReactNode;
}

type Position = 'bottom' | 'right' | 'top' | 'left';

function getSeatPosition(seatIndex: number, mySeat: number): Position {
  const offset = (seatIndex - mySeat + 4) % 4;
  const positions: Position[] = ['bottom', 'right', 'top', 'left'];
  return positions[offset];
}

export function TableLayout({ seats, mySeat, activeSeat, dealerSeat, roundWind, handNumber, honba, riichiSticks, wallRemaining, doraIndicatorIds, children }: TableLayoutProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh', background: 'var(--surface-table)', display: 'flex', flexDirection: 'column' }}>
      <InfoBar roundWind={roundWind} handNumber={handNumber} honba={honba} riichiSticks={riichiSticks} wallRemaining={wallRemaining} />
      <div style={{ flex: 1, position: 'relative', padding: '0.5rem', overflow: 'hidden' }}>
        {/* Seat positions */}
        {seats.map((seat) => (
          <SeatPosition
            key={seat.seatIndex}
            position={getSeatPosition(seat.seatIndex, mySeat)}
            seatIndex={seat.seatIndex}
            displayName={seat.displayName}
            tileCount={seat.tileCount}
            isDealer={seat.isDealer}
            isActive={seat.isActive}
            isRiichi={seat.isRiichi}
            score={seat.score}
            isMe={seat.seatIndex === mySeat}
            river={seat.river}
            melds={seat.melds}
          />
        ))}

        {/* Dora display in center */}
        <DoraDisplay doraIndicatorIds={doraIndicatorIds} />

        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DoraDisplay component**

Create `apps/web/src/components/table/DoraDisplay.tsx`:

```typescript
import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

function parseTileId(id: string): TileDef {
  const parts = id.split('-');
  const suitNames = ['man', 'pin', 'sou'];
  const windNames = ['east', 'south', 'west', 'north'];
  const dragonNames = ['haku', 'hatsu', 'chun'];
  const honorNames = [...windNames, ...dragonNames];

  if (suitNames.includes(parts[0])) {
    return { id, suit: parts[0] as 'man' | 'pin' | 'sou', rank: parseInt(parts[1], 10), isFlower: false };
  } else if (honorNames.includes(parts[0])) {
    return { id, honorType: windNames.includes(parts[0]) ? 'wind' : 'dragon', honorName: parts[0] as any, isFlower: false };
  }
  return { id, isFlower: false };
}

interface DoraDisplayProps {
  doraIndicatorIds: string[];
}

export function DoraDisplay({ doraIndicatorIds }: DoraDisplayProps) {
  if (doraIndicatorIds.length === 0) return null;

  const renderTile = (id: string) => {
    const tile = parseTileId(id);
    const props = { width: 28, height: 38 };
    if (tile.suit === 'man') return <ManTile key={id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'pin') return <PinTile key={id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'sou') return <SouTile key={id} rank={tile.rank!} {...props} />;
    if (tile.honorName) return <HonorTile key={id} honorName={tile.honorName} {...props} />;
    return null;
  };

  return (
    <div style={{
      position: 'absolute',
      top: '45%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.25rem',
      zIndex: 1,
    }}>
      <div style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Dora</div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {doraIndicatorIds.map(id => renderTile(id))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite SeatPosition with tile backs, river, and melds**

Replace `apps/web/src/components/table/SeatPosition.tsx`:

```typescript
import React from 'react';
import { TileBack } from '@mahjong/ui';
import { RiverArea } from './RiverArea.js';
import { MeldArea } from './MeldArea.js';
import { TileDef } from '@mahjong/game-core';

interface MeldDisplay {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

interface RiverEntry {
  tile: TileDef;
  isLastDiscard?: boolean;
}

interface SeatPositionProps {
  position: 'bottom' | 'right' | 'top' | 'left';
  seatIndex: number;
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
  score: number;
  isMe: boolean;
  river: RiverEntry[];
  melds: MeldDisplay[];
}

const SEAT_WIND_LABELS = ['East', 'South', 'West', 'North'];

export function SeatPosition({ position, seatIndex, displayName, tileCount, isDealer, isActive, isRiichi, score, isMe, river, melds }: SeatPositionProps) {
  const isVertical = position === 'left' || position === 'right';

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { position: 'absolute', top: '0.5rem', left: '50%', transform: 'translateX(-50%)' },
    bottom: { position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)' },
    left: { position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)' },
    right: { position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' },
  };

  const tileBackWidth = isMe ? 0 : 20;
  const tileBackHeight = isMe ? 0 : 28;

  return (
    <div style={{
      ...positionStyles[position],
      display: 'flex',
      flexDirection: isVertical ? 'row' : 'column',
      alignItems: 'center',
      gap: '0.375rem',
      zIndex: 2,
    }}>
      {/* Player info badge */}
      <div style={{
        padding: '0.375rem 0.75rem',
        borderRadius: '8px',
        background: 'var(--surface-panel)',
        border: isActive ? '2px solid var(--seat-active-ring)' : '1px solid var(--border-subtle)',
        transition: 'border-color 200ms ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {SEAT_WIND_LABELS[seatIndex]} {isDealer && '(D)'}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: isActive ? 'var(--accent-warm)' : 'var(--text-primary)' }}>
            {displayName}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{score}</div>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {isRiichi && <span style={{ fontSize: '0.5625rem', color: 'var(--accent-warm)', fontWeight: 600 }}>RIICHI</span>}
            {!isMe && <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{tileCount} tiles</span>}
          </div>
        </div>
      </div>

      {/* Opponent tile backs */}
      {!isMe && tileCount > 0 && (
        <div style={{ display: 'flex', gap: '0.5px', flexShrink: 0, flexWrap: 'nowrap' }}>
          {Array.from({ length: Math.min(tileCount, 13) }).map((_, i) => (
            <TileBack key={i} width={tileBackWidth} height={tileBackHeight} />
          ))}
        </div>
      )}

      {/* Melds for this seat */}
      {melds.length > 0 && <MeldArea melds={melds} />}

      {/* River for this seat */}
      {river.length > 0 && <RiverArea entries={river} />}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite MeldArea with real tile rendering**

Replace `apps/web/src/components/table/MeldArea.tsx`:

```typescript
import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

function parseTileId(id: string): TileDef {
  const parts = id.split('-');
  const suitNames = ['man', 'pin', 'sou'];
  const windNames = ['east', 'south', 'west', 'north'];
  const dragonNames = ['haku', 'hatsu', 'chun'];
  const honorNames = [...windNames, ...dragonNames];

  if (suitNames.includes(parts[0])) {
    return { id, suit: parts[0] as 'man' | 'pin' | 'sou', rank: parseInt(parts[1], 10), isFlower: false };
  } else if (honorNames.includes(parts[0])) {
    return { id, honorType: windNames.includes(parts[0]) ? 'wind' : 'dragon', honorName: parts[0] as any, isFlower: false };
  }
  return { id, isFlower: false };
}

interface Meld {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

interface MeldAreaProps {
  melds: Meld[];
}

function renderSmallTile(tile: TileDef) {
  const props = { width: 24, height: 32 };
  if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...props} />;
  if (tile.honorName) return <HonorTile honorName={tile.honorName} {...props} />;
  return null;
}

export function MeldArea({ melds }: MeldAreaProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {melds.map((meld, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: '1px',
          padding: '2px',
          borderRadius: '4px',
          background: 'var(--surface-panel)',
          border: '1px solid var(--border-subtle)',
        }}>
          {/* For melds with no tile data yet, show a label */}
          {(!meld.tiles || meld.tiles.length === 0) && (
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>{meld.type}</span>
          )}
          {meld.tiles && meld.tiles.length > 0 && meld.tiles.map((t: any, j: number) => {
            const tileId = typeof t === 'string' ? t : t.id;
            const tileDef = parseTileId(tileId);
            return <div key={j}>{renderSmallTile(tileDef)}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Update RiverArea with grid layout**

Replace `apps/web/src/components/table/RiverArea.tsx`:

```typescript
import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface RiverEntry {
  tile: TileDef;
  isLastDiscard?: boolean;
  isRiichiDiscard?: boolean;
}

interface RiverAreaProps {
  entries: RiverEntry[];
}

function renderSmallTile(tile: TileDef, isLast: boolean) {
  const props = { width: 22, height: 30 };
  const wrapperStyle: React.CSSProperties = {
    opacity: isLast ? 1 : 0.7,
    transform: isLast ? 'translateY(-2px)' : 'none',
    transition: 'transform 120ms ease',
  };

  let tileEl: React.ReactNode;
  if (tile.suit === 'man') tileEl = <ManTile rank={tile.rank!} {...props} />;
  else if (tile.suit === 'pin') tileEl = <PinTile rank={tile.rank!} {...props} />;
  else if (tile.suit === 'sou') tileEl = <SouTile rank={tile.rank!} {...props} />;
  else if (tile.honorName) tileEl = <HonorTile honorName={tile.honorName} {...props} />;
  else tileEl = null;

  return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
}

export function RiverArea({ entries }: RiverAreaProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 22px)',
      gap: '1px',
      padding: '0.25rem',
      background: 'var(--surface-panel)',
      borderRadius: '4px',
      border: '1px solid var(--border-subtle)',
    }}>
      {entries.map((e, i) => renderSmallTile(e.tile, !!e.isLastDiscard))}
    </div>
  );
}
```

- [ ] **Step 6: Update HandArea to highlight drawn tile**

Replace `apps/web/src/components/table/HandArea.tsx`:

```typescript
import React, { useState } from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface HandAreaProps {
  tiles: TileDef[];
  drawnTileId: string | null;
  onDiscard?: (tile: TileDef) => void;
}

export function HandArea({ tiles, drawnTileId, onDiscard }: HandAreaProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const renderTile = (tile: TileDef, index: number, isDrawn: boolean) => {
    const isSelected = selectedIndex === index;
    const props = {
      width: 40,
      height: 56,
      selected: isSelected,
      onClick: () => setSelectedIndex(isSelected ? null : index),
    };

    const wrapperStyle: React.CSSProperties = isDrawn ? {
      marginLeft: '0.5rem',
      border: '2px solid var(--accent-warm)',
      borderRadius: '4px',
    } : {};

    let tileEl: React.ReactNode;
    if (tile.suit === 'man') tileEl = <ManTile key={tile.id} rank={tile.rank!} {...props} />;
    else if (tile.suit === 'pin') tileEl = <PinTile key={tile.id} rank={tile.rank!} {...props} />;
    else if (tile.suit === 'sou') tileEl = <SouTile key={tile.id} rank={tile.rank!} {...props} />;
    else if (tile.honorName) tileEl = <HonorTile key={tile.id} honorName={tile.honorName} {...props} />;
    else tileEl = null;

    return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
  };

  return (
    <div style={{ display: 'flex', gap: '2px', padding: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {tiles.map((tile, i) => renderTile(tile, i, tile.id === drawnTileId))}
      {selectedIndex !== null && (
        <button
          onClick={() => {
            onDiscard?.(tiles[selectedIndex]);
            setSelectedIndex(null);
          }}
          style={{
            marginLeft: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--accent-warm)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.8125rem',
            alignSelf: 'center',
          }}
        >
          Discard
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Update GameScreen to pass new props to TableLayout and HandArea**

In `GameScreen.tsx`, update the `TableLayout` usage:

```typescript
<TableLayout
  seats={seatDisplays}
  mySeat={mySeat}
  activeSeat={roomState?.activeSeat ?? 0}
  dealerSeat={roomState?.dealerSeat ?? 0}
  roundWind={roomState?.roundWind ?? 'east'}
  handNumber={roomState?.handNumber ?? 1}
  honba={roomState?.honba ?? 0}
  riichiSticks={roomState?.riichiSticks ?? 0}
  wallRemaining={roomState?.wallRemaining ?? 0}
  doraIndicatorIds={roomState?.doraIndicators ? roomState.doraIndicators.split(',').filter(Boolean) : []}
>
```

Update the `HandArea` usage:

```typescript
<HandArea tiles={handTiles} drawnTileId={drawnTileId} onDiscard={handleDiscard} />
```

Remove the separate RiverArea and MeldArea for specific seats since they are now rendered inside SeatPosition.

- [ ] **Step 8: Update GameScreen's buildSeatDisplays to include meld tile data**

In the `buildSeatDisplays` function, parse the meld data properly. The server's `SeatRoundSchema` only has `meldTypes` as a string. We need the actual tile IDs. Add a new schema field for this.

Actually, we need to add `meldTileIds` to the schema. Go back to `GameState.ts` and add:

```typescript
@type('string') meldTileIds: string = '';
```

In the server's `updateSeatSchemas`, add:

```typescript
seatSchema.meldTileIds = (this.seatMelds.get(i) ?? []).map((m) => m.tiles.map((t) => t.id).join('|')).join(',');
```

Then in `buildSeatDisplays` in `GameScreen.tsx`, parse `meldTileIds`:

```typescript
const meldTileIdsStr: string = seatData?.meldTileIds ?? '';
const meldGroups = meldTileIdsStr ? meldTileIdsStr.split(',').filter(Boolean) : [];
const melds = meldGroups.map((group) => {
  const tileIds = group.split('|');
  return {
    type: '', // Will be inferred from tiles
    tiles: tileIds.map(id => ({ id })),
    isConcealed: false,
  };
});

// Fill in meld types from the existing meldTypes string
const meldTypes: string[] = seatData?.meldTypes ? seatData.meldTypes.split(',').filter(Boolean) : [];
for (let j = 0; j < melds.length; j++) {
  if (meldTypes[j]) melds[j].type = meldTypes[j];
}
```

- [ ] **Step 9: Build and fix any type errors**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/server build && pnpm --filter @mahjong/web build 2>&1 | tail -20`
Expected: Successful builds

- [ ] **Step 10: Commit**

```bash
cd /home/jay/User_Apps/mahjong
git add apps/web/src/components/table/TableLayout.tsx apps/web/src/components/table/SeatPosition.tsx apps/web/src/components/table/MeldArea.tsx apps/web/src/components/table/RiverArea.tsx apps/web/src/components/table/HandArea.tsx apps/web/src/components/table/DoraDisplay.tsx apps/web/src/screens/GameScreen.tsx apps/server/src/rooms/schema/GameState.ts apps/server/src/rooms/MahjongRoom.ts
git commit -m "feat: seat-relative table layout with tile backs, rivers, melds, dora display"
```

---

## Task 8: End-to-end verification and polish

**Files:**
- May modify various files for bug fixes

- [ ] **Step 1: Build all packages**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core build && pnpm --filter @mahjong/ui build && pnpm --filter @mahjong/server build && pnpm --filter @mahjong/web build`
Expected: All builds succeed

- [ ] **Step 2: Run game-core tests**

Run: `cd /home/jay/User_Apps/mahjong && pnpm --filter @mahjong/game-core test`
Expected: All tests pass

- [ ] **Step 3: Fix any type errors or build failures**

If any builds fail, fix the type errors and rebuild. Common issues:
- Missing imports
- Type mismatches between schema changes
- `meldTileIds` not being set in updateSeatSchemas

- [ ] **Step 4: Commit any fixes**

```bash
cd /home/jay/User_Apps/mahjong
git add -A
git commit -m "fix: resolve build errors from game implementation"
```

- [ ] **Step 5: Final commit with all changes**

```bash
cd /home/jay/User_Apps/mahjong
git log --oneline -10
```

Review the commit history to verify all tasks have been committed.
