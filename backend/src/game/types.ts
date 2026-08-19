import { drawPlayerHand, drawDisaster, drawBunker, type RoomDecks } from "../gameData.js";

export type BackendCardCategory =
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

export type BackendGamePhase = "reveal" | "discussion" | "reverseVote" | "defense" | "finalVote";

export interface BackendRevealedCard {
  category: BackendCardCategory;
  label: string;
  value: string;
  action?: string;
  cardId?: number;
  activated?: boolean;
  requested?: boolean;
  forced?: boolean;
  revealedAt: number;
}

export interface BackendPlayer {
  id: string;
  name: string;
  playerKey: string;
  disconnected: boolean;
  disconnectedAt: number | null;
  hand: ReturnType<typeof drawPlayerHand>;
  revealedCards: BackendRevealedCard[];
  isEliminated: boolean;
  isHost: boolean;
  roundRevealCount: number;
  roundDebt: number;
  voteImmunity: boolean;
  defenseTimeReduced: boolean;
  hasIntroduced: boolean;
}

export interface BackendGameRoom {
  id: string;
  players: Map<string, BackendPlayer>;
  status: "lobby" | "playing" | "ended";
  disaster: ReturnType<typeof drawDisaster> | null;
  bunker: ReturnType<typeof drawBunker> | null;
  createdAt: number;
  round: number;
  cardRevealLimit: number;
  originalPlayerCount: number;
  turnOrder: string[];
  currentTurnIndex: number;
  turnEndsAt: number | null;
  turnDurationSec: number;
  pausedRemainingMs: number | null;
  phase: BackendGamePhase;
  phaseDurations: Record<BackendGamePhase, number>;
  votes: Map<string, string>;
  voteCounts: Record<string, number>;
  defendingPlayerIds: string[];
  lastEliminatedPlayerId: string | null;
  terminated?: boolean;
  decks: RoomDecks;
}

export interface BackendEndTurnResult {
  nextPlayerId: string | null;
  phaseEnded: boolean;
}

export interface BackendPhaseAdvanceResult {
  phase: BackendGamePhase;
  roundAdvanced: boolean;
  eliminatedPlayerId: string | null;
  gameEnded: boolean;
}

export interface BackendRevealResult {
  card?: BackendRevealedCard;
  error?: string;
}

export interface BackendVoteResult {
  error?: string;
  voteCounts?: Record<string, number>;
}

export interface BackendActivateResult {
  error?: string;
  message?: string;
  flashes?: BackendActivateFlash[];
  eliminatedPlayerId?: string;
  revivedPlayerId?: string;
  gameOver?: boolean;
}

export interface BackendActivateOpts {
  ownerId: string;
  slot: "specialCard1" | "specialCard2";
  targetId?: string;
}

export interface BackendActivateFlash {
  playerId: string;
  card: BackendRevealedCard;
}

export type BackendHandCategory = "profession" | "health" | "ageGender" | "hobby" | "personality" | "phobia" | "bagItem";
