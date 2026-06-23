import { useEffect, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { disconnectSocket } from "@/lib/socket";
import LobbyPage from "@/components/LobbyPage";
import WaitingRoom from "@/components/WaitingRoom";
import GameBoard from "@/components/GameBoard";
import AdminPage from "@/components/AdminPage";

type Screen = "lobby" | "waiting" | "playing";

function isAdminRoute(): boolean {
  return window.location.pathname.replace(/\/$/, "").endsWith("/admin")
    || window.location.search.includes("admin=1");
}

function getRoomCodeFromUrl(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  return code ? code.toUpperCase() : undefined;
}

export default function App() {
  const game = useGame();
  const [screen, setScreen] = useState<Screen>("lobby");
  const prefillRoomCode = getRoomCodeFromUrl();

  const [savedSession, setSavedSession] = useState(() => {
    const saved = game.getSavedSession();
    // If the user opened an invite link for a DIFFERENT room than their saved
    // session, suppress the stale "Resume" banner so they don't accidentally
    // tap it and end up in their previous (likely empty) room instead of the
    // one their friend invited them to.
    const urlRoom = getRoomCodeFromUrl();
    if (saved && urlRoom && saved.roomId.toUpperCase() !== urlRoom) {
      return null;
    }
    return saved;
  });

  // Handle being kicked out
  useEffect(() => {
    if (game.kicked) {
      alert("Та тоглоомоос хасагдлаа.");
      game.forgetSession();
      setSavedSession(null);
      // setScreen first so the auto-transition effect cannot bounce us back
      // into the kicked room while we're clearing state.
      setScreen("lobby");
      game.clearKicked();
      game.resetGameState();
      disconnectSocket();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [game.kicked]);

  async function handleCreateRoom(name: string, hostCode: string) {
    try {
      await game.createRoom(name, hostCode);
      window.history.replaceState({}, "", window.location.pathname);
      setScreen("waiting");
    } catch (e: any) {
      game.setError(e.message || "Өрөө үүсгэж чадсангүй");
    }
  }

  async function handleJoinRoom(roomId: string, name: string) {
    try {
      await game.joinRoom(roomId, name);
      window.history.replaceState({}, "", window.location.pathname);
      setScreen("waiting");
    } catch (e: any) {
      game.setError(e.message || "Өрөөнд нэгдэж чадсангүй");
    }
  }

  async function handleStartGame() {
    try {
      await game.startGame();
      setScreen("playing");
    } catch (e: any) {
      game.setError(e.message);
    }
  }

  function handleGoHome() {
    game.forgetSession();
    setSavedSession(null);
    // Set lobby screen FIRST so the auto-transition effect (which only runs
    // when screen !== "lobby") cannot bounce us back into the old room
    // between the resetGameState call and the next render.
    setScreen("lobby");
    game.resetGameState();
    disconnectSocket();
    window.history.replaceState({}, "", window.location.pathname);
  }

  function handleForgetSession() {
    game.forgetSession();
    setSavedSession(null);
  }

  // Auto-transition based on room status (covers reconnect into running game)
  useEffect(() => {
    if (screen === "lobby") return;
    if (game.room?.status === "playing") setScreen("playing");
    else if (game.room?.status === "lobby") setScreen("waiting");
  }, [game.room?.status, screen]);

  if (isAdminRoute()) {
    return <div className="dark"><AdminPage /></div>;
  }

  return (
    <div className="dark">
      {screen === "lobby" && (
        <LobbyPage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error={game.error}
          prefillRoomCode={prefillRoomCode}
          savedSession={savedSession}
          onForgetSession={handleForgetSession}
        />
      )}
      {screen === "waiting" && game.myPlayerId && (
        <WaitingRoom
          room={game.room}
          myPlayerId={game.myPlayerId}
          onStartGame={handleStartGame}
          onGoHome={handleGoHome}
        />
      )}
      {screen === "playing" && game.room && game.myPlayerId && (
        <GameBoard
          room={game.room}
          myPlayerId={game.myPlayerId}
          flashCards={game.flashCards}
          chatMessages={game.chatMessages}
          roundBanner={game.roundBanner}
          onRevealCard={game.revealCard}
          onEliminate={game.eliminatePlayer}
          onKickPlayer={game.kickPlayer}
          onNextRound={game.nextRound}
          onNextPhase={game.nextPhase}
          onSetRevealLimit={game.setRevealLimit}
          onEndTurn={game.endTurn}
          onSetTurnDuration={game.setTurnDuration}
          onPauseTimer={game.pauseTimer}
          onResumeTimer={game.resumeTimer}
          onStopTimer={game.stopTimer}
          onRestartTimer={game.restartTimer}
          onCastVote={game.castVote}
          onClearVote={game.clearVote}
          onEndGame={game.endGame}
          onRestartGame={game.restartGame}
          onRequestSpecial={game.requestSpecial}
          onActivateSpecial={game.activateSpecial}
          onSendChat={game.sendChat}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  );
}
