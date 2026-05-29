import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function isCoach(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  return !!data;
}

async function canSeeSession(userId: string, sessionId: string): Promise<{ ok: boolean; memberId?: string; coach: boolean }> {
  const coach = await isCoach(userId);
  const { data: s, error } = await supabaseAdmin
    .from("sessions")
    .select("id, member_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !s) return { ok: false, coach };
  return { ok: coach || s.member_id === userId, memberId: s.member_id, coach };
}

// ── Get thread: videos + comments for one (session, exercise_name)
export const getExerciseThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), exerciseName: z.string().min(1).max(255) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const acc = await canSeeSession(context.userId, data.sessionId);
    if (!acc.ok) throw new Error("Accès refusé");

    const [{ data: videos }, { data: comments }] = await Promise.all([
      supabaseAdmin
        .from("technique_videos")
        .select("id, exercise_name, storage_path, thumbnail_url, created_at, coach_reviewed, unread_for_member, member_id")
        .eq("session_id", data.sessionId)
        .eq("exercise_name", data.exerciseName)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("exercise_comments")
        .select("id, content, author_id, author_role, created_at, video_id")
        .eq("session_id", data.sessionId)
        .eq("exercise_name", data.exerciseName)
        .order("created_at", { ascending: true }),
    ]);

    // Clear unread badge if member viewing
    if (!acc.coach && videos && videos.some(v => v.unread_for_member)) {
      await supabaseAdmin
        .from("technique_videos")
        .update({ unread_for_member: false })
        .eq("session_id", data.sessionId)
        .eq("exercise_name", data.exerciseName)
        .eq("member_id", context.userId);
    }

    return { videos: videos ?? [], comments: comments ?? [] };
  });

// ── Post a comment
export const postExerciseComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      exerciseName: z.string().min(1).max(255),
      videoId: z.string().uuid().optional().nullable(),
      content: z.string().trim().min(1).max(2000),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const acc = await canSeeSession(context.userId, data.sessionId);
    if (!acc.ok) throw new Error("Accès refusé");
    const role: "coach" | "member" = acc.coach ? "coach" : "member";

    const { data: row, error } = await supabaseAdmin
      .from("exercise_comments")
      .insert({
        session_id: data.sessionId,
        exercise_name: data.exerciseName,
        video_id: data.videoId ?? null,
        author_id: context.userId,
        author_role: role,
        content: data.content,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // If coach commented → flag unread for member
    if (role === "coach") {
      const upd: any = { unread_for_member: true };
      if (data.videoId) upd.coach_reviewed = true;
      await supabaseAdmin
        .from("technique_videos")
        .update(upd)
        .eq("session_id", data.sessionId)
        .eq("exercise_name", data.exerciseName);
    }

    return row;
  });

// ── Signed URL for a private video
export const getSignedVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ storagePath: z.string().min(1).max(1024) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Verify access: coach OR owner (path starts with userId/)
    const coach = await isCoach(context.userId);
    const ownerSegment = data.storagePath.split("/")[0];
    if (!coach && ownerSegment !== context.userId) throw new Error("Accès refusé");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("technique-videos")
      .createSignedUrl(data.storagePath, 60 * 60);
    if (error || !signed) throw new Error(error?.message || "URL signée indisponible");
    return { url: signed.signedUrl };
  });

// ── Mark video reviewed
export const markVideoReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ videoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const coach = await isCoach(context.userId);
    if (!coach) throw new Error("Réservé au coach");
    const { error } = await supabaseAdmin
      .from("technique_videos")
      .update({ coach_reviewed: true, reviewed_at: new Date().toISOString() })
      .eq("id", data.videoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Coach review queue (videos not yet reviewed, grouped by member)
export const getCoachReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const coach = await isCoach(context.userId);
    if (!coach) throw new Error("Réservé au coach");
    const { data: videos, error } = await supabaseAdmin
      .from("technique_videos")
      .select("id, member_id, session_id, exercise_name, storage_path, created_at, coach_reviewed")
      .eq("coach_reviewed", false)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const memberIds = Array.from(new Set((videos ?? []).map(v => v.member_id)));
    const { data: profiles } = memberIds.length
      ? await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", memberIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return (videos ?? []).map(v => ({
      ...v,
      member: profileMap.get(v.member_id) ?? null,
    }));
  });

// ── List videos for a member (coach view of member detail)
export const listMemberVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const coach = await isCoach(context.userId);
    if (!coach && context.userId !== data.memberId) throw new Error("Accès refusé");
    const { data: videos, error } = await supabaseAdmin
      .from("technique_videos")
      .select("id, session_id, exercise_name, storage_path, created_at, coach_reviewed")
      .eq("member_id", data.memberId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return videos ?? [];
  });
