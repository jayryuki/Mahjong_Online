import React, { useMemo } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { parseTileId } from '../../lib/tile-utils.js';
import type { SeatDisplay, MeldDisplay } from '../../lib/types.js';
import type { TileDef } from '@mahjong/game-core';

interface MobileSeatFeedProps {
  seats: SeatDisplay[];
  mySeat: number;
  wildCardTileId?: string | null;
  noticeText?: string | null;
  recentActionBySeat?: Record<number, { label: string } | undefined>;
}

const WIND_LABELS = ['East', 'South', 'West', 'North'];

function tileKey(tile: TileDef): string {
  if (tile.suit) {
    const suitOrder: Record<string, number> = { man: 0, pin: 1, sou: 2 };
    return `${suitOrder[tile.suit]}${tile.rank?.toString().padStart(2, '0') ?? '00'}`;
  }
  return `9${tile.honorName ?? 'zzz'}`;
}

function getMeldLabel(type: string) {
  if (type === 'chi') return 'Chi';
  if (type === 'pon') return 'Pon';
  if (type === 'kan-open') return 'Open Kan';
  if (type === 'kan-added') return 'Added Kan';
  if (type === 'kan-closed') return 'Closed Kan';
  return type || 'Meld';
}

function renderConcealedTile(width: number, height: number) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '7px',
        background: 'var(--mahjong-concealed-tile-bg)',
        border: '1px solid var(--game-panel-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 5px 12px rgba(0,0,0,0.16)',
        flex: '0 0 auto',
      }}
    />
  );
}

function MeldStrip({
  melds,
  tileW,
  tileH,
  wildTileKey,
}: {
  melds: MeldDisplay[];
  tileW: number;
  tileH: number;
  wildTileKey: string | null;
}) {
  if (!melds.length) {
    return (
      <span style={{ fontSize: '0.72rem', color: 'var(--game-on-table-muted)', fontWeight: 600 }}>
        No melds yet
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '0.1rem',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {melds.map((meld, index) => {
        const tileIds = meld.tiles?.map((tile: any) => (typeof tile === 'string' ? tile : tile.id)) ?? [];
        return (
          <div
            key={`${meld.type}-${index}`}
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              padding: '0.35rem',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
            }}
          >
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--game-on-table-muted)',
              }}
            >
              {getMeldLabel(meld.type)}
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {meld.isConcealed
                ? tileIds.map((_, concealedIndex) => <div key={concealedIndex}>{renderConcealedTile(tileW, tileH)}</div>)
                : tileIds.map((tileId) => {
                    const tile = parseTileId(tileId);
                    return (
                      <TileRenderer
                        key={tileId}
                        tile={tile}
                        width={tileW}
                        height={tileH}
                        isWild={wildTileKey !== null && tileKey(tile) === wildTileKey}
                      />
                    );
                  })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MobileSeatFeed({
  seats,
  mySeat,
  wildCardTileId,
  noticeText,
  recentActionBySeat = {},
}: MobileSeatFeedProps) {
  const scale = useScale();
  const rem = (value: number, min: number) => `${Math.max(min, value * scale)}rem`;
  const wildTileKey = wildCardTileId ? tileKey(parseTileId(wildCardTileId)) : null;
  const riverTileW = Math.max(24, Math.round(46 * scale));
  const riverTileH = Math.max(34, Math.round(64 * scale));
  const meldTileW = Math.max(26, Math.round(48 * scale));
  const meldTileH = Math.max(36, Math.round(68 * scale));
  const orderedSeats = useMemo(
    () =>
      [2, 3, 1, 0]
        .map((offset) => seats.find((seat) => seat.seatIndex === (mySeat + offset) % 4))
        .filter((seat): seat is SeatDisplay => !!seat),
    [mySeat, seats],
  );

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        padding: '0.35rem 0.4rem 0.45rem',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {noticeText && (
        <div
          style={{
            flex: '0 0 auto',
            padding: '0.35rem 0.55rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(184,92,58,0.96), rgba(244,114,182,0.84))',
            color: '#fff',
            fontWeight: 800,
            fontSize: rem(0.78, 0.7),
            letterSpacing: '0.03em',
            boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
          }}
        >
          {noticeText}
        </div>
      )}

      {orderedSeats.map((seat) => {
        const action = recentActionBySeat[seat.seatIndex];

        return (
          <section
            key={seat.seatIndex}
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.26rem',
              padding: '0.42rem 0.5rem',
              borderRadius: '14px',
              background: seat.isActive
                ? 'linear-gradient(180deg, rgba(184,92,58,0.18), rgba(7,16,14,0.28))'
                : 'rgba(9, 20, 18, 0.26)',
              border: `1px solid ${seat.isActive ? 'rgba(245,196,81,0.55)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: seat.isActive
                ? '0 8px 18px rgba(184,92,58,0.16), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 7px 16px rgba(0,0,0,0.11)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '2rem',
                    height: '1.38rem',
                    padding: '0 0.4rem',
                    borderRadius: '999px',
                    background: seat.isActive ? 'rgba(245,196,81,0.18)' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--game-on-table-text)',
                    fontWeight: 900,
                    fontSize: rem(0.66, 0.62),
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {WIND_LABELS[seat.seatIndex]}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: rem(0.84, 0.74),
                      fontWeight: 800,
                      color: 'var(--game-on-table-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {seat.displayName}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      flexWrap: 'wrap',
                      fontSize: rem(0.7, 0.64),
                      color: 'var(--game-on-table-muted)',
                      fontWeight: 700,
                    }}
                  >
                    <span>{seat.score} pts</span>
                    <span>{seat.tileCount} tiles</span>
                    {seat.isDealer && <span>Dealer</span>}
                    {seat.seatIndex === mySeat && <span>You</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                {action && (
                  <span
                    style={{
                      padding: '0.22rem 0.5rem',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.09)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: 'var(--game-on-table-text)',
                      fontWeight: 800,
                      fontSize: rem(0.64, 0.6),
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      maxWidth: '8.5rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {action.label}
                  </span>
                )}
                {seat.isActive && (
                  <span
                    style={{
                      padding: '0.26rem 0.55rem',
                      borderRadius: '999px',
                      background: 'var(--accent-warm)',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: rem(0.66, 0.62),
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      boxShadow: '0 6px 14px rgba(184,92,58,0.24)',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
              <span
                style={{
                  fontSize: rem(0.6, 0.56),
                  color: 'var(--game-on-table-muted)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Melds
              </span>
              <MeldStrip melds={seat.melds} tileW={meldTileW} tileH={meldTileH} wildTileKey={wildTileKey} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
              <span
                style={{
                  fontSize: rem(0.6, 0.56),
                  color: 'var(--game-on-table-muted)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Discards
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  overflowX: 'auto',
                  paddingBottom: '0.1rem',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {seat.river.length > 0 ? (
                  seat.river.map((entry, index) => (
                    <div
                      key={`${seat.seatIndex}-${entry.tile.id}-${index}`}
                      style={{
                        flex: '0 0 auto',
                        borderRadius: '7px',
                        boxShadow: entry.isLastDiscard
                          ? '0 0 0 1px rgba(245,196,81,0.45), 0 0 12px rgba(184,92,58,0.38)'
                          : undefined,
                      }}
                    >
                      <TileRenderer
                        tile={entry.tile}
                        width={riverTileW}
                        height={riverTileH}
                        isWild={wildTileKey !== null && tileKey(entry.tile) === wildTileKey}
                      />
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: rem(0.68, 0.62), color: 'var(--game-on-table-muted)', fontWeight: 600 }}>
                    No discards
                  </span>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
