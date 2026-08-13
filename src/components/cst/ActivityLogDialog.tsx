import { useState } from "react";
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
