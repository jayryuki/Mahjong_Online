# Hong Kong Mahjong Rules — Design Spec

## Overview

Replace the existing Riichi rules with Traditional Hong Kong Mahjong rules as the default and only ruleset.

## Key Rules

- **Self-draw only**: Players can only win by tsumo (drawing the winning tile). No ron.
- **Wild card (joker)**: After dealing 13 tiles to each player, the next tile from the wall is flipped face-up. All copies of that exact tile (e.g., all sou-5s) become wild cards.
- **Wild card substitution**: Wild cards can represent any tile in any meld (sequences, triplets, pairs) for forming a winning hand.
- **Wild card discard**: Wild cards can be discarded. Anyone can claim them via normal chi/pon rules.
- **Wild card in hand**: When drawn from the wall, wild cards stay in hand — not declared as a special meld.
- **No scoring penalty** for using wild cards.
- **GONG doubles**: If the winner has any kan (exposed or concealed), their score is doubled.
- **Winner paid by all**: All 3 other players pay the winner (implied by self-draw only).
- **No riichi declaration**.

## Scoring Model

Traditional HK fan-based scoring (0–13+ fans), no minimum fan to win.

### Fan Categories

| Fan | Name | Description |
|-----|------|-------------|
| 0 | Chicken Hand | No patterns, minimal hand |
| 1 | Common Hand | All sequences + one pair (no triplets) |
| 1 | Dragon Pung | Pung of any dragon (haku/hatsu/chun) |
| 1 | Seat Wind | Pung of player's seat wind |
| 1 | Round Wind | Pung of the round wind |
| 2 | All Pung | All triplets (no sequences) |
| 2 | Mixed One Suit | One suited tile type + honors only |
| 2 | Half Flush | Honors + one suit |
| 3 | All Tiles in Hand | Concealed hand, self-drawn |
| 3 | Small Dragons | Two dragon pungs + one dragon pair |
| 4 | Big Dragons | Three dragon pungs |
| 4 | Small Winds | Three wind pungs + one wind pair |
| 5 | Mixed Pure Suit | Pure suit + one honor type |
| 6 | Full Flush | All tiles from one suit, no honors |
| 7 | Pure One Suit | All same suit, no honors, all sequences |
| 8 | Nine Gates | 1-1-1-2-3-4-5-6-7-8-9-9-9 + any tile of same suit |
| 13 | Thirteen Orphans | One of each terminal + honor + one duplicate |

### Payment Table (fan → base points)

Simplified doubling scale:
- 0 fan: 1 point
- 1 fan: 2 points
- 2 fan: 4 points
- 3 fan: 8 points
- 4 fan: 16 points
- 5 fan: 32 points
- 6 fan: 64 points
- 7+ fan: capped at 128 points (limit hand)

Dealer pays double. GONG (kan) doubles the final score.

## Files Changed

### `packages/game-core/src/rules/preset.ts`
- Add `wildCardEnabled: boolean` and `selfDrawOnly: boolean` to `RulesPreset`
- Add `gongDoubles: boolean`

### `packages/game-core/src/rules/hongkong.ts` (new)
- `HONG_KONG_PRESET` with HK-specific settings

### `packages/game-core/src/models/tile.ts`
- Add `isWild: boolean` to `TileDef`

### `packages/game-core/src/scoring/hk-evaluator.ts` (new)
- HK fan-based pattern evaluation

### `packages/game-core/src/scoring/hk-calculator.ts` (new)
- HK fan → points calculation with GONG doubling

### `packages/game-core/src/scoring/validator.ts`
- `isValidWinningShape` must account for wild card substitution

### `packages/game-core/src/index.ts`
- Export HK preset

### `apps/server/src/rooms/MahjongRoom.ts`
- Flip wild card after dealing
- Mark wild tiles in concealed hands
- Remove ron/riichi logic
- Wild-card-aware chi/pon
- GONG doubling in settlement

### `apps/web/src/screens/GameScreen.tsx`
- Remove riichi/ron UI
- Show wild card indicator

### `apps/web/src/components/table/DoraDisplay.tsx`
- Rename/adapt to show wild card indicator instead of dora

### `apps/web/src/components/actions/ActionPrompt.tsx`
- Remove riichi/ron action labels
