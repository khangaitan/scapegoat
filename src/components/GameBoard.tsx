import { useState } from "react";
import type { GameRoom, ChatMessage, FlashCard, CardCategory, Player } from "@/lib/types";
import { PHASE_LABELS, PHASE_ICONS } from "@/lib/types";
import PlayerIcon from "./PlayerIcon";
import MyHand from "./MyHand";
import ChatPanel from "./ChatPanel";
import FlashReveal from "./FlashReveal";
import RoundBanner from "./RoundBanner";
import AdminPanel from "./AdminPanel";
import WinnerPopup from "./WinnerPopup";
import TurnTimer from "./TurnTimer";
import TimerControls from "./TimerControls";
import SpecialCardActivator from "./SpecialCardActivator";

interface Props {
  room: GameRoom;
  myPlayerId: string;
  flashCards: FlashCard[];
  chatMessages: ChatMessage[];
  roundBanner: number | null;
  onRevealCard: (category: CardCategory) => Promise<void>;
  onEliminate: (playerId: string) => Promise<void>;
  onKickPlayer: (playerId: string) => Promise<void>;
  onNextRound: () => Promise<void>;
  onNextPhase: () => Promise<void>;
  onSetRevealLimit: (n: number) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onSetTurnDuration: (s: number) => Promise<void>;
  onPauseTimer: () => Promise<void>;
  onResumeTimer: () => Promise<void>;
  onStopTimer: () => Promise<void>;
  onRestartTimer: () => Promise<void>;
  onCastVote: (targetId: string) => Promise<void>;
  onClearVote: () => Promise<void>;
  onEndGame: () => Promise<void>;
  onRestartGame: () => Promise<void>;
  onRequestSpecial: (slot: "specialCard1" | "specialCard2") => Promise<void>;
  onActivateSpecial: (ownerId: string, slot: "specialCard1" | "specialCard2", targetId?: string) => Promise<void>;
  onSendChat: (msg: string) => void;
  onGoHome: () => void;
}

type Tab = "hand" | "chat";

