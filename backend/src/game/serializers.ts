import { getCurrentPlayerId, PHASE_LABELS } from "../gameState.js";
import { getSpecialCardAction } from "../gameData.js";
import type { BackendGameRoom as GameRoom, BackendPlayer as Player } from "../game/types.js";
import type {
  PlayerHand as SharedPlayerHand,
  GameRoom as SharedGameRoom,
} from "../../../shared/types.js";

export function serializeRoom(room: GameRoom, requestingPlayerId?: string): SharedGameRoom {
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

function serializeHand(player: Player): SharedPlayerHand {
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
