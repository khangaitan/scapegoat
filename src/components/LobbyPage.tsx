import { useState } from "react";
import RulesModal from "./RulesModal";

interface Props {
  onCreateRoom: (name: string, hostCode: string) => Promise<void>;
  onJoinRoom: (roomId: string, name: string) => Promise<void>;
  error: string | null;
  prefillRoomCode?: string;
  savedSession?: { roomId: string; playerName: string } | null;
  onForgetSession?: () => void;
}

export default function LobbyPage({ onCreateRoom, onJoinRoom, error, prefillRoomCode, savedSession, onForgetSession }: Props) {
  const [tab, setTab] = useState<"create" | "join">(prefillRoomCode ? "join" : "create");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState(prefillRoomCode ?? "");
  const [hostCode, setHostCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !hostCode.trim()) return;
    setLoading(true);
    try { await onCreateRoom(name.trim(), hostCode.trim().toUpperCase()); } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!name.trim() || !roomCode.trim()) return;
    setLoading(true);
    try { await onJoinRoom(roomCode.trim().toUpperCase(), name.trim()); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo / Title */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-muted-foreground text-sm tracking-widest uppercase">Амьд үлдэх нь таны</p>
        <h1 className="text-6xl font-black tracking-widest text-shadow-glow" style={{ color: "hsl(16,85%,55%)" }}>
          СОНГОЛТ
        </h1>
        <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: "hsl(16,85%,55%)" }} />
      </div>

      {/* Card */}
      <div className="w-full max-w-md card-bg rounded-xl neon-border p-8">
        {/* Tabs */}
        <div className="flex mb-8 bg-muted rounded-lg p-1">
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tab === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("create")}
          >
            Өрөө үүсгэх
          </button>
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tab === "join" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("join")}
          >
            Өрөөнд нэгдэх
          </button>
        </div>

        {/* Resume banner */}
        {savedSession && (
          <div className="mb-4 px-4 py-3 rounded-lg border text-sm slide-up flex items-center justify-between gap-2"
            style={{ background: "hsl(140,55%,18%,0.4)", borderColor: "hsl(140,55%,45%,0.6)", color: "hsl(140,70%,80%)" }}>
            <div className="flex-1">
              ↩️ Өмнөх тоглоом — <strong>{savedSession.roomId}</strong> ({savedSession.playerName})
            </div>
            <button
              onClick={async () => {
                setLoading(true);
                try { await onJoinRoom(savedSession.roomId, savedSession.playerName); } finally { setLoading(false); }
              }}
              disabled={loading}
              className="px-3 py-1 rounded-md text-xs font-bold disabled:opacity-50"
              style={{ background: "hsl(140,55%,45%)", color: "white" }}
            >
              Буцах
            </button>
            <button
              onClick={() => onForgetSession?.()}
              className="text-xs opacity-60 hover:opacity-100"
              title="Мартах"
            >
              ✕
            </button>
          </div>
        )}

        {/* Invite banner */}
        {prefillRoomCode && tab === "join" && (
          <div className="mb-4 px-4 py-3 rounded-lg border text-sm slide-up"
            style={{ background: "hsl(16,85%,55%,0.1)", borderColor: "hsl(16,85%,55%,0.4)", color: "hsl(16,85%,70%)" }}>
            🎮 <strong>{prefillRoomCode}</strong> өрөөнд урилга ирсэн байна — нэрээ оруулаад нэгдэнэ үү!
          </div>
        )}

        {/* Name field (shared) */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Таны нэр
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Нэрээ оруулна уу..."
            maxLength={20}
            autoFocus
            className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            onKeyDown={e => e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())}
          />
        </div>

        {tab === "join" && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Өрөөний код
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={8}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono text-lg tracking-widest text-center uppercase"
              onKeyDown={e => e.key === "Enter" && handleJoin()}
            />
          </div>
        )}

        {tab === "create" && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Хост код
            </label>
            <input
              type="text"
              value={hostCode}
              onChange={e => setHostCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              maxLength={20}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono text-lg tracking-widest text-center uppercase"
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Хост код худалдан авсан хүн л өрөө үүсгэх боломжтой. Нэг код = нэг тоглоом.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-destructive/20 border border-destructive/50 rounded-lg text-sm text-destructive-foreground slide-up">
            {error}
          </div>
        )}

        <button
          onClick={tab === "create" ? handleCreate : handleJoin}
          disabled={loading || !name.trim() || (tab === "join" && !roomCode.trim()) || (tab === "create" && !hostCode.trim())}
          className="w-full py-3 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground"
          style={{ background: "hsl(16,85%,55%)" }}
        >
          {loading ? "Уншиж байна..." : tab === "create" ? "Өрөө үүсгэх" : "Нэгдэх"}
        </button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        Чи амьд үлдэх үү, эсвэл хасагдах уу?
      </p>

      <button
        onClick={() => setRulesOpen(true)}
        className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
      >
        📖 Тоглоомын дүрэм
      </button>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
