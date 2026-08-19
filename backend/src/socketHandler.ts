import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./lib/logger.js";
import {
  createRoom,
  getRoom,
  addPlayer,
  findPlayerByKey,
  rekeyPlayer,
  startGame,
  nextRound,
  endTurn,
  advancePhase,
  setTurnDuration,
  setRevealLimit,
  revealCard,
  castVote,
  eliminatePlayer,
  activateSpecialCard,
  getCurrentPlayerId,
  startCurrentTurn,
  pauseTimer,
  resumeTimer,
  stopTimer,
  autoRevealProfessionOnIntro,
  TURN_BASED_PHASES,
  rooms,
} from "./gameState.js";
import type { BackendGameRoom as GameRoom, BackendCardCategory as CardCategory } from "./game/types.js";
import { serializeRoom } from "./game/serializers.js";
import { consumeHostCode } from "./lib/hostCodes.js";

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastRoom(io: SocketIOServer, room: GameRoom | undefined) {
  if (!room) return;
  for (const [pid] of room.players) {
    const targetSocket = io.sockets.sockets.get(pid);
    if (targetSocket) {
      targetSocket.emit("room_update", serializeRoom(room, pid));
    }
  }
}

function emitIntroReveal(io: SocketIOServer, room: GameRoom, playerId: string | null) {
  if (!playerId) return;
  const card = autoRevealProfessionOnIntro(room, playerId);
  if (!card) return;
  const player = room.players.get(playerId);
  if (!player) return;
  io.to(room.id).emit("card_revealed", { playerId, playerName: player.name, card });
}

const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTurnTimer(roomId: string) {
  const t = turnTimers.get(roomId);
  if (t) clearTimeout(t);
  turnTimers.delete(roomId);
}

function scheduleTurnTimer(io: SocketIOServer, roomId: string) {
  clearTurnTimer(roomId);
  const room = getRoom(roomId);
  if (!room || room.status !== "playing" || !room.turnEndsAt) return;
  if (room.pausedRemainingMs !== null) return;
  const ms = Math.max(0, room.turnEndsAt - Date.now());
  const timer = setTimeout(() => {
    autoAdvance(io, roomId);
  }, ms + 100);
  turnTimers.set(roomId, timer);
}

function autoAdvance(io: SocketIOServer, roomId: string) {
  const room = getRoom(roomId);
  if (!room || room.status !== "playing") return;
  advance(io, room);
}

function advance(io: SocketIOServer, room: GameRoom) {
  if (TURN_BASED_PHASES.includes(room.phase)) {
    const result = endTurn(room);
    if (result.phaseEnded) {
      const r = advancePhase(room);
      emitPhaseChange(io, room, r);
    } else {
      emitIntroReveal(io, room, result.nextPlayerId);
      io.to(room.id).emit("turn_changed", { playerId: result.nextPlayerId });
    }
  } else {
    const r = advancePhase(room);
    emitPhaseChange(io, room, r);
  }
  broadcastRoom(io, room);
  scheduleTurnTimer(io, room.id);
}

const teardownTimers = new Map<string, NodeJS.Timeout>();

function cancelTeardown(roomId: string) {
  const t = teardownTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    teardownTimers.delete(roomId);
  }
}

function tearDownRoom(io: SocketIOServer, room: GameRoom, delayMs = 5 * 60 * 1000) {
  // After game ends, the room becomes single-use. Schedule deletion so
  // the winners popup can be viewed; then disconnect everyone.
  if (room.terminated) return;
  room.terminated = true;
  clearTurnTimer(room.id);
  cancelTeardown(room.id);
  const t = setTimeout(() => {
    teardownTimers.delete(room.id);
    try {
      // If somehow a restart cleared `terminated` (defensive: should have been
      // cancelled above), bail without nuking an active room.
      if (!room.terminated) return;
      io.to(room.id).emit("room_closed", { reason: "game_ended" });
      const sockets = io.sockets.adapter.rooms.get(room.id);
      if (sockets) {
        for (const sid of Array.from(sockets)) {
          io.sockets.sockets.get(sid)?.leave(room.id);
        }
      }
      rooms.delete(room.id);
    } catch (e) {
      logger.error({ err: e }, "tearDownRoom error");
    }
  }, delayMs);
  teardownTimers.set(room.id, t);
}

