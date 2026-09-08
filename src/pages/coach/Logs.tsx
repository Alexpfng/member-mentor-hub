import CoachSidebar from "@/components/CoachSidebar";
import { CSTSectionNum } from "@/components/Atoms";
import MemberAppLogWidget from "@/components/coach/MemberAppLogWidget";

export default function CoachLogs() {
  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-scroll" style={{ flex: 1, padding: "24px 32px", minWidth: 0 }}>
        <div style={{ marginBottom: 22 }}>
          <CSTSectionNum num={1} label="SUIVI LOGS" sub="PARCOURS DES COACHÉS" />
          <h1 className="cst-display" style={{ fontSize: 44, margin: "10px 0 0", color: "#fff" }}>
            CE QUI SE PASSE VRAIMENT.
          </h1>
          <div className="cst-italic" style={{ fontSize: 24, color: "var(--cst-mid-green)" }}>
            Ouvertures, séances, sorties, Strava et validations.
          </div>
        </div>
        <MemberAppLogWidget maxSummaries={40} />
      </div>
    </div>
  );
}
