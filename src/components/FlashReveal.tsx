import { useState, useEffect } from "react";
import type { FlashCard } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/types";

interface Props {
  flashCards: FlashCard[];
}

function FlashCardItem({ flash }: { flash: FlashCard }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 3600);
    return () => clearTimeout(exitTimer);
  }, []);

  const icon = CATEGORY_ICONS[flash.card.category] || "🃏";

  return (
    <div className={`${exiting ? "flash-card-exit" : "flash-card-enter"}`}>
      <div className="bg-card border-2 rounded-2xl px-8 py-6 text-center shadow-2xl max-w-sm mx-auto"
        style={{ borderColor: "hsl(16,85%,55%)", boxShadow: "0 0 30px rgba(220,100,50,0.5), 0 0 60px rgba(220,100,50,0.2)" }}>
        <div className="text-4xl mb-2">{icon}</div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "hsl(16,85%,55%)" }}>
          {flash.playerName}
        </p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{flash.card.label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{flash.card.value}</p>
        {flash.card.action && (
          <p className="text-sm mt-3 leading-snug" style={{ color: "hsl(16,85%,65%)" }}>
            ⚡ {flash.card.action}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FlashReveal({ flashCards }: Props) {
  if (flashCards.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-50 gap-4 px-4">
      {flashCards.slice(-3).map(flash => (
        <FlashCardItem key={flash.id} flash={flash} />
      ))}
    </div>
  );
}
