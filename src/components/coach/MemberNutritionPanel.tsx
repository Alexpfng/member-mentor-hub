import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CSTSectionNum } from "@/components/Atoms";
import NutritionDetailDisclosure from "@/components/cst/NutritionDetailDisclosure";
import { getMemberNutrition, setMemberNutritionGoal } from "@/lib/nutrition.functions";
import { localDateISO } from "@/lib/local-date";

type Props = {
  memberId: string;
};

function formatKcal(value: number | null | undefined) {
  return value == null ? "—" : `${value.toLocaleString("fr-FR")} kcal`;
}

export default function MemberNutritionPanel({ memberId }: Props) {
  const getNutrition = useServerFn(getMemberNutrition);
  const saveGoal = useServerFn(setMemberNutritionGoal);
  const [nutrition, setNutrition] = useState<any>(null);
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function reload() {
    try {
      const result = await getNutrition({ data: { memberId, date: localDateISO() } });
      setNutrition(result);
      setGoal(result.goal?.dailyKcal != null ? String(result.goal.dailyKcal) : "");
      setNote(result.goal?.coachNote ?? "");
    } catch (error) {
      console.error("[MemberNutritionPanel] load", error);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  async function handleSave() {
    const trimmed = goal.trim();
    const parsed = trimmed === "" ? null : Number(trimmed.replace(/\s/g, ""));
    if (
      parsed !== null &&
      (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000 || !Number.isInteger(parsed))
    ) {
      toast.error("Objectif nutrition invalide");
      return;
    }
    setBusy(true);
    try {
      const nextGoal = await saveGoal({
        data: {
          memberId,
          dailyKcalGoal: parsed,
          coachNote: note.trim() || null,
        },
      });
      setNutrition((current: any) =>
        current
          ? {
              ...current,
              goal: nextGoal,
              summary: { ...current.summary, goalKcal: nextGoal.dailyKcal },
            }
          : current,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur nutrition");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cst-card-dark" style={{ padding: 18 }}>
      <CSTSectionNum num={11} label="NUTRITION" sub="CALORIES CONSOMMÉES" />
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div className="cst-mono" style={{ fontSize: 8, opacity: 0.55 }}>
            AUJOURD'HUI
          </div>
          <strong style={{ fontSize: 18 }}>{formatKcal(nutrition?.summary?.totalKcal)}</strong>
        </div>
        <div>
          <div className="cst-mono" style={{ fontSize: 8, opacity: 0.55 }}>
            MOY. 7 JOURS
          </div>
          <strong style={{ fontSize: 18 }}>{formatKcal(nutrition?.averageKcal7d)}</strong>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
            OBJECTIF KCAL / JOUR
          </label>
          <input
            className="cst-input"
            type="number"
            min="0"
            max="10000"
            step="1"
            inputMode="numeric"
            style={{ width: "100%", marginTop: 4 }}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="ex. 2200"
          />
        </div>
        <div>
          <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
            NOTE COACH
          </label>
          <textarea
            className="cst-input"
            rows={3}
            style={{ width: "100%", marginTop: 4, resize: "vertical" }}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. priorité protéines, collation pré-training..."
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="cst-btn cst-btn-primary cst-btn-sm"
            disabled={busy}
            onClick={handleSave}
          >
            {busy ? "..." : "ENREGISTRER"}
          </button>
          {saved && <span style={{ color: "var(--cst-success)", fontSize: 11 }}>✓ Enregistré</span>}
        </div>
        <span className="cst-mono" style={{ fontSize: 8, opacity: 0.4, lineHeight: 1.4 }}>
          Objectif alimentaire. Ne modifie pas les calories d'activité.
        </span>
      </div>
      <NutritionDetailDisclosure
        summary={nutrition?.summary}
        macroComparison={nutrition?.macroComparison}
      />
    </div>
  );
}
