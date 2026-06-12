import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';
import type { SeatDisplay } from '../../lib/types.js';

interface CenterRiverProps {
  mySeat: number;
  seats: SeatDisplay[];
}

const DESKTOP_TILES_PER_ROW = 6;
const MOBILE_TILES_PER_ROW = 4;
const GAP = 3;

interface RiverEntry {
  tile: TileDef;
  isLastDiscard: boolean;
  key: string;
}

interface QuadrantLayout {
  style: React.CSSProperties;
  maxW: number;
  maxH: number;
  /** flex-direction for the row container */
  rowDirection: 'row' | 'row-reverse';
  /** flex-direction for the column of rows */
  columnDirection: 'column' | 'column-reverse';
  /** alignment of rows within the column */
  rowAlign: 'flex-start' | 'flex-end';
}

type SeatBadgePosition = 'top' | 'right' | 'bottom' | 'left';

function computeLayouts(tableW: number, tableH: number, isMobile: boolean) {
  const aspect = 58 / 80;
  const gap = 8;

  // On mobile, use a smaller center area % so the board is more compact
  const centerW = tableW * (isMobile ? 0.5 : 0.6);
  const centerH = tableH * (isMobile ? 0.6 : 0.72);
  const quadW = (centerW - gap) / 2;
  const quadH = (centerH - gap) / 2;

  // Tile size: fit 3 columns in a quadrant (2 on mobile)
  const targetCols = isMobile ? 2 : 3;
  let tileW = (quadW - GAP * (targetCols - 1)) / targetCols;
  let tileH = tileW / aspect;

  const maxRows = isMobile ? 3 : 4;
  if (tileH * maxRows + (maxRows - 1) * GAP > quadH) {
    tileH = (quadH - (maxRows - 1) * GAP) / maxRows;
    tileW = tileH * aspect;
  }

  // Quadrant positions (each river anchored to its corner, grows toward center)
  // Layout:  Top(2)    | Right(1)
  //          Left(3)   | Bottom(0)
  const layouts: Record<number, QuadrantLayout> = {
    0: { // bottom-right: anchored bottom-right, grows up-left toward center
      style: {
        position: 'absolute',
        right: `calc(50% - ${centerW / 2}px)`,
        bottom: `calc(50% - ${centerH / 2}px)`,
      },
      maxW: quadW, maxH: quadH,
      rowDirection: 'row-reverse',      // tiles grow leftward
      columnDirection: 'column-reverse', // rows grow upward
      rowAlign: 'flex-end',             // align rows to bottom
    },
    1: { // top-right: anchored top-right, grows down-left toward center
      style: {
        position: 'absolute',
        right: `calc(50% - ${centerW / 2}px)`,
        top: `calc(50% - ${centerH / 2}px)`,
      },
      maxW: quadW, maxH: quadH,
      rowDirection: 'row-reverse',   // tiles grow leftward
      columnDirection: 'column',     // rows grow downward
      rowAlign: 'flex-start',        // align rows to top
    },
    2: { // top-left: anchored top-left, grows down-right toward center
      style: {
        position: 'absolute',
        left: `calc(50% - ${centerW / 2}px)`,
        top: `calc(50% - ${centerH / 2}px)`,
      },
      maxW: quadW, maxH: quadH,
      rowDirection: 'row',           // tiles grow rightward
      columnDirection: 'column',     // rows grow downward
      rowAlign: 'flex-start',        // align rows to top
    },
    3: { // bottom-left: anchored bottom-left, grows up-right toward center
      style: {
        position: 'absolute',
        left: `calc(50% - ${centerW / 2}px)`,
        bottom: `calc(50% - ${centerH / 2}px)`,
      },
      maxW: quadW, maxH: quadH,
      rowDirection: 'row',            // tiles grow rightward
      columnDirection: 'column-reverse', // rows grow upward
      rowAlign: 'flex-end',           // align rows to bottom
    },
  };

  return { tileW, tileH, layouts, centerW, centerH };
}

