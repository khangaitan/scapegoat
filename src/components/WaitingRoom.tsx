import { useState } from "react";
import type { GameRoom } from "@/lib/types";
import RulesModal from "./RulesModal";

interface Props {
  room: GameRoom | null;
  myPlayerId: string;
  onStartGame: () => Promise<void>;
  onGoHome: () => void;
}

export default function WaitingRoom({ room, myPlayerId, onStartGame, onGoHome }: Props) {
  const [copied, setCopied] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">Өрөө ачааллаж байна...</div>
      </div>
    );
  }

  const me = room.players.find(p => p.id === myPlayerId);
  const isHost = me?.isHost;
  const playerCount = room.players.length;
  const canStart = playerCount >= 2;

  const inviteLink = `${window.location.origin}${window.location.pathname}?room=${room.id}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the text
      const el = document.getElementById("invite-link-input") as HTMLInputElement;
      el?.select();
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      {/* Top-right controls */}
      <div className="fixed top-4 right-4 z-30 flex gap-2">
        <button
          onClick={() => setRulesOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all text-sm font-semibold"
        >
          📖 Дүрэм
        </button>
        <button
          onClick={() => { if (confirm("Нүүр хуудас руу буцах уу? Тоглоомоос гарна.")) onGoHome(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all text-sm font-semibold"
        >
          ← Нүүр
        </button>
      </div>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-widest" style={{ color: "hsl(16,85%,55%)" }}>СОНГОЛТ</h1>
          <p className="text-muted-foreground text-sm mt-1">Тоглоом эхлэхийг хүлээж байна</p>
        </div>

        {/* Room code + invite link */}
        <div className="card-bg rounded-xl neon-border p-6 mb-6">
          <div className="text-center mb-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Өрөөний код</p>
            <p className="text-5xl font-black font-mono tracking-widest" style={{ color: "hsl(16,85%,55%)" }}>
              {room.id}
            </p>
          </div>

          {/* Shareable invite link */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">
              🔗 Урилгын линк
            </p>
            <div className="flex gap-2">
              <input
                id="invite-link-input"
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary truncate cursor-text"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={copyLink}
                className="flex-shrink-0 px-4 py-2.5 rounded-lg font-bold text-sm transition-all text-white"
                style={{
                  background: copied ? "hsl(140,60%,40%)" : "hsl(16,85%,55%)",
                }}
              >
                {copied ? "✓ Хуулагдсан!" : "Хуулах"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Энэ линкийг найзуудадаа илгээхэд тэд өрөөний кодоо автоматаар оруулна
            </p>
          </div>
        </div>

        {/* Player list */}
        <div className="card-bg rounded-xl neon-border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-foreground">Тоглогчид</h2>
            <span className="text-sm text-muted-foreground">{playerCount} / 16</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {room.players.map((player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 slide-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: `hsl(${(i * 47) % 360}, 60%, 45%)` }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
                  {player.isHost && <p className="text-xs text-amber-400">Хост</p>}
                  {player.id === myPlayerId && <p className="text-xs text-accent">Та</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Start button (host only) */}
        {isHost ? (
          <div>
            {!canStart && (
              <p className="text-center text-sm text-muted-foreground mb-3">
                Хамгийн багадаа 2 тоглогч хэрэгтэй ({playerCount}/2)
              </p>
            )}
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className="w-full py-4 font-black text-lg rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white glow-pulse"
              style={{ background: canStart ? "hsl(16,85%,55%)" : "hsl(220,15%,25%)" }}
            >
              🚨 ТОГЛООМ ЭХЛҮҮЛЭХ
            </button>
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm">
            Хост тоглоом эхлүүлэхийг хүлээж байна...
          </p>
        )}
      </div>
    </div>
  );
}
