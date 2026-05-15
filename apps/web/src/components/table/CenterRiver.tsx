import React, { useEffect, useRef, useMemo, useState } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';

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

interface CenterRiverProps {
  mySeat: number;
  seats: SeatDisplay[];
}

const BASE_TILE_W = 58;
const BASE_TILE_H = 80;
const TILE_ASPECT = BASE_TILE_W / BASE_TILE_H;
const GAP = 3;
const PADDING = 4;

interface RiverEntry {
  tile: TileDef;
  seatIndex: number;
  isLastDiscard: boolean;
  key: string;
}

function computeGridLayout(
  containerW: number,
  containerH: number,
  tileCount: number
): { cols: number; rows: number; tileW: number; tileH: number } {
  if (tileCount === 0 || containerW <= 0 || containerH <= 0) {
    return { cols: 0, rows: 0, tileW: 0, tileH: 0 };
  }

  const innerW = containerW - PADDING * 2;
  const innerH = containerH - PADDING * 2;

  let bestCols = 1;
  let bestArea = 0;

  const maxColsToTry = Math.min(tileCount, Math.floor(innerW / 12));

  for (let cols = 1; cols <= maxColsToTry; cols++) {
    const rows = Math.ceil(tileCount / cols);
    const availW = innerW - (cols - 1) * GAP;
    const availH = innerH - (rows - 1) * GAP;

    if (availW <= 0 || availH <= 0) continue;

    const fitW = availW / cols;
    const fitH = availH / rows;

    let tileW: number, tileH: number;
    if (fitW / TILE_ASPECT <= fitH) {
      tileW = fitW;
      tileH = fitW / TILE_ASPECT;
    } else {
      tileH = fitH;
      tileW = fitH * TILE_ASPECT;
    }

    tileW = Math.min(tileW, BASE_TILE_W);
    tileH = Math.min(tileH, BASE_TILE_H);

    const area = tileW * tileH;
    if (area > bestArea) {
      bestArea = area;
      bestCols = cols;
    }
  }

  const rows = Math.ceil(tileCount / bestCols);
  const availW = innerW - (bestCols - 1) * GAP;
  const availH = innerH - (rows - 1) * GAP;

  let tileW: number, tileH: number;
  if (availW / bestCols / TILE_ASPECT <= availH / rows) {
    tileW = Math.min(availW / bestCols, BASE_TILE_W);
    tileH = tileW / TILE_ASPECT;
    if (tileH > BASE_TILE_H) {
      tileH = BASE_TILE_H;
      tileW = tileH * TILE_ASPECT;
    }
  } else {
    tileH = Math.min(availH / rows, BASE_TILE_H);
    tileW = tileH * TILE_ASPECT;
    if (tileW > BASE_TILE_W) {
      tileW = BASE_TILE_W;
      tileH = tileW / TILE_ASPECT;
    }
  }

  return { cols: bestCols, rows, tileW, tileH };
}

export function CenterRiver({ mySeat, seats }: CenterRiverProps) {
  const scale = useScale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const prevCountRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allRiverTiles = useMemo(() => {
    const entries: RiverEntry[] = [];
    for (let offset = 0; offset < 4; offset++) {
      const seatIdx = (mySeat + offset) % 4;
      const seat = seats.find(s => s.seatIndex === seatIdx);
      if (seat) {
        for (let i = 0; i < seat.river.length; i++) {
          entries.push({
            tile: seat.river[i].tile,
            seatIndex: seatIdx,
            isLastDiscard: seat.river[i].isLastDiscard ?? false,
            key: `s${seatIdx}-p${i}-${seat.river[i].tile.id}`,
          });
        }
      }
    }
    return entries;
  }, [mySeat, seats]);

  const totalCount = allRiverTiles.length;

  const grid = useMemo(() => {
    return computeGridLayout(containerSize.w, containerSize.h, totalCount);
  }, [containerSize.w, containerSize.h, totalCount]);

  useEffect(() => {
    if (totalCount === 0) {
      prevCountRef.current = 0;
    }
  }, [totalCount]);

  const isAnimatable = (index: number, entry: RiverEntry) => {
    return entry.isLastDiscard && index >= prevCountRef.current - 1;
  };

  useEffect(() => {
    prevCountRef.current = totalCount;
  }, [totalCount]);

  const { cols, tileW, tileH } = grid;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, rgba(45,90,61,0.15) 0%, transparent 70%)',
      }}
    >
      {totalCount === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: `${1.125 * scale}rem`,
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center',
        }}>
          Discard pile
        </div>
      )}
      {totalCount > 0 && cols > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
          gridTemplateRows: `repeat(${grid.rows}, ${tileH}px)`,
          gap: `${GAP}px`,
          padding: `${PADDING}px`,
          placeItems: 'center',
          transition: 'all 300ms ease',
        }}>
          {allRiverTiles.map((entry, i) => {
            const animate = isAnimatable(i, entry);
            return (
              <div
                key={entry.key}
                style={{
                  width: `${tileW}px`,
                  height: `${tileH}px`,
                  opacity: entry.isLastDiscard ? 1 : 0.8,
                  transition: 'width 300ms ease, height 300ms ease, opacity 200ms ease',
                  ...(animate ? { animation: 'tileDropIn 400ms ease-out' } : {}),
                  ...(entry.isLastDiscard ? {
                    boxShadow: '0 0 10px 4px rgba(184, 92, 58, 0.6), 0 0 20px 6px rgba(251, 191, 36, 0.3)',
                    borderRadius: '4px',
                  } : {}),
                }}
                className={entry.isLastDiscard ? 'river-glow' : undefined}
              >
                <TileRenderer tile={entry.tile} width={tileW} height={tileH} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
