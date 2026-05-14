import { GamePhase } from '../models/match.js';

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  const allowed: Record<string, string[]> = {
    'ROOM_OPEN': ['LOBBY'],
    'LOBBY': ['DEALING'],
    'DEALING': ['TURN_DRAW'],
    'TURN_DRAW': ['TURN_DECISION', 'HAND_END'],
    'TURN_DECISION': ['REACTION_WINDOW', 'TURN_DRAW', 'HAND_END', 'TURN_DECISION'],
    'REACTION_WINDOW': ['TURN_DECISION', 'TURN_DRAW'],
    'RESOLUTION': ['HAND_END'],
    'HAND_END': ['ROUND_END', 'DEALING'],
    'ROUND_END': ['DEALING', 'MATCH_END'],
    'MATCH_END': [],
  };
  return (allowed[from.type] ?? []).includes(to.type);
}
