export type CardCategory =
  | "profession"
  | "health"
  | "ageGender"
  | "hobby"
  | "personality"
  | "specialCard1"
  | "specialCard2"
  | "phobia"
  | "extraInfo"
  | "bagItem";

export type GamePhase = "reveal" | "discussion" | "reverseVote" | "defense" | "finalVote";

export interface RevealedCard {
  category: CardCategory;
  label: string;
  value: string;
  action?: string;
  cardId?: number;
  activated?: boolean;
  requested?: boolean;
  forced?: boolean;
  revealedAt: number;
}

export interface PlayerHand {
  profession: string;
  health: string;
  ageGender: string;
  hobby: string;
  personality: string;
  specialCard1: string;
  specialCard1Action: string;
  specialCard2: string;
  specialCard2Action: string;
  phobia: string;
  extraInfo: string;
  bagItem: string;
}

export interface Player {
  id: string;
  name: string;
  isEliminated: boolean;
  isHost: boolean;
  revealedCards: RevealedCard[];
  hand: PlayerHand | null;
  revealedCount: number;
  roundRevealCount: number;
  roundDebt: number;
  effectiveLimit: number;
  voteImmunity?: boolean;
  defenseTimeReduced?: boolean;
  disconnected?: boolean;
}

export interface Disaster {
  id: number;
  name: string;
  description: string;
  extra: string;
}

export interface Bunker {
  id: number;
  description: string;
}

export interface GameRoom {
  id: string;
  status: "lobby" | "playing" | "ended";
  disaster: Disaster | null;
  bunker: Bunker | null;
  players: Player[];
  round: number;
  cardRevealLimit: number;
  originalPlayerCount: number;
  turnOrder: string[];
  currentTurnIndex: number;
  currentTurnPlayerId: string | null;
  turnEndsAt: number | null;
  turnDurationSec: number;
  pausedRemainingMs: number | null;
  isPaused: boolean;
  phase: GamePhase;
  phaseLabel: string;
  phaseDurations: Record<GamePhase, number>;
  voteCounts: Record<string, number>;
  defendingPlayerIds: string[];
  lastEliminatedPlayerId: string | null;
  myVote: string | null;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface FlashCard {
  playerId: string;
  playerName: string;
  card: RevealedCard;
  id: string;
}
