import CoachSidebar from "../../components/CoachSidebar";
import { CSTSectionNum } from "../../components/Atoms";
import CommunityFeed from "@/components/cst/CommunityFeed";

/**
 * La communauté vue par le coach : mêmes entrées que les membres, et surtout la
 * possibilité de cololiker. Un encouragement du coach ne vaut pas celui d'un
 * pair, il vaut plus.
 */
export default function CoachCommunaute() {
  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll-visible" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "24px 32px 48px", maxWidth: 720, margin: "0 auto" }}>
          <CSTSectionNum num={1} label="COMMUNAUTÉ" sub="LE FIL DE TES COACHÉS" />

          <p style={{ margin: "10px 0 0", fontSize: 12, opacity: 0.6, lineHeight: 1.5 }}>
            Seuls les membres ayant accepté de partager apparaissent ici — leur choix vaut aussi
            pour toi. Leur suivi complet reste sur leur fiche.
          </p>

          {/* Pas de case de partage : le coach n'a pas de séances à publier. */}
          <CommunityFeed canShare={false} />
        </div>
      </div>
    </div>
  );
}
