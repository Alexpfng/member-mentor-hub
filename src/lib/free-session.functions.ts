import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FREE_CATEGORIES = ["muscu", "course", "cardio", "sport", "mobilite", "autre"] as const;

/* ---------- Session ---------- */

export const createFreeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        category: z.enum(FREE_CATEGORIES).optional().nullable(),
        title: z.string().max(200).optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        member_id: context.userId,
        session_type: "free",
        free_category: data.category ?? null,
        free_title: data.title?.trim() || null,
        session_label: data.title?.trim() || "Séance libre",
        date: today,
        started_at: new Date().toISOString(),
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: row.id };
  });

export const updateFreeSessionMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        category: z.enum(FREE_CATEGORIES).optional().nullable(),
        title: z.string().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.category !== undefined) patch.free_category = data.category;
    if (data.title !== undefined) {
      const t = data.title?.trim() || null;
      patch.free_title = t;
      patch.session_label = t || "Séance libre";
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin
      .from("sessions")
      .update(patch)
      .eq("id", data.sessionId)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finishFreeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        overallFeeling: z.number().int().min(1).max(5).optional().nullable(),
        averageRpe: z.number().int().min(1).max(10).optional().nullable(),
        memberNote: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sess } = await supabaseAdmin
      .from("sessions")
      .select("id, started_at, free_title, session_label")
      .eq("id", data.sessionId)
      .eq("member_id", context.userId)
      .maybeSingle();
    if (!sess) throw new Error("Séance introuvable");

    const endedAt = new Date();
    let durationMin: number | null = null;
    if (sess.started_at) {
      const ms = endedAt.getTime() - new Date(sess.started_at).getTime();
      durationMin = Math.max(0, Math.round(ms / 60000));
    }

    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        status: "completed",
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMin,
        overall_feeling: data.overallFeeling ?? null,
        average_rpe: data.averageRpe ?? null,
        member_note: data.memberNote?.trim() || null,
      })
      .eq("id", data.sessionId)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);

    // Notifier le coach via Messages
    try {
      const { data: coachRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach")
        .limit(1)
        .maybeSingle();
      if (coachRole?.user_id) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", context.userId)
          .maybeSingle();
        const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "Un membre";
        const title = sess.free_title || sess.session_label || "Séance libre";
        await supabaseAdmin.from("messages").insert({
          from_id: context.userId,
          to_id: coachRole.user_id,
          content: `${name} a fait une séance libre · ${title}`,
        });
      }
    } catch {
      /* non-bloquant */
    }

    return { ok: true, durationMin };
  });

/* ---------- Free activities ---------- */

const activityInput = z.object({
  name: z.string().min(1).max(160),
  category: z.string().max(40).optional().nullable(),
  series: z.number().int().min(0).max(50).optional().nullable(),
  reps: z.string().max(40).optional().nullable(),
  charge: z.string().max(40).optional().nullable(),
  distance_km: z.number().min(0).max(1000).optional().nullable(),
  duration_min: z.number().int().min(0).max(60 * 24).optional().nullable(),
  elevation_m: z.number().int().min(0).max(20000).optional().nullable(),
  rpe: z.number().int().min(1).max(10).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

async function ensureOwnSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("member_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Séance introuvable");
}

export const addFreeActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        activity: activityInput,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOwnSession(data.sessionId, context.userId);
    const { count } = await supabaseAdmin
      .from("free_activities")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId);
    const { data: row, error } = await supabaseAdmin
      .from("free_activities")
      .insert({
        session_id: data.sessionId,
        ...data.activity,
        order_index: count ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateFreeActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        sessionId: z.string().uuid(),
        activity: activityInput,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOwnSession(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("free_activities")
      .update({ ...data.activity })
      .eq("id", data.id)
      .eq("session_id", data.sessionId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteFreeActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOwnSession(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("free_activities")
      .delete()
      .eq("id", data.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFreeActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("free_activities")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ---------- Session media ---------- */

export const attachSessionMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        type: z.enum(["photo", "video"]),
        storagePath: z.string().min(1).max(500),
        thumbnailPath: z.string().min(1).max(500).optional().nullable(),
        caption: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOwnSession(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("session_media")
      .insert({
        session_id: data.sessionId,
        member_id: context.userId,
        type: data.type,
        storage_path: data.storagePath,
        thumbnail_path: data.thumbnailPath ?? null,
        caption: data.caption?.trim() || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSessionMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("session_media")
      .select("storage_path, thumbnail_path, member_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    // permission: owner or coach
    const isOwner = row.member_id === context.userId;
    if (!isOwner) {
      const { data: rr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "coach")
        .maybeSingle();
      if (!rr) throw new Error("Non autorisé");
    }
    const paths = [row.storage_path, row.thumbnail_path].filter(Boolean) as string[];
    if (paths.length) await supabaseAdmin.storage.from("session-media").remove(paths);
    await supabaseAdmin.from("session_media").delete().eq("id", data.id);
    return { ok: true };
  });

export const updateMediaCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), caption: z.string().max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("session_media")
      .update({ caption: data.caption.trim() || null })
      .eq("id", data.id)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSessionMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("session_media")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const out = await Promise.all(
      (rows ?? []).map(async (m) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("session-media")
          .createSignedUrl(m.storage_path, 60 * 60 * 6);
        let thumbUrl: string | null = null;
        if (m.thumbnail_path) {
          const { data: t } = await supabaseAdmin.storage
            .from("session-media")
            .createSignedUrl(m.thumbnail_path, 60 * 60 * 6);
          thumbUrl = t?.signedUrl ?? null;
        }
        return {
          id: m.id,
          type: m.type as "photo" | "video",
          caption: m.caption,
          createdAt: m.created_at,
          url: signed?.signedUrl ?? null,
          thumbnailUrl: thumbUrl ?? signed?.signedUrl ?? null,
        };
      }),
    );
    return out;
  });
