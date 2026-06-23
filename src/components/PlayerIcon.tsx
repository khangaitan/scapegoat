import { useState } from "react";
import type { Player, GamePhase } from "@/lib/types";
import PlayerHistoryModal from "./PlayerHistoryModal";

interface Props {
  player: Player;
  myPlayerId: string;
  isHost: boolean;
  isCurrentTurn?: boolean;
  voteCount?: number;
  isDefending?: boolean;
  isMyVote?: boolean;
  canVote?: boolean;
  phase?: GamePhase;
  onEliminate: (playerId: string) => void;
  onVote?: (playerId: string) => void;
  index: number;
}

export default function PlayerIcon({
  player,
  myPlayerId,
  isHost,
  isCurrentTurn,
  voteCount = 0,
  isDefending,
  isMyVote,
  canVote,
  phase,
  onEliminate,
  onVote,
  index,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const isMe = player.id === myPlayerId;
  const color = `hsl(${(index * 47) % 360}, 60%, ${player.isEliminated ? 25 : 45}%)`;

  const showVoteBtn = canVote && !isMe && !player.isEliminated && (phase === "reverseVote" || phase === "finalVote");
  const voteBtnLabel = phase === "finalVote" ? "Хасах ⚖" : "👉 Сонгох";

  return (
    <>
      <div
        className={`relative flex flex-col items-center gap-1 cursor-pointer group transition-all duration-300 ${player.isEliminated ? "opacity-40" : ""}`}
        onClick={() => setShowHistory(true)}
      >
        {/* Active turn ring */}
        {isCurrentTurn && !player.isEliminated && (
          <div
            className="absolute -inset-1.5 rounded-full pointer-events-none"
            style={{
              border: "2px solid hsl(16,85%,55%)",
              boxShadow: "0 0 18px hsl(16,85%,55%), inset 0 0 12px hsl(16,85%,55% / 0.3)",
              animation: "turnPulse 1.5s ease-in-out infinite",
            }}
          />
        )}

        {/* Defending ring */}
        {isDefending && !player.isEliminated && !isCurrentTurn && (
          <div
            className="absolute -inset-1.5 rounded-full pointer-events-none"
            style={{
              border: "2px solid hsl(48,95%,55%)",
              boxShadow: "0 0 14px hsl(48,95%,55% / 0.6)",
            }}
          />
        )}

        {/* My vote ring */}
        {isMyVote && !player.isEliminated && (
          <div
            className="absolute -inset-2.5 rounded-full pointer-events-none"
            style={{
              border: "2px dashed hsl(0,80%,60%)",
              boxShadow: "0 0 10px hsl(0,80%,60% / 0.5)",
            }}
          />
        )}

        {/* Avatar */}
        <div
          className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg font-black text-white transition-all duration-300 relative"
          style={{
            background: color,
            boxShadow: player.isEliminated
              ? "0 0 12px rgba(220,50,50,0.5)"
              : isMe
              ? "0 0 15px rgba(220,100,50,0.6)"
              : "none",
            border: isMe ? "2px solid hsl(16,85%,55%)" : "2px solid transparent",
          }}
        >
          {player.name.charAt(0).toUpperCase()}
          {player.isEliminated && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <span className="text-lg">❌</span>
            </div>
          )}
          {player.isHost && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
              <span className="text-xs">👑</span>
            </div>
          )}
          {player.disconnected && !player.isEliminated && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full"
              style={{ background: "rgba(0,0,0,0.65)" }}
              title="Холболт тасарсан"
            >
              <span className="text-lg">📵</span>
            </div>
          )}
        </div>

        {/* Speaking indicator */}
        {isCurrentTurn && !player.isEliminated && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider whitespace-nowrap"
            style={{ background: "hsl(16,85%,55%)", color: "white" }}
          >
            🎤
          </div>
        )}

        {/* Defending badge */}
        {isDefending && !player.isEliminated && !isCurrentTurn && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider whitespace-nowrap"
            style={{ background: "hsl(48,95%,55%)", color: "black" }}
          >
            🛡️
          </div>
        )}

        {/* Vote count badge (during vote phases) */}
        {voteCount > 0 && (phase === "reverseVote" || phase === "finalVote") && (
          <div
            className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full text-xs font-black flex items-center justify-center text-white border-2 border-background"
            style={{ background: "hsl(0,80%,55%)" }}
          >
            {voteCount}
          </div>
        )}

        {/* Revealed count badge */}
        {player.revealedCount > 0 && (phase === "reveal" || phase === "discussion") && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
            style={{ background: "hsl(16,85%,55%)" }}
          >
            {player.revealedCount}
          </div>
        )}

        {/* Name */}
        <p className={`text-xs font-medium max-w-[60px] truncate text-center ${isMe ? "text-primary" : isCurrentTurn ? "text-primary font-bold" : "text-muted-foreground"}`}>
          {isMe ? "Та" : player.name}
        </p>

        {/* Vote button */}
        {showVoteBtn && (
          <button
            onClick={e => { e.stopPropagation(); onVote?.(player.id); }}
            className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider whitespace-nowrap border transition-all ${
              isMyVote
                ? "bg-red-700 border-red-500 text-white"
                : "bg-card border-red-800 text-red-400 hover:bg-red-900/40 hover:text-red-200 hover:border-red-600"
            }`}
            title={isMyVote ? "Энэ таны санал. Өөр тоглогч дарж өөрчилж болно" : voteBtnLabel}
          >
            {isMyVote ? "✓ Миний санал" : voteBtnLabel}
          </button>
        )}

        {/* Hover tooltip */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card border border-border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {player.name} · {player.revealedCount} карт
          {voteCount > 0 && <span className="text-red-400 ml-1">· {voteCount} санал</span>}
        </div>
      </div>

      {/* Eliminate button (host only, not self) */}
      {isHost && !isMe && !player.isEliminated && (
        <button
          onClick={e => { e.stopPropagation(); onEliminate(player.id); }}
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
        >
          Хасах
        </button>
      )}

      {showHistory && (
        <PlayerHistoryModal
          player={player}
          onClose={() => setShowHistory(false)}
        />
      )}

      <style>{`
        @keyframes turnPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </>
  );
}
