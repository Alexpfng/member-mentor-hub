import { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ENABLED } from "@/lib/app-mode";
import { BETA_MODE } from "@/lib/site";
import { CSTLogo, CSTAvatar } from "./Atoms";

const allItems = [
  { id: "dashboard", label: "Tableau de bord", icon: "⧉", path: "/coach", beta: true },
  { id: "membres", label: "Membres", icon: "○", path: "/coach/membre", beta: true },
  { id: "programmes", label: "Programmes", icon: "◤", path: "/coach/builder", beta: true },
  { id: "import", label: "Import Excel", icon: "◥", path: "/coach/import", beta: false },
  { id: "running", label: "Trail & Run", icon: "▲", path: "/coach/running", beta: false },
  { id: "messages", label: "Messages", icon: "◌", path: "/coach/messages", beta: true },
];

const items = BETA_MODE ? allItems.filter((it) => it.beta) : allItems;

function NavItems({ activeId, navigate, onNav }) {
  return (
    <>
      {items.map((it) => {
        const on = it.id === activeId;
        return (
          <div
            key={it.id}
            onClick={() => {
              navigate({ to: it.path });
              onNav?.();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 12px",
              borderRadius: 8,
              background: on ? "rgba(45,90,53,0.18)" : "transparent",
              color: on ? "#fff" : "rgba(255,255,255,0.65)",
              fontSize: 13,
              fontWeight: on ? 600 : 400,
              cursor: "pointer",
              borderLeft: on ? "2px solid var(--cst-mid-green)" : "2px solid transparent",
            }}
          >
            <span
              style={{
                width: 16,
                opacity: on ? 1 : 0.55,
                color: on ? "var(--cst-mid-green)" : "inherit",
              }}
            >
              {it.icon}
            </span>
            <span style={{ letterSpacing: 0.2 }}>{it.label}</span>
          </div>
        );
      })}
    </>
  );
}

export default function CoachSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleSignOut() {
    if (SUPABASE_ENABLED) {
      await supabase.auth.signOut();
    }
    navigate({ to: "/login" });
  }

  const activeId =
    items.find((it) =>
      it.path !== "/coach" ? pathname.startsWith(it.path) : pathname === "/coach",
    )?.id || "dashboard";

  const userBlock = (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <CSTAvatar initials="LC" size={32} />
      <div className="cst-col" style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Léo Colognesi</div>
        <div className="cst-mono" style={{ fontSize: 9 }}>
          COACH · ADMIN
        </div>
      </div>
      <button
        onClick={handleSignOut}
        title="Déconnexion"
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.6)",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 10,
          cursor: "pointer",
          fontFamily: "var(--cst-mono)",
        }}
      >
        ⎋
      </button>
    </div>
  );

  const currentLabel = items.find((it) => it.id === activeId)?.label ?? "Coach";

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="cst-hatch coach-sidebar-desktop"
        style={{
          width: 240,
          flex: "0 0 240px",
          background: "#16261A",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 16px",
        }}
      >
        <div style={{ padding: "0 8px 24px" }}>
          <CSTLogo />
          <div className="cst-mono" style={{ marginTop: 6, fontSize: 9, opacity: 0.55 }}>
            L'ESPACE · COACH
          </div>
        </div>
        <nav className="cst-col" style={{ gap: 2, flex: 1 }}>
          <NavItems activeId={activeId} navigate={navigate} />
        </nav>
        {userBlock}
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="coach-mobile-topbar">
        <button
          className="coach-hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <rect width="22" height="2" rx="1" fill="currentColor" />
            <rect y="7" width="16" height="2" rx="1" fill="currentColor" />
            <rect y="14" width="22" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        <span className="topbar-title">{currentLabel}</span>
        <button
          onClick={handleSignOut}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.6)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 10,
            cursor: "pointer",
            fontFamily: "var(--cst-mono)",
            marginLeft: "auto",
          }}
        >
          ⎋
        </button>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      <div
        className={`coach-drawer-overlay ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── MOBILE DRAWER ── */}
      <div className={`coach-drawer ${drawerOpen ? "open" : ""}`}>
        <div style={{ padding: "20px 16px 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <CSTLogo />
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontSize: 22,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
          <nav className="cst-col" style={{ gap: 2 }}>
            <NavItems activeId={activeId} navigate={navigate} onNav={() => setDrawerOpen(false)} />
          </nav>
          <div style={{ marginTop: 24 }}>{userBlock}</div>
        </div>
      </div>
    </>
  );
}
