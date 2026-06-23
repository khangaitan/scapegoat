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

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  profession: "Мэргэжил",
  health: "Эрүүл мэнд",
  ageGender: "Нас, хүйс",
  hobby: "Хобби",
  personality: "Зан araншин",
  specialCard1: "Тусгай карт 1",
  specialCard2: "Тусгай карт 2",
  phobia: "Айдас (Фобиа)",
  extraInfo: "Нэмэлт мэдээлэл",
  bagItem: "Гар цүнх",
};

export const CATEGORY_ICONS: Record<CardCategory, string> = {
  profession: "💼",
  health: "🏥",
  ageGender: "👤",
  hobby: "🎯",
  personality: "🧠",
  specialCard1: "⭐",
  specialCard2: "⭐",
  phobia: "😱",
  extraInfo: "📋",
  bagItem: "🎒",
};

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

export type SpecialCardTarget = "none" | "otherPlayer" | "anyPlayer" | "eliminatedPlayer";

export const SPECIAL_CARD_TARGET: Record<number, SpecialCardTarget> = {
  1: "none", 2: "none", 3: "none", 4: "none", 5: "none", 6: "none",
  7: "otherPlayer", 8: "otherPlayer", 9: "otherPlayer", 10: "otherPlayer", 11: "otherPlayer", 12: "otherPlayer",
  13: "none", 14: "none", 15: "none", 16: "none", 17: "none", 18: "none",
  19: "otherPlayer", 20: "anyPlayer", 21: "anyPlayer", 22: "anyPlayer",
  23: "otherPlayer", 24: "otherPlayer", 25: "otherPlayer",
  26: "eliminatedPlayer", 27: "otherPlayer", 28: "none", 29: "none", 30: "none",
};

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

export type GamePhase = "reveal" | "discussion" | "reverseVote" | "defense" | "finalVote";

export const PHASE_LABELS: Record<GamePhase, string> = {
  reveal: "Карт дэлгэх",
  discussion: "Нийтийн нэг минут",
  reverseVote: "Хэн хасуулах вэ?",
  defense: "Өөрийгөө хамгаалах",
  finalVote: "Эцсийн санал хураалт",
};

export const PHASE_ICONS: Record<GamePhase, string> = {
  reveal: "🃏",
  discussion: "💬",
  reverseVote: "👉",
  defense: "🛡️",
  finalVote: "⚖️",
};

export const PHASE_ORDER: GamePhase[] = ["reveal", "discussion", "reverseVote", "defense", "finalVote"];

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

export interface FlashCard {
  playerId: string;
  playerName: string;
  card: RevealedCard;
  id: string;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export const ROUND_PHASE_NAMES: Record<number, string> = {
  1: "МЭДЭЭЛЭЛ ТАНИЛЦУУЛАХ",
  2: "ХЭЛЭЛЦҮҮЛЭГ",
  3: "САНАЛ ХУРААЛТ",
  4: "ШИЙДЭЛТ",
};

export function getRoundPhaseName(round: number): string {
  return ROUND_PHASE_NAMES[round] ?? "ШИЙДЭЛТ";
}
