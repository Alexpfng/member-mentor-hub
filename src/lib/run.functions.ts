import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { RunExtraction, RunMetrics } from "@/lib/run-stats";

/* ---------------------------------------------------------------------------
   Analyse de course par capture d'écran (Lovable AI Gateway) + persistance
   structurée dans run_stats. Voir docs/superpowers/specs pour le cadrage.
--------------------------------------------------------------------------- */

const GATEWAY_URL =
  process.env.LOVABLE_AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";
// Modèle multimodal configurable (les ids évoluent côté Lovable).
const AI_MODEL = process.env.LOVABLE_AI_MODEL || "google/gemini-2.5-flash";

const SYSTEM_PROMPT =
  "Tu es un extracteur de données sportives. On te donne une capture d'écran d'une montre GPS " +
  "ou d'une app de course (Strava, Garmin, Apple Fitness, Coros, tapis…). Extrais UNIQUEMENT " +
  "les statistiques de LA course affichée. Réponds STRICTEMENT en JSON valide, sans aucun texte " +
  "autour, avec exactement ces clés : distanceKm (number|null, en kilomètres), durationMin " +
  "(number|null, durée totale en minutes), elevationM (number|null, dénivelé positif en mètres), " +
  "avgHr (number|null, fréquence cardiaque moyenne en bpm), pacePerKm (string|null, allure au " +
  "format 'm:ss' par kilomètre), confidence (number entre 0 et 1). Convertis les unités si besoin " +
  "(miles→km). Si une valeur est absente ou illisible, mets null. N'invente jamais de valeur.";

/** Extrait le premier bloc JSON d'une réponse potentiellement enrobée de texte/markdown. */
function extractJsonBlock(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start)
    throw new Error("Réponse IA sans JSON exploitable");
  return JSON.parse(candidate.slice(start, end + 1));
}

const numish = z.preprocess((v) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}, z.number().nullable());

// Tolère camelCase ET snake_case renvoyés par le modèle.
const extractionSchema = z
  .object({
    distanceKm: numish.optional(),
    distance_km: numish.optional(),
    durationMin: numish.optional(),
    duration_min: numish.optional(),
    elevationM: numish.optional(),
    elevation_m: numish.optional(),
    avgHr: numish.optional(),
    avg_hr: numish.optional(),
    pacePerKm: z.string().nullable().optional(),
    pace_per_km: z.string().nullable().optional(),
    confidence: numish.optional(),
  })
  .transform(
    (o): RunExtraction => ({
      distanceKm: o.distanceKm ?? o.distance_km ?? null,
      durationMin: o.durationMin ?? o.duration_min ?? null,
      elevationM: o.elevationM ?? o.elevation_m ?? null,
      avgHr: o.avgHr ?? o.avg_hr ?? null,
      pacePerKm: o.pacePerKm ?? o.pace_per_km ?? null,
      confidence: Math.min(1, Math.max(0, o.confidence ?? 0.5)),
    }),
  );

async function assertOwnSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("id, member_id")
    .eq("id", sessionId)
    .eq("member_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Séance introuvable");
}

/**
 * Lit une capture d'écran de course (déjà uploadée dans le bucket session-media)
 * et renvoie les stats extraites. Jamais bloquant côté produit : en cas d'échec,
 * l'UI bascule sur la saisie manuelle.
 */
export const analyzeRunScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), storagePath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RunExtraction> => {
    await assertOwnSession(data.sessionId, context.userId);
    // Anti-SSRF : on n'accepte que des chemins du dossier de l'utilisateur.
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Chemin de fichier non autorisé");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Analyse IA indisponible (clé manquante)");

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("session-media")
      .createSignedUrl(data.storagePath, 60 * 10);
    if (signErr || !signed?.signedUrl) throw new Error("Capture introuvable");

    let res: Response;
    try {
      res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Voici la capture d'écran de ma course. Renvoie le JSON demandé.",
                },
                { type: "image_url", image_url: { url: signed.signedUrl } },
              ],
            },
          ],
        }),
      });
    } catch {
      throw new Error("Service d'analyse injoignable");
    }

    if (res.status === 429) throw new Error("Trop de demandes d'analyse, réessaie dans un instant");
    if (res.status === 402) throw new Error("Quota d'analyse IA épuisé");
    if (!res.ok) throw new Error("L'analyse de la capture a échoué");

    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse d'analyse vide");

    return extractionSchema.parse(extractJsonBlock(content));
  });

/* ---------- Persistance des stats structurées ---------- */

const metricsSchema = z.object({
  distanceKm: z.number().min(0).max(1000).nullable(),
  durationSec: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24)
    .nullable(),
  elevationM: z.number().int().min(0).max(20000).nullable(),
  avgHr: z.number().int().min(0).max(300).nullable(),
  paceSecPerKm: z
    .number()
    .int()
    .min(0)
    .max(60 * 60)
    .nullable(),
  rpe: z.number().int().min(1).max(10).nullable(),
});

