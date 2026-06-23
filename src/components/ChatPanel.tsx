import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  myPlayerId: string;
  onSend: (msg: string) => void;
}

export default function ChatPanel({ messages, myPlayerId, onSend }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Чат</h3>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Мессеж байхгүй байна</p>
        ) : messages.map((msg, i) => {
          const isMe = msg.playerId === myPlayerId;
          return (
            <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${isMe ? "bg-primary/20 border border-primary/30" : "bg-muted/60 border border-border"}`}>
                {!isMe && <p className="text-xs font-bold mb-0.5" style={{ color: `hsl(${(msg.playerId.charCodeAt(0) * 47) % 360}, 60%, 55%)` }}>{msg.playerName}</p>}
                <p className="text-sm text-foreground break-words">{msg.message}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 px-1">{formatTime(msg.timestamp)}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Мессеж бичих..."
          onKeyDown={e => e.key === "Enter" && handleSend()}
          maxLength={200}
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-2 rounded-lg text-white font-bold text-sm disabled:opacity-40"
          style={{ background: "hsl(16,85%,55%)" }}
        >
          →
        </button>
      </div>
    </div>
  );
}
