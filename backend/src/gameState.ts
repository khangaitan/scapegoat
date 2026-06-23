import { drawPlayerHand, drawDisaster, drawBunker, getSpecialCardAction, getSpecialCardMeta, drawNew, drawPlayerHandFromDecks, drawNewFromDecks, createRoomDecks, type RoomDecks } from "./gameData.js";

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
  personality: "Зан араншин",
  specialCard1: "Тусгай карт 1",
  specialCard2: "Тусгай карт 2",
  phobia: "Айдас (Фобиа)",
  extraInfo: "Нэмэлт мэдээлэл",
  bagItem: "Гар цүнх",
};

export type GamePhase = "reveal" | "discussion" | "reverseVote" | "defense" | "finalVote";

export const PHASE_LABELS: Record<GamePhase, string> = {
  reveal: "Карт дэлгэх",
  discussion: "Нийтийн нэг минут",
  reverseVote: "Хэн хасуулах вэ?",
  defense: "Өөрийгөө хамгаалах",
  finalVote: "Эцсийн санал хураалт",
};

const PHASE_DEFAULT_DURATIONS: Record<GamePhase, number> = {
  reveal: 60,
  discussion: 60,
  reverseVote: 30,
  defense: 30,
  finalVote: 30,
};

export const TURN_BASED_PHASES: GamePhase[] = ["reveal", "reverseVote", "defense"];

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

export interface Player {
  id: string;
  name: string;
  playerKey: string;
  disconnected: boolean;
  disconnectedAt: number | null;
  hand: ReturnType<typeof drawPlayerHand>;
  revealedCards: RevealedCard[];
  isEliminated: boolean;
  isHost: boolean;
  roundRevealCount: number;
  roundDebt: number;
  voteImmunity: boolean;
  defenseTimeReduced: boolean;
  hasIntroduced: boolean;
}

export interface GameRoom {
  id: string;
  players: Map<string, Player>;
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
  phase: GamePhase;
  phaseDurations: Record<GamePhase, number>;
  votes: Map<string, string>;
  voteCounts: Record<string, number>;
  defendingPlayerIds: string[];
  lastEliminatedPlayerId: string | null;
  terminated?: boolean;
  decks: RoomDecks;
}

export const rooms = new Map<string, GameRoom>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRoom(roomId: string): GameRoom {
  const room: GameRoom = {
    id: roomId,
    players: new Map(),
    status: "lobby",
    disaster: null,
    bunker: null,
    createdAt: Date.now(),
    round: 0,
    cardRevealLimit: 2,
    originalPlayerCount: 0,
    turnOrder: [],
    currentTurnIndex: 0,
    turnEndsAt: null,
    turnDurationSec: 60,
    pausedRemainingMs: null,
    phase: "reveal",
    phaseDurations: { ...PHASE_DEFAULT_DURATIONS },
    votes: new Map(),
    voteCounts: {},
    defendingPlayerIds: [],
    lastEliminatedPlayerId: null,
    decks: createRoomDecks(),
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId);
}

export function findPlayerByKey(room: GameRoom, playerKey: string): Player | undefined {
  for (const p of room.players.values()) if (p.playerKey === playerKey) return p;
  return undefined;
}

export function rekeyPlayer(room: GameRoom, oldId: string, newId: string): void {
  if (oldId === newId) return;
  const player = room.players.get(oldId);
  if (!player) return;
  room.players.delete(oldId);
  player.id = newId;
  room.players.set(newId, player);
  room.turnOrder = room.turnOrder.map(id => (id === oldId ? newId : id));
  if (room.votes.has(oldId)) {
    const v = room.votes.get(oldId)!;
    room.votes.delete(oldId);
    room.votes.set(newId, v);
  }
  for (const [voterId, targetId] of room.votes.entries()) {
    if (targetId === oldId) room.votes.set(voterId, newId);
  }
  if (room.voteCounts[oldId] !== undefined) {
    room.voteCounts[newId] = room.voteCounts[oldId];
    delete room.voteCounts[oldId];
  }
  room.defendingPlayerIds = room.defendingPlayerIds.map(id => (id === oldId ? newId : id));
  if (room.lastEliminatedPlayerId === oldId) room.lastEliminatedPlayerId = newId;
}

