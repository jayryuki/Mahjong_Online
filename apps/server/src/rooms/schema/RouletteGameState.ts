import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export class ChipSchema extends Schema {
  @type('string') playerId: string = '';
  @type('uint8') chipColor: number = 0;
  @type('uint32') amount: number = 0;
  @type('string') betType: string = '';
}

export class ChatMessageSchema extends Schema {
  @type('string') senderId: string = '';
  @type('string') senderName: string = '';
  @type('string') text: string = '';
  @type('uint32') timestamp: number = 0;
}

export class PlayerSchema extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('uint8') seatIndex: number = 0;
  @type('boolean') isConnected: boolean = false;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isHost: boolean = false;
  @type('uint32') bankroll: number = 1000;
  @type('uint8') chipColor: number = 255; // 0-7, 255 = unassigned
  @type('uint32') totalBetThisRound: number = 0;
}

export class RouletteGameState extends Schema {
  @type('string') roomId: string = '';
  @type('string') roomCode: string = '';
  @type('string') status: string = 'lobby';
  @type('string') hostPlayerId: string = '';
  @type('string') phase: string = 'LOBBY';

  @type('int8') winningNumber: number = -1; // -1 until settled, 0-37 (37=00)

  @type('uint8') timerSeconds: number = 0; // countdown during BETTING

  @type('uint32') minBet: number = 1;
  @type('uint32') maxBet: number = 1000;
  @type('uint8') betTime: number = 30; // configurable seconds
  @type('uint8') maxPlayers: number = 8;

  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([ChipSchema]) chips = new ArraySchema<ChipSchema>();
  @type([ChatMessageSchema]) chatMessages = new ArraySchema<ChatMessageSchema>();

  // Last 20 winning numbers for hot/cold display, stored as string representations
  @type([ 'string' ]) lastResults = new ArraySchema<string>();

  @type('string') roundResult: string = ''; // JSON settlement summary
}
