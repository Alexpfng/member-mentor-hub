import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadCount } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

const items = [
  { id: "home", icon: "🏠", label: "Accueil", path: "/membre" },
  { id: "prog", icon: "📋", label: "Programme", path: "/membre/programme" },
  { id: "plan", icon: "📅", label: "Planning", path: "/membre/planning" },
  { id: "carn", icon: "📖", label: "Carnet", path: "/membre/carnet" },
  { id: "progr", icon: "📈", label: "Progrès", path: "/membre/progression" },
  { id: "trail", icon: "🏃", label: "Trail & Run", path: "/membre/running" },
  { id: "msgs", icon: "💬", label: "Messages", path: "/membre/messages" },
  { id: "profile", icon: "⚙️", label: "Réglages", path: "/membre/profil" },
];

export default function MemberNav({ unreadCount: unreadProp = undefined } = {}) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { roles, switchRole } = useAuth();
  const hasCoachRole = roles.includes("coach");
  const unreadFn = useServerFn(getUnreadCount);
  const [unread, setUnread] = useState(unreadProp ?? 0);

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

  const activeId =
    items.find((it) =>
      it.path !== "/membre" ? pathname.startsWith(it.path) : pathname === "/membre",
    )?.id ?? "home";

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
      <nav className="bottom-nav" role="navigation" aria-label="Navigation principale">
        {items.map((it) => {
          const on = it.id === activeId;
          return (
            <div
              key={it.id}
              className={`bottom-nav-item ${on ? "active" : ""}`}
              onClick={() => navigate({ to: it.path })}
              role="button"
              tabIndex={0}
              aria-label={t(it.label)}
              aria-current={on ? "page" : undefined}
            >
              <span className="nav-icon" style={{ fontSize: 20 }}>
                {it.icon}
              </span>
              <span className="nav-label">{t(it.label)}</span>
              {it.id === "msgs" && effectiveUnread > 0 && (
                <span className="bottom-nav-badge">
                  {effectiveUnread > 9 ? "9+" : effectiveUnread}
                </span>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
