import { useState } from "react";
import type { GameRoom, Player } from "@/lib/types";

interface Props {
  room: GameRoom;
  onNextRound: () => Promise<void>;
  onNextPhase: () => Promise<void>;
  onSetRevealLimit: (n: number) => Promise<void>;
  onSetTurnDuration: (s: number) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onKickPlayer: (id: string) => Promise<void>;
}

export default function AdminPanel({
  room,
  onNextRound,
  onNextPhase,
  onSetRevealLimit,
  onSetTurnDuration,
  onEndTurn,
  onKickPlayer,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const activePlayers = room.players.filter(p => !p.isEliminated);
  const currentPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);

  async function handleNext() {
    setLoading("round");
    try { await onNextRound(); } finally { setLoading(null); }
  }

  async function handleLimit(delta: number) {
    const newLimit = room.cardRevealLimit + delta;
    if (newLimit < 1 || newLimit > 10) return;
    setLoading("limit");
    try { await onSetRevealLimit(newLimit); } finally { setLoading(null); }
  }

  async function handleDuration(delta: number) {
    const newDur = room.turnDurationSec + delta;
    if (newDur < 15 || newDur > 300) return;
    setLoading("duration");
    try { await onSetTurnDuration(newDur); } finally { setLoading(null); }
  }

  async function handleSkipTurn() {
    setLoading("skip");
    try { await onEndTurn(); } finally { setLoading(null); }
  }

  async function handleKick(player: Player) {
    if (!confirm(`${player.name}-г тоглоомоос хасах уу?`)) return;
    setLoading(`kick-${player.id}`);
    try { await onKickPlayer(player.id); } finally { setLoading(null); }
  }

  return (
    <div className="mx-4 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm font-bold"
        style={{
          background: open ? "hsl(16,85%,10%)" : "transparent",
          borderColor: open ? "hsl(16,85%,55%)" : "hsl(var(--border))",
          color: open ? "hsl(16,85%,65%)" : "hsl(var(--muted-foreground))",
        }}
      >
        <span>⚙️ Админ тохиргоо</span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 space-y-4">
          {/* Current turn + skip */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Одоогийн ярих ээлж
            </p>
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <span className="text-sm font-bold" style={{ color: "hsl(16,85%,65%)" }}>
                🎤 {currentPlayer?.name ?? "—"}
              </span>
              <button
                onClick={handleSkipTurn}
                disabled={loading === "skip"}
                className="px-3 py-1 rounded-md text-xs font-bold border border-border hover:border-primary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                ⏭ Ээлж алгасах
              </button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Card reveal limit */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Картын дэлгэх хязгаар (Үе бүрт)
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleLimit(-1)}
                disabled={room.cardRevealLimit <= 1 || loading === "limit"}
                className="w-9 h-9 rounded-lg bg-muted border border-border text-lg font-bold hover:border-primary transition-colors disabled:opacity-40"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black" style={{ color: "hsl(16,85%,55%)" }}>
                  {room.cardRevealLimit}
                </span>
                <span className="text-sm text-muted-foreground ml-2">карт / үе</span>
              </div>
              <button
                onClick={() => handleLimit(1)}
                disabled={room.cardRevealLimit >= 10 || loading === "limit"}
                className="w-9 h-9 rounded-lg bg-muted border border-border text-lg font-bold hover:border-primary transition-colors disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Turn duration */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Ярих цагийн уртын тохиргоо
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDuration(-15)}
                disabled={room.turnDurationSec <= 15 || loading === "duration"}
                className="w-9 h-9 rounded-lg bg-muted border border-border text-lg font-bold hover:border-primary transition-colors disabled:opacity-40"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black" style={{ color: "hsl(16,85%,55%)" }}>
                  {room.turnDurationSec}
                </span>
                <span className="text-sm text-muted-foreground ml-2">сек / тоглогч</span>
              </div>
              <button
                onClick={() => handleDuration(15)}
                disabled={room.turnDurationSec >= 300 || loading === "duration"}
                className="w-9 h-9 rounded-lg bg-muted border border-border text-lg font-bold hover:border-primary transition-colors disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Phase advance */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Тоглоомын удирдлага
            </p>
            <button
              onClick={async () => { setLoading("phase"); try { await onNextPhase(); } finally { setLoading(null); } }}
              disabled={loading === "phase"}
              className="w-full py-2.5 rounded-lg font-bold text-sm transition-all border"
              style={{
                background: "hsl(280,55%,40%)",
                borderColor: "hsl(280,55%,55%)",
                color: "white",
                opacity: loading === "phase" ? 0.6 : 1,
              }}
            >
              {loading === "phase" ? "..." : "⏭ Дараагийн шат руу шилжих"}
            </button>
            <button
              onClick={handleNext}
              disabled={loading === "round"}
              className="w-full py-2.5 rounded-lg font-bold text-sm transition-all border"
              style={{
                background: "hsl(16,85%,55%)",
                borderColor: "hsl(16,85%,55%)",
                color: "white",
                opacity: loading === "round" ? 0.6 : 1,
              }}
            >
              {loading === "round" ? "..." : `▶ ${room.round + 1}-Р ҮЕ ШУУД ЭХЛҮҮЛЭХ`}
            </button>
          </div>

          <div className="h-px bg-border" />

          {/* Kick players */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Тоглогч хасах (Kick)
            </p>
            <div className="space-y-1.5">
              {activePlayers.map(player => (
                <div key={player.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {player.name}
                      {player.id === room.currentTurnPlayerId && (
                        <span className="ml-2 text-xs" style={{ color: "hsl(16,85%,65%)" }}>🎤</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {player.roundRevealCount}/{player.effectiveLimit} карт дэлгэсэн
                      {player.roundDebt > 0 && <span className="text-amber-400 ml-1">(-{player.roundDebt} өр)</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleKick(player)}
                    disabled={loading === `kick-${player.id}`}
                    className="px-2.5 py-1 rounded-md text-xs font-bold border border-red-800 text-red-400 hover:bg-red-900/40 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    Хасах
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Balance info */}
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Үе шатны урсгал</p>
            <p>1️⃣ 🃏 Карт дэлгэх — ээлжээр (60с)</p>
            <p>2️⃣ 💬 Нийтийн нэг минут — нийт (60с)</p>
            <p>3️⃣ 👉 Хэн хасуулах вэ? — ээлжээр санал (30с)</p>
            <p>4️⃣ 🛡️ Өөрийгөө хамгаалах — ээлжээр (30с)</p>
            <p>5️⃣ ⚖️ Эцсийн санал — нийт (30с)</p>
          </div>
        </div>
      )}
    </div>
  );
}
