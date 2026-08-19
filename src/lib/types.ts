import type {
  CardCategory,
  PlayerHand,
  Player,
  Disaster,
  Bunker,
  GamePhase,
  GameRoom,
  ChatMessage,
  FlashCard,
  RevealedCard,
} from "../../shared/types";

export type {
  CardCategory,
  PlayerHand,
  Player,
  Disaster,
  Bunker,
  GamePhase,
  GameRoom,
  ChatMessage,
  FlashCard,
  RevealedCard,
};

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

export type SpecialCardTarget = "none" | "otherPlayer" | "anyPlayer" | "eliminatedPlayer";

export const SPECIAL_CARD_TARGET: Record<number, SpecialCardTarget> = {
  1: "none", 2: "none", 3: "none", 4: "none", 5: "none", 6: "none",
  7: "otherPlayer", 8: "otherPlayer", 9: "otherPlayer", 10: "otherPlayer", 11: "otherPlayer", 12: "otherPlayer",
  13: "none", 14: "none", 15: "none", 16: "none", 17: "none", 18: "none",
  19: "otherPlayer", 20: "anyPlayer", 21: "anyPlayer", 22: "anyPlayer",
  23: "otherPlayer", 24: "otherPlayer", 25: "otherPlayer",
  26: "eliminatedPlayer", 27: "otherPlayer", 28: "none", 29: "none", 30: "none",
};

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

export const ROUND_PHASE_NAMES: Record<number, string> = {
  1: "МЭДЭЭЛЭЛ ТАНИЛЦУУЛАХ",
  2: "ХЭЛЭЛЦҮҮЛЭГ",
  3: "САНАЛ ХУРААЛТ",
  4: "ШИЙДЭЛТ",
};

export function getRoundPhaseName(round: number): string {
  return ROUND_PHASE_NAMES[round] ?? "ШИЙДЭЛТ";
}
