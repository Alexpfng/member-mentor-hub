import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import MemberNav from "../../components/MemberNav";
import { GuidedTour } from "@/components/cst/GuidedTour";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/notif-prefs.functions";
import {
  getMemberPlanningSettings,
  updateMemberPlanningSettings,
  getMyProfileInfo,
  updateMyProfileInfo,
} from "@/lib/member-profile.functions";
import { WEEK_START_OPTIONS, weekWindowLabel } from "@/lib/planning-weeks";
import { supabase } from "@/integrations/supabase/client";
import {
  disconnectStrava,
  getStravaConnectUrl,
  getStravaConnectionStatus,
} from "@/lib/strava.functions";
import { useI18n } from "@/lib/i18n";

const TOGGLES = [
  ["planned_session", "Rappel jour de séance planifié"],
  ["weight_reminder", "Rappel hebdo pour noter ton poids"],
  ["logbook", "Carnet de bord prêt"],
  ["pr", "Nouveau record personnel"],
  ["new_week", "Nouvelle semaine publiée par le coach"],
  ["coach_msg", "Messages du coach"],
  ["streak", "Encouragements sur ta série de régularité"],
] as const;

const DOW = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

export default function MemberProfil() {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();
  const getFn = useServerFn(getNotificationPrefs);
  const updateFn = useServerFn(updateNotificationPrefs);
  const getPlanningSettings = useServerFn(getMemberPlanningSettings);
  const updatePlanningSettings = useServerFn(updateMemberPlanningSettings);
  const getMyInfo = useServerFn(getMyProfileInfo);
  const updateMyInfo = useServerFn(updateMyProfileInfo);
  const getStravaStatus = useServerFn(getStravaConnectionStatus);
  const getConnectUrl = useServerFn(getStravaConnectUrl);
  const disconnectStravaFn = useServerFn(disconnectStrava);
  const [prefs, setPrefs] = useState<any>(null);
  const [planningWeekStartDay, setPlanningWeekStartDay] = useState(1);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const [strava, setStrava] = useState<{
    connected: boolean;
    athleteId: number | null;
    expiresAt: string | null;
    lastSyncAt: string | null;
  } | null>(null);
  const [stravaBusy, setStravaBusy] = useState(false);
  const [info, setInfo] = useState({
    first_name: "",
    last_name: "",
    email: "",
    level: "",
    height_cm: "",
    weight_kg: "",
    goal: "",
  });
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Chaque réglage se charge INDÉPENDAMMENT : avant, les 3 appels étaient
      // dans un même try — si le 1er (prefs notif) échouait, le « début de
      // semaine » n'était jamais appliqué et l'écran retombait sur le défaut
      // (Lundi), donnant l'impression que le choix du coaché « se réinitialise »
      // à la reconnexion.
      try {
        const r = await getFn();
        if (mounted) setPrefs(r);
      } catch (e) {
        console.error("[Profil] getNotificationPrefs", e);
      }
      try {
        const planning = await getPlanningSettings();
        if (mounted) setPlanningWeekStartDay(planning.planning_week_start_day);
      } catch (e) {
        console.error("[Profil] getPlanningSettings", e);
      }
      try {
        const status = await getStravaStatus();
        if (mounted) {
          setStrava({
            connected: status.connected,
            athleteId: status.athleteId,
            expiresAt: status.expiresAt,
            lastSyncAt: status.lastSyncAt,
          });
        }
      } catch (e) {
        console.error("[Profil] getStravaConnectionStatus", e);
      }
      try {
        const mine = await getMyInfo();
        if (mounted) {
          setInfo({
            first_name: mine.first_name ?? "",
            last_name: mine.last_name ?? "",
            email: mine.email ?? "",
            level: mine.level ?? "",
            height_cm: mine.height_cm != null ? String(mine.height_cm) : "",
            weight_kg: mine.weight_kg != null ? String(mine.weight_kg) : "",
            goal: mine.goal ?? "",
          });
        }
      } catch (e) {
        console.error("[Profil] getMyProfileInfo", e);
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [getFn]);

  const handleChange = async (patch: Record<string, any>) => {
    setPrefs((p: any) => ({ ...p, ...patch }));
    try {
      const r = await updateFn({ data: patch });
      setPrefs(r);
    } catch (e: any) {
      toast.error(e?.message ?? t("Erreur"));
    }
  };

  const handleConnectStrava = async () => {
    setStravaBusy(true);
    try {
      const { url } = await getConnectUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? t("Connexion Strava impossible"));
      setStravaBusy(false);
    }
  };

  const handlePlanningWeekStartChange = async (value: number) => {
    setPlanningWeekStartDay(value);
    setPlanningBusy(true);
    try {
      const res = await updatePlanningSettings({
        data: { planning_week_start_day: value },
      });
      setPlanningWeekStartDay(res.planning_week_start_day);
      toast.success(t("Semaine perso mise à jour"));
    } catch (e: any) {
      toast.error(e?.message ?? t("Mise à jour impossible"));
    } finally {
      setPlanningBusy(false);
    }
  };

  const handleDisconnectStrava = async () => {
    setStravaBusy(true);
    try {
      await disconnectStravaFn();
      setStrava({ connected: false, athleteId: null, expiresAt: null, lastSyncAt: null });
      toast.success(t("Strava déconnecté"));
    } catch (e: any) {
      toast.error(e?.message ?? t("Déconnexion Strava impossible"));
    } finally {
      setStravaBusy(false);
    }
  };

  const num = (s: string): number | null => {
    const v = s.trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const handleSaveInfo = async () => {
    setInfoBusy(true);
    setInfoSaved(false);
    try {
      const h = num(info.height_cm);
      await updateMyInfo({
        data: {
          first_name: info.first_name.trim() || null,
          last_name: info.last_name.trim() || null,
          level: info.level || null,
          height_cm: h != null ? Math.round(h) : null,
          weight_kg: num(info.weight_kg),
          goal: info.goal.trim() || null,
        },
      });
      setInfoSaved(true);
      toast.success(t("Infos mises à jour"));
      setTimeout(() => setInfoSaved(false), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? t("Mise à jour impossible"));
    } finally {
      setInfoBusy(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", search: { redirect: "/" } });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate({ to: "/membre" })} className="text-sm opacity-60">
            {t("← Retour")}
          </button>
          <h1 className="font-mono text-xs tracking-widest">{t("RÉGLAGES")}</h1>
          <div className="w-10" />
        </div>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">{t("Langue")}</h2>
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="text-xs opacity-70">{t("Choisis la langue de l'application.")}</div>
            <div className="flex gap-2">
              {(["fr", "en"] as const).map((lng) => (
                <button
                  key={lng}
                  onClick={() => setLocale(lng)}
                  className={`flex-1 py-3 rounded border text-sm ${
                    locale === lng
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border"
                  }`}
                >
                  {lng === "fr" ? "Français" : "English"}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="font-mono text-xs tracking-widest opacity-60 mb-2">
              {t("HUB COACHÉ")}
            </div>
            <h2 className="text-lg font-semibold mb-1">{t("Tous tes réglages au même endroit")}</h2>
            <p className="text-sm opacity-70">
              {t("Retrouve ici tout ce que tu peux modifier en tant que coaché.")}
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">{t("MES INFOS")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveInfo();
            }}
            className="p-4 rounded-xl border border-border bg-card space-y-3"
          >
            <div className="text-xs opacity-70">
              {t(
                "Ces infos aident ton coach à ajuster ton suivi. Complète-les et mets-les à jour toi-même quand ça change.",
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-mono text-[10px] opacity-60">{t("PRÉNOM")}</span>
                <input
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={info.first_name}
                  onChange={(e) => setInfo({ ...info, first_name: e.target.value })}
                />
              </div>
              <div>
                <span className="font-mono text-[10px] opacity-60">{t("NOM")}</span>
                <input
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={info.last_name}
                  onChange={(e) => setInfo({ ...info, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <span className="font-mono text-[10px] opacity-60">{t("EMAIL")}</span>
              <input
                className="w-full mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm opacity-60"
                value={info.email}
                disabled
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-mono text-[10px] opacity-60">{t("NIVEAU")}</span>
                <select
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={info.level}
                  onChange={(e) => setInfo({ ...info, level: e.target.value })}
                >
                  <option value="">{t("— Non renseigné —")}</option>
                  <option value="débutant">{t("Débutant")}</option>
                  <option value="intermédiaire">{t("Intermédiaire")}</option>
                  <option value="avancé">{t("Avancé")}</option>
                  <option value="élite">{t("Élite")}</option>
                </select>
              </div>
              <div>
                <span className="font-mono text-[10px] opacity-60">{t("TAILLE (CM)")}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={80}
                  max={260}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={info.height_cm}
                  onChange={(e) => setInfo({ ...info, height_cm: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-mono text-[10px] opacity-60">{t("POIDS (KG)")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={20}
                  max={400}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={info.weight_kg}
                  onChange={(e) => setInfo({ ...info, weight_kg: e.target.value })}
                />
              </div>
            </div>
            <div>
              <span className="font-mono text-[10px] opacity-60">{t("OBJECTIF")}</span>
              <input
                className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder={t("Ex. Préparation combat / Perte de gras / Hypertrophie…")}
                value={info.goal}
                onChange={(e) => setInfo({ ...info, goal: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={infoBusy}
              className="w-full py-3 rounded bg-primary text-primary-foreground text-sm disabled:opacity-60"
            >
              {infoBusy ? t("ENREGISTREMENT…") : t("ENREGISTRER MES INFOS")}
            </button>
            {infoSaved && (
              <div className="text-xs text-center" style={{ color: "var(--cst-mid-green)" }}>
                {t("✓ Infos mises à jour")}
              </div>
            )}
          </form>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">{t("PLANNING")}</h2>
          <div className="p-4 rounded-xl border border-border bg-card space-y-3 mb-8">
            <div className="text-sm font-medium">{t("Début de ma semaine")}</div>
            <div className="text-xs opacity-70">
              {t("Choisis le jour qui doit lancer ton cycle hebdomadaire de 7 jours.")}
            </div>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-3 text-sm"
              disabled={planningBusy}
              value={planningWeekStartDay}
              onChange={(e) => handlePlanningWeekStartChange(Number(e.target.value))}
            >
              {WEEK_START_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="text-xs opacity-60">
              {t("Semaine perso :")} {weekWindowLabel(planningWeekStartDay)}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">
            {t("DÉCOUVRIR L'APP")}
          </h2>
          <button
            onClick={() => setTourOpen(true)}
            className="cst-btn cst-btn-ghost-dark w-full"
            style={{ fontSize: 12, padding: "12px 0" }}
          >
            {t("▶ REVOIR LA VISITE GUIDÉE")}
          </button>
          <div className="text-xs opacity-60 mt-2">
            {t("Les 10 étapes d'une séance, en images. Deux minutes.")}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">NOTIFICATIONS</h2>
          {loading || !prefs ? (
            <div className="opacity-60 text-sm">{t("Chargement…")}</div>
          ) : (
            <div className="space-y-3">
              {TOGGLES.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
                >
                  <Label htmlFor={key} className="cursor-pointer text-sm">
                    {t(label)}
                  </Label>
                  <Switch
                    id={key}
                    checked={Boolean(prefs[key])}
                    onCheckedChange={(v) => handleChange({ [key]: v })}
                  />
                </div>
              ))}

              {prefs.weight_reminder && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="text-xs opacity-70">{t("Quand recevoir le rappel poids ?")}</div>
                  <div className="flex gap-2 flex-wrap">
                    {DOW.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => handleChange({ weight_reminder_dow: i })}
                        className={`px-3 py-1 rounded text-xs font-mono ${
                          prefs.weight_reminder_dow === i
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t(d)}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="time"
                    value={String(prefs.weight_reminder_time ?? "09:00").slice(0, 5)}
                    onChange={(e) => handleChange({ weight_reminder_time: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">{t("CONNEXIONS")}</h2>
          <div className="space-y-3 mb-8">
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="text-sm font-medium">
                {strava?.connected
                  ? t("Compte Strava connecté")
                  : t("Aucun compte Strava connecté")}
              </div>
              <div className="text-xs opacity-70">
                {strava?.connected
                  ? t(
                      "Tes courses du jour pourront être rattachées automatiquement à ta séance course.",
                    )
                  : t(
                      "Connecte Strava pour faire remonter automatiquement tes sorties course dans l'app.",
                    )}
              </div>
              {strava?.connected && (
                <div className="text-xs opacity-60 space-y-1">
                  <div>
                    {t("Athlète Strava :")} {strava.athleteId ?? "—"}
                  </div>
                  <div>
                    {t("Dernière synchro :")}{" "}
                    {strava.lastSyncAt ? new Date(strava.lastSyncAt).toLocaleString("fr-FR") : "—"}
                  </div>
                  <div>
                    {t("Expiration token :")}{" "}
                    {strava.expiresAt ? new Date(strava.expiresAt).toLocaleString("fr-FR") : "—"}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {!strava?.connected ? (
                  <button
                    className="w-full py-3 rounded border border-border text-sm"
                    disabled={stravaBusy}
                    onClick={handleConnectStrava}
                  >
                    {stravaBusy ? t("Connexion...") : t("Connecter Strava")}
                  </button>
                ) : (
                  <button
                    className="w-full py-3 rounded border border-border text-sm"
                    disabled={stravaBusy}
                    onClick={handleDisconnectStrava}
                  >
                    {stravaBusy ? t("Déconnexion...") : t("Déconnecter Strava")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">{t("COMPTE")}</h2>
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="text-sm font-medium">{t("Gestion du compte")}</div>
            <div className="text-xs opacity-70">
              {t("Retrouve ici les actions liées à ton espace personnel.")}
            </div>
            <button
              className="w-full py-3 rounded border border-border text-sm"
              onClick={handleLogout}
            >
              {t("Se déconnecter")}
            </button>
          </div>
        </section>
      </div>
      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <MemberNav />
    </div>
  );
}
