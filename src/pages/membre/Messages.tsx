import { useState, useEffect, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import MemberNav from "../../components/MemberNav";
import { sendMessage, listMessages, getMyCoach } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Coach {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Message {
  id: string;
  from_id: string;
  to_id: string;
  content: string;
  created_at: string;
  read: boolean;
  pinned: boolean;
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (now.toDateString() === d.toDateString())
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString())
    return `Hier · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return `${d.toLocaleDateString("fr-FR")} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MemberMessages() {
  const sendFn = useServerFn(sendMessage);
  const msgsFn = useServerFn(listMessages);
  const coachFn = useServerFn(getMyCoach);

  const [coach, setCoach] = useState<Coach | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await coachFn({});
        setCoach(r.coach as Coach | null);
      } catch (e: any) {
        toast.error(e.message ?? "Impossible de trouver ton coach");
      } finally {
        setLoading(false);
      }
    })();
  }, [coachFn]);

  const loadMessages = useCallback(async (partnerId: string) => {
    try {
      const r = await msgsFn({ data: { partner_id: partnerId } });
      setMessages(r.messages as Message[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  }, [msgsFn]);

  useEffect(() => { if (coach) loadMessages(coach.id); }, [coach, loadMessages]);

  // Realtime
  useEffect(() => {
    if (!coach || !currentUserId) return;
    const ch = supabase.channel(`user:${currentUserId}:msgs`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (
          (m.from_id === currentUserId && m.to_id === coach.id) ||
          (m.from_id === coach.id && m.to_id === currentUserId)
        ) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coach, currentUserId]);

  const handleSend = async () => {
    if (!body.trim() || !coach || sending) return;
    setSending(true);
    const text = body.trim();
    const optimistic: Message = {
      id: "opt-" + Date.now(), from_id: currentUserId ?? "", to_id: coach.id,
      content: text, created_at: new Date().toISOString(), read: false, pinned: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      await sendFn({ data: { to_user_id: coach.id, body: text } });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur envoi");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="cst-screen" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#16261A" }}>
        <div style={{ fontFamily: "var(--cst-display)", fontSize: 22, fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
          MESSAGES
        </div>
        {coach && (
          <div style={{ fontSize: 12, color: "var(--cst-text-muted)", marginTop: 4 }}>
            Avec {coach.first_name} {coach.last_name}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="cst-scroll" style={{ flex: 1, padding: "16px 16px 80px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "var(--cst-text-muted)", fontSize: 13, marginTop: 40 }}>
            Chargement…
          </div>
        )}
        {!loading && !coach && (
          <div style={{ textAlign: "center", color: "var(--cst-text-muted)", fontSize: 13, marginTop: 40 }}>
            Aucun coach disponible pour le moment.
          </div>
        )}
        {!loading && coach && messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--cst-text-muted)", fontSize: 13, marginTop: 40 }}>
            Pas encore de message. Dis bonjour à {coach.first_name} 👋
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.from_id === currentUserId;
          const showTime = i === 0 || (new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime()) > 5 * 60000;
          return (
            <div key={m.id}>
              {showTime && (
                <div style={{ textAlign: "center", fontFamily: "var(--cst-mono)", fontSize: 9, color: "var(--cst-text-muted)", margin: "8px 0" }}>
                  {relTime(m.created_at)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "78%", padding: "10px 14px",
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isMe ? "var(--cst-mid-green)" : "#243029",
                  border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                }}>
                  {m.content}
                  {m.pinned && <span style={{ marginLeft: 6, fontSize: 12 }}>📌</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {coach && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 64,
          padding: "10px 16px", display: "flex", gap: 8, alignItems: "flex-end",
          background: "var(--cst-dark-green, #0F1B11)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <textarea
            className="cst-input"
            rows={1}
            placeholder={`Écrire à ${coach.first_name}…`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, resize: "none", fontSize: 14, padding: "10px 14px", minHeight: 44 }}
          />
          <button
            className="cst-btn cst-btn-primary"
            onClick={handleSend}
            disabled={sending || !body.trim()}
            style={{ minHeight: 44, padding: "10px 18px", opacity: !body.trim() || sending ? 0.5 : 1 }}
          >
            ↑
          </button>
        </div>
      )}

      <MemberNav />
    </div>
  );
}
