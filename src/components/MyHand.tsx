import { useState } from "react";
import type { PlayerHand, CardCategory } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/types";

interface Props {
  hand: PlayerHand;
  revealedCategories: CardCategory[];
  isMyTurn: boolean;
  round: number;
  effectiveLimit: number;
  roundRevealCount: number;
  onReveal: (category: CardCategory) => Promise<void>;
}

const ALL_CATEGORIES: CardCategory[] = [
  "profession", "health", "ageGender", "hobby", "personality",
  "specialCard1", "specialCard2", "phobia", "extraInfo", "bagItem"
];

export default function MyHand({
  hand,
  revealedCategories,
  isMyTurn,
  round,
  effectiveLimit,
  roundRevealCount,
  onReveal,
}: Props) {
  const [revealing, setRevealing] = useState<CardCategory | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasProfession = revealedCategories.includes("profession");
  const remainingThisRound = effectiveLimit - roundRevealCount;
  const round1NeedsProfession = round === 1 && !hasProfession && remainingThisRound <= 1;
  const limitReached = effectiveLimit > 0 && roundRevealCount >= effectiveLimit;
  const blockedByDebt = effectiveLimit === 0;

  function isCardDisabled(cat: CardCategory): boolean {
    if (revealedCategories.includes(cat)) return true;
    if (revealing) return true;
    if (!isMyTurn) return true;
    // Special cards don't burn a slot, so the per-round limit doesn't gate them.
    const isSpecial = cat === "specialCard1" || cat === "specialCard2";
    if (!isSpecial) {
      if (blockedByDebt) return true;
      if (limitReached) return true;
      if (round1NeedsProfession && cat !== "profession") return true;
    }
    return false;
  }

  async function handleReveal(cat: CardCategory) {
    if (isCardDisabled(cat)) return;
    setRevealing(cat);
    setErrorMsg(null);
    try {
      await onReveal(cat);
    } catch (e: any) {
      setErrorMsg(e.message || "Карт нээж чадсангүй");
      setTimeout(() => setErrorMsg(null), 3500);
    } finally {
      setRevealing(null);
    }
  }

  const handValues: Record<CardCategory, string> = {
    profession: hand.profession,
    health: hand.health,
    ageGender: hand.ageGender,
    hobby: hand.hobby,
    personality: hand.personality,
    specialCard1: hand.specialCard1,
    specialCard2: hand.specialCard2,
    phobia: hand.phobia,
    extraInfo: hand.extraInfo,
    bagItem: hand.bagItem,
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Миний картууд
        </h3>
        {!isMyTurn && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border">
            Таны ээлж биш
          </span>
        )}
        {isMyTurn && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md border"
            style={{ background: "hsl(16,85%,15%)", borderColor: "hsl(16,85%,55%)", color: "hsl(16,85%,65%)" }}
          >
            ЯРИХ ЭЭЛЖ
          </span>
        )}
      </div>

      {/* Status hints */}
      {round1NeedsProfession && isMyTurn && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold border border-amber-800/60 bg-amber-950/30 text-amber-300">
          ⚠️ Эхний үед "Мэргэжил" картаа заавал дэлгэх ёстой. Сүүлийн үлдсэн дэлгэх боломжоо ашиглана уу.
        </div>
      )}
      {blockedByDebt && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold border border-red-800/60 bg-red-950/30 text-red-300">
          🚫 Өмнөх үед хязгаараас илүү дэлгэсэн тул энэ үед карт дэлгэх эрхгүй.
        </div>
      )}
      {!isMyTurn && !blockedByDebt && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border bg-muted/30">
          Өөр тоглогчийн ярих ээлж явагдаж байна. Таны ээлж ирэхийг хүлээнэ үү.
        </div>
      )}
      {errorMsg && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold border border-red-800/60 bg-red-950/40 text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {ALL_CATEGORIES.map(cat => {
          const isRevealed = revealedCategories.includes(cat);
          const isLoading = revealing === cat;
          const disabled = isCardDisabled(cat);
          const mustChooseProf = round1NeedsProfession && cat === "profession" && isMyTurn;
          return (
            <button
              key={cat}
              onClick={() => handleReveal(cat)}
              disabled={disabled}
              className={`relative flex flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-all duration-200 border ${
                isRevealed
                  ? "bg-muted/30 border-border opacity-60 cursor-default"
                  : disabled
                  ? "bg-card/40 border-border opacity-40 cursor-not-allowed"
                  : mustChooseProf
                  ? "bg-card border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-95"
                  : "bg-card border-border hover:border-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                {isRevealed && (
                  <span className="text-xs px-1.5 py-0.5 rounded text-green-400 bg-green-400/10 font-medium">
                    ✓
                  </span>
                )}
                {mustChooseProf && !isRevealed && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Заавал
                  </span>
                )}
                {isLoading && (
                  <span className="text-xs text-muted-foreground animate-spin">⟳</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-semibold">
                {CATEGORY_LABELS[cat]}
              </p>
              <p className={`text-xs font-bold leading-tight ${isRevealed ? "text-muted-foreground" : "text-foreground"}`}>
                {handValues[cat]}
              </p>
              {(cat === "specialCard1" || cat === "specialCard2") && (
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: "hsl(16,85%,65%)" }}>
                  ⚡ {cat === "specialCard1" ? hand.specialCard1Action : hand.specialCard2Action}
                </p>
              )}
              {!isRevealed && !disabled && (
                <p className="text-xs mt-1 font-semibold" style={{ color: "hsl(16,85%,55%)" }}>
                  Нээх →
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
