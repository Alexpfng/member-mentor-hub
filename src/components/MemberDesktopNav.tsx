import { useLocation, useNavigate } from "@tanstack/react-router";
import { memberNavigationActiveId, memberNavigationItems } from "@/lib/member-navigation";
import "./member-desktop-nav.css";

export default function MemberDesktopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeId = memberNavigationActiveId(pathname);

  return (
    <aside className="member-desktop-nav" aria-label="Navigation principale">
      <a
        className="member-desktop-brand"
        href="/membre"
        onClick={(event) => {
          event.preventDefault();
          navigate({ to: "/membre" });
        }}
      >
        <span aria-hidden="true">★</span> COLOSMARTTRAINING
        <small>L’ESPACE · MEMBRE</small>
      </a>
      <nav>
        {memberNavigationItems.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`member-desktop-nav-item${active ? " is-active" : ""}`}
              onClick={() => navigate({ to: item.path })}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
