import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logWeight } from "@/lib/weight.functions";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWeight?: number | null;
  onSaved?: () => void;
};

export function WeightLogDialog({ open, onOpenChange, defaultWeight, onSaved }: Props) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [weight, setWeight] = useState<string>(defaultWeight ? String(defaultWeight) : "");
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const save = useServerFn(logWeight);

  const handleSave = async () => {
    const w = Number(weight.replace(",", "."));
    if (!w || w < 20 || w > 400) {
      toast.error(t("Poids invalide"));
      return;
    }
    setSaving(true);
    try {
      await save({ data: { weightKg: w, date, note: note || null } });
      toast.success(t("Poids enregistré 💪"));
      onOpenChange(false);
      onSaved?.();
      setNote("");
    } catch (e: any) {
      toast.error(e?.message ?? t("Erreur"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Ton poids aujourd'hui")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="weight">{t("Poids (kg)")}</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="80.5"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="date">{t("Date")}</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="note">{t("Note (optionnel)")}</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
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
