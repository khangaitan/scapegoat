// Full-featured stub Socket.IO server implementing all game events.
import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, { path: "/api/socket.io", cors: { origin: "*" } });

const rooms = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeId(len = 4) {
  return Math.random().toString(36).toUpperCase().slice(2, 2 + len);
}

function makeHand(name) {
  return {
    profession:         `${name}-мэргэжил`,
    health:             "Эрүүл",
    ageGender:          "30, эрэгтэй",
    hobby:              "Уншлага",
    personality:        "Тайван",
    specialCard1:       "Тусгай 1",
    specialCard1Action: "Нэг картыг харах",
    specialCard2:       "Тусгай 2",
    specialCard2Action: "Нэг тоглогчийн картыг солих",
    phobia:             "Харанхуйгаас айдаг",
    extraInfo:          "Нэмэлт мэдээлэл байхгүй",
    bagItem:            "Анхны тусламжийн хайрцаг",
  };
}

function activePlayers(room) {
  return [...room.players.values()].filter(p => !p.isEliminated);
}

function clearTurnTimer(room) {
  if (room._turnTimer) {
    clearTimeout(room._turnTimer);
    room._turnTimer = null;
  }
  room.turnEndsAt = null;
}

function startTurnTimer(room, durationMs) {
  clearTurnTimer(room);
  room.isPaused = false;
  room.pausedRemainingMs = null;
  room.turnEndsAt = Date.now() + durationMs;
  room._turnTimer = setTimeout(() => advanceTurn(room), durationMs);
}

function advanceTurn(room) {
  clearTurnTimer(room);
  const active = activePlayers(room);
  if (active.length === 0) return;

  // Determine the pool of players who take turns in the current phase
  let pool;
  if (room.phase === "defense") {
    pool = room.defendingPlayerIds
      .map(id => room.players.get(id))
      .filter(p => p && !p.isEliminated);
  } else {
    pool = active;
  }

  if (pool.length === 0) return;

  // Find the next index within the pool
  const currentId = room.currentTurnPlayerId;
  const poolIds = pool.map(p => p.playerId);
  const idx = poolIds.indexOf(currentId);
  const nextIdx = (idx + 1) % poolIds.length;

  room.currentTurnPlayerId = poolIds[nextIdx];
  room.currentTurnIndex = active.findIndex(p => p.playerId === room.currentTurnPlayerId);

  startTurnTimer(room, room.turnDurationSec * 1000);
  broadcastRoom(room);
}

function setPhaseFirstTurn(room) {
  const active = activePlayers(room);
  if (room.phase === "discussion") {
    room.currentTurnPlayerId = null;
    room.currentTurnIndex = 0;
    clearTurnTimer(room);
    return;
  }

  let pool;
  if (room.phase === "defense") {
    pool = room.defendingPlayerIds
      .map(id => room.players.get(id))
      .filter(p => p && !p.isEliminated);
  } else {
    pool = active;
  }

  if (pool.length === 0) return;
  room.currentTurnPlayerId = pool[0].playerId;
  room.currentTurnIndex = active.findIndex(p => p.playerId === pool[0].playerId);
  startTurnTimer(room, room.turnDurationSec * 1000);
}

function computeVoteCounts(room) {
  const counts = {};
  for (const targetId of Object.values(room.votes)) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }
  room.voteCounts = counts;
}

function resolveReverseVote(room) {
  computeVoteCounts(room);
  const active = activePlayers(room);
  // Sort active players by vote count descending, pick top 2
  const sorted = active
    .map(p => ({ id: p.playerId, count: room.voteCounts[p.playerId] || 0 }))
    .sort((a, b) => b.count - a.count);
  room.defendingPlayerIds = sorted.slice(0, 2).map(e => e.id);
}

function startNextRound(room) {
  room.round++;
  room.phase = "reveal";
  room.votes = {};
  room.voteCounts = {};
  room.defendingPlayerIds = [];
  room.lastEliminatedPlayerId = null;
  const active = activePlayers(room);
  room.turnOrder = active.map(p => p.playerId);
  for (const p of active) {
    p.roundRevealCount = 0;
    p.effectiveLimit = room.cardRevealLimit;
  }
  room.currentTurnIndex = 0;
  room.currentTurnPlayerId = room.turnOrder[0] ?? null;
  io.to(room.id).emit("round_started", { round: room.round });
  startTurnTimer(room, room.turnDurationSec * 1000);
}

