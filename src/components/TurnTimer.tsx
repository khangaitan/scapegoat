import { useEffect, useState } from "react";

interface Props {
  endsAt: number | null;
  durationSec: number;
  isMyTurn: boolean;
  pausedRemainingMs?: number | null;
}

export default function TurnTimer({ endsAt, durationSec, isMyTurn, pausedRemainingMs }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const isPaused = pausedRemainingMs != null;
  const msLeft = isPaused
    ? pausedRemainingMs!
    : endsAt
    ? Math.max(0, endsAt - now)
    : null;

  if (msLeft == null) return null;

  const secLeft = Math.ceil(msLeft / 1000);
  const pct = Math.max(0, Math.min(100, (msLeft / (durationSec * 1000)) * 100));
  const isLow = !isPaused && secLeft <= 10;

  const color = isPaused
    ? "hsl(48,90%,60%)"
    : isLow
    ? "hsl(0,75%,55%)"
    : isMyTurn
    ? "hsl(16,85%,55%)"
    : "hsl(var(--muted-foreground))";

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" stroke="hsl(var(--muted))" strokeWidth="3" fill="none" />
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke={color}
            strokeWidth="3"
            fill="none"
            strokeDasharray={2 * Math.PI * 16}
            strokeDashoffset={2 * Math.PI * 16 * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.3s linear, stroke 0.3s" }}
          />
        </svg>
        <span
          className={`text-xs font-black ${isLow ? "animate-pulse" : ""}`}
          style={{ color }}
        >
          {isPaused ? "⏸" : secLeft}
        </span>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {isPaused ? `${secLeft}с зогссон` : "сек"}
      </span>
    </div>
  );
}
