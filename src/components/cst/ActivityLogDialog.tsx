import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity.functions";
import {
  formatStepsValue,
  getStepsScaleMax,
  nudgeSteps,
  parseStepsValue,
  STEP_INCREMENT,
} from "@/lib/activity-steps-scale";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSteps?: number | null;
  defaultCalories?: number | null;
  goalSteps?: number | null;
  goalCalories?: number | null;
  onSaved?: () => void;
};

export function ActivityLogDialog({
  open,
  onOpenChange,
  defaultSteps,
  defaultCalories,
  goalSteps,
  goalCalories,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [steps, setSteps] = useState<string>(defaultSteps != null ? String(defaultSteps) : "");
  const [calories, setCalories] = useState<string>(
    defaultCalories != null ? String(defaultCalories) : "",
  );
  const [date, setDate] = useState<string>(today);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(logActivity);
  const scaleMax = useMemo(() => getStepsScaleMax(goalSteps, steps), [goalSteps, steps]);
  const scaleSteps = parseStepsValue(steps) ?? 0;
  const goalRatio =
    goalSteps != null && scaleMax > 0 ? Math.min(100, Math.max(0, (goalSteps / scaleMax) * 100)) : null;

  const parseField = (raw: string, max: number, label: string): number | null | "error" => {
    const trimmed = raw.trim();
    if (trimmed === "") return null; // champ laissé vide = on n'y touche pas
    const n = Number(trimmed.replace(/\s/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > max || !Number.isInteger(n)) {
      toast.error(t(`${label} invalide`));
      return "error";
    }
    return n;
  };

  const handleSave = async () => {
    const s = parseField(steps, 200000, "Pas");
    if (s === "error") return;
    const c = parseField(calories, 30000, "Calories");
    if (c === "error") return;
    if (s === null && c === null) {
      toast.error(t("Indique au moins tes pas ou tes calories."));
      return;
    }
    setSaving(true);
    try {
      // On n'envoie que les champs renseignés pour ne pas écraser l'autre valeur du jour.
      const payload: {
        date: string;
        steps?: number | null;
        calories?: number | null;
      } = { date };
      if (steps.trim() !== "") payload.steps = s;
      if (calories.trim() !== "") payload.calories = c;
      await save({ data: payload });
      toast.success(t("Activité enregistrée 👟"));
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Erreur"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Ton activité du jour")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="steps">
              {t("Pas")}
              {goalSteps != null ? ` (${t("objectif")} ${goalSteps.toLocaleString("fr-FR")})` : ""}
            </Label>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 14,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <strong className="cst-display" style={{ fontSize: 28, lineHeight: 1 }}>
                  {formatStepsValue(scaleSteps)}
                </strong>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.65 }}>
                  / {formatStepsValue(scaleMax)} {t("pas")}
                </span>
              </div>
              <div style={{ position: "relative", paddingTop: goalRatio != null ? 18 : 0 }}>
                {goalRatio != null && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: `${goalRatio}%`,
                      top: 0,
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      pointerEvents: "none",
                    }}
                  >
                    <span className="cst-mono" style={{ fontSize: 8, color: "#F2D16B" }}>
                      {t("OBJECTIF")}
                    </span>
                    <span style={{ width: 2, height: 12, borderRadius: 999, background: "#F2D16B" }} />
                  </div>
                )}
                <input
                  id="steps-scale"
                  type="range"
                  min={0}
                  max={scaleMax}
                  step={STEP_INCREMENT}
                  value={scaleSteps}
                  onChange={(e) => setSteps(e.target.value)}
                  aria-label={t("Échelle de pas")}
                  style={{
                    width: "100%",
                    accentColor: "var(--cst-mid-green, #6EAB76)",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSteps(nudgeSteps(steps, -STEP_INCREMENT))}
                  style={{ flex: 1 }}
                >
                  -500
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSteps(nudgeSteps(steps, STEP_INCREMENT))}
                  style={{ flex: 1 }}
                >
                  +500
                </Button>
              </div>
            </div>
            <Input
              id="steps"
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="8000"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="calories">
              {t("Calories")}
              {goalCalories != null ? ` (${t("objectif")} ${goalCalories.toLocaleString("fr-FR")})` : ""}
            </Label>
            <Input
              id="calories"
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="2200"
            />
          </div>
          <div>
            <Label htmlFor="activity-date">{t("Date")}</Label>
            <Input
              id="activity-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("Annuler")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("Enregistrement…") : t("Enregistrer ✓")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