function resolveFinalVote(room) {
  computeVoteCounts(room);
  // Only count votes targeting defenders
  const tallies = {};
  for (const id of room.defendingPlayerIds) {
    tallies[id] = room.voteCounts[id] || 0;
  }
  const maxVotes = Math.max(...Object.values(tallies), 0);
  const topPlayers = room.defendingPlayerIds.filter(id => (tallies[id] || 0) === maxVotes);

  if (topPlayers.length === 1) {
    doEliminate(room, topPlayers[0]);
    room.pendingDoubleElimination = false;
  } else {
    // Tie
    if (room.pendingDoubleElimination) {
      topPlayers.forEach(id => doEliminate(room, id));
      room.pendingDoubleElimination = false;
    } else {
      room.pendingDoubleElimination = true;
      io.to(room.id).emit("system_chat", {
        message: "Санал тэнцэв — энэ удаад хэн ч хасагдахгүй. Дараагийн удаад 2 тоглогч хасагдана.",
        timestamp: Date.now(),
      });
    }
  }

  // Check win condition: active ≤ half of original → end game
  const remaining = activePlayers(room).length;
  if (remaining <= Math.floor(room.originalPlayerCount / 2)) {
    clearTurnTimer(room);
    room.status = "ended";
    io.to(room.id).emit("game_over", { reason: "Тоглоом дууслаа" });
  } else {
    // Still more than half alive → auto-loop to next round after 4s
    io.to(room.id).emit("system_chat", {
      message: "Дараагийн үе 4 секундын дараа эхэлнэ...",
      timestamp: Date.now(),
    });
    setTimeout(() => {
      const r = rooms.get(room.id);
      if (!r || r.status !== "playing") return;
      startNextRound(r);
      broadcastRoom(r);
    }, 4000);
  }
}

function doEliminate(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return;
  player.isEliminated = true;
  room.lastEliminatedPlayerId = playerId;
  io.to(room.id).emit("player_eliminated", { playerId, playerName: player.name });
  io.to(room.id).emit("system_chat", {
    message: `${player.name} бункерт орох эрхээ алдлаа.`,
    timestamp: Date.now(),
  });
  // Rebuild turn order (remove eliminated)
  room.turnOrder = activePlayers(room).map(p => p.playerId);
}