export default function GameBoard({
  room,
  myPlayerId,
  flashCards,
  chatMessages,
  roundBanner,
  onRevealCard,
  onEliminate,
  onKickPlayer,
  onNextRound,
  onNextPhase,
  onSetRevealLimit,
  onEndTurn,
  onSetTurnDuration,
  onPauseTimer,
  onResumeTimer,
  onStopTimer,
  onRestartTimer,
  onCastVote,
  onClearVote,
  onEndGame,
  onRestartGame,
  onRequestSpecial,
  onActivateSpecial,
  onSendChat,
  onGoHome,
}: Props) {
  const [tab, setTab] = useState<Tab>("hand");
  const [showDisaster, setShowDisaster] = useState(false);
  const [showBunker, setShowBunker] = useState(false);
  const [endingTurn, setEndingTurn] = useState(false);

  const me = room.players.find(p => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const myRevealedCategories = (me?.revealedCards ?? []).map(c => c.category) as CardCategory[];

  const activePlayers = room.players.filter(p => !p.isEliminated);
  const eliminatedPlayers = room.players.filter(p => p.isEliminated);

  const isMyTurn = room.currentTurnPlayerId === myPlayerId;
  const currentTurnPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);

  const isVotingPhase = room.phase === "reverseVote" || room.phase === "finalVote";
  const isTurnBased = room.phase === "reveal" || room.phase === "reverseVote" || room.phase === "defense";

  // Voting eligibility
  const canVote =
    !!me &&
    !me.isEliminated &&
    isVotingPhase &&
    (room.phase === "reverseVote" ? isMyTurn : true);

  const defendingPlayerIds = room.defendingPlayerIds ?? [];
  const voteCounts = room.voteCounts ?? {};
  const defendingPlayers = defendingPlayerIds
    .map(id => room.players.find(p => p.id === id))
    .filter((p): p is Player => !!p);

  async function handleEndTurn() {
    setEndingTurn(true);
    try { await onEndTurn(); } finally { setEndingTurn(false); }
  }

  async function handleVote(targetId: string) {
    try { await onCastVote(targetId); } catch (e: any) {
      alert(e.message || "Санал өгч чадсангүй");
    }
  }

  // Phase-specific banner color
  const phaseColors: Record<string, { bg: string; border: string; text: string }> = {
    reveal:      { bg: "hsl(16,85%,8%)",  border: "hsl(16,85%,35%)",  text: "hsl(16,85%,65%)" },
    discussion:  { bg: "hsl(210,60%,8%)", border: "hsl(210,60%,40%)", text: "hsl(210,80%,70%)" },
    reverseVote: { bg: "hsl(0,70%,8%)",   border: "hsl(0,70%,40%)",   text: "hsl(0,80%,70%)" },
    defense:     { bg: "hsl(48,80%,8%)",  border: "hsl(48,80%,40%)",  text: "hsl(48,90%,70%)" },
    finalVote:   { bg: "hsl(280,60%,8%)", border: "hsl(280,60%,45%)", text: "hsl(280,80%,75%)" },
  };
  const pc = phaseColors[room.phase] || phaseColors.reveal;

  const showCurrentTurnBar = isTurnBased && currentTurnPlayer && room.status === "playing";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <FlashReveal flashCards={flashCards} />
      <RoundBanner round={roundBanner} />

      {room.status === "ended" && (
        <WinnerPopup room={room} onGoHome={onGoHome} />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <h1 className="text-xl font-black tracking-widest" style={{ color: "hsl(16,85%,55%)" }}>СОНГОЛТ</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground font-mono">
            #{room.id}
          </span>
          <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
            {activePlayers.length} тоглогч
          </span>
          {isHost && room.status === "playing" && (
            <button
              onClick={() => {
                if (confirm("Тоглоомыг яг одоо дуусгах уу? Бүх тоглогчдод тоглоом дуусна.")) {
                  onEndGame().catch(e => alert(e.message));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-95"
              style={{ background: "hsl(0,70%,20%)", borderColor: "hsl(0,70%,45%)", color: "hsl(0,70%,85%)" }}
            >
              🛑 Дуусгах
            </button>
          )}
          {isHost && (
            <button
              onClick={() => {
                if (confirm("Шинэ тоглоом эхлүүлэх үү? Бүх карт, оноо шинэчлэгдэнэ.")) {
                  onRestartGame().catch(e => alert(e.message));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-95"
              style={{ background: "hsl(16,85%,20%)", borderColor: "hsl(16,85%,55%)", color: "hsl(16,85%,90%)" }}
            >
              🔄 Дахин
            </button>
          )}
          <button
            onClick={() => { if (confirm("Нүүр хуудас руу буцах уу? Тоглоомоос гарна.")) onGoHome(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all text-xs font-semibold"
          >
            🏠 Нүүр
          </button>
        </div>
      </div>

      {/* Round + phase indicator */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{ borderColor: pc.border, background: pc.bg }}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black" style={{ color: "hsl(16,85%,55%)" }}>
            {room.round}-Р ҮЕ
          </span>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: pc.text }}>
            {PHASE_ICONS[room.phase]} {PHASE_LABELS[room.phase]}
          </span>
        </div>
        <div className="text-right">
          {!isTurnBased && (
            <div className="flex items-center gap-2 justify-end">
              <TurnTimer
                endsAt={room.turnEndsAt}
                durationSec={room.turnDurationSec}
                isMyTurn={false}
                pausedRemainingMs={room.pausedRemainingMs}
              />
              {isHost && (
                <TimerControls
                  isPaused={room.isPaused}
                  isRunning={!!room.turnEndsAt && !room.isPaused}
                  onPause={onPauseTimer}
                  onResume={onResumeTimer}
                  onStop={onStopTimer}
                  onRestart={onRestartTimer}
                  size="sm"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phase progress strip */}
      <div className="px-4 py-2 flex items-center gap-1 overflow-x-auto bg-card/30 border-b border-border">
        {(["reveal", "discussion", "reverseVote", "defense", "finalVote"] as const).map(p => {
          const isActive = room.phase === p;
          const phaseIdx = ["reveal", "discussion", "reverseVote", "defense", "finalVote"].indexOf(p);
          const currentIdx = ["reveal", "discussion", "reverseVote", "defense", "finalVote"].indexOf(room.phase);
          const isPast = phaseIdx < currentIdx;
          return (
            <div
              key={p}
              className={`flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                isActive
                  ? "border-2"
                  : isPast
                  ? "bg-muted/30 text-muted-foreground"
                  : "bg-muted/10 text-muted-foreground/50"
              }`}
              style={isActive ? { background: pc.bg, borderColor: pc.border, color: pc.text } : {}}
            >
              {PHASE_ICONS[p]} {PHASE_LABELS[p]}
            </div>
          );
        })}
      </div>

      {/* Current turn bar (turn-based phases) */}
      {showCurrentTurnBar && (
        <div
          className="mx-4 mt-3 mb-1 rounded-xl px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 border-2"
          style={{
            background: isMyTurn ? "hsl(16,85%,10%)" : "hsl(var(--card) / 0.5)",
            borderColor: isMyTurn ? "hsl(16,85%,55%)" : "hsl(var(--border))",
            boxShadow: isMyTurn ? "0 0 20px hsl(16,85%,55% / 0.3)" : "none",
          }}
        >
          {/* Top row on mobile: mic + label/name. Side-by-side on desktop. */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl flex-shrink-0">🎤</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-tight"
                style={{ color: isMyTurn ? "hsl(16,85%,65%)" : "hsl(var(--muted-foreground))" }}
              >
                {isMyTurn ? "Таны ярих ээлж" : "Ярих ээлж"}
              </p>
              <p className="text-base font-black truncate"
                style={{ color: isMyTurn ? "white" : "hsl(var(--foreground))" }}
              >
                {isMyTurn ? "ТА" : currentTurnPlayer!.name}
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  ({room.currentTurnIndex + 1}/{room.turnOrder.length})
                </span>
              </p>
            </div>
          </div>
          {/* Bottom row on mobile: timer + controls + end button. */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-shrink-0">
            <TurnTimer
              endsAt={room.turnEndsAt}
              durationSec={room.turnDurationSec}
              isMyTurn={isMyTurn}
              pausedRemainingMs={room.pausedRemainingMs}
            />
            {isHost && (
              <TimerControls
                isPaused={room.isPaused}
                isRunning={!!room.turnEndsAt && !room.isPaused}
                onPause={onPauseTimer}
                onResume={onResumeTimer}
                onStop={onStopTimer}
                onRestart={onRestartTimer}
                size="sm"
              />
            )}
            {isMyTurn && (() => {
              const required = Math.min(2, room.cardRevealLimit);
              const revealed = me?.roundRevealCount ?? 0;
              const canEnd = revealed >= required;
              return (
                <button
                  onClick={handleEndTurn}
                  disabled={endingTurn || !canEnd}
                  title={canEnd ? "Ярих ээлжээ дуусгах" : `Эхлээд ${required} карт нээнэ үү (${revealed}/${required})`}
                  className="px-3 sm:px-4 py-2 rounded-lg font-bold text-xs border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{
                    background: canEnd ? "hsl(16,85%,55%)" : "hsl(var(--muted))",
                    borderColor: canEnd ? "hsl(16,85%,55%)" : "hsl(var(--border))",
                    color: canEnd ? "white" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {endingTurn ? "..." : canEnd ? "ДУУСГАХ ▶" : `ДУУСГАХ (${revealed}/${required})`}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Phase-specific instruction banner */}
      {room.status === "playing" && (
        <div className="mx-4 mt-2 mb-3 rounded-xl px-4 py-2.5 border text-xs leading-relaxed"
          style={{ background: pc.bg, borderColor: pc.border, color: pc.text }}
        >
          {room.phase === "reveal" && (
            <span><b>{PHASE_ICONS.reveal} Карт дэлгэх:</b> Тоглогчид ээлжээр өөрсдийн картаа дэлгэнэ.</span>
          )}
          {room.phase === "discussion" && (
            <span><b>{PHASE_ICONS.discussion} Нийтийн нэг минут:</b> Бүгд чөлөөтэй хэлэлцэнэ. Чат ашиглана уу.</span>
          )}
          {room.phase === "reverseVote" && (
            <span><b>{PHASE_ICONS.reverseVote} Хэн хасуулах вэ?</b> Хэн нэгнийг хасахаар сонгоно. {isMyTurn && <span className="font-bold">— Таны ээлж: тоглогч дээр дарж сонгоно уу.</span>}</span>
          )}
          {room.phase === "defense" && (
            <span><b>{PHASE_ICONS.defense} Өөрийгөө хамгаалах:</b> Хамгийн их санал авсан тоглогчид өөрсдийгөө хамгаална.</span>
          )}
          {room.phase === "finalVote" && (
            <span><b>{PHASE_ICONS.finalVote} Эцсийн санал:</b> Хэнийг хасахыг сонгоно уу. Хамгаалж буй тоглогчоос л сонгох боломжтой.</span>
          )}
        </div>
      )}

      {/* Defending players highlight (during defense/finalVote) */}
      {(room.phase === "defense" || room.phase === "finalVote") && defendingPlayers.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl px-3 py-2 border border-yellow-700/60 bg-yellow-950/30">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-1">
            🛡️ Өөрийгөө хамгаалж буй тоглогчид
          </p>
          <div className="flex flex-wrap gap-2">
            {defendingPlayers.map(p => (
              <span key={p.id} className="text-xs font-bold px-2 py-0.5 rounded-md bg-yellow-900/40 text-yellow-200 border border-yellow-800/60">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Special card panel — players request, host activates */}
      {me && room.status === "playing" && (isHost || !me.isEliminated) && (
        <SpecialCardActivator
          players={room.players}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onRequest={onRequestSpecial}
          onActivate={onActivateSpecial}
        />
      )}

      {/* Admin panel */}
      {isHost && room.status === "playing" && (
        <div className="pt-1">
          <AdminPanel
            room={room}
            onNextRound={onNextRound}
            onNextPhase={onNextPhase}
            onSetRevealLimit={onSetRevealLimit}
            onSetTurnDuration={onSetTurnDuration}
            onEndTurn={onEndTurn}
            onKickPlayer={onKickPlayer}
          />
        </div>
      )}

      {/* My reveal status (only during reveal phase) */}
      {me && room.status === "playing" && room.phase === "reveal" && (
        <div className="mx-4 mb-3 mt-1 rounded-xl px-4 py-2.5 flex items-center justify-between border"
          style={{
            background: "hsl(var(--card) / 0.5)",
            borderColor: me.roundRevealCount >= me.effectiveLimit
              ? "hsl(16,85%,35%)"
              : "hsl(var(--border))",
          }}
        >
          <div>
            <p className="text-xs text-muted-foreground">Энэ үед дэлгэсэн</p>
            <p className="text-sm font-black">
              <span style={{ color: "hsl(16,85%,65%)" }}>{me.roundRevealCount}</span>
              <span className="text-muted-foreground"> / {me.effectiveLimit} карт</span>
              {me.roundDebt > 0 && (
                <span className="text-amber-400 text-xs ml-2">(өрийн хасалт: -{me.roundDebt})</span>
              )}
            </p>
          </div>
          {me.effectiveLimit === 0 ? (
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-red-950/50 text-red-400 border border-red-800/50">
              🚫 Эрх хаагдсан
            </span>
          ) : me.roundRevealCount < me.effectiveLimit ? (
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-amber-950/50 text-amber-400 border border-amber-800/50">
              {me.effectiveLimit - me.roundRevealCount} карт үлдлээ
            </span>
          ) : (
            <span className="text-xs font-bold px-2 py-1 rounded-md text-green-400 border border-green-800/50 bg-green-950/30">
              ✓ Дууссан
            </span>
          )}
        </div>
      )}

      {/* Disaster & Bunker info banners */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        {room.disaster && (
          <button
            onClick={() => setShowDisaster(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-red-950/50 border border-red-800/60 rounded-lg px-3 py-2 text-left hover:border-red-600 transition-colors"
          >
            <span className="text-lg">☢️</span>
            <div>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wide">Гамшиг</p>
              <p className="text-xs text-red-200 font-semibold">{room.disaster.name}</p>
            </div>
          </button>
        )}
        {room.bunker && (
          <button
            onClick={() => setShowBunker(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-blue-950/50 border border-blue-800/60 rounded-lg px-3 py-2 text-left hover:border-blue-600 transition-colors"
          >
            <span className="text-lg">🏗️</span>
            <div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">Бункер</p>
              <p className="text-xs text-blue-200 font-semibold truncate max-w-[120px]">{room.bunker.description.substring(0, 40)}...</p>
            </div>
          </button>
        )}
      </div>

      {/* Players row */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Тоглогчид
          </p>
          {isVotingPhase && (
            <div className="flex items-center gap-3">
              {canVote && room.myVote && (
                <button
                  onClick={async () => {
                    try { await onClearVote(); } catch (e: any) { alert(e.message); }
                  }}
                  className="text-xs px-2 py-1 rounded border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30"
                  title="Саналаа цуцалж дахин сонгох"
                >
                  Саналаа цуцлах
                </button>
              )}
              {canVote && (
                <p className="text-[10px] text-muted-foreground italic">
                  {room.myVote ? "Өөр тоглогч дарж саналаа өөрчлөх боломжтой" : "Тоглогчийг сонгож санал өг"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {Object.values(voteCounts).reduce((a, b) => a + b, 0)} нийт санал
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-5">
          {activePlayers.map((player, i) => (
            <div key={player.id} className="relative">
              <PlayerIcon
                player={player}
                myPlayerId={myPlayerId}
                isHost={isHost}
                isCurrentTurn={player.id === room.currentTurnPlayerId}
                voteCount={voteCounts[player.id] || 0}
                isDefending={defendingPlayerIds.includes(player.id)}
                isMyVote={room.myVote === player.id}
                canVote={canVote && (room.phase === "reverseVote" || defendingPlayerIds.includes(player.id))}
                phase={room.phase}
                onEliminate={onEliminate}
                onVote={handleVote}
                index={i}
              />
              {/* Per-round reveal dots (only during reveal/discussion) */}
              {(room.phase === "reveal" || room.phase === "discussion") && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {Array.from({ length: room.cardRevealLimit }).map((_, di) => (
                    <div
                      key={di}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: di < player.roundRevealCount
                          ? "hsl(16,85%,55%)"
                          : "hsl(var(--muted))",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {eliminatedPlayers.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Хасагдсан</p>
            <div className="flex flex-wrap gap-4">
              {eliminatedPlayers.map((player, i) => (
                <div key={player.id} className="relative">
                  <PlayerIcon
                    player={player}
                    myPlayerId={myPlayerId}
                    isHost={isHost}
                    onEliminate={onEliminate}
                    index={activePlayers.length + i}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-4" />

      {/* Bottom tabs */}
      <div className="flex border-b border-border px-4 mt-2">
        <button
          onClick={() => setTab("hand")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "hand" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          🃏 Миний картууд
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          💬 Чат {chatMessages.length > 0 && <span className="ml-1 text-xs bg-primary/30 px-1.5 rounded-full">{chatMessages.length}</span>}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {tab === "hand" && me && (
          <MyHand
            hand={me.hand!}
            revealedCategories={myRevealedCategories}
            isMyTurn={isMyTurn && room.phase === "reveal"}
            round={room.round}
            effectiveLimit={me.effectiveLimit}
            roundRevealCount={me.roundRevealCount}
            onReveal={onRevealCard}
          />
        )}
        {tab === "chat" && (
          <div className="h-full flex flex-col" style={{ minHeight: "300px" }}>
            <ChatPanel
              messages={chatMessages}
              myPlayerId={myPlayerId}
              onSend={onSendChat}
            />
          </div>
        )}
      </div>

      {/* Disaster Modal */}
      {showDisaster && room.disaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDisaster(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-red-950/90 border border-red-700 rounded-2xl p-6 z-10 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">☢️ Гамшиг</p>
                <h2 className="text-2xl font-black text-red-200">{room.disaster.name}</h2>
              </div>
              <button onClick={() => setShowDisaster(false)} className="text-red-400 hover:text-red-200 text-xl">✕</button>
            </div>
            <p className="text-sm text-red-200 mb-3 leading-relaxed">{room.disaster.description}</p>
            {room.disaster.extra && (
              <div className="bg-red-900/50 rounded-lg p-3">
                <p className="text-xs text-red-300 font-semibold uppercase tracking-wide mb-1">Нэмэлт мэдээлэл</p>
                <p className="text-sm text-red-200 leading-relaxed">{room.disaster.extra}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bunker Modal */}
      {showBunker && room.bunker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBunker(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-blue-950/90 border border-blue-700 rounded-2xl p-6 z-10 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">🏗️ Бункерийн мэдээлэл</p>
                <h2 className="text-xl font-black text-blue-200">Бункер #{room.bunker.id}</h2>
              </div>
              <button onClick={() => setShowBunker(false)} className="text-blue-400 hover:text-blue-200 text-xl">✕</button>
            </div>
            <p className="text-sm text-blue-100 leading-relaxed">{room.bunker.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