const SEAT_WIND_LABELS = ['E', 'S', 'W', 'N'];

function getSeatBadgeAnchor(position: SeatBadgePosition, centerW: number, centerH: number, inset: number): React.CSSProperties {
  switch (position) {
    case 'top':
      return {
        position: 'absolute',
        left: '50%',
        top: `calc(50% - ${centerH / 2}px + ${inset}px)`,
        transform: 'translate(-50%, 0)',
      };
    case 'right':
      return {
        position: 'absolute',
        left: `calc(50% + ${centerW / 2}px - ${inset}px)`,
        top: '50%',
        transform: 'translate(-100%, -50%)',
      };
    case 'bottom':
      return {
        position: 'absolute',
        left: '50%',
        top: `calc(50% + ${centerH / 2}px - ${inset}px)`,
        transform: 'translate(-50%, -100%)',
      };
    case 'left':
    default:
      return {
        position: 'absolute',
        left: `calc(50% - ${centerW / 2}px + ${inset}px)`,
        top: '50%',
        transform: 'translate(0, -50%)',
      };
  }
}

function SeatRiverCard({
  seat,
  position,
  scale,
}: {
  seat: SeatDisplay;
  position: SeatBadgePosition;
  scale: number;
}) {
  const isMobile = scale < 0.75;
  const justifyContent =
    position === 'left' ? 'flex-start' : position === 'right' ? 'flex-end' : 'center';

  return (
    <div
      style={{
        pointerEvents: 'none',
        minWidth: `${isMobile ? 112 : 148}px`,
        maxWidth: `${isMobile ? 144 : 196}px`,
        padding: isMobile ? '0.4rem 0.55rem' : '0.5rem 0.7rem',
        borderRadius: isMobile ? '12px' : '14px',
        background: seat.isActive
          ? 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(0,0,0,0.12)), var(--accent-warm)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.18)), var(--game-panel-overlay)',
        border: `1px solid ${seat.isActive ? 'rgba(255,255,255,0.16)' : 'var(--game-panel-border)'}`,
        boxShadow: seat.isActive
          ? '0 10px 22px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 8px 18px rgba(0,0,0,0.22)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.28rem',
        alignItems: justifyContent,
        color: 'var(--game-on-table-text)',
        textShadow: 'var(--game-text-outline-shadow)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent,
          gap: '0.45rem',
          width: '100%',
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: isMobile ? '1.7rem' : '1.9rem',
            height: isMobile ? '1.45rem' : '1.6rem',
            padding: '0 0.35rem',
            borderRadius: '999px',
            background: seat.isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.14)',
            fontSize: `${0.78 * scale}rem`,
            fontWeight: 800,
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}
        >
          {SEAT_WIND_LABELS[seat.seatIndex]}
          {seat.isDealer ? 'D' : ''}
        </span>
        <span
          style={{
            fontSize: `${0.94 * scale}rem`,
            fontWeight: 700,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {seat.displayName}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent,
          gap: '0.45rem',
          width: '100%',
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: `${1.02 * scale}rem`, fontWeight: 800 }}>{seat.score}</span>
        <span style={{ fontSize: `${0.72 * scale}rem`, color: 'var(--game-on-table-muted)', fontWeight: 700 }}>
          {seat.tileCount} tiles
        </span>
      </div>
    </div>
  );
}

