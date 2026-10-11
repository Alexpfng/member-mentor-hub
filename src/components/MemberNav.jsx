import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadCount } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  memberNavigationActiveId,
  mobileMemberMoreItems,
  mobileMemberPrimaryItems,
} from "@/lib/member-navigation";

export default function MemberNav({ unreadCount: unreadProp = undefined } = {}) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { roles, switchRole } = useAuth();
  const hasCoachRole = roles.includes("coach");
  const unreadFn = useServerFn(getUnreadCount);
  const [unread, setUnread] = useState(unreadProp ?? 0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (typeof unreadProp === "number") return; // parent controls it
    let cancelled = false;
    let ch = null;
    const refresh = async () => {
      try {
        const r = await unreadFn({});
        if (!cancelled) setUnread(r.count ?? 0);
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    // Refresh when a new message arrives in realtime (scoped to current user)
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (cancelled || !uid) return;
      ch = supabase
        .channel(`user:${uid}:nav`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
        .subscribe();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (ch) supabase.removeChannel(ch);
    };
  }, [unreadFn, unreadProp, pathname]);

  const effectiveUnread = typeof unreadProp === "number" ? unreadProp : unread;

  const activeId = memberNavigationActiveId(pathname);
  const moreActive = mobileMemberMoreItems.some((item) => item.id === activeId);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  const renderUnreadBadge = (className = "bottom-nav-badge") =>
    effectiveUnread > 0 ? (
      <span className={className}>{effectiveUnread > 9 ? "9+" : effectiveUnread}</span>
    ) : null;

  return (
    <>
      {hasCoachRole && (
        <button
          onClick={() => {
            switchRole("coach");
            navigate({ to: "/coach" });
          }}
          style={{
            position: "fixed",
            bottom: 72,
            right: 16,
            zIndex: 50,
            background: "var(--cst-mid-green, #2d5a35)",
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "6px 14px",
            fontSize: 10,
            fontFamily: "var(--cst-mono, monospace)",
            letterSpacing: "0.12em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <span>◎</span> VUE COACH
        </button>
      )}
      {moreOpen && (
        <button
          type="button"
          className="bottom-nav-dismiss"
          aria-label="Fermer le menu Plus"
          onClick={() => setMoreOpen(false)}
        />
      )}
      {moreOpen && (
        <nav id="member-nav-more" className="bottom-nav-more" aria-label="Autres pages">
          {mobileMemberMoreItems.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                className={`bottom-nav-more-item ${active ? "active" : ""}`}
                onClick={() => {
                  setMoreOpen(false);
                  navigate({ to: item.path });
                }}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{t(item.label)}</span>
                {item.id === "msgs" && renderUnreadBadge("bottom-nav-more-badge")}
              </button>
            );
          })}
        </nav>
      )}
      <nav className="bottom-nav" aria-label="Navigation principale">
        {mobileMemberPrimaryItems.map((it) => {
          const on = it.id === activeId;
          return (
            <button
              key={it.id}
              type="button"
              className={`bottom-nav-item ${on ? "active" : ""}`}
              onClick={() => navigate({ to: it.path })}
              aria-label={t(it.label)}
              aria-current={on ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {it.icon}
              </span>
              <span className="nav-label">{t(it.label)}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`bottom-nav-item bottom-nav-more-trigger ${moreActive ? "active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-label={moreOpen ? "Fermer le menu Plus" : "Plus de pages"}
          aria-expanded={moreOpen}
        >
          <span className="nav-icon" aria-hidden="true">
            <MoreHorizontal size={20} strokeWidth={2.5} />
          </span>
          <span className="nav-label">Plus</span>
          {renderUnreadBadge()}
        </button>
      </nav>
    </>
  );
}
