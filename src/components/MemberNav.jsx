import { useNavigate, useLocation } from "@tanstack/react-router";
import { BETA_MODE } from "@/lib/site";

const allItems = [
  { id: "home", icon: "🏠", label: "Accueil", path: "/membre", beta: true },
  { id: "prog", icon: "📋", label: "Programme", path: "/membre/programme", beta: true },
  { id: "hist", icon: "📈", label: "Progrès", path: "/membre/historique", beta: false },
  { id: "msgs", icon: "💬", label: "Messages", path: "/membre/messages", beta: true },
  { id: "profile", icon: "👤", label: "Profil", path: "/membre/profil", beta: true },
];

const items = BETA_MODE ? allItems.filter((it) => it.beta) : allItems;

export default function MemberNav({ unreadCount = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeId =
    items.find((it) =>
      it.path !== "/membre" ? pathname.startsWith(it.path) : pathname === "/membre",
    )?.id ?? "home";

  return (
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
            {it.id === "msgs" && unreadCount > 0 && (
              <span className="bottom-nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