export function addPlayer(room: GameRoom, socketId: string, name: string, isHost: boolean, playerKey: string): Player {
  const player: Player = {
    id: socketId,
    name,
    playerKey,
    disconnected: false,
    disconnectedAt: null,
    hand: drawPlayerHand(),
    revealedCards: [],
    isEliminated: false,
    isHost,
    roundRevealCount: 0,
    roundDebt: 0,
    voteImmunity: false,
    defenseTimeReduced: false,
    hasIntroduced: false,
  };
  room.players.set(socketId, player);
  return player;
}

export function setupTurnOrder(room: GameRoom, playerIds?: string[]): void {
  const ids = playerIds ?? Array.from(room.players.values()).filter(p => !p.isEliminated).map(p => p.id);
  room.turnOrder = shuffle(ids);
  room.currentTurnIndex = 0;
}

export function startCurrentTurn(room: GameRoom): void {
  let durationSec = room.turnDurationSec;
  if (room.phase === "defense") {
    const currentId = room.turnOrder[room.currentTurnIndex];
    const current = currentId ? room.players.get(currentId) : null;
    if (current?.defenseTimeReduced) {
      durationSec = 0;
      current.defenseTimeReduced = false;
    }
  }
  room.turnEndsAt = Date.now() + durationSec * 1000;
  room.pausedRemainingMs = null;
}

export function pauseTimer(room: GameRoom): boolean {
  if (room.pausedRemainingMs !== null) return false;
  if (!room.turnEndsAt) return false;
  room.pausedRemainingMs = Math.max(0, room.turnEndsAt - Date.now());
  room.turnEndsAt = null;
  return true;
}

export function resumeTimer(room: GameRoom): boolean {
  if (room.pausedRemainingMs === null) return false;
  room.turnEndsAt = Date.now() + room.pausedRemainingMs;
  room.pausedRemainingMs = null;
  return true;
}

export function stopTimer(room: GameRoom): boolean {
  room.turnEndsAt = null;
  room.pausedRemainingMs = null;
  return true;
}

export function getCurrentPlayerId(room: GameRoom): string | null {
  if (!TURN_BASED_PHASES.includes(room.phase)) return null;
  return room.turnOrder[room.currentTurnIndex] ?? null;
}

function tallyVotes(room: GameRoom): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [, targetId] of room.votes) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }
  return counts;
}

export function startPhase(room: GameRoom, phase: GamePhase): void {
  room.phase = phase;
  room.votes.clear();
  room.voteCounts = {};
  room.turnDurationSec = room.phaseDurations[phase];

  if (phase === "reveal" || phase === "reverseVote") {
    setupTurnOrder(room);
  } else if (phase === "defense") {
    setupTurnOrder(room, room.defendingPlayerIds);
  } else {
    room.turnOrder = [];
    room.currentTurnIndex = 0;
  }
  startCurrentTurn(room);
}

export function startGame(room: GameRoom): void {
  room.status = "playing";
  room.disaster = drawDisaster();
  room.bunker = drawBunker();
  room.round = 1;
  room.cardRevealLimit = 2;
  room.phaseDurations = { ...PHASE_DEFAULT_DURATIONS };
  room.originalPlayerCount = room.players.size;
  room.defendingPlayerIds = [];
  room.lastEliminatedPlayerId = null;
  // Fresh shuffled decks per game so dealt cards are unique across players.
  room.decks = createRoomDecks();
  for (const player of room.players.values()) {
    player.hand = drawPlayerHandFromDecks(room.decks);
    player.revealedCards = [];
    player.isEliminated = false;
    player.roundRevealCount = 0;
    player.roundDebt = 0;
    player.voteImmunity = false;
    player.defenseTimeReduced = false;
    player.hasIntroduced = false;
  }
  startPhase(room, "reveal");
}

export function nextRound(room: GameRoom): number {
  for (const player of room.players.values()) {
    if (player.isEliminated) continue;
    const extra = Math.max(0, player.roundRevealCount - room.cardRevealLimit);
    player.roundDebt = extra;
    player.roundRevealCount = 0;
    player.voteImmunity = false;
  }
  room.round += 1;
  room.defendingPlayerIds = [];
  startPhase(room, "reveal");
  return room.round;
}

export interface PhaseAdvanceResult {
  phase: GamePhase;
  roundAdvanced: boolean;
  eliminatedPlayerId: string | null;
  gameEnded: boolean;
}

