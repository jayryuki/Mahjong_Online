import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { parseTileId } from '../../lib/tile-utils.js';

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
    if (e.pointerType === 'touch') return;
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
        gap: '4px',
        zIndex: 200,
        background: 'linear-gradient(180deg, rgba(11,18,30,0.82), rgba(29,15,43,0.82))',
        padding: `${5 * scale}px ${9 * scale}px ${7 * scale}px`,
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(4px)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: isDragging ? 'none' : 'auto',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 150ms ease',
        boxShadow: '0 10px 24px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.05)',
        ...(isDragging && { boxShadow: '0 14px 26px rgba(0,0,0,0.45)' }),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div style={{ fontSize: `${0.8 * scale}rem`, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#fff', fontWeight: 900, textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}>
        Joker
        <span style={{ fontSize: `${0.75 * scale}rem`, opacity: 0.6, marginLeft: '4px' }}>&#x2630;</span>
      </div>
      <div style={{ borderRadius: '8px' }}>
        <TileRenderer tile={tile} width={tileW} height={tileH} isWild showWildBadge />
      </div>
    </div>
  );

  // Portal to body so it's not clipped by any overflow:hidden parent
  if (mounted) {
    return createPortal(el, document.body);
  }
  return el;
}
