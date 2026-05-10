import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TableLayout } from '../components/table/TableLayout.js';
import { HandArea } from '../components/table/HandArea.js';
import { RiverArea } from '../components/table/RiverArea.js';
import { MeldArea } from '../components/table/MeldArea.js';
import { ActionPrompt } from '../components/actions/ActionPrompt.js';
import { Button } from '../components/common/Button.js';
import { getRoom, getMySessionId } from '../lib/gameContext.js';
import { TileDef } from '@mahjong/game-core';

// Parse a tile ID string (e.g. "man-1-0", "pin-5-3", "east-0") into a TileDef object
function parseTileId(id: string): TileDef {
  const parts = id.split('-');
  const suitNames = ['man', 'pin', 'sou'];
  const windNames = ['east', 'south', 'west', 'north'];
  const dragonNames = ['haku', 'hatsu', 'chun'];
  const honorNames = [...windNames, ...dragonNames];

  if (suitNames.includes(parts[0])) {
    return {
      id,
      suit: parts[0] as 'man' | 'pin' | 'sou',
      rank: parseInt(parts[1], 10),
      isFlower: false,
    };
  } else if (honorNames.includes(parts[0])) {
    return {
      id,
      honorType: windNames.includes(parts[0]) ? 'wind' : 'dragon',
      honorName: parts[0] as any,
      isFlower: false,
    };
  }

  // Fallback
  return { id, isFlower: false };
}

// Sort key for tiles
function tileKey(t: TileDef): string {
  if (t.suit) {
    const suitOrder: Record<string, number> = { man: 0, pin: 1, sou: 2 };
    return `${suitOrder[t.suit]}${t.rank!.toString().padStart(2, '0')}`;
  }
  return `9${t.honorName ?? 'zzz'}`;
}

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

interface PlayerData {
  playerId: string;
  displayName: string;
  seatIndex: number;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
}

interface SeatData {
  seatIndex: number;
  concealedCount: number;
  isRiichi: boolean;
  meldCount: number;
  meldTypes: string;
  riverTileIds: string;
  score: number;
  hasPassedReaction: boolean;
}

