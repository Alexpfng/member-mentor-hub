import { useNavigate, useLocation } from "@tanstack/react-router";


const items = [
  { id: "home", icon: "🏠", label: "Accueil", path: "/membre" },
  { id: "prog", icon: "📋", label: "Programme", path: "/membre/programme" },
  { id: "hist", icon: "📈", label: "Progrès", path: "/membre/historique" },
  { id: "msgs", icon: "💬", label: "Messages", path: "/membre/messages" },
  { id: "profile", icon: "👤", label: "Profil", path: "/membre/profil" },
];

export default function MemberNav({ unreadCount = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
              {it.id === "msgs" && unreadCount > 0 && (
                <span className="bottom-nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