export function advancePhase(room: GameRoom): PhaseAdvanceResult {
  const result: PhaseAdvanceResult = {
    phase: room.phase,
    roundAdvanced: false,
    eliminatedPlayerId: null,
    gameEnded: false,
  };

  let nextP: GamePhase;
  if (room.phase === "reveal") {
    nextP = "discussion";
  } else if (room.phase === "discussion") {
    nextP = "reverseVote";
  } else if (room.phase === "reverseVote") {
    const counts = tallyVotes(room);
    room.voteCounts = counts;
    const max = Math.max(0, ...Object.values(counts));
    room.defendingPlayerIds = max > 0
      ? Object.entries(counts).filter(([, c]) => c === max).map(([id]) => id)
      : [];
    if (room.defendingPlayerIds.length === 0) {
      // Skip defense + final vote — go to next round
      nextRound(room);
      result.phase = room.phase;
      result.roundAdvanced = true;
      return result;
    }
    nextP = "defense";
  } else if (room.phase === "defense") {
    nextP = "finalVote";
  } else { // finalVote
    const counts = tallyVotes(room);
    room.voteCounts = counts;
    // Top voted, but immune players cannot be eliminated this round
    const eligible = Object.entries(counts).filter(([id]) => {
      const p = room.players.get(id);
      return p && !p.voteImmunity;
    });
    const max = Math.max(0, ...eligible.map(([, c]) => c));
    if (max > 0) {
      const top = eligible.filter(([, c]) => c === max);
      if (top.length === 1) {
        const [eliminatedId] = top[0];
        const player = room.players.get(eliminatedId);
        if (player) {
          player.isEliminated = true;
          result.eliminatedPlayerId = eliminatedId;
          room.lastEliminatedPlayerId = eliminatedId;
        }
      }
    }

    const activePlayers = Array.from(room.players.values()).filter(p => !p.isEliminated);
    const gameOver = room.originalPlayerCount > 0 && activePlayers.length <= Math.ceil(room.originalPlayerCount / 2);
    if (gameOver) {
      room.status = "ended";
      room.turnEndsAt = null;
      result.gameEnded = true;
      result.phase = room.phase;
      return result;
    }

    nextRound(room);
    result.phase = room.phase;
    result.roundAdvanced = true;
    return result;
  }

  startPhase(room, nextP);
  result.phase = nextP;
  return result;
}

export function setTurnDuration(room: GameRoom, seconds: number): void {
  const clamped = Math.max(15, Math.min(300, seconds));
  room.turnDurationSec = clamped;
  // Apply to current phase as the new default
  room.phaseDurations[room.phase] = clamped;
}

export function setRevealLimit(room: GameRoom, limit: number): void {
  room.cardRevealLimit = Math.max(1, Math.min(10, limit));
}

export function getCardValue(player: Player, category: CardCategory): string {
  const hand = player.hand;
  switch (category) {
    case "profession": return hand.profession.name;
    case "health": return hand.health.name;
    case "ageGender": return `${hand.ageGender.age} нас, ${hand.ageGender.gender}`;
    case "hobby": return hand.hobby.name;
    case "personality": return hand.personality.name;
    case "specialCard1": return hand.specialCard1.name;
    case "specialCard2": return hand.specialCard2.name;
    case "phobia": return hand.phobia.name;
    case "extraInfo": return hand.extraInfo.name;
    case "bagItem": return hand.bagItem.name;
  }
}

export interface RevealResult {
  card?: RevealedCard;
  error?: string;
}