function emitPhaseChange(io: SocketIOServer, room: GameRoom, r: ReturnType<typeof advancePhase>) {
  if (r.gameEnded) {
    clearTurnTimer(room.id);
    io.to(room.id).emit("game_over", {
      survivors: Array.from(room.players.values())
        .filter(p => !p.isEliminated)
        .map(p => ({ id: p.id, name: p.name, revealedCards: p.revealedCards })),
    });
    tearDownRoom(io, room);
    return;
  }
  if (r.eliminatedPlayerId) {
    const eliminated = room.players.get(r.eliminatedPlayerId);
    io.to(room.id).emit("player_eliminated", {
      playerId: r.eliminatedPlayerId,
      playerName: eliminated?.name ?? "?",
    });
  }
  if (r.roundAdvanced) {
    io.to(room.id).emit("round_started", { round: room.round });
  } else {
    io.to(room.id).emit("phase_changed", { phase: r.phase });
  }
}

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  const socketRooms = new Map<string, string>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const RECONNECT_GRACE_MS = 90_000;

  function cancelDisconnectTimer(playerKey: string) {
    const t = disconnectTimers.get(playerKey);
    if (t) {
      clearTimeout(t);
      disconnectTimers.delete(playerKey);
    }
  }

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("create_room", async ({ playerName, playerKey, hostCode }: { playerName: string; playerKey: string; hostCode?: string }, cb: Function) => {
      try {
        if (!playerKey) return cb({ success: false, error: "Missing player key" });
        if (!hostCode || !hostCode.trim()) {
          return cb({ success: false, error: "Хост код шаардлагатай" });
        }
        const roomId = generateRoomId();
        const result = await consumeHostCode(hostCode, playerName, roomId);
        if (!result.ok) return cb({ success: false, error: result.error });

        const room = createRoom(roomId);
        addPlayer(room, socket.id, playerName, true, playerKey);
        socket.join(roomId);
        socketRooms.set(socket.id, roomId);
        cb({ success: true, roomId, playerId: socket.id });
        broadcastRoom(io, room);
      } catch (e) {
        logger.error(e);
        cb({ success: false, error: "Failed to create room" });
      }
    });

    socket.on("join_room", ({ roomId, playerName, playerKey }: { roomId: string; playerName: string; playerKey: string }, cb: Function) => {
      try {
        if (!playerKey) return cb({ success: false, error: "Missing player key" });
        const room = getRoom(roomId.toUpperCase());
        if (!room) return cb({ success: false, error: "Өрөө олдсонгүй" });

        const existing = findPlayerByKey(room, playerKey);
        if (existing) {
          cancelDisconnectTimer(playerKey);
          const oldId = existing.id;
          rekeyPlayer(room, oldId, socket.id);
          existing.disconnected = false;
          existing.disconnectedAt = null;
          if (playerName && playerName.trim()) existing.name = playerName.trim();
          socket.join(room.id);
          socketRooms.set(socket.id, room.id);
          cb({ success: true, roomId: room.id, playerId: socket.id, reconnected: true });
          io.to(room.id).emit("system_chat", {
            message: `${existing.name} буцаж нэгдлээ`,
            timestamp: Date.now(),
          });
          broadcastRoom(io, room);
          return;
        }

        if (room.status !== "lobby") return cb({ success: false, error: "Тоглоом эхэлчихсэн байна" });
        if (room.players.size >= 16) return cb({ success: false, error: "Өрөө дүүрэн байна (max 16)" });

        addPlayer(room, socket.id, playerName, false, playerKey);
        socket.join(room.id);
        socketRooms.set(socket.id, room.id);
        cb({ success: true, roomId: room.id, playerId: socket.id });
        broadcastRoom(io, room);
      } catch (e) {
        logger.error(e);
        cb({ success: false, error: "Failed to join room" });
      }
    });

    socket.on("start_game", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false, error: "Not in a room" });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false, error: "Room not found" });

        const player = room.players.get(socket.id);
        if (!player?.isHost) return cb?.({ success: false, error: "Зөвхөн хост л тоглоом эхлүүлж болно" });
        if (room.players.size < 2) return cb?.({ success: false, error: "Хамгийн багадаа 2 тоглогч хэрэгтэй" });

        startGame(room);
        emitIntroReveal(io, room, getCurrentPlayerId(room));
        broadcastRoom(io, room);
        scheduleTurnTimer(io, roomId);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false, error: "Failed to start game" });
      }
    });

    socket.on("end_game", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const player = room.players.get(socket.id);
        if (!player?.isHost) return cb?.({ success: false, error: "Зөвхөн хост тоглоом дуусгаж болно" });
        if (room.status !== "playing") return cb?.({ success: false, error: "Тоглоом явагдаагүй байна" });

        clearTurnTimer(roomId);
        room.status = "ended";
        room.turnEndsAt = null;
        // isPaused is derived in broadcastRoom from pausedRemainingMs;
        // clearing pausedRemainingMs here is enough.
        room.pausedRemainingMs = null;
        room.turnOrder = [];
        const survivors = Array.from(room.players.values())
          .filter(p => !p.isEliminated)
          .map(p => ({ id: p.id, name: p.name, revealedCards: p.revealedCards }));
        broadcastRoom(io, room);
        io.to(roomId).emit("chat_message", {
          playerId: "system",
          playerName: "Систем",
          message: `🛑 Хост тоглоомыг дуусгав`,
          timestamp: Date.now(),
        });
        io.to(roomId).emit("game_over", { survivors });
        tearDownRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("restart_game", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const player = room.players.get(socket.id);
        if (!player?.isHost) return cb?.({ success: false, error: "Зөвхөн хост дахин эхлүүлж болно" });
        if (room.players.size < 2) return cb?.({ success: false, error: "Хамгийн багадаа 2 тоглогч хэрэгтэй" });

        // The host code is single-use per room; once the game has been
        // played to completion, allowing unlimited restarts would defeat the
        // monetization model. Disallow restart after the room has been
        // marked for teardown.
        if (room.terminated) {
          return cb?.({ success: false, error: "Тоглоом дууссан. Шинэ хост код хэрэгтэй." });
        }

        clearTurnTimer(roomId);
        startGame(room);
        broadcastRoom(io, room);
        scheduleTurnTimer(io, roomId);
        io.to(roomId).emit("chat_message", {
          playerId: "system",
          playerName: "Систем",
          message: `🔄 Хост шинэ тоглоом эхлүүлэв`,
          timestamp: Date.now(),
        });
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false, error: "Дахин эхлүүлж чадсангүй" });
      }
    });

    socket.on("end_turn", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        if (room.status !== "playing") return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        const currentId = getCurrentPlayerId(room);
        if (currentId !== socket.id && !requester?.isHost) {
          return cb?.({ success: false, error: "Зөвхөн ярьж буй тоглогч эсвэл хост ээлж дуусгах эрхтэй" });
        }
        if (!requester?.isHost) {
          const me = room.players.get(socket.id);
          const required = Math.min(2, room.cardRevealLimit);
          if (me && (me.roundRevealCount ?? 0) < required) {
            return cb?.({ success: false, error: `Эхлээд ${required} карт нээх ёстой` });
          }
        }
        advance(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("pause_timer", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост" });
        if (!pauseTimer(room)) return cb?.({ success: false, error: "Зогсоох цаг байхгүй" });
        clearTurnTimer(roomId);
        broadcastRoom(io, room);
        io.to(roomId).emit("timer_paused", {});
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("resume_timer", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост" });
        if (!resumeTimer(room)) return cb?.({ success: false, error: "Үргэлжлүүлэх цаг байхгүй" });
        scheduleTurnTimer(io, roomId);
        broadcastRoom(io, room);
        io.to(roomId).emit("timer_resumed", {});
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("stop_timer", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост" });
        stopTimer(room);
        clearTurnTimer(roomId);
        broadcastRoom(io, room);
        io.to(roomId).emit("timer_stopped", {});
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("restart_timer", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост" });
        if (room.status !== "playing") return cb?.({ success: false, error: "Тоглоом явагдаагүй байна" });
        startCurrentTurn(room);
        scheduleTurnTimer(io, roomId);
        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("next_phase", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        if (room.status !== "playing") return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост л үе шилжүүлж болно" });

        // Force-advance through current phase entirely
        const r = advancePhase(room);
        emitPhaseChange(io, room, r);
        broadcastRoom(io, room);
        scheduleTurnTimer(io, roomId);
        cb?.({ success: true, phase: room.phase });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("next_round", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        if (room.status !== "playing") return cb?.({ success: false, error: "Тоглоом явагдаагүй байна" });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост л үе шилжүүлж болно" });

        const newRound = nextRound(room);
        io.to(roomId).emit("round_started", { round: newRound });
        broadcastRoom(io, room);
        scheduleTurnTimer(io, roomId);
        cb?.({ success: true, round: newRound });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("set_reveal_limit", ({ limit }: { limit: number }, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост л тохируулж болно" });

        setRevealLimit(room, limit);
        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("set_turn_duration", ({ seconds }: { seconds: number }, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост л тохируулж болно" });

        setTurnDuration(room, seconds);
        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("reveal_card", ({ category }: { category: CardCategory }, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const player = room.players.get(socket.id);
        if (!player) return cb?.({ success: false });

        const result = revealCard(room, socket.id, category);
        if (result.error || !result.card) {
          return cb?.({ success: false, error: result.error || "Карт нээж чадсангүй" });
        }

        io.to(roomId).emit("card_revealed", {
          playerId: socket.id,
          playerName: player.name,
          card: result.card,
        });

        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("cast_vote", ({ targetId }: { targetId: string }, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const result = castVote(room, socket.id, targetId);
        if (result.error) return cb?.({ success: false, error: result.error });

        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("clear_vote", (_, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        if (room.phase !== "reverseVote" && room.phase !== "finalVote") {
          return cb?.({ success: false, error: "Одоо санал хураалт явагдахгүй байна" });
        }
        room.votes.delete(socket.id);
        room.voteCounts = Object.fromEntries(
          Object.entries({} as Record<string, number>),
        );
        for (const target of room.votes.values()) {
          room.voteCounts[target] = (room.voteCounts[target] || 0) + 1;
        }
        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("eliminate_player", ({ playerId }: { playerId: string }, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Only host can eliminate" });

        const result = eliminatePlayer(room, playerId);
        if (!result.ok) return cb?.({ success: false });

        if (result.turnAdvanced) {
          io.to(roomId).emit("turn_changed", { playerId: getCurrentPlayerId(room) });
          scheduleTurnTimer(io, roomId);
        }

        broadcastRoom(io, room);

        if (result.gameOver) {
          clearTurnTimer(roomId);
          io.to(roomId).emit("game_over", {
            survivors: Array.from(room.players.values())
              .filter(p => !p.isEliminated)
              .map(p => ({ id: p.id, name: p.name, revealedCards: p.revealedCards })),
          });
          tearDownRoom(io, room);
        }

        cb?.({ success: true, gameOver: result.gameOver });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("request_special", (
      { slot }: { slot: "specialCard1" | "specialCard2" },
      cb: Function,
    ) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });
        const requester = room.players.get(socket.id);
        if (!requester) return cb?.({ success: false, error: "Тоглогч олдсонгүй" });
        if (requester.isEliminated) return cb?.({ success: false, error: "Хасагдсан тоглогч хүсэлт илгээж чадахгүй" });

        const revealed = requester.revealedCards.find(c => c.category === slot);
        if (!revealed) return cb?.({ success: false, error: "Тусгай карт нээгдээгүй байна" });
        if (revealed.activated) return cb?.({ success: false, error: "Энэ карт идэвхжсэн байна" });

        const wasRequested = !!revealed.requested;
        revealed.requested = !wasRequested;

        if (!wasRequested) {
          io.to(roomId).emit("chat_message", {
            playerId: "system",
            playerName: "Систем",
            message: `🙋 ${requester.name}: тусгай карт идэвхжүүлэх хүсэлт илгээв — "${revealed.value}"`,
            timestamp: Date.now(),
          });
        }

        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("activate_special", (
      { ownerId, slot, targetId }: { ownerId: string; slot: "specialCard1" | "specialCard2"; targetId?: string },
      cb: Function,
    ) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Зөвхөн хост идэвхжүүлж болно" });

        const result = activateSpecialCard(room, { ownerId, slot, targetId });
        if (result.error) return cb?.({ success: false, error: result.error });

        if (result.flashes) {
          for (const f of result.flashes) {
            const owner = room.players.get(f.playerId);
            io.to(roomId).emit("card_revealed", {
              playerId: f.playerId,
              playerName: owner?.name ?? "?",
              card: f.card,
            });
          }
        }
        if (result.message) {
          io.to(roomId).emit("chat_message", {
            playerId: "system",
            playerName: "Систем",
            message: `⚡ ${result.message}`,
            timestamp: Date.now(),
          });
        }
        if (result.eliminatedPlayerId) {
          const eliminated = room.players.get(result.eliminatedPlayerId);
          io.to(roomId).emit("player_eliminated", {
            playerId: result.eliminatedPlayerId,
            playerName: eliminated?.name ?? "?",
          });
        }
        broadcastRoom(io, room);

        if (result.gameOver) {
          clearTurnTimer(roomId);
          io.to(roomId).emit("game_over", {
            survivors: Array.from(room.players.values())
              .filter(p => !p.isEliminated)
              .map(p => ({ id: p.id, name: p.name, revealedCards: p.revealedCards })),
          });
          tearDownRoom(io, room);
        } else {
          // Reschedule timer in case the active turn changed (e.g. card 19
          // eliminated the current turn player) or defense time was reduced.
          scheduleTurnTimer(io, roomId);
        }

        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("kick_player", ({ playerId }: { playerId: string }, cb: Function) => {
      try {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return cb?.({ success: false });
        const room = getRoom(roomId);
        if (!room) return cb?.({ success: false });

        const requester = room.players.get(socket.id);
        if (!requester?.isHost) return cb?.({ success: false, error: "Only host can kick" });

        const targetSocket = io.sockets.sockets.get(playerId);
        if (targetSocket) {
          targetSocket.emit("kicked", { reason: "Хост таныг тоглоомоос хасав" });
          targetSocket.leave(roomId);
        }

        const wasCurrentTurn = getCurrentPlayerId(room) === playerId;
        room.players.delete(playerId);
        socketRooms.delete(playerId);
        room.turnOrder = room.turnOrder.filter(id => id !== playerId);
        if (room.currentTurnIndex >= room.turnOrder.length) {
          room.currentTurnIndex = Math.max(0, room.turnOrder.length - 1);
        }
        room.votes.delete(playerId);

        if (wasCurrentTurn && room.status === "playing" && room.turnOrder.length > 0) {
          startCurrentTurn(room);
          io.to(roomId).emit("turn_changed", { playerId: getCurrentPlayerId(room) });
          scheduleTurnTimer(io, roomId);
        }

        broadcastRoom(io, room);
        cb?.({ success: true });
      } catch (e) {
        logger.error(e);
        cb?.({ success: false });
      }
    });

    socket.on("chat_message", ({ message }: { message: string }) => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      io.to(roomId).emit("chat_message", {
        playerId: socket.id,
        playerName: player.name,
        message,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      socketRooms.delete(socket.id);
      logger.info({ socketId: socket.id, roomId }, "Player disconnected");
      if (!player) return;

      const finalize = () => {
        const wasCurrentTurn = getCurrentPlayerId(room) === player.id;
        room.players.delete(player.id);
        room.turnOrder = room.turnOrder.filter(id => id !== player.id);
        if (room.currentTurnIndex >= room.turnOrder.length) {
          room.currentTurnIndex = Math.max(0, room.turnOrder.length - 1);
        }
        room.votes.delete(player.id);

        if (room.players.size === 0) {
          clearTurnTimer(roomId);
          return;
        }

        const stillHost = Array.from(room.players.values()).some(p => p.isHost);
        if (!stillHost) {
          const newHost = room.players.values().next().value;
          if (newHost) newHost.isHost = true;
        }

        if (wasCurrentTurn && room.status === "playing" && room.turnOrder.length > 0) {
          startCurrentTurn(room);
          io.to(roomId).emit("turn_changed", { playerId: getCurrentPlayerId(room) });
          scheduleTurnTimer(io, roomId);
        }

        io.to(roomId).emit("system_chat", {
          message: `${player.name} өрөөнөөс гарлаа`,
          timestamp: Date.now(),
        });
        broadcastRoom(io, room);
        io.to(roomId).emit("player_left", { playerId: player.id });
      };

      // Apply a reconnection grace period in BOTH lobby and playing states.
      // Without this, a brief mobile network blip / page refresh / iframe
      // re-mount in the lobby would instantly remove the player — and if it
      // was the host, the host badge would jump to a random other player.
      // We use a shorter grace in the lobby because there's no in-game state
      // to preserve, just identity/host status.
      const graceMs = room.status === "lobby"
        ? Math.min(20_000, RECONNECT_GRACE_MS)
        : RECONNECT_GRACE_MS;

      player.disconnected = true;
      player.disconnectedAt = Date.now();
      // No need to spam chat in the lobby for transient blips.
      if (room.status !== "lobby") {
        io.to(roomId).emit("system_chat", {
          message: `${player.name} холболт тасарлаа — ${Math.round(graceMs / 1000)} секундийн дотор буцаж нэгдэж болно`,
          timestamp: Date.now(),
        });
      }
      broadcastRoom(io, room);

      cancelDisconnectTimer(player.playerKey);
      const key = player.playerKey;
      const timer = setTimeout(() => {
        disconnectTimers.delete(key);
        const cur = findPlayerByKey(room, key);
        if (!cur || !cur.disconnected) return;
        finalize();
      }, graceMs);
      disconnectTimers.set(key, timer);
      return;
    });
  });

  return io;
}
