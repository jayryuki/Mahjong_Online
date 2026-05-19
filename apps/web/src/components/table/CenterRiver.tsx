import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';
import type { SeatDisplay } from '../../lib/types.js';

interface CenterRiverProps {
  mySeat: number;
  seats: SeatDisplay[];
}

const TILES_PER_ROW = 6;
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

function computeLayouts(tableW: number, tableH: number) {
  const aspect = 58 / 80;
  const gap = 8;

  const centerW = tableW * 0.6;
  const centerH = tableH * 0.6;
  const quadW = (centerW - gap) / 2;
  const quadH = (centerH - gap) / 2;

  // Tile size: fit 3 columns in a quadrant
  const targetCols = 3;
  let tileW = (quadW - GAP * (targetCols - 1)) / targetCols;
  let tileH = tileW / aspect;

  const maxRows = 4;
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

  return { tileW, tileH, layouts };
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

  const tableW = containerSize.w || 400;
  const tableH = containerSize.h || 300;
  const { tileW, tileH, layouts } = computeLayouts(tableW, tableH);

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
        const cols = Math.min(TILES_PER_ROW, entries.length, Math.max(1, Math.floor((ql.maxW + GAP) / (tileW + GAP))));

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
    </div>
  );
}