export function revealCard(room: GameRoom, playerId: string, category: CardCategory): RevealResult {
  const player = room.players.get(playerId);
  if (!player) return { error: "Тоглогч олдсонгүй" };
  if (room.status !== "playing") return { error: "Тоглоом явагдаагүй байна" };
  if (room.phase !== "reveal") return { error: "Одоо карт дэлгэх үе биш" };
  if (player.isEliminated) return { error: "Та хасагдсан байна" };
  if (player.revealedCards.find(c => c.category === category)) return { error: "Энэ картыг өмнө нь дэлгэсэн байна" };

  const currentId = getCurrentPlayerId(room);
  if (currentId !== playerId) return { error: "Таны ярих ээлж биш байна" };

  const isSpecial = category === "specialCard1" || category === "specialCard2";
  const effectiveLimit = Math.max(0, room.cardRevealLimit - player.roundDebt);
  // Special cards don't consume a reveal slot, so they're exempt from limit gates.
  if (!isSpecial) {
    if (effectiveLimit === 0) {
      return { error: "Өмнөх үед хязгаараас илүү дэлгэсэн тул энэ үед карт дэлгэх эрхгүй" };
    }
    if (effectiveLimit > 0 && player.roundRevealCount >= effectiveLimit) {
      return { error: "Энэ үед дэлгэх хязгаар дууссан" };
    }
    if (room.round === 1) {
      const hasProfession = player.revealedCards.some(c => c.category === "profession");
      const remainingSlots = effectiveLimit - player.roundRevealCount;
      if (!hasProfession && category !== "profession" && remainingSlots <= 1) {
        return { error: "Эхний үед 'Мэргэжил' картаа заавал дэлгэх ёстой" };
      }
    }
  }

  const value = getCardValue(player, category);
  let action: string | undefined;
  let cardId: number | undefined;
  let activated: boolean | undefined;
  if (category === "specialCard1") {
    cardId = player.hand.specialCard1.id;
    action = getSpecialCardAction(cardId);
    activated = false;
  } else if (category === "specialCard2") {
    cardId = player.hand.specialCard2.id;
    action = getSpecialCardAction(cardId);
    activated = false;
  }
  const card: RevealedCard = {
    category,
    label: CATEGORY_LABELS[category],
    value,
    action,
    cardId,
    activated,
    revealedAt: Date.now(),
  };
  player.revealedCards.push(card);
  // Special cards don't count toward the per-round reveal limit.
  if (category !== "specialCard1" && category !== "specialCard2") {
    player.roundRevealCount += 1;
  }
  return { card };
}

export interface VoteResult {
  error?: string;
  voteCounts?: Record<string, number>;
}

export function castVote(room: GameRoom, voterId: string, targetId: string): VoteResult {
  const voter = room.players.get(voterId);
  if (!voter) return { error: "Тоглогч олдсонгүй" };
  if (voter.isEliminated) return { error: "Хасагдсан тоглогч санал өгөх эрхгүй" };
  if (room.status !== "playing") return { error: "Тоглоом явагдаагүй" };

  if (room.phase !== "reverseVote" && room.phase !== "finalVote") {
    return { error: "Одоо санал хураалт явагдахгүй байна" };
  }

  if (room.phase === "reverseVote") {
    if (getCurrentPlayerId(room) !== voterId) return { error: "Таны ярих ээлж биш" };
  }

  const target = room.players.get(targetId);
  if (!target) return { error: "Хүчингүй тоглогч" };
  if (target.isEliminated) return { error: "Хасагдсан тоглогчид санал өгөх боломжгүй" };
  if (targetId === voterId) return { error: "Өөрийгөө сонгох боломжгүй" };

  if (room.phase === "finalVote" && !room.defendingPlayerIds.includes(targetId)) {
    return { error: "Зөвхөн өөрийгөө хамгаалж байгаа тоглогчийг сонгоно уу" };
  }

  room.votes.set(voterId, targetId);
  room.voteCounts = tallyVotes(room);
  return { voteCounts: room.voteCounts };
}

export interface EndTurnResult {
  nextPlayerId: string | null;
  phaseEnded: boolean;
}

export function endTurn(room: GameRoom): EndTurnResult {
  if (!TURN_BASED_PHASES.includes(room.phase)) {
    return { nextPlayerId: null, phaseEnded: true };
  }
  let safety = room.turnOrder.length + 1;
  while (safety-- > 0) {
    room.currentTurnIndex += 1;
    if (room.currentTurnIndex >= room.turnOrder.length) {
      room.turnEndsAt = null;
      return { nextPlayerId: null, phaseEnded: true };
    }
    const nextId = room.turnOrder[room.currentTurnIndex];
    const nextPlayer = room.players.get(nextId);
    if (nextPlayer && !nextPlayer.isEliminated) {
      startCurrentTurn(room);
      return { nextPlayerId: nextId, phaseEnded: false };
    }
  }
  room.turnEndsAt = null;
  return { nextPlayerId: null, phaseEnded: true };
}

