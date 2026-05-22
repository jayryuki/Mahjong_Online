# Adding a New Game to the Colyseus Server

This server runs multiple games behind a single Colyseus instance on port 2500.
Currently hosted: **Mahjong** and **Blackjack**.

---

## The Big Picture

Colyseus is game-agnostic. You register a Room class with a string name, and it
handles all WebSocket routing automatically. The REST API and frontend serving
are Express concerns that you wire up alongside it. Adding a new game means:

1. A **game-core package** (pure logic, no Colyseus dependency)
2. A **Room class** (Colyseus server-side handler)
3. A **Schema** (what gets synced to clients)
4. A **web client** (React app that connects via colyseus.js)
5. **Wiring** in index.ts to tie it all together

---

## Step-by-Step

### 1. Create a game-core package

```
packages/poker-game-core/
  src/
    index.ts
    engine/fsm.ts      ← game phases / state machine
    models/card.ts      ← domain types
    ...
  package.json          ← name: "@poker/game-core"
  tsconfig.json
```

Copy `packages/blackjack-game-core` as a template. This package has **zero
Colyseus dependencies** — it's pure game logic (deck management, hand evaluation,
state machine transitions). The server imports it and uses it inside the Room.

Add it as a workspace dependency in `apps/server/package.json`:

```json
"@poker/game-core": "workspace:*"
```

Then run `pnpm install` from the monorepo root.

### 2. Create the Colyseus Schema

Create `src/rooms/schema/PokerGameState.ts`. This defines what data gets synced
to clients over the network. Only put data here that players should see.

```typescript
import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('boolean') isHost: boolean = false;
  // ... add fields your game needs
}

export class GameState extends Schema {
  @type('string') phase: string = 'LOBBY';
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  // ... add top-level game state
}
```

**Important:** Colyseus Schema does NOT support union types. Use a `phase` string
field and JSON-encoded strings for complex sub-state (see how Blackjack encodes
`roundResult` and Mahjong encodes `legalActions`).

### 3. Create the Room class

Create `src/rooms/PokerRoom.ts` extending `Room<GameState>`:

```typescript
import { Room, Client } from '@colyseus/core';
import { GameState, PlayerSchema } from './schema/PokerGameState.js';

export class PokerRoom extends Room<GameState> {
  maxClients = 9;

  onCreate(options: any) {
    this.setState(new GameState());
    // Register message handlers:
    this.onMessage('some-action', (client, data) => { ... });
  }

  onJoin(client: Client, options: any) {
    // Add player to state
  }

  onLeave(client: Client) {
    // Remove player, handle disconnect
  }

  onDispose() {
    // Clean up timers
  }
}
```

### 4. Register the room in index.ts

```typescript
import { PokerRoom } from './rooms/PokerRoom.js';
// ...
gameServer.define('poker', PokerRoom);
```

That single line is all Colyseus needs. The string `'poker'` becomes the room
type used by `matchMaker.createRoom('poker', ...)` and by
`colyseusClient.joinById(roomId, ...)`.

### 5. Wire up the API routes

In `index.ts`, update the POST /api/rooms handler to map your game name:

```typescript
const gameType = game === 'blackjack' ? 'blackjack'
               : game === 'poker' ? 'poker'
               : 'mahjong';
```

### 6. Add the frontend dist

Build your game's web client and copy the output to `apps/server/poker-dist/`.
Then add host-based routing in `index.ts`:

```typescript
const pokerDist = path.resolve(__dirname, '../poker-dist');

// In the static middleware:
if (host.includes('poker')) {
  express.static(pokerDist)(req, res, next);
} else if (host.includes('blackjack')) {
  express.static(blackjackDist)(req, res, next);
} else {
  express.static(mahjongDist)(req, res, next);
}

// In the SPA catch-all:
const dist = host.includes('poker') ? pokerDist
           : host.includes('blackjack') ? blackjackDist
           : mahjongDist;
```

Each game gets its own subdomain (e.g. poker.jayryuki.com) pointing to this
same server.

---

## Turn-Based Games: The "isMyTurn" Bug

### The Problem We Kept Hitting

In multiplayer, when one player finished their turn, the next player's screen
would show **"Waiting for other players..."** indefinitely and never show action
buttons. The game was stuck.

### Root Cause

The client was deriving `isMyTurn` from a `turnInfo` object set by the
`your-turn` direct message from the server. But React's effect system would
sometimes **clear `turnInfo` to null** in the same render cycle that `isMyTurn`
became true, because:

1. Server sets `activeSeat = 2` in the synced state → state patch arrives
2. Server sends `your-turn` direct message → arrives slightly after
3. React re-renders with the new state → an effect clears `turnInfo` because
   "the active seat changed"
