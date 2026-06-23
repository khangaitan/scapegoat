import type { Player } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/types";

interface Props {
  player: Player;
  onClose: () => void;
}

export default function PlayerHistoryModal({ player, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md card-bg rounded-2xl neon-border p-6 z-10 slide-up max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">{player.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {player.isEliminated ? "❌ Хасагдсан" : "🟢 Тоглоомд байна"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mb-4" />

        {/* Revealed cards */}
        <div className="overflow-y-auto flex-1">
          {player.revealedCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-3xl mb-2">🃏</p>
              <p className="text-sm">Одоохондоо карт нээгээгүй байна</p>
            </div>
          ) : (
            <div className="space-y-2">
              {player.revealedCards.map((card, i) => (
                <div
                  key={`${card.category}-${i}`}
                  className="flex items-start gap-3 bg-muted/50 rounded-lg px-4 py-3 slide-up"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[card.category] || "🃏"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{card.label}</p>
                    <p className="text-sm text-foreground font-medium mt-0.5">{card.value}</p>
                    {card.action && (
                      <p className="text-xs mt-1 leading-snug" style={{ color: "hsl(16,85%,65%)" }}>
                        ⚡ {card.action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            {player.revealedCards.length} карт нээгдсэн ·
            Нийт 10 карт
          </p>
        </div>
      </div>
    </div>
  );
}
