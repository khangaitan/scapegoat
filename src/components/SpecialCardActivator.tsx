import { useState } from "react";
import type { Player, RevealedCard, SpecialCardTarget } from "@/lib/types";
import { SPECIAL_CARD_TARGET } from "@/lib/types";

type Slot = "specialCard1" | "specialCard2";

interface PendingSpecial {
  ownerId: string;
  ownerName: string;
  slot: Slot;
  card: RevealedCard;
  targetType: SpecialCardTarget;
  isMine: boolean;
}

interface Props {
  players: Player[];
  myPlayerId: string;
  isHost: boolean;
  onRequest: (slot: Slot) => Promise<void>;
  onActivate: (ownerId: string, slot: Slot, targetId?: string) => Promise<void>;
}

export default function SpecialCardActivator({
  players,
  myPlayerId,
  isHost,
  onRequest,
  onActivate,
}: Props) {
  const [picking, setPicking] = useState<PendingSpecial | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const all: PendingSpecial[] = [];
  for (const p of players) {
    if (p.isEliminated && !isHost) continue;
    for (const card of p.revealedCards) {
      if ((card.category === "specialCard1" || card.category === "specialCard2") && !card.activated && card.cardId) {
        all.push({
          ownerId: p.id,
          ownerName: p.name,
          slot: card.category,
          card,
          targetType: SPECIAL_CARD_TARGET[card.cardId] ?? "none",
          isMine: p.id === myPlayerId,
        });
      }
    }
  }

  // Players see only their own cards. Host sees everyone's, requested ones first.
  const pending = isHost
    ? all.sort((a, b) => Number(!!b.card.requested) - Number(!!a.card.requested))
    : all.filter(c => c.isMine);

  if (pending.length === 0) return null;

  async function activate(ps: PendingSpecial, targetId?: string) {
    setBusy(true);
    setError(null);
    try {
      await onActivate(ps.ownerId, ps.slot, targetId);
      setPicking(null);
    } catch (e: any) {
      setError(e.message || "Идэвхжүүлж чадсангүй");
      setTimeout(() => setError(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  async function request(ps: PendingSpecial) {
    setBusy(true);
    setError(null);
    try {
      await onRequest(ps.slot);
    } catch (e: any) {
      setError(e.message || "Хүсэлт илгээж чадсангүй");
      setTimeout(() => setError(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  function handleHostClick(ps: PendingSpecial) {
    if (ps.targetType === "none") activate(ps);
    else setPicking(ps);
  }

  function getTargetCandidates(ps: PendingSpecial): Player[] {
    if (ps.targetType === "eliminatedPlayer") return players.filter(p => p.isEliminated);
    if (ps.targetType === "otherPlayer") return players.filter(p => !p.isEliminated && p.id !== ps.ownerId);
    if (ps.targetType === "anyPlayer") return players.filter(p => !p.isEliminated);
    return [];
  }

  const requestedCount = all.filter(c => c.card.requested).length;
  const headerLabel = isHost
    ? `Тусгай карт${requestedCount > 0 ? ` — ${requestedCount} хүсэлт` : ""} (${pending.length})`
    : `Миний тусгай карт (${pending.length})`;

  return (
    <div className="mx-4 my-3 rounded-xl border-2 overflow-hidden"
      style={{ borderColor: "hsl(16,85%,55%)", background: "hsl(16,85%,8%)" }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{requestedCount > 0 && isHost ? "🙋" : "⚡"}</span>
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: "hsl(16,85%,75%)" }}>
            {headerLabel}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {error && (
            <div className="rounded-md px-2 py-1.5 text-xs font-semibold border border-red-800/60 bg-red-950/40 text-red-300">
              {error}
            </div>
          )}
          {pending.map((ps, i) => {
            const requested = !!ps.card.requested;
            return (
              <div
                key={`${ps.ownerId}-${ps.slot}-${i}`}
                className="rounded-lg border p-2.5"
                style={{
                  borderColor: requested ? "hsl(16,85%,55%)" : "hsl(var(--border))",
                  background: requested ? "hsl(16,85%,12%)" : "hsl(var(--card) / 0.6)",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      {requested && <span>🙋</span>}
                      {ps.ownerName}{ps.isMine && " (та)"}
                    </p>
                    <p className="text-xs font-bold text-foreground leading-tight">{ps.card.value}</p>
                  </div>

                  {isHost ? (
                    <button
                      onClick={() => handleHostClick(ps)}
                      disabled={busy}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                      style={{
                        background: "hsl(16,85%,30%)",
                        borderColor: "hsl(16,85%,55%)",
                        color: "hsl(16,85%,90%)",
                      }}
                    >
                      {ps.targetType === "none" ? "⚡ Идэвхжүүлэх" : "🎯 Сонгох"}
                    </button>
                  ) : (
                    <button
                      onClick={() => request(ps)}
                      disabled={busy}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                      style={
                        requested
                          ? { background: "hsl(var(--muted) / 0.4)", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                          : { background: "hsl(16,85%,30%)", borderColor: "hsl(16,85%,55%)", color: "hsl(16,85%,90%)" }
                      }
                    >
                      {requested ? "✕ Цуцлах" : "🙋 Хүсэлт"}
                    </button>
                  )}
                </div>
                {ps.card.action && (
                  <p className="text-[10px] leading-snug" style={{ color: "hsl(16,85%,65%)" }}>
                    {ps.card.action}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Target picker modal — host only */}
      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => !busy && setPicking(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-card p-4"
            style={{ borderColor: "hsl(16,85%,55%)" }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {picking.ownerName} — {picking.card.value}
            </p>
            {picking.card.action && (
              <p className="text-xs mt-1.5 mb-3 leading-snug" style={{ color: "hsl(16,85%,65%)" }}>
                ⚡ {picking.card.action}
              </p>
            )}
            <p className="text-xs font-bold mb-2 text-foreground">Зорилтот тоглогч сонго:</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {getTargetCandidates(picking).map(t => (
                <button
                  key={t.id}
                  onClick={() => activate(picking, t.id)}
                  disabled={busy}
                  className="w-full text-left text-sm font-semibold px-3 py-2 rounded-md border border-border bg-card/80 hover:border-primary disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {t.isEliminated && <span className="text-xs text-muted-foreground mr-1">💀</span>}
                  {t.name}
                </button>
              ))}
              {getTargetCandidates(picking).length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Зорилтот тоглогч байхгүй</p>
              )}
            </div>
            <button
              onClick={() => setPicking(null)}
              disabled={busy}
              className="w-full mt-3 text-xs font-semibold px-3 py-2 rounded-md border border-border bg-muted/40 disabled:opacity-50"
            >
              Болих
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
