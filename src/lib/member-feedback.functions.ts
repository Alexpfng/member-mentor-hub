import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CoachComment = {
  session_id: string;
  exercise_name: string | null;
  content: string;
  created_at: string;
  author_role: string;
};

type TechVideo = {
  session_id: string | null;
  exercise_name: string | null;
  coach_reviewed: boolean | null;
  unread_for_member: boolean | null;
  created_at: string | null;
};

export type MemberFeedbackSession = {
  id: string;
  label: string;
  date: string | null;
  endedAt: string | null;
  weekNumber: number | null;
  dayNumber: number | null;
  coachNote: string | null;
  exercises: string[];
  coachCommentCount: number;
  videoCount: number;
  unseen: boolean;
  lastFeedbackAt: string | null;
};

// Retours du coach côté membre : mot du coach sur la séance + réponses par
// exercice (fil technique) + vidéos revues, pour les séances récentes.
// Le membre n'avait aucune vue post-séance de ces échanges (le fil n'existe que
// pendant la séance en cours) — cette fonction alimente l'écran « Retours ».
export const getMemberCoachFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const memberId = context.userId;

    // 60 séances terminées les plus récentes (pas de plancher de date : certaines
    // séances libres n'ont qu'ended_at, un filtre sur `date` les manquerait).
    const { data: sessions, error } = await supabaseAdmin
      .from("sessions")
      .select("id, session_label, date, ended_at, week_number, day_number, coach_note, free_title")
      .eq("member_id", memberId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false, nullsFirst: false })
      .order("date", { ascending: false, nullsFirst: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const list = sessions ?? [];
    const ids = list.map((s: { id: string }) => s.id);
    if (ids.length === 0) {
      return { sessions: [] as MemberFeedbackSession[], unseenCount: 0 };
    }

    const [{ data: commentsData }, { data: videosData }] = await Promise.all([
      supabaseAdmin
        .from("exercise_comments")
        .select("session_id, exercise_name, content, created_at, author_role")
        .in("session_id", ids)
        .eq("author_role", "coach")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("technique_videos")
        .select("session_id, exercise_name, coach_reviewed, unread_for_member, created_at")
        .eq("member_id", memberId)
        .in("session_id", ids),
    ]);

    const comments = (commentsData ?? []) as CoachComment[];
    const videos = (videosData ?? []) as TechVideo[];

    const commentsBySession = new Map<string, CoachComment[]>();
    for (const c of comments) {
      const arr = commentsBySession.get(c.session_id) ?? [];
      arr.push(c);
      commentsBySession.set(c.session_id, arr);
    }
    const videosBySession = new Map<string, TechVideo[]>();
    for (const v of videos) {
      if (!v.session_id) continue;
      const arr = videosBySession.get(v.session_id) ?? [];
      arr.push(v);
      videosBySession.set(v.session_id, arr);
    }

    let unseenCount = 0;
    const result: MemberFeedbackSession[] = [];

    for (const s of list) {
      const cs = commentsBySession.get(s.id) ?? [];
      const vs = videosBySession.get(s.id) ?? [];
      const reviewedVideos = vs.filter((v) => v.coach_reviewed);
      const note = s.coach_note && s.coach_note.trim() ? s.coach_note.trim() : null;
      const hasFeedback = !!note || cs.length > 0 || reviewedVideos.length > 0;
      if (!hasFeedback) continue;

      const exSet = new Set<string>();
      for (const c of cs) if (c.exercise_name) exSet.add(c.exercise_name);
      for (const v of reviewedVideos) if (v.exercise_name) exSet.add(v.exercise_name);

      const unseen = vs.some((v) => v.unread_for_member);
      if (unseen) unseenCount++;

      const commentTimes = cs.map((c) => c.created_at).filter(Boolean).sort();
      const lastFeedbackAt = commentTimes.length
        ? commentTimes[commentTimes.length - 1]
        : (s.ended_at ?? s.date ?? null);

      result.push({
        id: s.id,
        label: s.free_title || s.session_label || "Séance",
        date: s.date ?? null,
        endedAt: s.ended_at ?? null,
        weekNumber: s.week_number ?? null,
        dayNumber: s.day_number ?? null,
        coachNote: note,
        exercises: Array.from(exSet),
        coachCommentCount: cs.length,
        videoCount: vs.length,
        unseen,
        lastFeedbackAt,
      });
    }

    // Non-vus d'abord, puis par date du dernier retour (récent → ancien).
    result.sort((a, b) => {
      if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
      return (b.lastFeedbackAt ?? "").localeCompare(a.lastFeedbackAt ?? "");
    });

    return { sessions: result, unseenCount };
  });
