import { useEffect } from "react";
import { GAME_RULES_MN } from "@/lib/rules";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RulesModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col card-bg rounded-2xl neon-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-black tracking-widest text-sm uppercase" style={{ color: "hsl(16,85%,55%)" }}>
            📖 Тоглоомын дүрэм
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
            aria-label="Хаах"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
            {GAME_RULES_MN}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all"
            style={{ background: "hsl(16,85%,55%)" }}
          >
            Ойлголоо
          </button>
        </div>
      </div>
    </div>
  );
}
