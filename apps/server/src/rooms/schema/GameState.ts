import { Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('uint8') seatIndex: number = 0;
  @type('boolean') isConnected: boolean = false;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isHost: boolean = false;
}

export class GameState extends Schema {
  @type('string') roomId: string = '';
  @type('string') roomCode: string = '';
  @type('string') status: string = 'lobby';
  @type('string') hostPlayerId: string = '';
  @type('string') phase: string = 'LOBBY';
  @type('uint8') activeSeat: number = 0;
  @type('uint8') wallRemaining: number = 0;
  @type('uint8') dealerSeat: number = 0;
  @type('uint8') handNumber: number = 1;
  @type('string') roundWind: string = 'east';
  @type('uint8') honba: number = 0;
  @type('uint8') riichiSticks: number = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
