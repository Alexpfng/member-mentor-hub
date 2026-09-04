import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  normalizeMemberAppEventRows,
  summarizeMemberAppEvents,
} from "@/lib/member-app-events";
import type { Json } from "@/integrations/supabase/types";

const eventNameSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9_:-]+$/);

const metadataSchema = z.record(z.string(), z.unknown()).default({});

async function assertCoach(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux coachs");
}

export async function recordMemberAppEvent(input: {
  memberId: string;
  eventName: string;
  actorUserId?: string | null;
  actorRole?: "member" | "coach" | "system";
  path?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  userAgent?: string | null;
}) {
  const { error } = await supabaseAdmin.from("member_app_events").insert({
    member_id: input.memberId,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? "member",
    event_name: input.eventName,
    path: input.path ?? null,
    session_id: input.sessionId ?? null,
    metadata: (input.metadata ?? {}) as Json,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    console.error("[member-app-events] insert failed", {
      memberId: input.memberId,
      eventName: input.eventName,
      error,
    });
  }
}

export const trackMemberAppEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventName: eventNameSchema,
        path: z.string().max(300).optional().nullable(),
        sessionId: z.string().uuid().optional().nullable(),
        metadata: metadataSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const request = getRequest();
    await recordMemberAppEvent({
      memberId: context.userId,
      actorUserId: context.userId,
      actorRole: "member",
      eventName: data.eventName,
      path: data.path ?? null,
      sessionId: data.sessionId ?? null,
      metadata: data.metadata ?? {},
      userAgent: request?.headers.get("user-agent") ?? null,
    });
    return { ok: true };
  });

export const getCoachMemberAppEventFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(80),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("member_app_events")
      .select("id, member_id, event_name, created_at, metadata, profiles(first_name, last_name, email)")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return {
          events: [],
          summaries: [],
          migrationMissing: true,
        };
      }
      throw new Error(error.message);
    }

    const events = normalizeMemberAppEventRows(
      (rows ?? []) as Parameters<typeof normalizeMemberAppEventRows>[0],
    );
    return {
      events,
      summaries: summarizeMemberAppEvents(events),
      migrationMissing: false,
    };
  });
