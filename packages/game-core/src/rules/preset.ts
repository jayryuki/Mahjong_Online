export interface RulesPreset {
  id: string;
  name: string;
  description: string;
  playerCount: 3 | 4;
  flowersEnabled: boolean;
  minimumHan: number;
  minimumFu?: number;
  scoringModel: 'riichi' | 'hong-kong';
  kiriageMangan: boolean;
  kazoeLimit: 'mangan' | 'haneman' | 'sanbaiman' | 'none';
  allowOpenHand: boolean;
  allowChi: boolean;
  allowPon: boolean;
  allowKan: boolean;
  allowRiichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  reactionPriority: ('ron' | 'pon' | 'kan-open' | 'chi')[];
  atamahane: boolean;
  turnTimerEnabled: boolean;
  turnTimerSeconds: number;
  reactionTimerSeconds: number;
  autoSortHand: boolean;
  confirmDiscard: boolean;
  scoreDisplayVerbosity: 'minimal' | 'standard' | 'detailed';
  spectatorPolicy: 'none' | 'allow';
}
