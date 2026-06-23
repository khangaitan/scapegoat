import { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import type { GameRoom, FlashCard, ChatMessage, CardCategory } from "@/lib/types";

// Wrap socket.emit in a Promise with a hard timeout so a dropped packet,
// disconnected socket, or missing server-side ack can never leave a UI button
// stuck in its loading state forever. Resolves with the server's ack payload.
function emitWithAck<T = any>(socket: Socket, event: string, payload: any, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Серверээс хариу ирсэнгүй (сүлжээ удаашралтай байж магадгүй)."));
    }, timeoutMs);
    socket.emit(event, payload, (res: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    });
  });
}

// Module-level helper (hoisted out of the hook) so we never accidentally
// capture a stale render's closure if someone later adds state references.
async function call(event: string, payload: any, fallbackMsg?: string): Promise<void> {
  const res = await emitWithAck<any>(getSocket(), event, payload);
  if (!res?.success) throw new Error(res?.error || fallbackMsg || "Үйлдэл амжилтгүй");
}

interface GameState {
  room: GameRoom | null;
  myPlayerId: string | null;
  roomId: string | null;
  flashCards: FlashCard[];
  chatMessages: ChatMessage[];
  connected: boolean;
  error: string | null;
  roundBanner: number | null;
  kicked: boolean;
}

