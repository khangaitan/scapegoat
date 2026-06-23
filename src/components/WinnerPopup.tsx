import { useState } from "react";
import type { GameRoom, Player } from "@/lib/types";

interface Props {
  room: GameRoom;
  onGoHome: () => void;
}

export default function WinnerPopup({ room, onGoHome }: Props) {
  const survivors = room.players.filter(p => !p.isEliminated);
  const eliminated = room.players.filter(p => p.isEliminated);

  const [story, setStory] = useState<string>("");
  const [loadingStory, setLoadingStory] = useState(false);
  const [storyError, setStoryError] = useState<string>("");

  const getProfession = (player: Player) => {
    const profCard = player.revealedCards.find(c => c.category === "profession");
    return profCard?.value ?? player.hand?.profession ?? "—";
  };

  async function generateStory() {
    setLoadingStory(true);
    setStoryError("");
    try {
      const payload = {
        survivors: survivors.map(p => ({
          name: p.name,
          cards: p.revealedCards.map(c => ({ label: c.label, value: c.value })),
        })),
        eliminated: eliminated.map(p => ({
          name: p.name,
          cards: p.revealedCards.map(c => ({ label: c.label, value: c.value })),
        })),
        disaster: room.disaster ? { name: room.disaster.name, description: room.disaster.description } : null,
        bunker: room.bunker ? { description: room.bunker.description } : null,
      };
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Серверийн алдаа");
      }
      const data = await res.json();
      setStory(data.story || "");
    } catch (e: any) {
      setStoryError(e.message || "Өгүүллэг үүсгэж чадсангүй");
    } finally {
      setLoadingStory(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-3xl border-2 z-10 overflow-hidden my-8"
        style={{
          borderColor: "hsl(16,85%,55%)",
          background: "linear-gradient(135deg, hsl(16,85%,5%) 0%, #0a0a0a 100%)",
          boxShadow: "0 0 80px hsl(16,85%,30%), 0 0 30px hsl(16,85%,20%)",
          animation: "winnerIn 0.6s cubic-bezier(.22,1,.36,1) both",
        }}
      >
        {/* Header */}
        <div className="relative text-center px-6 pt-8 pb-6">
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(16,85%,20%) 0%, transparent 70%)" }}
          />
          <p className="relative text-4xl mb-2">🏆</p>
          <h1 className="relative text-2xl font-black tracking-widest" style={{ color: "hsl(16,85%,65%)" }}>
            БАЯР ХҮРГЭЕ!
          </h1>
          <p className="relative text-base font-bold text-white/80 mt-1">
            АМЬД ҮЛДЭГСЭД ТОДОРЛОО
          </p>
          <div className="relative mt-3 text-xs text-muted-foreground">
            {eliminated.length} тоглогч хасагдсан · {survivors.length} тоглогч амьд үлдлээ
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mx-6" style={{ background: "hsl(16,85%,30%)" }} />

        {/* Survivors with FULL revealed cards */}
        <div className="px-6 py-5 space-y-3 max-h-[55vh] overflow-y-auto">
          {survivors.map((player, i) => (
            <div
              key={player.id}
              className="rounded-xl p-4 border"
              style={{
                background: "hsl(16,85%,8%)",
                borderColor: "hsl(16,85%,30%)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
                  style={{ background: "hsl(16,85%,20%)", color: "hsl(16,85%,65%)" }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base text-white">{player.name}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "hsl(16,85%,65%)" }}>
                    💼 {getProfession(player)}
                  </p>

                  {player.revealedCards.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      {player.revealedCards.map(card => (
                        <div
                          key={card.category}
                          className="rounded-lg border border-border/60 p-2 text-xs"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{card.label}</p>
                          <p className="text-white font-semibold leading-snug mt-0.5">{card.value}</p>
                          {card.action && (
                            <p className="mt-1 text-[10px] leading-snug" style={{ color: "hsl(16,85%,65%)" }}>
                              ⚡ {card.action}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic mt-2">Карт нээгээгүй</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bunker info */}
        {room.bunker && (
          <div className="mx-6 mb-4 rounded-xl p-3 border border-blue-800/60 bg-blue-950/30">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-1">🏗️ Тэдний бункер</p>
            <p className="text-xs text-blue-200 leading-relaxed">{room.bunker.description}</p>
          </div>
        )}

        {/* Story section */}
        <div className="mx-6 mb-4 rounded-xl p-4 border border-purple-800/60 bg-purple-950/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-purple-300 uppercase tracking-wide">📖 Тэдний түүх</p>
            <button
              onClick={generateStory}
              disabled={loadingStory}
              className="text-xs px-3 py-1 rounded-md font-bold border border-purple-600 text-purple-200 hover:bg-purple-900/40 disabled:opacity-50"
            >
              {loadingStory ? "Бичиж байна..." : story ? "Дахин бичих" : "✨ Түүх үүсгэх"}
            </button>
          </div>
          {storyError && <p className="text-xs text-red-400 mt-1">{storyError}</p>}
          {story && (
            <p className="text-sm text-purple-100/90 leading-relaxed whitespace-pre-wrap mt-2">
              {story}
            </p>
          )}
          {!story && !loadingStory && !storyError && (
            <p className="text-[11px] text-purple-300/60 italic">
              Тоглогчдын картууд дээр үндэслэн AI богино өгүүллэг бичнэ.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onGoHome}
            className="w-full py-3 rounded-xl font-black text-sm tracking-wider transition-all border"
            style={{
              background: "hsl(16,85%,55%)",
              borderColor: "hsl(16,85%,55%)",
              color: "white",
            }}
          >
            🏠 НҮҮР ХУУДАС РУУ БУЦАХ
          </button>
        </div>
      </div>

      <style>{`
        @keyframes winnerIn {
          0% { opacity: 0; transform: scale(0.85) translateY(30px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
