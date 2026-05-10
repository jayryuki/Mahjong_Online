import { Room, Client } from '@colyseus/core';
import { GameState, PlayerSchema } from './schema/GameState.js';

export class MahjongRoom extends Room<GameState> {
  maxClients = 4;

  onCreate(options: { preset: any; hostPlayerId: string; roomCode: string }) {
    this.setState(new GameState());
    this.state.roomId = this.roomId;
    this.state.roomCode = options.roomCode;
    this.state.hostPlayerId = options.hostPlayerId;
    this.state.status = 'lobby';
    this.state.phase = 'LOBBY';

    this.onMessage('choose-seat', (client, data: { seatIndex: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.seatIndex = data.seatIndex;
      }
    });

    this.onMessage('toggle-ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !player.isReady;
      }
    });

    this.onMessage('start-match', (client) => {
      this.state.status = 'in-progress';
      this.state.phase = 'DEALING';
    });
  }

  onJoin(client: Client, options: { displayName: string }) {
    const player = new PlayerSchema();
    player.playerId = client.sessionId;
    player.displayName = options.displayName || 'Player';
    player.isConnected = true;
    player.isHost = client.sessionId === this.state.hostPlayerId;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isConnected = false;
    }
  }

  onDispose() {
    // Cleanup
  }
}