export function useGame() {
  const [state, setState] = useState<GameState>({
    room: null,
    myPlayerId: null,
    roomId: null,
    flashCards: [],
    chatMessages: [],
    connected: false,
    error: null,
    roundBanner: null,
    kicked: false,
  });

  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      setState(s => ({ ...s, connected: true, error: null }));
    });

    socket.on("disconnect", () => {
      setState(s => ({ ...s, connected: false }));
    });

    socket.on("room_update", (room: GameRoom) => {
      setState(s => ({ ...s, room }));
    });

    socket.on("round_started", ({ round }: { round: number }) => {
      setState(s => ({ ...s, roundBanner: round }));
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => {
        setState(s => ({ ...s, roundBanner: null }));
      }, 3500);
    });

    socket.on("card_revealed", ({ playerId, playerName, card }: { playerId: string; playerName: string; card: any }) => {
      const flashId = `${playerId}-${card.category}-${Date.now()}`;
      const flashCard: FlashCard = { playerId, playerName, card, id: flashId };

      setState(s => ({ ...s, flashCards: [...s.flashCards, flashCard] }));

      const timer = setTimeout(() => {
        setState(s => ({ ...s, flashCards: s.flashCards.filter(f => f.id !== flashId) }));
        flashTimers.current.delete(flashId);
      }, 4000);
      flashTimers.current.set(flashId, timer);
    });

    socket.on("chat_message", (msg: ChatMessage) => {
      setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-100), msg] }));
    });

    socket.on("system_chat", (msg: { message: string; timestamp: number }) => {
      const sysMsg: ChatMessage = {
        playerId: "system",
        playerName: "Систем",
        message: msg.message,
        timestamp: msg.timestamp,
      };
      setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-100), sysMsg] }));
    });

    socket.on("player_left", (_: { playerId: string }) => {});

    socket.on("turn_changed", (_: { playerId: string | null }) => {});
    socket.on("phase_changed", (_: { phase: string }) => {});
    socket.on("player_eliminated", (_: { playerId: string; playerName: string }) => {});

    socket.on("game_over", (_: any) => {
      // room_update will have status=ended
    });

    socket.on("kicked", (_: { reason: string }) => {
      setState(s => ({ ...s, kicked: true }));
    });

    socket.on("room_closed", (_: { reason: string }) => {
      try {
        localStorage.removeItem("songolt_session");
      } catch {}
      setState(s => ({ ...s, kicked: true }));
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room_update");
      socket.off("round_started");
      socket.off("turn_changed");
      socket.off("phase_changed");
      socket.off("player_eliminated");
      socket.off("card_revealed");
      socket.off("chat_message");
      socket.off("player_left");
      socket.off("game_over");
      socket.off("kicked");
      socket.off("room_closed");
      socket.off("system_chat");
      flashTimers.current.forEach(t => clearTimeout(t));
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  const getPlayerKey = (): string => {
    try {
      let key = localStorage.getItem("songolt_player_key");
      if (!key) {
        key = (crypto as any).randomUUID ? crypto.randomUUID() : `pk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("songolt_player_key", key);
      }
      return key;
    } catch {
      return `pk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  };

  const saveSession = (roomId: string, playerName: string) => {
    try {
      localStorage.setItem("songolt_last_room", roomId);
      localStorage.setItem("songolt_last_name", playerName);
    } catch {}
  };

  const clearSession = () => {
    try {
      localStorage.removeItem("songolt_last_room");
      localStorage.removeItem("songolt_last_name");
    } catch {}
  };

  const createRoom = useCallback(async (playerName: string, hostCode: string): Promise<{ roomId: string }> => {
    const playerKey = getPlayerKey();
    const res = await emitWithAck<any>(getSocket(), "create_room", { playerName, playerKey, hostCode });
    if (!res?.success) throw new Error(res?.error || "Өрөө үүсгэж чадсангүй");
    saveSession(res.roomId, playerName);
    setState(s => ({ ...s, myPlayerId: res.playerId, roomId: res.roomId, error: null }));
    return { roomId: res.roomId };
  }, []);

  const joinRoom = useCallback(async (roomId: string, playerName: string): Promise<void> => {
    const playerKey = getPlayerKey();
    const res = await emitWithAck<any>(getSocket(), "join_room", { roomId, playerName, playerKey });
    if (!res?.success) throw new Error(res?.error || "Өрөөнд нэгдэж чадсангүй");
    saveSession(res.roomId, playerName);
    setState(s => ({ ...s, myPlayerId: res.playerId, roomId: res.roomId, error: null }));
  }, []);

  const getSavedSession = useCallback((): { roomId: string; playerName: string } | null => {
    try {
      const roomId = localStorage.getItem("songolt_last_room");
      const playerName = localStorage.getItem("songolt_last_name");
      if (roomId && playerName) return { roomId, playerName };
    } catch {}
    return null;
  }, []);

  const forgetSession = useCallback(() => clearSession(), []);

  const startGame = useCallback(() => call("start_game", {}, "Тоглоом эхлүүлж чадсангүй"), []);
  const revealCard = useCallback((category: CardCategory) => call("reveal_card", { category }, "Карт нээж чадсангүй"), []);
  const eliminatePlayer = useCallback((playerId: string) => call("eliminate_player", { playerId }), []);
  const kickPlayer = useCallback((playerId: string) => call("kick_player", { playerId }), []);
  const nextRound = useCallback(() => call("next_round", {}, "Үе шилжүүлж чадсангүй"), []);
  const setRevealLimit = useCallback((limit: number) => call("set_reveal_limit", { limit }), []);
  const endTurn = useCallback(() => call("end_turn", {}, "Ээлж дуусгаж чадсангүй"), []);
  const setTurnDuration = useCallback((seconds: number) => call("set_turn_duration", { seconds }), []);
  const castVote = useCallback((targetId: string) => call("cast_vote", { targetId }, "Санал өгч чадсангүй"), []);
  const clearVote = useCallback(() => call("clear_vote", {}, "Санал цуцалж чадсангүй"), []);
  const pauseTimer = useCallback(() => call("pause_timer", {}), []);
  const resumeTimer = useCallback(() => call("resume_timer", {}), []);
  const stopTimer = useCallback(() => call("stop_timer", {}), []);
  const restartTimer = useCallback(() => call("restart_timer", {}, "Цаг сэргээж чадсангүй"), []);
  const nextPhase = useCallback(() => call("next_phase", {}), []);
  const endGame = useCallback(() => call("end_game", {}, "Тоглоом дуусгаж чадсангүй"), []);
  const restartGame = useCallback(() => call("restart_game", {}, "Дахин эхлүүлж чадсангүй"), []);
  const requestSpecial = useCallback((slot: "specialCard1" | "specialCard2") => call("request_special", { slot }, "Хүсэлт илгээж чадсангүй"), []);
  const activateSpecial = useCallback(
    (ownerId: string, slot: "specialCard1" | "specialCard2", targetId?: string) =>
      call("activate_special", { ownerId, slot, targetId }, "Идэвхжүүлж чадсангүй"),
    [],
  );

  const sendChat = useCallback((message: string) => {
    const socket = getSocket();
    socket.emit("chat_message", { message });
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(s => ({ ...s, error }));
  }, []);

  const clearKicked = useCallback(() => {
    setState(s => ({ ...s, kicked: false }));
  }, []);

  // Clear all game-room state without touching the connection. Use this when
  // the user navigates back to the lobby (Home button) so leftover data from
  // the previous room can never bleed into the next room they create or join.
  const resetGameState = useCallback(() => {
    for (const t of flashTimers.current.values()) clearTimeout(t);
    flashTimers.current.clear();
    if (bannerTimer.current) {
      clearTimeout(bannerTimer.current);
      bannerTimer.current = null;
    }
    setState(s => ({
      ...s,
      room: null,
      myPlayerId: null,
      roomId: null,
      flashCards: [],
      chatMessages: [],
      roundBanner: null,
      kicked: false,
      error: null,
    }));
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    revealCard,
    eliminatePlayer,
    kickPlayer,
    nextRound,
    nextPhase,
    setRevealLimit,
    endTurn,
    setTurnDuration,
    pauseTimer,
    resumeTimer,
    stopTimer,
    restartTimer,
    castVote,
    clearVote,
    endGame,
    restartGame,
    requestSpecial,
    activateSpecial,
    sendChat,
    setError,
    clearKicked,
    getSavedSession,
    forgetSession,
    resetGameState,
  };
}
