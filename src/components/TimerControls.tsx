import { useState } from "react";

interface Props {
  isPaused: boolean;
  isRunning: boolean;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
  size?: "sm" | "md";
}

export default function TimerControls({
  isPaused,
  isRunning,
  onPause,
  onResume,
  onStop,
  onRestart,
  size = "md",
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try { await fn(); } catch { /* swallow */ }
    finally { setLoading(null); }
  }

  const btnSize = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";

  const isStopped = !isRunning && !isPaused;

  return (
    <div className="flex items-center gap-1">
      {isStopped ? (
        <button
          onClick={() => run("restart", onRestart)}
          disabled={loading === "restart"}
          className={`${btnSize} rounded-md flex items-center justify-center font-black border transition-all disabled:opacity-40`}
          style={{
            background: "hsl(140,55%,18%)",
            borderColor: "hsl(140,55%,45%)",
            color: "hsl(140,70%,80%)",
          }}
          title="Цаг сэргээж тоглоомыг үргэлжлүүлэх"
        >
          ▶
        </button>
      ) : isPaused ? (
        <button
          onClick={() => run("resume", onResume)}
          disabled={loading === "resume"}
          className={`${btnSize} rounded-md flex items-center justify-center font-black border transition-all disabled:opacity-40`}
          style={{
            background: "hsl(140,55%,18%)",
            borderColor: "hsl(140,55%,45%)",
            color: "hsl(140,70%,80%)",
          }}
          title="Үргэлжлүүлэх"
        >
          ▶
        </button>
      ) : (
        <button
          onClick={() => run("pause", onPause)}
          disabled={loading === "pause" || !isRunning}
          className={`${btnSize} rounded-md flex items-center justify-center font-black border transition-all disabled:opacity-40`}
          style={{
            background: "hsl(48,80%,18%)",
            borderColor: "hsl(48,80%,45%)",
            color: "hsl(48,90%,75%)",
          }}
          title="Зогсоох"
        >
          ⏸
        </button>
      )}
      <button
        onClick={() => run("stop", onStop)}
        disabled={loading === "stop" || (!isRunning && !isPaused)}
        className={`${btnSize} rounded-md flex items-center justify-center font-black border transition-all disabled:opacity-40`}
        style={{
          background: "hsl(0,60%,18%)",
          borderColor: "hsl(0,60%,45%)",
          color: "hsl(0,80%,80%)",
        }}
        title="Цаг бүрэн зогсооно"
      >
        ⏹
      </button>
    </div>
  );
}
