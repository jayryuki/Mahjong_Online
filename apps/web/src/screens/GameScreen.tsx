import React from 'react';
import { useParams } from 'react-router-dom';
import { useGameClient } from '../hooks/useGameClient.js';
import { useLegalActions } from '../hooks/useLegalActions.js';
import { TableLayout } from '../components/table/TableLayout.js';
import { HandArea } from '../components/table/HandArea.js';
import { RiverArea } from '../components/table/RiverArea.js';
import { MeldArea } from '../components/table/MeldArea.js';
import { ActionPrompt } from '../components/actions/ActionPrompt.js';
import { TileDef } from '@mahjong/game-core';

export function GameScreen() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state, error, join } = useGameClient(roomCode || '');
  const legalActions = useLegalActions(state, 0); // TODO: determine my seat

  // Mock data for now — will be wired to real state in Task 16
  const mockSeats = [
    { seatIndex: 0, displayName: 'You', tileCount: 13, isDealer: true, isActive: true, isRiichi: false, melds: [], river: [] },
    { seatIndex: 1, displayName: 'Player 2', tileCount: 13, isDealer: false, isActive: false, isRiichi: false, melds: [], river: [] },
    { seatIndex: 2, displayName: 'Player 3', tileCount: 13, isDealer: false, isActive: false, isRiichi: false, melds: [], river: [] },
    { seatIndex: 3, displayName: 'Player 4', tileCount: 13, isDealer: false, isActive: false, isRiichi: false, melds: [], river: [] },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TableLayout
        seats={mockSeats}
        activeSeat={0}
        dealerSeat={0}
        roundWind="east"
        handNumber={1}
        honba={0}
        riichiSticks={0}
        wallRemaining={70}
      >
        <div style={{ position: 'absolute', bottom: '4rem', left: '50%', transform: 'translateX(-50%)' }}>
          <HandArea tiles={[]} onDiscard={(tile: TileDef) => {}} />
        </div>
      </TableLayout>
      <ActionPrompt actions={legalActions} onAction={(action) => {}} />
    </div>
  );
}
