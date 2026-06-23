import { useEffect, useState } from "react";

interface HostCode {
  code: string;
  createdAt: string | number | Date;
  note: string | null;
  usedAt: string | number | Date | null;
  usedByName: string | null;
  roomId: string | null;
}

const TOKEN_KEY = "songolt_admin_token";
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function AdminPage() {
  const [token, setToken] = useState<string>(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  });
  const [tokenInput, setTokenInput] = useState("");
  const [codes, setCodes] = useState<HostCode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCopied, setJustCopied] = useState<string | null>(null);

  async function fetchCodes(t: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/codes`, {
        headers: { "x-admin-token": t },
      });
      if (res.status === 401) {
        setError("Токен буруу байна.");
        setCodes(null);
        try { localStorage.removeItem(TOKEN_KEY); } catch {}
        setToken("");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCodes(data.codes || []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchCodes(token);
  }, [token]);

  function handleLogin() {
    if (!tokenInput.trim()) return;
    // Strip any non-ASCII characters — HTTP headers must be ISO-8859-1 only.
    const t = tokenInput.trim().replace(/[^\x20-\x7E]/g, "");
    if (!t) return;
    try { localStorage.setItem(TOKEN_KEY, t); } catch {}
    setToken(t);
    setTokenInput("");
  }

  function handleLogout() {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setToken("");
    setCodes(null);
  }

  async function handleGenerate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNote("");
      await fetchCodes(token);
    } catch (e: any) {
      setError(e?.message || "Үүсгэж чадсангүй");
    } finally {
      setCreating(false);
    }
  }

  function copy(code: string) {
    try {
      navigator.clipboard.writeText(code);
      setJustCopied(code);
      setTimeout(() => setJustCopied(c => (c === code ? null : c)), 1200);
    } catch {}
  }

  function fmt(d: string | number | Date | null): string {
    if (!d) return "—";
    try { return new Date(d).toLocaleString("mn-MN"); } catch { return String(d); }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm card-bg rounded-xl neon-border p-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "hsl(16,85%,55%)" }}>Админ нэвтрэх</h1>
          <p className="text-xs text-muted-foreground mb-4">Хост кодын удирдлага</p>
          <input
            type="password"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          {error && <div className="mb-3 text-sm text-destructive">{error}</div>}
          <button
            onClick={handleLogin}
            disabled={!tokenInput.trim()}
            className="w-full py-2 font-bold rounded-lg disabled:opacity-50 text-primary-foreground"
            style={{ background: "hsl(16,85%,55%)" }}
          >
            Нэвтрэх
          </button>
        </div>
      </div>
    );
  }

  const unused = codes?.filter(c => !c.usedAt) || [];
  const used = codes?.filter(c => c.usedAt) || [];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-wider" style={{ color: "hsl(16,85%,55%)" }}>СОНГОЛТ — Админ</h1>
            <p className="text-xs text-muted-foreground mt-1">Хост кодын удирдлага</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground">Гарах</button>
        </div>

        <div className="card-bg rounded-xl neon-border p-5 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Шинэ код үүсгэх</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Тэмдэглэл (заавал биш) — жнь: худалдан авагчийн нэр"
              maxLength={200}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={e => e.key === "Enter" && handleGenerate()}
            />
            <button
              onClick={handleGenerate}
              disabled={creating}
              className="px-5 py-2 font-bold rounded-lg disabled:opacity-50 text-primary-foreground whitespace-nowrap"
              style={{ background: "hsl(16,85%,55%)" }}
            >
              {creating ? "..." : "+ Үүсгэх"}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-destructive/20 border border-destructive/50 rounded-lg text-sm text-destructive-foreground">{error}</div>}
        {loading && !codes && <div className="text-center py-12 text-muted-foreground">Уншиж байна...</div>}

        {codes && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6 text-center">
              <div className="card-bg rounded-lg p-3"><div className="text-2xl font-bold">{codes.length}</div><div className="text-xs text-muted-foreground">Нийт</div></div>
              <div className="card-bg rounded-lg p-3"><div className="text-2xl font-bold" style={{ color: "hsl(140,55%,55%)" }}>{unused.length}</div><div className="text-xs text-muted-foreground">Ашиглаагүй</div></div>
              <div className="card-bg rounded-lg p-3"><div className="text-2xl font-bold text-muted-foreground">{used.length}</div><div className="text-xs text-muted-foreground">Ашигласан</div></div>
            </div>

            <div className="card-bg rounded-xl neon-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h2 className="text-sm font-semibold uppercase tracking-wider">Кодууд</h2>
              </div>
              {codes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Одоогоор код байхгүй байна.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2">Код</th>
                        <th className="text-left px-4 py-2">Төлөв</th>
                        <th className="text-left px-4 py-2">Тэмдэглэл</th>
                        <th className="text-left px-4 py-2">Үүссэн</th>
                        <th className="text-left px-4 py-2">Ашигласан</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...unused, ...used].map(c => (
                        <tr key={c.code} className="border-t border-border/50">
                          <td className="px-4 py-2">
                            <button
                              onClick={() => copy(c.code)}
                              className="font-mono text-base font-bold tracking-wider hover:underline"
                              style={{ color: c.usedAt ? "hsl(0,0%,55%)" : "hsl(16,85%,60%)" }}
                              title="Хуулах"
                            >
                              {c.code}
                            </button>
                            {justCopied === c.code && <span className="ml-2 text-[10px]" style={{ color: "hsl(140,55%,55%)" }}>хуулагдлаа</span>}
                          </td>
                          <td className="px-4 py-2">
                            {c.usedAt ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Ашигласан</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(140,55%,18%)", color: "hsl(140,70%,75%)" }}>Бэлэн</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{c.note || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{fmt(c.createdAt)}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">
                            {c.usedAt ? (
                              <div>
                                <div>{fmt(c.usedAt)}</div>
                                {c.usedByName && <div className="opacity-70">{c.usedByName}{c.roomId ? ` · ${c.roomId}` : ""}</div>}
                              </div>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
