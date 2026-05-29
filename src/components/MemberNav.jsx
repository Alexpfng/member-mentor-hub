import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadCount } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";


const items = [
  { id: "home", icon: "🏠", label: "Accueil", path: "/membre" },
  { id: "prog", icon: "📋", label: "Programme", path: "/membre/programme" },
  { id: "hist", icon: "📈", label: "Progrès", path: "/membre/historique" },
  { id: "msgs", icon: "💬", label: "Messages", path: "/membre/messages" },
  { id: "profile", icon: "👤", label: "Profil", path: "/membre/profil" },
];

export default function MemberNav({ unreadCount: unreadProp = undefined } = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unreadFn = useServerFn(getUnreadCount);
  const [unread, setUnread] = useState(unreadProp ?? 0);

  useEffect(() => {
    if (typeof unreadProp === "number") return; // parent controls it
    let cancelled = false;
    const refresh = async () => {
      try {
        const r = await unreadFn({});
        if (!cancelled) setUnread(r.count ?? 0);
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    // Refresh when a new message arrives in realtime
    const ch = supabase.channel("nav-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .subscribe();
    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [unreadFn, unreadProp, pathname]);

  const effectiveUnread = typeof unreadProp === "number" ? unreadProp : unread;

  const activeId =
    items.find((it) =>
      it.path !== "/membre" ? pathname.startsWith(it.path) : pathname === "/membre",
    )?.id ?? "home";

  return (
    <>
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
              aria-label={it.label}
              aria-current={on ? "page" : undefined}
            >
              <span className="nav-icon" style={{ fontSize: 20 }}>
                {it.icon}
              </span>
              <span className="nav-label">{it.label}</span>
              {it.id === "msgs" && effectiveUnread > 0 && (
                <span className="bottom-nav-badge">{effectiveUnread > 9 ? "9+" : effectiveUnread}</span>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
