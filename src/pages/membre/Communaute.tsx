import { useNavigate } from "@tanstack/react-router";

import MemberNav from "../../components/MemberNav";
import { CSTSectionNum } from "../../components/Atoms";
import CommunityFeed from "@/components/cst/CommunityFeed";

export default function Communaute() {
  const navigate = useNavigate();

  return (
    <div className="cst-page">
      <div className="cst-shell" style={{ paddingBottom: 96 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 4px" }}>
          <button
            onClick={() => navigate({ to: "/membre" })}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            aria-label="Retour à l'accueil"
            style={{ paddingInline: 12 }}
          >
            ←
          </button>
          <CSTSectionNum num={1} label="COMMUNAUTÉ" sub="LES COACHÉS DE LÉO" />
        </div>

        <CommunityFeed />
      </div>

      <MemberNav />
    </div>
  );
}