export function eliminatePlayer(room: GameRoom, playerId: string): { ok: boolean; gameOver: boolean; turnAdvanced: boolean } {
  const player = room.players.get(playerId);
  if (!player) return { ok: false, gameOver: false, turnAdvanced: false };
  player.isEliminated = true;

  let turnAdvanced = false;
  if (getCurrentPlayerId(room) === playerId) {
    endTurn(room);
    turnAdvanced = true;
  }

  const activePlayers = Array.from(room.players.values()).filter(p => !p.isEliminated);
  const gameOver = room.originalPlayerCount > 0 && activePlayers.length <= Math.ceil(room.originalPlayerCount / 2);
  if (gameOver) {
    room.status = "ended";
    room.turnEndsAt = null;
  }
  return { ok: true, gameOver, turnAdvanced };
}

type HandCategory = "profession" | "health" | "ageGender" | "hobby" | "personality" | "phobia" | "bagItem";

const HAND_TO_CARD: Record<HandCategory, CardCategory> = {
  profession: "profession",
  health: "health",
  ageGender: "ageGender",
  hobby: "hobby",
  personality: "personality",
  phobia: "phobia",
  bagItem: "bagItem",
};

function refreshRevealedValue(player: Player, category: CardCategory): RevealedCard | null {
  const revealed = player.revealedCards.find(c => c.category === category);
  if (!revealed) return null;
  revealed.value = getCardValue(player, category);
  revealed.revealedAt = Date.now();
  return revealed;
}

function setHandCard(player: Player, category: HandCategory, newCard: any): void {
  (player.hand as any)[category] = newCard;
}

function forceReveal(player: Player, category: CardCategory): RevealedCard | null {
  if (player.revealedCards.find(c => c.category === category)) return null;
  const card: RevealedCard = {
    category,
    label: CATEGORY_LABELS[category],
    value: getCardValue(player, category),
    forced: true,
    revealedAt: Date.now(),
  };
  player.revealedCards.push(card);
  return card;
}

function swapHand(a: Player, b: Player, category: HandCategory): ActivateFlash[] {
  const tmp = (a.hand as any)[category];
  (a.hand as any)[category] = (b.hand as any)[category];
  (b.hand as any)[category] = tmp;
  const flashes: ActivateFlash[] = [];
  const cardCat = HAND_TO_CARD[category];
  const aR = refreshRevealedValue(a, cardCat);
  const bR = refreshRevealedValue(b, cardCat);
  if (aR) flashes.push({ playerId: a.id, card: aR });
  if (bR) flashes.push({ playerId: b.id, card: bR });
  return flashes;
}

export interface ActivateOpts {
  ownerId: string;
  slot: "specialCard1" | "specialCard2";
  targetId?: string;
}

export interface ActivateFlash {
  playerId: string;
  card: RevealedCard;
}

export interface ActivateResult {
  error?: string;
  message?: string;
  flashes?: ActivateFlash[];
  eliminatedPlayerId?: string;
  revivedPlayerId?: string;
  gameOver?: boolean;
}

