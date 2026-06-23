import { useEffect, useState } from "react";
import { getRoundPhaseName } from "@/lib/types";

interface Props {
  round: number | null;
}

export default function RoundBanner({ round }: Props) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<number | null>(null);

  useEffect(() => {
    if (round === null) return;
    setDisplayed(round);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [round]);

  if (!visible || displayed === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
      style={{ animation: "roundBannerIn 0.5s cubic-bezier(.22,1,.36,1) both" }}
    >
      <div className="relative flex flex-col items-center gap-4">
        <div
          className="absolute inset-0 rounded-3xl blur-3xl opacity-40"
          style={{ background: "hsl(16,85%,55%)", transform: "scale(1.5)" }}
        />
        <div className="relative px-10 py-8 rounded-3xl border-2 neon-border bg-black/80 backdrop-blur-xl text-center">
          <p className="text-sm font-bold tracking-[0.3em] mb-1" style={{ color: "hsl(16,85%,65%)" }}>
            ШИНЭ ҮЕ
          </p>
          <p className="text-7xl font-black mb-2" style={{ color: "hsl(16,85%,55%)", textShadow: "0 0 40px hsl(16,85%,55%)" }}>
            {displayed}-Р ҮЕ
          </p>
          <p className="text-lg font-bold tracking-widest text-white/80 uppercase">
            {getRoundPhaseName(displayed)}
          </p>
        </div>
      </div>
      <style>{`
        @keyframes roundBannerIn {
          0% { opacity: 0; transform: scale(0.7); }
          60% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
