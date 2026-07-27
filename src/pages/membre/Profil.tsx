import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import MemberNav from "../../components/MemberNav";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/notif-prefs.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  disconnectStrava,
  getStravaConnectUrl,
  getStravaConnectionStatus,
} from "@/lib/strava.functions";

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
  const getFn = useServerFn(getNotificationPrefs);
  const updateFn = useServerFn(updateNotificationPrefs);
  const getStravaStatus = useServerFn(getStravaConnectionStatus);
  const getConnectUrl = useServerFn(getStravaConnectUrl);
  const disconnectStravaFn = useServerFn(disconnectStrava);
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [strava, setStrava] = useState<{
    connected: boolean;
    athleteId: number | null;
    expiresAt: string | null;
    lastSyncAt: string | null;
  } | null>(null);
  const [stravaBusy, setStravaBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getFn();
        setPrefs(r);
        const status = await getStravaStatus();
        setStrava({
          connected: status.connected,
          athleteId: status.athleteId,
          expiresAt: status.expiresAt,
          lastSyncAt: status.lastSyncAt,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [getFn]);

  const handleChange = async (patch: Record<string, any>) => {
    setPrefs((p: any) => ({ ...p, ...patch }));
    try {
      const r = await updateFn({ data: patch });
      setPrefs(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  const handleConnectStrava = async () => {
    setStravaBusy(true);
    try {
      const { url } = await getConnectUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Connexion Strava impossible");
      setStravaBusy(false);
    }
  };

  const handleDisconnectStrava = async () => {
    setStravaBusy(true);
    try {
      await disconnectStravaFn();
      setStrava({ connected: false, athleteId: null, expiresAt: null, lastSyncAt: null });
      toast.success("Strava déconnecté");
    } catch (e: any) {
      toast.error(e?.message ?? "Déconnexion Strava impossible");
    } finally {
      setStravaBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate({ to: "/membre" })} className="text-sm opacity-60">
            ← Retour
          </button>
          <h1 className="font-mono text-xs tracking-widest">MON PROFIL</h1>
          <div className="w-10" />
        </div>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">STRAVA</h2>
          <div className="space-y-3 mb-8">
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="text-sm font-medium">
                {strava?.connected ? "Compte Strava connecté" : "Aucun compte Strava connecté"}
              </div>
              <div className="text-xs opacity-70">
                {strava?.connected
                  ? "Tes courses du jour pourront être rattachées automatiquement à ta séance course."
                  : "Connecte Strava pour faire remonter automatiquement tes sorties course dans l'app."}
              </div>
              {strava?.connected && (
                <div className="text-xs opacity-60 space-y-1">
                  <div>Athlète Strava : {strava.athleteId ?? "—"}</div>
                  <div>
                    Dernière synchro :{" "}
                    {strava.lastSyncAt ? new Date(strava.lastSyncAt).toLocaleString("fr-FR") : "—"}
                  </div>
                  <div>
                    Expiration token :{" "}
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
                    {stravaBusy ? "Connexion..." : "Connecter Strava"}
                  </button>
                ) : (
                  <button
                    className="w-full py-3 rounded border border-border text-sm"
                    disabled={stravaBusy}
                    onClick={handleDisconnectStrava}
                  >
                    {stravaBusy ? "Déconnexion..." : "Déconnecter Strava"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest opacity-60 mb-3">NOTIFICATIONS</h2>
          {loading || !prefs ? (
            <div className="opacity-60 text-sm">Chargement…</div>
          ) : (
            <div className="space-y-3">
              {TOGGLES.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <Label htmlFor={key} className="cursor-pointer text-sm">
                    {label}
                  </Label>
                  <Switch
                    id={key}
                    checked={Boolean(prefs[key])}
                    onCheckedChange={(v) => handleChange({ [key]: v })}
                  />
                </div>
              ))}

              {prefs.weight_reminder && (
                <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                  <div className="text-xs opacity-70">Quand recevoir le rappel poids ?</div>
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
                        {d}
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

        <section>
          <button
            className="w-full py-3 rounded border border-border text-sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login", search: { redirect: "/" } });
            }}
          >
            Se déconnecter
          </button>
        </section>
      </div>
      <MemberNav />
    </div>
  );
}