function checkHostTransfer(room) {
  const active = activePlayers(room);
  const hasHost = active.some(p => p.isHost);
  if (!hasHost && active.length > 0) {
    active[0].isHost = true;
  }
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

function roomSnapshot(room, forPlayerId) {
  const players = [...room.players.values()].map(p => ({
    id: p.playerId,
    name: p.name,
    isHost: p.isHost,
    isEliminated: p.isEliminated,
    revealedCards: p.revealedCards,
    hand: room.status === "playing" && p.playerId === forPlayerId ? p.hand : null,
    revealedCount: p.revealedCount,
    roundRevealCount: p.roundRevealCount,
    roundDebt: p.roundDebt,
    effectiveLimit: p.effectiveLimit,
    voteImmunity: p.voteImmunity || false,
    disconnected: p.disconnected || false,
  }));

  const myVote = room.votes[forPlayerId] ?? null;

  return {
    id: room.id,
    status: room.status,
    disaster: room.status === "playing" || room.status === "ended"
      ? { id: 1, name: "Цөмийн дэлбэрэлт", description: "Цацраг идэвхт бохирдол", extra: "" }
      : null,
    bunker: room.status === "playing" || room.status === "ended"
      ? { id: 1, description: "Газар доорх бункер, 5 хүний хүчин чадалтай" }
      : null,
    players,
    round: room.round,
    cardRevealLimit: room.cardRevealLimit,
    originalPlayerCount: room.originalPlayerCount,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    currentTurnPlayerId: room.currentTurnPlayerId,
    turnEndsAt: room.turnEndsAt,
    turnDurationSec: room.turnDurationSec,
    pausedRemainingMs: room.pausedRemainingMs,
    isPaused: room.isPaused,
    phase: room.phase,
    phaseLabel: {
      reveal: "Карт дэлгэх",
      discussion: "Нийтийн нэг минут",
      reverseVote: "Хэн хасуулах вэ?",
      defense: "Өөрийгөө хамгаалах",
      finalVote: "Эцсийн санал хураалт",
    }[room.phase] ?? room.phase,
    phaseDurations: { reveal: 60, discussion: 60, reverseVote: 30, defense: 60, finalVote: 30 },
    voteCounts: room.voteCounts,
    defendingPlayerIds: room.defendingPlayerIds,
    lastEliminatedPlayerId: room.lastEliminatedPlayerId,
    myVote,
  };
}

function broadcastRoom(room) {
  for (const p of room.players.values()) {
    io.to(p.socketId).emit("room_update", roomSnapshot(room, p.playerId));
  }
}

// ─── Auth helpers ────────────────────────────────────────────────────────────

function getPlayer(room, socket) {
  return [...room.players.values()].find(p => p.socketId === socket.id);
}

function isHost(room, socket) {
  const p = getPlayer(room, socket);
  return p?.isHost === true;
}

// ─── Connection ──────────────────────────────────────────────────────────────

io.on("connection", socket => {
  console.log(`[+] connected: ${socket.id}`);

  // ── Lobby ──────────────────────────────────────────────────────────────────

  socket.on("create_room", ({ playerName, playerKey, hostCode }, ack) => {
    const roomId = makeId(4);
    const playerId = `pk_${makeId(8)}`;
    const player = {
      playerId, socketId: socket.id, name: playerName, isHost: true,
      hand: makeHand(playerName), playerKey, disconnected: false,
      isEliminated: false, revealedCards: [], revealedCount: 0,
      roundRevealCount: 0, roundDebt: 0, effectiveLimit: 2, voteImmunity: false,
    };
    const room = {
      id: roomId, status: "lobby", players: new Map([[playerId, player]]),
      phase: "reveal", round: 1, cardRevealLimit: 2, originalPlayerCount: 0,
      turnOrder: [], currentTurnIndex: 0, currentTurnPlayerId: null,
      turnEndsAt: null, turnDurationSec: 60, pausedRemainingMs: null, isPaused: false,
      votes: {}, voteCounts: {}, defendingPlayerIds: [],
      lastEliminatedPlayerId: null, pendingDoubleElimination: false, _turnTimer: null,
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    console.log(`  create_room: ${roomId} by ${playerName} (hostCode=${hostCode})`);
    broadcastRoom(room);
    ack({ success: true, roomId, playerId });
  });

  socket.on("join_room", ({ roomId, playerName, playerKey }, ack) => {
    const rid = roomId.toUpperCase();
    const room = rooms.get(rid);
    if (!room) return ack({ success: false, error: "Өрөө олдсонгүй" });

    const existing = [...room.players.values()].find(p => p.playerKey === playerKey);
    if (existing) {
      existing.socketId = socket.id;
      existing.disconnected = false;
      socket.join(rid);
      socket.data.roomId = rid;
      socket.data.playerId = existing.playerId;
      console.log(`  rejoin: ${existing.name} -> ${rid}`);
      broadcastRoom(room);
      ack({ success: true, roomId: rid, playerId: existing.playerId });
      return;
    }

    if (room.status !== "lobby") return ack({ success: false, error: "Тоглоом эхэлчихсэн байна" });
    const playerId = `pk_${makeId(8)}`;
    const player = {
      playerId, socketId: socket.id, name: playerName, isHost: false,
      hand: makeHand(playerName), playerKey, disconnected: false,
      isEliminated: false, revealedCards: [], revealedCount: 0,
      roundRevealCount: 0, roundDebt: 0, effectiveLimit: 2, voteImmunity: false,
    };
    room.players.set(playerId, player);
    socket.join(rid);
    socket.data.roomId = rid;
    socket.data.playerId = playerId;
    console.log(`  join_room: ${playerName} -> ${rid}`);
    broadcastRoom(room);
    ack({ success: true, roomId: rid, playerId });
  });

  socket.on("start_game", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост эхлүүлж болно" });

    room.status = "playing";
    room.phase = "reveal";
    room.round = 1;
    room.originalPlayerCount = room.players.size;
    room.turnOrder = [...room.players.keys()];
    room.currentTurnIndex = 0;
    room.currentTurnPlayerId = room.turnOrder[0] ?? null;
    room.votes = {};
    room.voteCounts = {};
    room.defendingPlayerIds = [];

    for (const p of room.players.values()) {
      p.effectiveLimit = room.cardRevealLimit;
      p.roundRevealCount = 0;
      p.roundDebt = 0;
    }

    console.log(`  start_game: ${room.id} (${room.players.size} players)`);
    ack?.({ success: true });
    io.to(room.id).emit("round_started", { round: 1 });
    startTurnTimer(room, room.turnDurationSec * 1000);
    broadcastRoom(room);
  });

  // ── Gameplay ───────────────────────────────────────────────────────────────

  socket.on("reveal_card", ({ category }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    const player = room.players.get(socket.data.playerId);
    if (!player) return ack?.({ success: false, error: "Тоглогч байхгүй" });
    if (room.phase !== "reveal") return ack?.({ success: false, error: "Карт дэлгэх үе биш" });
    if (room.currentTurnPlayerId !== player.playerId) return ack?.({ success: false, error: "Таны ээлж биш" });
    if (player.isEliminated) return ack?.({ success: false, error: "Та хасагдсан" });

    const alreadyRevealed = player.revealedCards.some(c => c.category === category);
    if (alreadyRevealed) return ack?.({ success: false, error: "Карт аль хэдийн нээгдсэн" });

    // Check per-round limit (special cards bypass it)
    const isSpecial = category === "specialCard1" || category === "specialCard2";
    if (!isSpecial && player.roundRevealCount >= player.effectiveLimit)
      return ack?.({ success: false, error: "Энэ үед дэлгэх картны хязгаарт хүрсэн" });

    const handValue = player.hand[category] ?? "";
    const handAction = player.hand[`${category}Action`] ?? undefined;
    const cardId = isSpecial
      ? (category === "specialCard1" ? 1 : 2)
      : undefined;

    const revealed = {
      category,
      label: {
        profession: "Мэргэжил", health: "Эрүүл мэнд", ageGender: "Нас, хүйс",
        hobby: "Хобби", personality: "Зан araншин", specialCard1: "Тусгай карт 1",
        specialCard2: "Тусгай карт 2", phobia: "Айдас (Фобиа)",
        extraInfo: "Нэмэлт мэдээлэл", bagItem: "Гар цүнх",
      }[category] ?? category,
      value: handValue,
      action: handAction,
      cardId,
      activated: false,
      requested: false,
      forced: false,
      revealedAt: Date.now(),
    };

    player.revealedCards.push(revealed);
    player.revealedCount++;
    if (!isSpecial) player.roundRevealCount++;

    io.to(room.id).emit("card_revealed", {
      playerId: player.playerId,
      playerName: player.name,
      card: revealed,
    });

    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("end_turn", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    const player = getPlayer(room, socket);
    if (!player) return ack?.({ success: false, error: "Тоглогч байхгүй" });
    const isCurrentTurn = room.currentTurnPlayerId === player.playerId;
    if (!isCurrentTurn && !player.isHost) return ack?.({ success: false, error: "Зөвхөн өөрийн ээлжид дуусгаж болно" });

    ack?.({ success: true });
    advanceTurn(room);
  });

  socket.on("next_phase", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост шилжүүлж болно" });

    clearTurnTimer(room);
    const active = activePlayers(room);

    if (room.phase === "reveal") {
      room.phase = "discussion";
      room.currentTurnPlayerId = null;
      io.to(room.id).emit("phase_changed", { phase: "discussion" });

    } else if (room.phase === "discussion") {
      room.phase = "reverseVote";
      room.votes = {};
      room.voteCounts = {};
      setPhaseFirstTurn(room);
      io.to(room.id).emit("phase_changed", { phase: "reverseVote" });

    } else if (room.phase === "reverseVote") {
      resolveReverseVote(room);
      room.phase = "defense";
      setPhaseFirstTurn(room);
      io.to(room.id).emit("phase_changed", { phase: "defense" });

    } else if (room.phase === "defense") {
      room.phase = "finalVote";
      room.votes = {};
      room.voteCounts = {};
      setPhaseFirstTurn(room);
      io.to(room.id).emit("phase_changed", { phase: "finalVote" });

    } else if (room.phase === "finalVote") {
      resolveFinalVote(room);
      if (room.status !== "ended") {
        // Let host trigger next_round manually
        clearTurnTimer(room);
        room.currentTurnPlayerId = null;
      }
    }

    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("next_round", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост шилжүүлж болно" });

    startNextRound(room);
    ack?.({ success: true });
    broadcastRoom(room);
  });

  // ── Voting ─────────────────────────────────────────────────────────────────

  socket.on("cast_vote", ({ targetId }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    const voter = getPlayer(room, socket);
    if (!voter || voter.isEliminated) return ack?.({ success: false, error: "Санал өгөх боломжгүй" });
    if (room.phase !== "reverseVote" && room.phase !== "finalVote")
      return ack?.({ success: false, error: "Санал хураалтын үе биш" });

    const target = room.players.get(targetId);
    if (!target || target.isEliminated) return ack?.({ success: false, error: "Буруу тоглогч" });
    if (targetId === voter.playerId) return ack?.({ success: false, error: "Өөртөө санал өгч болохгүй" });

    if (room.phase === "finalVote" && !room.defendingPlayerIds.includes(targetId))
      return ack?.({ success: false, error: "Зөвхөн хамгаалж буй тоглогчид санал өгнө" });

    room.votes[voter.playerId] = targetId;
    computeVoteCounts(room);

    ack?.({ success: true });
    broadcastRoom(room);

    // Auto-advance if all active non-immune players have voted
    const eligible = activePlayers(room).filter(p => !p.voteImmunity);
    const allVoted = eligible.every(p => room.votes[p.playerId]);
    if (allVoted && eligible.length > 0) {
      setTimeout(() => {
        const r = rooms.get(socket.data.roomId);
        if (!r) return;
        if (r.phase === "reverseVote") {
          resolveReverseVote(r);
          r.phase = "defense";
          setPhaseFirstTurn(r);
          io.to(r.id).emit("phase_changed", { phase: "defense" });
          broadcastRoom(r);
        } else if (r.phase === "finalVote") {
          resolveFinalVote(r);
          if (r.status !== "ended") {
            clearTurnTimer(r);
            r.currentTurnPlayerId = null;
          }
          broadcastRoom(r);
        }
      }, 1200);
    }
  });

  socket.on("clear_vote", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    const voter = getPlayer(room, socket);
    if (!voter) return ack?.({ success: false, error: "Тоглогч байхгүй" });

    delete room.votes[voter.playerId];
    computeVoteCounts(room);
    ack?.({ success: true });
    broadcastRoom(room);
  });

  // ── Host controls ──────────────────────────────────────────────────────────

  socket.on("eliminate_player", ({ playerId }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    doEliminate(room, playerId);
    room.turnOrder = activePlayers(room).map(p => p.playerId);

    const remaining = activePlayers(room).length;
    if (remaining <= Math.floor(room.originalPlayerCount / 2)) {
      clearTurnTimer(room);
      room.status = "ended";
      io.to(room.id).emit("game_over", { reason: "Тоглоом дууслаа" });
    }

    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("kick_player", ({ playerId }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    const target = room.players.get(playerId);
    if (!target) return ack?.({ success: false, error: "Тоглогч байхгүй" });

    io.to(target.socketId).emit("kicked", { reason: "Хостоос гаргагдлаа" });
    room.players.delete(playerId);
    room.turnOrder = activePlayers(room).map(p => p.playerId);

    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("set_reveal_limit", ({ limit }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    room.cardRevealLimit = Math.max(1, Math.min(10, limit));
    for (const p of activePlayers(room)) {
      p.effectiveLimit = room.cardRevealLimit;
    }
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("set_turn_duration", ({ seconds }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    room.turnDurationSec = Math.max(15, Math.min(300, seconds));
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("pause_timer", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });
    if (!room.turnEndsAt || room.isPaused) return ack?.({ success: false });

    room.pausedRemainingMs = Math.max(0, room.turnEndsAt - Date.now());
    clearTurnTimer(room);
    room.isPaused = true;
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("resume_timer", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });
    if (!room.isPaused) return ack?.({ success: false });

    const remaining = room.pausedRemainingMs ?? room.turnDurationSec * 1000;
    startTurnTimer(room, remaining);
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("stop_timer", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    clearTurnTimer(room);
    room.isPaused = false;
    room.pausedRemainingMs = null;
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("restart_timer", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    startTurnTimer(room, room.turnDurationSec * 1000);
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("end_game", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    clearTurnTimer(room);
    room.status = "ended";
    io.to(room.id).emit("game_over", { reason: "Хост тоглоомыг дуусгалаа" });
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("restart_game", (_, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост" });

    clearTurnTimer(room);
    room.status = "lobby";
    room.phase = "reveal";
    room.round = 1;
    room.votes = {};
    room.voteCounts = {};
    room.defendingPlayerIds = [];
    room.lastEliminatedPlayerId = null;
    room.pendingDoubleElimination = false;
    room.currentTurnPlayerId = null;
    room.currentTurnIndex = 0;
    room.turnEndsAt = null;
    room.isPaused = false;
    room.pausedRemainingMs = null;

    for (const p of room.players.values()) {
      p.isEliminated = false;
      p.revealedCards = [];
      p.revealedCount = 0;
      p.roundRevealCount = 0;
      p.roundDebt = 0;
      p.effectiveLimit = room.cardRevealLimit;
      p.hand = makeHand(p.name);
    }

    ack?.({ success: true });
    broadcastRoom(room);
  });

  // ── Special cards ──────────────────────────────────────────────────────────

  socket.on("request_special", ({ slot }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    const player = getPlayer(room, socket);
    if (!player || player.isEliminated) return ack?.({ success: false, error: "Хасагдсан тоглогч тусгай карт ашиглаж болохгүй" });

    const card = player.revealedCards.find(c => c.category === slot);
    if (!card) return ack?.({ success: false, error: "Карт нээгдээгүй байна" });
    if (card.activated) return ack?.({ success: false, error: "Карт аль хэдийн идэвхжсэн" });

    card.requested = true;
    ack?.({ success: true });
    broadcastRoom(room);
  });

  socket.on("activate_special", ({ ownerId, slot, targetId }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack?.({ success: false, error: "Өрөө байхгүй" });
    if (!isHost(room, socket)) return ack?.({ success: false, error: "Зөвхөн хост идэвхжүүлнэ" });

    const owner = room.players.get(ownerId);
    if (!owner) return ack?.({ success: false, error: "Тоглогч байхгүй" });

    const card = owner.revealedCards.find(c => c.category === slot);
    if (!card) return ack?.({ success: false, error: "Карт олдсонгүй" });

    card.activated = true;
    card.requested = false;

    io.to(room.id).emit("system_chat", {
      message: `${owner.name}-ийн тусгай карт идэвхжлээ: ${card.value}`,
      timestamp: Date.now(),
    });

    ack?.({ success: true });
    broadcastRoom(room);
  });

  // ── Chat ───────────────────────────────────────────────────────────────────

  socket.on("chat_message", ({ message }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const player = getPlayer(room, socket);
    if (!player) return;

    const msg = {
      playerId: player.playerId,
      playerName: player.name,
      message: String(message).slice(0, 200),
      timestamp: Date.now(),
    };
    io.to(room.id).emit("chat_message", msg);
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`[-] disconnected: ${socket.id}`);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = [...room.players.values()].find(p => p.socketId === socket.id);
    if (player) {
      player.disconnected = true;
      checkHostTransfer(room);
      broadcastRoom(room);
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => console.log(`Stub server listening on :${PORT}  (path /api/socket.io)\n`));
