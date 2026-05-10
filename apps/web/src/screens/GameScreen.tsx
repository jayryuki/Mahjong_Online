import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TableLayout } from '../components/table/TableLayout.js';
import { HandArea } from '../components/table/HandArea.js';
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
  meldTileIds: string;
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
  const mySeatRef = useRef<number>(0);

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

  // Drawn tile ID (from tile-drawn message)
  const [drawnTileId, setDrawnTileId] = useState<string | null>(null);

  // Hand version tracking
  const [handVersion, setHandVersion] = useState<number>(0);

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
        mySeatRef.current = mySeatIdx;
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

    room.send('request-hand');

    const unsubs: Array<() => void> = [];

    const onHandState = (data: { tiles: string[]; melds: Array<{ type: string; tileIds: string[]; isConcealed: boolean }>; handVersion: number; phase?: string; activeSeat?: number; legalActions?: string[] }) => {
      const tiles = data.tiles.map(parseTileId);
      tiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
      setHandTiles(tiles);
      setHandVersion(data.handVersion);
      setHandResult(null);

      // Reconstruct turn state from server response
      if (data.phase && data.legalActions) {
        if (data.phase === 'TURN_DRAW' && data.activeSeat === mySeatRef.current) {
          setLegalActions(data.legalActions);
          setStatusMessage('Your turn - Draw a tile!');
        } else if (data.phase === 'TURN_DECISION' && data.activeSeat === mySeatRef.current) {
          setLegalActions(data.legalActions);
          setStatusMessage('Tile drawn! Choose an action.');
        } else if (data.phase === 'REACTION_WINDOW') {
          setReactionOptions(data.legalActions);
          setStatusMessage('A tile was discarded. You can react!');
        } else {
          setStatusMessage(`Seat ${data.activeSeat ?? '?'} is playing...`);
        }
      } else {
        setStatusMessage('Hand synced.');
      }
    };

    const onDeal = (data: { tiles: string[]; handVersion?: number }) => {
      const tiles = data.tiles.map(parseTileId);
      tiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
      setHandTiles(tiles);
      if (data.handVersion !== undefined) setHandVersion(data.handVersion);
      setStatusMessage('Hand dealt! Waiting for your turn...');
      setHandResult(null);
    };

    const onYourTurnDraw = (data: { seat: number }) => {
      if (data.seat === mySeatRef.current) {
        setStatusMessage('Your turn - Draw a tile!');
        setLegalActions(['DRAW_TILE']);
      } else {
        setStatusMessage(`Seat ${data.seat} is drawing...`);
        setLegalActions([]);
      }
    };

    const onTileDrawn = (data: { tileId: string; handVersion?: number }) => {
      const tile = parseTileId(data.tileId);
      setDrawnTileId(data.tileId);
      setHandTiles((prev) => {
        const newTiles = [...prev, tile];
        newTiles.sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
        return newTiles;
      });
      if (data.handVersion !== undefined) setHandVersion(data.handVersion);
      setStatusMessage('Tile drawn! Choose an action.');
    };

    const onLegalActions = (data: { actions: string[] }) => {
      setLegalActions(data.actions);
    };

    const onReactionOptions = (data: { discardSeat: number; discardTileId: string; actions: string[] }) => {
      setReactionOptions(data.actions);
      setStatusMessage(`Seat ${data.discardSeat} discarded. You can react!`);
    };

    const onMeldApplied = (data: { meld: { type: string; tileIds: string[] }; handVersion?: number }) => {
      const meldTileIds = new Set(data.meld.tileIds);
      setHandTiles((prev) => prev.filter((t) => !meldTileIds.has(t.id)));
      if (data.handVersion !== undefined) setHandVersion(data.handVersion);
      setStatusMessage(`Meld applied: ${data.meld.type}`);
    };

    const onHandResult = (data: any) => {
      setHandResult(data);
      setLegalActions([]);
      setReactionOptions([]);
      setDrawnTileId(null);
      if (data.endReason === 'exhaustive-draw') {
        setStatusMessage('Exhaustive draw! No one wins this hand.');
      } else {
        setStatusMessage(`Hand over! ${data.winType === 'ron' ? 'Ron' : 'Tsumo'} by seat ${data.winner}!`);
      }
    };

    const onRiichiDeclared = (data: { seat: number }) => {
      setStatusMessage(`Seat ${data.seat} declared Riichi!`);
    };

    const onMatchEnd = (data: { finalScores: Array<{ seatIndex: number; points: number }> }) => {
      setStatusMessage('Match over!');
      setHandResult({ endReason: 'match-end', finalScores: data.finalScores });
    };

    unsubs.push(room.onMessage('hand-state', onHandState));
    unsubs.push(room.onMessage('deal', onDeal));
    unsubs.push(room.onMessage('your-turn-draw', onYourTurnDraw));
    unsubs.push(room.onMessage('tile-drawn', onTileDrawn));
    unsubs.push(room.onMessage('legal-actions', onLegalActions));
    unsubs.push(room.onMessage('reaction-options', onReactionOptions));
    unsubs.push(room.onMessage('meld-applied', onMeldApplied));
    unsubs.push(room.onMessage('hand-result', onHandResult));
    unsubs.push(room.onMessage('riichi-declared', onRiichiDeclared));
    unsubs.push(room.onMessage('match-end', onMatchEnd));

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [room]);

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
      case 'DECLARE_RIICHI':
        room.send('declare-riichi');
        setLegalActions([]);
        setStatusMessage('Declaring Riichi!');
        break;
    }
  }, [room]);

  // Handle discard
  const handleDiscard = useCallback((tile: TileDef) => {
    if (!room) return;
    room.send('discard-tile', { tileId: tile.id });
    setHandTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setDrawnTileId(null);
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
      const meldTileIdsStr: string = seatData?.meldTileIds ?? '';
      const meldGroups = meldTileIdsStr ? meldTileIdsStr.split(',').filter(Boolean) : [];
      const melds = meldGroups.map((group) => {
        const tileIds = group.split('|');
        return {
          type: '',
          tiles: tileIds.map(id => ({ id })),
          isConcealed: false,
        };
      });

      const meldTypes: string[] = seatData?.meldTypes ? seatData.meldTypes.split(',').filter(Boolean) : [];
      for (let j = 0; j < melds.length; j++) {
        if (meldTypes[j]) melds[j].type = meldTypes[j];
      }

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
        mySeat={mySeat}
        activeSeat={roomState?.activeSeat ?? 0}
        dealerSeat={roomState?.dealerSeat ?? 0}
        roundWind={roomState?.roundWind ?? 'east'}
        handNumber={roomState?.handNumber ?? 1}
        honba={roomState?.honba ?? 0}
        riichiSticks={roomState?.riichiSticks ?? 0}
        wallRemaining={roomState?.wallRemaining ?? 0}
        doraIndicatorIds={roomState?.doraIndicators ? roomState.doraIndicators.split(',').filter(Boolean) : []}
      >
        {/* My hand area */}
        <div style={{ position: 'absolute', bottom: '4rem', left: '50%', transform: 'translateX(-50%)' }}>
          <HandArea tiles={handTiles} drawnTileId={drawnTileId} onDiscard={handleDiscard} />
        </div>
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
            {handResult.endReason === 'match-end' ? (
              <>
                <h2 style={{ color: 'var(--accent-warm)', margin: '0 0 1rem 0' }}>Match Over</h2>
                {handResult.finalScores?.map((s: any) => {
                  const seat = seatDisplays[s.seatIndex];
                  return (
                    <div key={s.seatIndex} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{seat?.displayName ?? `Seat ${s.seatIndex}`}</span>
                      <span style={{ color: s.points >= 25000 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{s.points}</span>
                    </div>
                  );
                })}
              </>
            ) : handResult.endReason === 'exhaustive-draw' ? (
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
            {phase === 'HAND_END' && (
              <Button
                onClick={() => {
                  if (handResult.endReason === 'match-end') {
                    navigate('/');
                  } else {
                    room?.send('next-hand');
                    setHandResult(null);
                    setHandTiles([]);
                    setDrawnTileId(null);
                  }
                }}
                style={{ marginTop: '1.5rem', width: '100%' }}
              >
                {handResult.endReason === 'match-end' ? 'Back to Home' : 'Next Hand'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
