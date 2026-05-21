import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export class CardSchema extends Schema {
  @type('string') suit: string = '';
  @type('string') rank: string = '';
  @type('string') id: string = '';
}

export class HandSchema extends Schema {
  @type([CardSchema]) cards = new ArraySchema<CardSchema>();
  @type('uint32') bet: number = 0;
  @type('string') status: string = 'playing';
  @type('boolean') isDoubled: boolean = false;
  @type('boolean') isSplit: boolean = false;
  @type('boolean') settled: boolean = false;
  @type('int32') payout: number = 0;
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
  @type('int32') currentBet: number = 0;
  @type('boolean') hasBet: boolean = false;
  @type([HandSchema]) hands = new ArraySchema<HandSchema>();
}

export class GameState extends Schema {
  @type('string') roomId: string = '';
  @type('string') roomCode: string = '';
  @type('string') status: string = 'lobby';
  @type('string') hostPlayerId: string = '';
  @type('string') phase: string = 'LOBBY';

  // Dealer state (public)
  @type([CardSchema]) dealerCards = new ArraySchema<CardSchema>();
  @type('string') dealerStatus: string = 'waiting';

  // Game state
  @type('uint8') activeSeat: number = 255;
  @type('uint8') activeHandIndex: number = 0;
  @type('uint8') numDecks: number = 2;
  @type('uint32') minBet: number = 10;
  @type('uint32') maxBet: number = 500;

  // Players
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();

  // Chat
  @type([ChatMessageSchema]) chatMessages = new ArraySchema<ChatMessageSchema>();

  // Round result
  @type('string') roundResult: string = '';
}
