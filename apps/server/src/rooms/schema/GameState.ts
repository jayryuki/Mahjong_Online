import { Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('uint8') seatIndex: number = 0;
  @type('boolean') isConnected: boolean = false;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isHost: boolean = false;
}

export class SeatRoundSchema extends Schema {
  @type('uint8') seatIndex: number = 0;
  @type('uint8') concealedCount: number = 0;
  @type('boolean') isRiichi: boolean = false;
  @type('uint8') meldCount: number = 0;
  @type('string') meldTypes: string = '';
  @type('string') riverTileIds: string = '';
  @type('int32') score: number = 25000;
  @type('boolean') hasPassedReaction: boolean = false;
  @type('uint8') handVersion: number = 0;
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
  @type({ map: SeatRoundSchema }) seats = new MapSchema<SeatRoundSchema>();

  // Flattened phase details (Colyseus schema can't represent union types)
  @type('string') doraIndicators: string = '';
  @type('string') legalActions: string = '';
  @type('string') lastDiscardTileId: string = '';
  @type('uint8') lastDiscardSeat: number = 255;
  @type('string') reactionEligibleSeats: string = '';
  @type('string') winInfo: string = '';
}