export function activateSpecialCard(room: GameRoom, opts: ActivateOpts): ActivateResult {
  const owner = room.players.get(opts.ownerId);
  if (!owner) return { error: "Картын эзэн олдсонгүй" };
  if (room.status !== "playing") return { error: "Тоглоом явагдаагүй байна" };

  const revealed = owner.revealedCards.find(c => c.category === opts.slot);
  if (!revealed) return { error: "Тусгай карт нээгдээгүй байна" };
  if (revealed.activated) return { error: "Энэ тусгай картыг өмнө идэвхжүүлсэн байна" };

  const cardId = revealed.cardId;
  if (!cardId) return { error: "Картын ID олдсонгүй" };
  const meta = getSpecialCardMeta(cardId);

  let target: Player | undefined;
  if (meta.target !== "none") {
    if (!opts.targetId) return { error: "Зорилтот тоглогч сонгоно уу" };
    target = room.players.get(opts.targetId);
    if (!target) return { error: "Зорилтот тоглогч олдсонгүй" };
    if (meta.target === "otherPlayer" && target.id === owner.id) return { error: "Өөрөөсөө өөр тоглогч сонгоно уу" };
    if (meta.target === "otherPlayer" && target.isEliminated) return { error: "Хасагдсан тоглогч сонгох боломжгүй" };
    if (meta.target === "anyPlayer" && target.isEliminated) return { error: "Хасагдсан тоглогч сонгох боломжгүй" };
    if (meta.target === "eliminatedPlayer" && !target.isEliminated) return { error: "Хасагдсан тоглогч сонгоно уу" };
  }

  const flashes: ActivateFlash[] = [];
  const result: ActivateResult = {};

  // Self redraws
  const selfRedraw: Record<number, HandCategory> = {
    1: "profession", 2: "health", 3: "ageGender", 4: "hobby",
    5: "personality", 6: "phobia",
  };
  // Other-player redraws
  const otherRedraw: Record<number, HandCategory> = {
    7: "profession", 8: "health", 9: "ageGender", 10: "hobby",
    11: "personality", 12: "phobia",
  };
  // Round-robin shifts
  const shiftRedraw: Record<number, HandCategory> = {
    13: "profession", 14: "health", 15: "ageGender", 16: "hobby",
    17: "personality", 18: "phobia",
  };

  if (selfRedraw[cardId]) {
    const cat = selfRedraw[cardId];
    setHandCard(owner, cat, drawNewFromDecks(room.decks, cat));
    const r = refreshRevealedValue(owner, HAND_TO_CARD[cat]);
    if (r) flashes.push({ playerId: owner.id, card: r });
    result.message = `${owner.name}: ${CATEGORY_LABELS[HAND_TO_CARD[cat]]} шинээр татав`;
  } else if (otherRedraw[cardId] && target) {
    const cat = otherRedraw[cardId];
    setHandCard(target, cat, drawNewFromDecks(room.decks, cat));
    const r = refreshRevealedValue(target, HAND_TO_CARD[cat]);
    if (r) flashes.push({ playerId: target.id, card: r });
    result.message = `${target.name}-н ${CATEGORY_LABELS[HAND_TO_CARD[cat]]} шинээр татав`;
  } else if (shiftRedraw[cardId]) {
    const cat = shiftRedraw[cardId];
    // Use stable seating order (room.players insertion order) so the shift
    // works in any phase, not just turn-based phases where turnOrder is set.
    const active = Array.from(room.players.values())
      .filter(p => !p.isEliminated);
    if (active.length >= 2) {
      const cards = active.map(p => (p.hand as any)[cat]);
      // Shift right: each player gets card from previous (left) neighbour
      for (let i = 0; i < active.length; i++) {
        const prev = (i - 1 + active.length) % active.length;
        setHandCard(active[i], cat, cards[prev]);
      }
      for (const p of active) {
        const r = refreshRevealedValue(p, HAND_TO_CARD[cat]);
        if (r) flashes.push({ playerId: p.id, card: r });
      }
    }
    result.message = `Бүгд ${CATEGORY_LABELS[HAND_TO_CARD[cat]]} картаа баруун тийш дамжуулав`;
  } else if (cardId === 19 && target) {
    target.isEliminated = true;
    room.lastEliminatedPlayerId = target.id;
    result.eliminatedPlayerId = target.id;
    if (getCurrentPlayerId(room) === target.id) endTurn(room);
    const active = Array.from(room.players.values()).filter(p => !p.isEliminated);
    const gameOver = room.originalPlayerCount > 0 && active.length <= Math.ceil(room.originalPlayerCount / 2);
    if (gameOver) {
      room.status = "ended";
      room.turnEndsAt = null;
      result.gameOver = true;
    }
    result.message = `${target.name} санал хураалтгүйгээр хасагдав`;
  } else if (cardId === 20 && target) {
    target.defenseTimeReduced = true;
    result.message = `${target.name}-н хамгаалах цаг хасагдав`;
  } else if (cardId === 21 && target) {
    const fr = forceReveal(target, "health");
    if (fr) flashes.push({ playerId: target.id, card: fr });
    result.message = `${target.name}-н эрүүл мэнд хүчээр нээгдэв`;
  } else if (cardId === 22 && target) {
    const fr = forceReveal(target, "phobia");
    if (fr) flashes.push({ playerId: target.id, card: fr });
    result.message = `${target.name}-н айдас хүчээр нээгдэв`;
  } else if (cardId === 23 && target) {
    flashes.push(...swapHand(owner, target, "health"));
    result.message = `${owner.name} ↔ ${target.name}: эрүүл мэнд солигдов`;
  } else if (cardId === 24 && target) {
    flashes.push(...swapHand(owner, target, "phobia"));
    result.message = `${owner.name} ↔ ${target.name}: айдас солигдов`;
  } else if (cardId === 25 && target) {
    flashes.push(...swapHand(owner, target, "bagItem"));
    result.message = `${owner.name} ↔ ${target.name}: гар цүнх солигдов`;
  } else if (cardId === 26 && target) {
    target.isEliminated = false;
    if (!room.turnOrder.includes(target.id)) {
      room.turnOrder.push(target.id);
    }
    result.revivedPlayerId = target.id;
    result.message = `${target.name} буцаж бункерт оров`;
  } else if (cardId === 27 && target) {
    target.voteImmunity = true;
    result.message = `${target.name} энэ үеийн санал хураалтаас аврагдав`;
  } else if (cardId === 28) {
    owner.voteImmunity = true;
    result.message = `${owner.name} энэ үеийн санал хураалтаас аврагдав`;
  } else if (cardId === 29) {
    result.message = `${owner.name}: баруун талын тоглогч найз болно`;
  } else if (cardId === 30) {
    result.message = `${owner.name}: зүүн талын тоглогч дайсан болно`;
  }

  revealed.activated = true;
  revealed.requested = false;
  result.flashes = flashes;
  return result;
}