function RiverSection({
  entries, tileW, tileH, cols, layout: ql,
}: {
  entries: RiverEntry[]; tileW: number; tileH: number; cols: number;
  layout: QuadrantLayout;
}) {
  const rows = Math.ceil(entries.length / cols);

  return (
    <div style={{
      display: 'flex',
      flexDirection: ql.columnDirection,
      gap: `${GAP}px`,
      alignItems: ql.rowAlign,
    }}>
      {Array.from({ length: rows }, (_, rowIdx) => {
        const rowTiles = entries.slice(rowIdx * cols, (rowIdx + 1) * cols);
        return (
          <div key={rowIdx} style={{
            display: 'flex',
            gap: `${GAP}px`,
            flexDirection: ql.rowDirection,
          }}>
            {rowTiles.map((entry) => (
              <div
                key={entry.key}
                style={{
                  width: `${tileW}px`, height: `${tileH}px`,
                  opacity: entry.isLastDiscard ? 1 : 0.75,
                  transition: 'opacity 200ms ease',
                  ...(entry.isLastDiscard ? {
                    boxShadow: '0 0 10px 4px rgba(184, 92, 58, 0.6), 0 0 20px 6px rgba(251, 191, 36, 0.3)',
                    borderRadius: '3px',
                    animation: 'tileDropIn 400ms ease-out',
                  } : {}),
                }}
                className={entry.isLastDiscard ? 'river-glow' : undefined}
              >
                <TileRenderer tile={entry.tile} width={tileW} height={tileH} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function CenterRiver({ mySeat, seats }: CenterRiverProps) {
  const scale = useScale();
  const isMobile = scale < 0.75;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const seatRivers = useMemo(() => {
    const rivers: Map<number, RiverEntry[]> = new Map();
    for (let offset = 0; offset < 4; offset++) {
      const seatIdx = (mySeat + offset) % 4;
      const seat = seats.find(s => s.seatIndex === seatIdx);
      if (seat && seat.river.length > 0) {
        rivers.set(offset, seat.river.map((r, i) => ({
          tile: r.tile,
          isLastDiscard: r.isLastDiscard ?? false,
          key: `s${seatIdx}-p${i}-${r.tile.id}`,
        })));
      }
    }
    return rivers;
  }, [mySeat, seats]);

  const totalTiles = Array.from(seatRivers.values()).reduce((sum, r) => sum + r.length, 0);
  const orderedSeats = useMemo(
    () =>
      Array.from({ length: 4 }, (_, offset) =>
        seats.find((seat) => seat.seatIndex === (mySeat + offset) % 4),
      ).filter((seat): seat is SeatDisplay => !!seat),
    [mySeat, seats],
  );

  const tableW = containerSize.w || 400;
  const tableH = containerSize.h || 300;
  const { tileW, tileH, layouts, centerW, centerH } = computeLayouts(tableW, tableH, isMobile);
  const tilesPerRow = isMobile ? MOBILE_TILES_PER_ROW : DESKTOP_TILES_PER_ROW;
  const badgeInset = isMobile ? 6 : 10;

  return (
    <div ref={containerRef} style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, rgba(45,90,61,0.15) 0%, transparent 70%)',
    }}>
      {totalTiles === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: `${1.125 * scale}rem`,
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center',
        }}>
          Discard pile
        </div>
      )}

      {Array.from(seatRivers.entries()).map(([seatOffset, entries]) => {
        const ql = layouts[seatOffset];
        const cols = Math.min(tilesPerRow, entries.length, Math.max(1, Math.floor((ql.maxW + GAP) / (tileW + GAP))));

        return (
          <div key={seatOffset} style={{
            ...ql.style,
            maxWidth: `${ql.maxW}px`,
            maxHeight: `${ql.maxH}px`,
            overflow: 'hidden',
          }}>
            <RiverSection
              entries={entries}
              tileW={tileW}
              tileH={tileH}
              cols={cols}
              layout={ql}
            />
          </div>
        );
      })}

      {orderedSeats.map((seat, seatOffset) => {
        const position: SeatBadgePosition =
          seatOffset === 0 ? 'bottom' : seatOffset === 1 ? 'right' : seatOffset === 2 ? 'top' : 'left';

        return (
          <div key={`seat-card-${seat.seatIndex}`} style={getSeatBadgeAnchor(position, centerW, centerH, badgeInset)}>
            <SeatRiverCard seat={seat} position={position} scale={scale} />
          </div>
        );
      })}
    </div>
  );
}