export function GameScreen() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  // Room reference from shared context (set by lobby before navigation)
  const room = getRoom();
  const mySessionId = getMySessionId();

  // My seat index
  const [mySeat, setMySeat] = useState<number>(0);

  // Hand tiles (parsed from server messages)
  const [handTiles, setHandTiles] = useState<TileDef[]>([]);

  // Current legal actions
  const [legalActions, setLegalActions] = useState<string[]>([]);

  // Reaction options (when someone discards and we can react)
  const [reactionOptions, setReactionOptions] = useState<string[]>([]);

  // Current phase
  const [phase, setPhase] = useState<string>('LOBBY');

  // Room state (synced from onStateChange)
  const [roomState, setRoomState] = useState<any>(null);

  // Win result for display
  const [handResult, setHandResult] = useState<any>(null);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for game to start...');

  // Track seat mapping from state
  const seatMapRef = useRef<Map<string, number>>(new Map());

  // Listen for state changes
  useEffect(() => {
    if (!room) return;

    const onStateChange = (state: any) => {
      setRoomState({ ...state });
      setPhase(state.phase || 'LOBBY');

      // Build seat mapping from players
      const players: PlayerData[] = state.players ? Array.from(state.players.values() as Iterable<PlayerData>) : [];
      const newSeatMap = new Map<string, number>();
      for (const p of players) {
        if (p.seatIndex !== undefined && p.seatIndex !== null) {
          newSeatMap.set(p.playerId, p.seatIndex);
        }
      }
      seatMapRef.current = newSeatMap;

      // Find my seat
      const mySeatIdx = newSeatMap.get(mySessionId);
      if (mySeatIdx !== undefined) {
        setMySeat(mySeatIdx);
      }
    };

    room.onStateChange(onStateChange);

    // Initial state
    if (room.state) {
      onStateChange(room.state);
    }

    return () => {
      room.onStateChange.remove(onStateChange);
    };
  }, [room, mySessionId]);

  // Listen for server messages
  useEffect(() => {
    if (!room) return;

    const unsubs: Array<() => void> = [];

    const onDeal = (data: { tiles: string[] }) => {
      const tiles = data.tiles.map(parseTileId);
      tiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
      setHandTiles(tiles);
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

    const onTileDrawn = (data: { tileId: string }) => {
      const tile = parseTileId(data.tileId);
      setHandTiles((prev) => {
        const newTiles = [...prev, tile];
        newTiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
        return newTiles;
      });
      setStatusMessage('Tile drawn! Choose an action.');
    };

    const onLegalActions = (data: { actions: string[] }) => {
      setLegalActions(data.actions);
    };

    const onReactionOptions = (data: { discardSeat: number; discardTileId: string; actions: string[] }) => {
      setReactionOptions(data.actions);
      setStatusMessage(`Seat ${data.discardSeat} discarded. You can react!`);
    };

    const onMeldApplied = (data: { meld: { type: string; tileIds: string[] } }) => {
      // Remove melded tiles from hand
      const meldTileIds = new Set(data.meld.tileIds);
      setHandTiles((prev) => prev.filter((t) => !meldTileIds.has(t.id)));
      setStatusMessage(`Meld applied: ${data.meld.type}`);
    };

    const onHandResult = (data: any) => {
      setHandResult(data);
      setLegalActions([]);
      setReactionOptions([]);
      if (data.endReason === 'exhaustive-draw') {
        setStatusMessage('Exhaustive draw! No one wins this hand.');
      } else {
        setStatusMessage(`Hand over! ${data.winType === 'ron' ? 'Ron' : 'Tsumo'} by seat ${data.winner}!`);
      }
    };

    unsubs.push(room.onMessage('deal', onDeal));
    unsubs.push(room.onMessage('your-turn-draw', onYourTurnDraw));
    unsubs.push(room.onMessage('tile-drawn', onTileDrawn));
    unsubs.push(room.onMessage('legal-actions', onLegalActions));
    unsubs.push(room.onMessage('reaction-options', onReactionOptions));
    unsubs.push(room.onMessage('meld-applied', onMeldApplied));
    unsubs.push(room.onMessage('hand-result', onHandResult));

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [room, mySeat]);

  // Handle actions from ActionPrompt
  const handleAction = useCallback((action: string) => {
    if (!room) return;

    switch (action) {
      case 'DRAW_TILE':
        room.send('draw-tile');
        setStatusMessage('Drawing tile...');
        setLegalActions([]);
        break;
      case 'PASS_REACTION':
        room.send('pass-reaction');
        setReactionOptions([]);
        setStatusMessage('Passed.');
        break;
      case 'CALL_PON':
        room.send('call-pon');
        setReactionOptions([]);
        setStatusMessage('Calling Pon!');
        break;
      case 'CALL_CHI':
        room.send('call-chi', { tiles: [0, 1] }); // Simplified chi - TODO: proper tile selection
        setReactionOptions([]);
        setStatusMessage('Calling Chi!');
        break;
      case 'DECLARE_WIN_RON':
        room.send('declare-win-ron');
        setReactionOptions([]);
        setStatusMessage('Declaring Ron!');
        break;
      case 'DECLARE_WIN_TSUMO':
        room.send('declare-win-tsumo');
        setLegalActions([]);
        setStatusMessage('Declaring Tsumo!');
        break;
    }
  }, [room]);

  // Handle discard
  const handleDiscard = useCallback((tile: TileDef) => {
    if (!room) return;
    room.send('discard-tile', { tileId: tile.id });
    setHandTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setLegalActions([]);
    setStatusMessage('Tile discarded. Waiting...');
  }, [room]);

  // Build seat display data from room state
  const buildSeatDisplays = (): SeatDisplay[] => {
    if (!roomState) {
      return [0, 1, 2, 3].map((i) => ({
        seatIndex: i,
        displayName: `Seat ${i}`,
        tileCount: 0,
        isDealer: i === 0,
        isActive: false,
        isRiichi: false,
        melds: [],
        river: [],
        score: 25000,
      }));
    }

    const players: PlayerData[] = roomState.players ? Array.from(roomState.players.values() as Iterable<PlayerData>) : [];
    const seats: SeatData[] = roomState.seats ? Array.from(roomState.seats.values() as Iterable<SeatData>) : [];
    const activeSeat = roomState.activeSeat ?? 0;
    const dealerSeat = roomState.dealerSeat ?? 0;

    return [0, 1, 2, 3].map((i) => {
      const seatData = seats.find((s) => s.seatIndex === i);
      const player = players.find((p) => p.seatIndex === i);

      // Parse river tiles
      const riverTileIds: string[] = seatData?.riverTileIds ? seatData.riverTileIds.split(',').filter(Boolean) : [];
      const riverEntries = riverTileIds.map((id, idx) => ({
        tile: parseTileId(id),
        isLastDiscard: idx === riverTileIds.length - 1,
      }));

      // Parse melds
      const meldTypes: string[] = seatData?.meldTypes ? seatData.meldTypes.split(',').filter(Boolean) : [];
      const melds = meldTypes.map((type) => ({
        type,
        tiles: [] as any[],
        isConcealed: false,
      }));

      return {
        seatIndex: i,
        displayName: player?.displayName || `Seat ${i}`,
        tileCount: seatData?.concealedCount ?? 0,
        isDealer: i === dealerSeat,
        isActive: i === activeSeat,
        isRiichi: seatData?.isRiichi ?? false,
        melds,
        river: riverEntries,
        score: seatData?.score ?? 25000,
      };
    });
  };

  const seatDisplays = buildSeatDisplays();
  const allActions = [...legalActions, ...reactionOptions];

  // No room - redirect to lobby
  if (!room) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Not connected to a room.</p>
        <Button onClick={() => navigate(`/lobby/${roomCode}`)}>Back to Lobby</Button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TableLayout
        seats={seatDisplays}
        activeSeat={roomState?.activeSeat ?? 0}
        dealerSeat={roomState?.dealerSeat ?? 0}
        roundWind={roomState?.roundWind ?? 'east'}
        handNumber={roomState?.handNumber ?? 1}
        honba={roomState?.honba ?? 0}
        riichiSticks={roomState?.riichiSticks ?? 0}
        wallRemaining={roomState?.wallRemaining ?? 0}
      >
        {/* My hand area */}
        <div style={{ position: 'absolute', bottom: '4rem', left: '50%', transform: 'translateX(-50%)' }}>
          <HandArea tiles={handTiles} onDiscard={handleDiscard} />
        </div>

        {/* My melds */}
        {seatDisplays[mySeat] && seatDisplays[mySeat].melds.length > 0 && (
          <div style={{ position: 'absolute', bottom: '10rem', left: '50%', transform: 'translateX(-50%)' }}>
            <MeldArea melds={seatDisplays[mySeat].melds} />
          </div>
        )}

        {/* Opponent river (top player for now) */}
        {seatDisplays[(mySeat + 2) % 4] && seatDisplays[(mySeat + 2) % 4].river.length > 0 && (
          <div style={{ position: 'absolute', top: '5rem', left: '50%', transform: 'translateX(-50%)' }}>
            <RiverArea entries={seatDisplays[(mySeat + 2) % 4].river} />
          </div>
        )}
      </TableLayout>

      {/* Status message */}
      <div style={{
        textAlign: 'center',
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        background: 'var(--surface-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {statusMessage}
        {phase !== 'LOBBY' && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>Phase: {phase}</span>}
      </div>

      {/* Action prompt */}
      <ActionPrompt actions={allActions} onAction={handleAction} />

      {/* Hand result overlay */}
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
            {handResult.endReason === 'exhaustive-draw' ? (
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
          </div>
        </div>
      )}
    </div>
  );
}
