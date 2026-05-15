import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
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

interface WildCardDisplayProps {
  wildCardTileId?: string | null;
}

export function WildCardDisplay({ wildCardTileId }: WildCardDisplayProps) {
  const scale = useScale();
  const dragRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setIsDragging(true);
    const rect = dragRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    dragRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffsetRef.current.x;
    const newY = e.clientY - dragOffsetRef.current.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!wildCardTileId) return null;

  const tile = parseTileId(wildCardTileId);
  const tileW = Math.round(72 * scale);
  const tileH = Math.round(99 * scale);

  // Default position: top-right area of viewport
  const defaultX = typeof window !== 'undefined' ? window.innerWidth - tileW - 24 : 0;
  const defaultY = 60;
  const posX = position?.x ?? defaultX;
  const posY = position?.y ?? defaultY;

  const el = (
    <div
      ref={dragRef}
      style={{
        position: 'fixed',
        left: `${posX}px`,
        top: `${posY}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        padding: `${4 * scale}px ${8 * scale}px ${6 * scale}px`,
        borderRadius: '8px',
        border: '1px solid rgba(251,191,36,0.25)',
        backdropFilter: 'blur(4px)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 150ms ease',
        ...(isDragging && { boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div style={{ fontSize: `${0.9375 * scale}rem`, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fbbf24', fontWeight: 700 }}>
        Wild
        <span style={{ fontSize: `${0.75 * scale}rem`, opacity: 0.6, marginLeft: '4px' }}>&#x2630;</span>
      </div>
      <div style={{ border: `1.5px solid #fbbf24`, borderRadius: '6px', boxShadow: '0 0 8px rgba(251,191,36,0.4)' }}>
        <TileRenderer tile={tile} width={tileW} height={tileH} />
      </div>
    </div>
  );

  // Portal to body so it's not clipped by any overflow:hidden parent
  if (mounted) {
    return createPortal(el, document.body);
  }
  return el;
}