async function fetchPreviousRun(
  memberId: string,
  exceptSessionId: string,
): Promise<RunMetrics | null> {
  const { data } = await supabaseAdmin
    .from("run_stats")
    .select("distance_km, duration_sec, elevation_m, avg_hr, pace_sec_per_km, rpe, session_id")
    .eq("member_id", memberId)
    .neq("session_id", exceptSessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    distanceKm: data.distance_km != null ? Number(data.distance_km) : null,
    durationSec: data.duration_sec,
    elevationM: data.elevation_m,
    avgHr: data.avg_hr,
    paceSecPerKm: data.pace_sec_per_km,
    rpe: data.rpe,
  };
}

async function upsertRunStats(input: {
  sessionId: string;
  memberId: string;
  metrics: RunMetrics;
  source: "manual" | "screenshot" | "strava";
  confidence?: number | null;
  screenshotMediaId?: string | null;
  rawExtraction?: unknown;
}) {
  const { error } = await supabaseAdmin.from("run_stats").upsert(
    {
      session_id: input.sessionId,
      member_id: input.memberId,
      distance_km: input.metrics.distanceKm,
      duration_sec: input.metrics.durationSec,
      elevation_m: input.metrics.elevationM,
      avg_hr: input.metrics.avgHr,
      pace_sec_per_km: input.metrics.paceSecPerKm,
      rpe: input.metrics.rpe,
      source: input.source,
      confidence: input.confidence ?? null,
      screenshot_media_id: input.screenshotMediaId ?? null,
      raw_extraction: (input.rawExtraction ?? null) as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Termine une séance de course (contexte programme) : met à jour la séance,
 * enregistre les stats structurées et renvoie la course précédente pour la
 * comparaison instantanée affichée au coaché.
 */
export const finishRunningSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        metrics: metricsSchema,
        feeling: z.number().int().min(1).max(5).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        source: z.enum(["manual", "screenshot", "strava"]).default("manual"),
        confidence: z.number().min(0).max(1).nullable().optional(),
        screenshotMediaId: z.string().uuid().nullable().optional(),
        rawExtraction: z.unknown().optional(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; previous: RunMetrics | null; current: RunMetrics }> => {
      await assertOwnSession(data.sessionId, context.userId);

      const durationMin =
        data.metrics.durationSec != null ? Math.round(data.metrics.durationSec / 60) : null;
      const { error: updErr } = await supabaseAdmin
        .from("sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          average_rpe: data.metrics.rpe,
          overall_feeling: data.feeling ?? null,
          member_note: data.note?.trim() || null,
          duration_minutes: durationMin,
        })
        .eq("id", data.sessionId)
        .eq("member_id", context.userId);
      if (updErr) throw new Error(updErr.message);

      // La persistance run_stats est best-effort : si la table n'est pas encore
      // migrée en prod, la séance se termine quand même (dégradation gracieuse).
      let previous: RunMetrics | null = null;
      try {
        previous = await fetchPreviousRun(context.userId, data.sessionId);
        await upsertRunStats({
          sessionId: data.sessionId,
          memberId: context.userId,
          metrics: data.metrics,
          source: data.source,
          confidence: data.confidence ?? null,
          screenshotMediaId: data.screenshotMediaId ?? null,
          rawExtraction: data.rawExtraction,
        });
      } catch (e) {
        console.error("[finishRunningSession] run_stats indisponible", e);
      }

      return { ok: true, previous, current: data.metrics };
    },
  );

/**
 * Dérive et enregistre run_stats à partir de l'activité "course" d'une séance
 * libre déjà terminée. Appelé par finishFreeSession. Non bloquant.
 */
export async function upsertRunStatsFromFreeSession(
  sessionId: string,
  memberId: string,
): Promise<void> {
  const { data: acts } = await supabaseAdmin
    .from("free_activities")
    .select("distance_km, duration_min, elevation_m, rpe")
    .eq("session_id", sessionId)
    .eq("category", "course")
    .order("order_index", { ascending: true });
  if (!acts || acts.length === 0) return;

  // Agrège les activités course (cas courant : une seule).
  let distanceKm = 0;
  let durationSec = 0;
  let elevationM = 0;
  let rpeMax: number | null = null;
  let hasDistance = false;
  let hasDuration = false;
  let hasElevation = false;
  for (const a of acts) {
    if (a.distance_km != null) {
      distanceKm += Number(a.distance_km);
      hasDistance = true;
    }
    if (a.duration_min != null) {
      durationSec += a.duration_min * 60;
      hasDuration = true;
    }
    if (a.elevation_m != null) {
      elevationM += a.elevation_m;
      hasElevation = true;
    }
    if (a.rpe != null) rpeMax = Math.max(rpeMax ?? 0, a.rpe);
  }
  const distance = hasDistance ? Math.round(distanceKm * 100) / 100 : null;
  const duration = hasDuration ? durationSec : null;
  const paceSecPerKm = distance && duration ? Math.round(duration / distance) : null;

  const metrics: RunMetrics = {
    distanceKm: distance,
    durationSec: duration,
    elevationM: hasElevation ? elevationM : null,
    avgHr: null,
    paceSecPerKm,
    rpe: rpeMax,
  };
  if (
    metrics.distanceKm == null &&
    metrics.durationSec == null &&
    metrics.elevationM == null &&
    metrics.rpe == null
  ) {
    return; // rien d'exploitable
  }
  await upsertRunStats({ sessionId, memberId, metrics, source: "manual" });
}