4. The `your-turn` message arrives and sets `turnInfo` → but the effect has
   already nulled it
5. `isMyTurn = turnInfo !== null` → false → shows "Waiting for other players..."

### The Fix: Derive isMyTurn from State, Not Messages

```typescript
// WRONG — fragile, breaks on race conditions:
const isMyTurn = turnInfo !== null && activeSeat === myPlayer?.seatIndex;

// CORRECT — derived purely from synced state:
const isMyTurn = currentPhase === 'PLAYER_TURN'
             && activeSeat !== 255
             && activeSeat === mySeatIndex;
```

The `your-turn` message still provides action **capabilities** (canHit, canSplit,
etc.) but `isMyTurn` itself comes from state. The capabilities are stored in a
ref so they survive re-renders, and are re-derived from state if the message was
missed.

### Guard Against Null turnInfo in the Render

Even with the state-based `isMyTurn`, there's a brief moment where `isMyTurn` is
true but the `your-turn` message hasn't arrived yet, so `turnInfo` is still null.
If you render `<ActionButtons canHit={turnInfo.canHit} .../>` at that point, it
crashes with `Cannot read properties of null (reading 'canHit')` and the screen
goes black.

Always guard:

```typescript
{showActions && turnInfo && (
  <ActionButtons
    canHit={turnInfo.canHit}
    canStand={turnInfo.canStand}
    ...
  />
)}
```

### Register All Server Messages

If the server broadcasts a message type (like `'shuffling'`) that the client
doesn't have a handler for, colyseus.js logs a warning. Register a no-op:

```typescript
room.onMessage('shuffling', () => {});
```

---

## Games Without Turns

Not every game has a sequential turn structure like Blackjack. For example, a
real-time game where all players act simultaneously, or a betting game where
everyone acts in parallel each round.

### How to Handle This

Instead of an `activeSeat` + `PLAYER_TURN` phase pattern, use a phase that
represents a **shared action window**:

**Schema:**
```typescript
export class GameState extends Schema {
  @type('string') phase: string = 'LOBBY';
  // No activeSeat needed — all players act at once
  @type('boolean') bettingOpen: boolean = false;
  @type('uint8') roundTimer: number = 0;       // seconds remaining
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
```

**Room:**
```typescript
private startBettingPhase() {
  this.state.phase = 'BETTING';
  this.state.bettingOpen = true;

  // All players can act simultaneously
  for (const [sessionId, internal] of this.internalState) {
    const client = this.clients.find(c => c.sessionId === sessionId);
    client?.send('betting-open', { minBet: 10, maxBet: 500 });
  }

  // Auto-close betting after 30 seconds
  this.turnTimer = setTimeout(() => {
    this.state.bettingOpen = false;
    // Auto-fold players who haven't bet
    for (const [sessionId, internal] of this.internalState) {
      if (!internal.hasActed) {
        internal.folded = true;
      }
    }
    this.advancePhase();
  }, 30000);
}
```

**Client:**
```typescript
// Everyone sees the same controls — no "isMyTurn" check needed
const showBetting = currentPhase === 'BETTING' && !myPlayer?.hasBet;

{showBetting && (
  <BettingControls onPlaceBet={handleBet} />
)}
```

The key difference: there's no `activeSeat` to track, no `your-turn` message to
race against, and every player sees the same UI. The server uses a timer to
close the action window and advance the phase automatically.

### Comparing the Two Patterns

| | Turn-Based (Blackjack) | Simultaneous (e.g. Poker betting) |
|---|---|---|
| **Who acts** | One player at a time | All players at once |
| **Phase signal** | `activeSeat` in state + `your-turn` message | Shared phase + timer |
| **Client check** | `isMyTurn = activeSeat === mySeat` | `showControls = phase === 'BETTING' && !hasActed` |
| **Race condition risk** | High — isMyTurn vs turnInfo | Low — no per-player turn state |
| **Auto-advance** | 30s per turn, auto-stand | 30s per round, auto-fold/check |
| **Server message** | `your-turn` (targeted to one client) | `round-start` (broadcast to all) |

---

## Quick Reference: File Checklist

When adding a new game, you'll create or modify these files:

| File | Action | Purpose |
|---|---|---|
| `packages/<game>-game-core/` | Create | Pure game logic (no Colyseus dep) |
| `apps/server/src/rooms/<Game>Room.ts` | Create | Colyseus Room handler |
| `apps/server/src/rooms/schema/<Game>GameState.ts` | Create | Network-synced Schema |
| `apps/server/src/index.ts` | Edit | Register room, add routing, update API |
| `apps/server/<game>-dist/` | Create | Built web client for Express to serve |
| `apps/server/package.json` | Edit | Add game-core workspace dependency |