export function autoRevealProfessionOnIntro(room: GameRoom, playerId: string): RevealedCard | null {
  const player = room.players.get(playerId);
  if (!player || player.hasIntroduced || room.phase !== "reveal") return null;
  player.hasIntroduced = true;
  if (player.revealedCards.find(c => c.category === "profession")) return null;
  const card: RevealedCard = {
    category: "profession",
    label: CATEGORY_LABELS["profession"],
    value: getCardValue(player, "profession"),
    forced: true,
    revealedAt: Date.now(),
  };
  player.revealedCards.push(card);
  return card;
}

export function serializeRoom(room: GameRoom, requestingPlayerId?: string) {
  const currentTurnPlayerId = getCurrentPlayerId(room);
  const myVote = requestingPlayerId ? room.votes.get(requestingPlayerId) ?? null : null;
  return {
    id: room.id,
    status: room.status,
    disaster: room.disaster,
    bunker: room.bunker,
    round: room.round,
    cardRevealLimit: room.cardRevealLimit,
    originalPlayerCount: room.originalPlayerCount,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    currentTurnPlayerId,
    turnEndsAt: room.turnEndsAt,
    turnDurationSec: room.turnDurationSec,
    pausedRemainingMs: room.pausedRemainingMs,
    isPaused: room.pausedRemainingMs !== null,
    phase: room.phase,
    phaseLabel: PHASE_LABELS[room.phase],
    phaseDurations: room.phaseDurations,
    voteCounts: room.voteCounts,
    defendingPlayerIds: room.defendingPlayerIds,
    lastEliminatedPlayerId: room.lastEliminatedPlayerId,
    myVote,
    players: Array.from(room.players.values()).map(p => {
      const effectiveLimit = Math.max(0, room.cardRevealLimit - p.roundDebt);
      return {
        id: p.id,
        name: p.name,
        isEliminated: p.isEliminated,
        isHost: p.isHost,
        revealedCards: p.revealedCards,
        hand: requestingPlayerId === p.id ? serializeHand(p) : null,
        revealedCount: p.revealedCards.length,
        roundRevealCount: p.roundRevealCount,
        roundDebt: p.roundDebt,
        effectiveLimit,
        voteImmunity: p.voteImmunity,
        defenseTimeReduced: p.defenseTimeReduced,
        disconnected: p.disconnected,
      };
    }),
  };
}

function serializeHand(player: Player) {
  const { hand } = player;
  return {
    profession: hand.profession.name,
    health: hand.health.name,
    ageGender: `${hand.ageGender.age} нас, ${hand.ageGender.gender}`,
    hobby: hand.hobby.name,
    personality: hand.personality.name,
    specialCard1: hand.specialCard1.name,
    specialCard1Action: getSpecialCardAction(hand.specialCard1.id),
    specialCard2: hand.specialCard2.name,
    specialCard2Action: getSpecialCardAction(hand.specialCard2.id),
    phobia: hand.phobia.name,
    extraInfo: hand.extraInfo.name,
    bagItem: hand.bagItem.name,
  };
}
