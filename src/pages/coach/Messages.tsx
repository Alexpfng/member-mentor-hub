import { useState, useEffect, useRef, useCallback } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useSearch } from '@tanstack/react-router';
import CoachSidebar from '../../components/CoachSidebar';
import { sendMessage, listConversations, listMessages, getMemberDetail } from '@/lib/coach.functions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Partner {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Conversation {
  partner: Partner;
  last_message: string;
  last_at: string;
  unread: boolean;
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


// ─── HELPERS ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  const now = new Date();
  const d = new Date(iso);
  if (h < 24 && now.toDateString() === d.toDateString())
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return `Hier · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return `${d.toLocaleDateString('fr-FR')} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const QUICK_REPLIES = [
  { icon: '💪', label: 'Bonne séance !', text: 'Bonne séance ! Continue comme ça 💪' },
  { icon: '📈', label: 'Augmente la charge', text: 'La semaine prochaine, augmente de 2.5kg sur le prochain exercice.' },
  { icon: '🔄', label: 'On adapte', text: 'Vu tes retours, j\'adapte le programme pour la semaine prochaine.' },
  { icon: '❓', label: 'Comment tu te sens ?', text: 'Comment tu te sens physiquement en ce moment ?' },
];

// ─── AVATAR ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #3A6B42, #1B2E1F)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--cst-display)', fontSize: size * 0.36, color: '#fff', fontWeight: 800,
    }}>{initials || '?'}</div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function CoachMessages() {
  const sendFn = useServerFn(sendMessage);
  const convFn = useServerFn(listConversations);
  const msgsFn = useServerFn(listMessages);
  const memberDetailFn = useServerFn(getMemberDetail);
  const { partner: partnerIdFromUrl } = useSearch({ from: '/_authenticated/coach/messages' });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartner, setActivePartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState('');
  const autoSelectedRef = useRef<string | null>(null);

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const r = await convFn({});
      setConversations(r.conversations);
    } catch {}
  }, [convFn]);

  // Auto-select partner from ?partner= URL param
  useEffect(() => {
    if (!partnerIdFromUrl) return;
    if (autoSelectedRef.current === partnerIdFromUrl) return;
    // Wait until conversations attempt has loaded
    const existing = conversations.find(c => c.partner.id === partnerIdFromUrl);
    if (existing) {
      autoSelectedRef.current = partnerIdFromUrl;
      setActivePartner(existing.partner);
      return;
    }
    // Not in existing conversations → fetch profile to start a fresh one
    autoSelectedRef.current = partnerIdFromUrl;
    (async () => {
      try {
        const detail: any = await memberDetailFn({ data: { member_id: partnerIdFromUrl } });
        const p = detail?.profile;
        if (p) {
          setActivePartner({
            id: p.id,
            first_name: p.first_name ?? '',
            last_name: p.last_name ?? '',
            email: p.email ?? '',
          });
        }
      } catch {
        autoSelectedRef.current = null;
      }
    })();
  }, [partnerIdFromUrl, conversations, memberDetailFn]);



  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages when partner changes
  const loadMessages = useCallback(async (partnerId: string) => {
    try {
      const r = await msgsFn({ data: { partner_id: partnerId } });
      setMessages(r.messages as Message[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {}
  }, [msgsFn]);


  useEffect(() => {
    if (activePartner) loadMessages(activePartner.id);
  }, [activePartner, loadMessages]);

  // Supabase realtime
  useEffect(() => {
    if (!activePartner || !currentUserId) return;
    const ch = supabase.channel(`msgs-${activePartner.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message;
        if (
          (m.from_id === currentUserId && m.to_id === activePartner.id) ||
          (m.from_id === activePartner.id && m.to_id === currentUserId)
        ) {
          setMessages(prev => [...prev, m]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activePartner, currentUserId]);

  // Send message
  const handleSend = async () => {
    if (!body.trim() || !activePartner || sending) return;
    setSending(true);
    const optimistic: Message = {
      id: 'opt-' + Date.now(), from_id: currentUserId ?? '', to_id: activePartner.id,
      content: body.trim(), created_at: new Date().toISOString(), read: false, pinned: false,
    };
    setMessages(prev => [...prev, optimistic]);
    setBody('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      await sendFn({ data: { to_user_id: activePartner.id, body: optimistic.content } });

      await loadConversations();
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur envoi');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setBody(optimistic.content);
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const filteredConvs = conversations.filter(c =>
    `${c.partner.first_name} ${c.partner.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />

      {/* Conversation list */}
      <aside style={{
        width: 280, flexShrink: 0, background: '#16261A',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'var(--cst-display)', fontSize: 20, fontWeight: 800, color: '#fff', textTransform: 'uppercase', marginBottom: 10 }}>MESSAGES</div>
          <input className="cst-input" placeholder="🔍 Rechercher..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ padding: '8px 12px', fontSize: 13 }} />
        </div>

        <div className="cst-scroll" style={{ flex: 1 }}>
          {filteredConvs.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--cst-text-muted)', fontSize: 13 }}>
              Aucune conversation.<br />Sélectionne un membre pour lui écrire.
            </div>
          )}
          {filteredConvs.map(c => (
            <div key={c.partner.id} onClick={() => setActivePartner(c.partner)} style={{
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              background: activePartner?.id === c.partner.id ? 'rgba(45,90,53,0.18)' : 'transparent',
              borderLeft: activePartner?.id === c.partner.id ? '2px solid var(--cst-mid-green)' : '2px solid transparent',
              cursor: 'pointer', transition: 'background 0.15s',
            }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={`${c.partner.first_name} ${c.partner.last_name}`} size={38} />
                {c.unread && <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--cst-mid-green)', border: '2px solid #16261A' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.partner.first_name} {c.partner.last_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cst-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {c.last_message}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--cst-text-muted)', flexShrink: 0, fontFamily: 'var(--cst-mono)' }}>
                {relTime(c.last_at)}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Conversation area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activePartner ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--cst-text-muted)' }}>
            <div style={{ fontSize: 32 }}>💬</div>
            <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 11, letterSpacing: '0.15em' }}>SÉLECTIONNE UN MEMBRE</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={`${activePartner.first_name} ${activePartner.last_name}`} size={36} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{activePartner.first_name} {activePartner.last_name}</div>
                <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)' }}>{activePartner.email}</div>
              </div>
            </div>

            {/* Messages */}
            <div className="cst-scroll" style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--cst-text-muted)', fontSize: 13, marginTop: 40 }}>
                  Pas encore de message. Dis bonjour 👋
                </div>
              )}

              {messages.map((m, i) => {
                const isMe = m.from_id === currentUserId;
                const showTime = i === 0 || (new Date(m.created_at).getTime() - new Date(messages[i-1].created_at).getTime()) > 5 * 60000;
                return (
                  <div key={m.id}>
                    {showTime && (
                      <div style={{ textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)', margin: '8px 0' }}>
                        {relTime(m.created_at)}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '70%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? 'var(--cst-mid-green)' : '#243029',
                        border: isMe ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        color: '#fff', fontSize: 14, lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}>
                        {m.content}
                        {m.pinned && <span style={{ marginLeft: 6, fontSize: 12 }}>📌</span>}
                      </div>
                    </div>
                    {isMe && i === messages.length - 1 && m.read && (
                      <div style={{ textAlign: 'right', fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)', marginTop: 2 }}>✓ Lu</div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies */}
            <div style={{ padding: '8px 20px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_REPLIES.map(qr => (
                <button key={qr.label} onClick={() => setBody(qr.text)} style={{
                  padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 11,
                  cursor: 'pointer', fontFamily: 'var(--cst-ui)', transition: 'background 0.15s, border-color 0.15s',
                }} onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(45,90,53,0.15)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--cst-mid-green)'; }}
                   onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}>
                  {qr.icon} {qr.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: '10px 20px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea ref={inputRef} className="cst-input" rows={2} placeholder={`Écrire à ${activePartner.first_name}…`}
                value={body} onChange={e => setBody(e.target.value)} onKeyDown={handleKeyDown}
                style={{ flex: 1, resize: 'none', fontFamily: 'var(--cst-ui)', fontSize: 14, padding: '10px 14px', minHeight: 44 }} />
              <button className="cst-btn cst-btn-primary" onClick={handleSend} disabled={sending || !body.trim()}
                style={{ minHeight: 44, padding: '10px 18px', opacity: (!body.trim() || sending) ? 0.5 : 1 }}>
                ↑
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
