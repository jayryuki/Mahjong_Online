# Full Playable Mahjong Game — Design Spec

**Date:** 2026-05-10  
**Scope:** Fix the game so it actually plays out — tiles appear, bots play, the table renders correctly, riichi works, and hands continue after ending.

---

## Problem Statement

The game starts (lobby → match), but:
- Players see no tiles because the `deal` message is missed during the lobby→game screen transition
- Bot players never act, so the game stalls immediately
- The table layout is not seat-relative
- Melds, rivers, dora, and opponent hands don't render properly
- No riichi declaration flow
- No hand continuation after a hand ends

---

## Design

### 1. Reliable Hand Delivery

**Server:** Add a `request-hand` message handler that returns the calling player's current concealed tile IDs and meld tile IDs. Also return a `handVersion` counter that increments on every hand mutation.

**Server:** Include `handVersion` in every private message (`deal`, `tile-drawn`, `meld-applied`). Store it as a server-side counter per seat.

**Client:** On `GameScreen` mount, send `request-hand`. On receiving the response, set `handTiles` and `handVersion`. On every subsequent private message, check `handVersion` for continuity — if desync detected, re-request.

**Client:** Also send `request-hand` whenever phase changes to `TURN_DRAW` or `TURN_DECISION` and `handTiles` is empty (covers reconnect scenarios).

### 2. Bot AI

**Server:** Add `scheduleBotAction(seat)` method called after every phase transition where the active seat is a bot.

- **TURN_DRAW**: After a 500ms delay, the bot auto-draws.
- **TURN_DECISION**: After a 300ms delay, the bot auto-discards. Discard strategy: sort tiles by "usefulness" (singles of terminal/honor first, then isolated middle tiles), discard the least useful.
- **REACTION_WINDOW**: Bots auto-pass unless they can declare ron (in which case they declare). Bots never call chi. Bots call pon with 30% probability if possible.
- **Tsumo check**: After drawing, bots check if they can declare tsumo and do so if possible.

**Discard heuristic**: Simple scoring — tiles that form part of a pair or sequence are kept, isolated terminals/honors are discarded first.

### 3. Seat-Relative Table Layout

**Client:** Compute a rotation offset from `mySeat`. Map positions as:
- `mySeat` → bottom
- `(mySeat + 1) % 4` → right
- `(mySeat + 2) % 4` → top
- `(mySeat + 3) % 4` → left

Each position displays:
- Player name + seat wind label (East/South/West/North)
- Tile count for the active hand
- Score
- Riichi indicator
- Dealer marker (D)
- Active turn glow

### 4. Full Tile Rendering

**Opponent hands:** Render `TileBack` components in a row, count = `concealedCount`.

**Rivers:** Render actual tiles in a grid (6 columns × N rows). Show all 4 rivers, positioned relative to each seat. Last discarded tile highlighted with a slight upward offset.

**Melds:** Render actual tile faces for each meld. Called tile rotated/sideways to indicate the call direction. For pon: 3 tiles with the called one sideways. For chi: 3 tiles in sequence.

**Dora indicators:** Display in the center of the table, using actual tile faces.

**Drawn tile:** The newly drawn tile is added to the right side of the hand, separated by a small gap, and highlighted.

### 5. Riichi Declaration

**Server:** In `handleDrawTile`, after drawing, check if the player's hand is in tenpai (i.e., after discarding any one tile, the remaining 13 tiles + some draw would complete a winning shape). If so, add `DECLARE_RIICHI` to legal actions.

**Tenpai check:** For each tile in the concealed hand, temporarily remove it and check if `isValidWinningShape(remaining, meldCount)` is true for any wait. If yes, the hand is tenpai for riichi.

**Server:** When a player declares riichi:
- Deduct 1000 points as riichi deposit
- Increment `riichiSticks`
- Mark the seat as riichi
- The player must discard immediately (only legal action is `DISCARD_TILE`)
- From now on, that player's legal actions are restricted: only `DRAW_TILE`, `DISCARD_TILE`, `DECLARE_WIN_TSUMO`, `DECLARE_WIN_RON`

**Client:** Show a "Riichi!" button when available. Show riichi stick indicator on the seat.

### 6. Hand Continuation

**Server:** Add `next-hand` message handler.

After `HAND_END`, the client shows a result overlay with a "Next Hand" button. When clicked:
1. Client sends `next-hand`
2. Server checks match continuation:
   - If winner was dealer, dealer stays (honba increments on exhaustive draw only)
   - If winner was not dealer, rotate dealer to next seat
   - If all 4 players have been dealer in East round, check if South round should start (for now, end match after East round)
   - Reset hand-level state, deal new hand
3. Transition through `ROUND_END` → `DEALING` → `TURN_DRAW`

**Match end:** After East round completes (all 4 seats have been dealer), transition to `MATCH_END` with final scores. Client navigates to result screen with actual score data.

### 7. Scoring Evaluator Fixes

**Fix `isChanta`**: Current logic is inverted — it checks that ALL tiles are terminals/honors, which is actually junchan/chinrouto. Fix to check that each meld/group contains at least one terminal or honor.

**Add seat wind yakuhai**: The evaluator already finds dragon yakuhai but doesn't check for seat wind or round wind triplets. Add checks for round wind and seat wind triplets as yakuhai.

---

## File Changes Summary

### Server (`apps/server/src/`)
- `rooms/MahjongRoom.ts` — Add `request-hand` handler, bot AI scheduling, riichi flow, `next-hand` handler, tenpai check
- `rooms/schema/GameState.ts` — Add `handVersion` field per seat, `riichiSticks` on seat schema

### Client (`apps/web/src/`)
- `screens/GameScreen.tsx` — Fix hand initialization with `request-hand`, add hand continuation button, pass mySeat to layout
- `components/table/TableLayout.tsx` — Seat-relative positioning, center dora display, 4 rivers
- `components/table/HandArea.tsx` — Highlight drawn tile, separate drawn tile visually
- `components/table/MeldArea.tsx` — Render actual tile faces instead of text labels
- `components/table/RiverArea.tsx` — Grid layout, all 4 rivers
- `components/table/SeatPosition.tsx` — Show tile backs for opponents, score, riichi indicator

### Game Core (`packages/game-core/src/`)
- `scoring/evaluator.ts` — Fix `isChanta`, add wind yakuhai
- `engine/validators.ts` — Add tenpai check helper function
- `scoring/validator.ts` — No changes needed (already exports `isValidWinningShape`)

### UI (`packages/ui/src/`)
- No structural changes needed — existing tile components cover all tile types

---

## Out of Scope

- Sound effects
- Tile animation/movement
- Advanced bot strategy (efficient meld planning, defense)
- Kan (open/closed/added) — too complex for initial implementation; pon and chi are sufficient
- South round (match ends after East round for now)
- Spectator mode
- Chat
