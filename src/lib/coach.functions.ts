import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

const programSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  duration_weeks: z.number().int().min(1).max(52).optional().nullable(),
  frequency_per_week: z.number().int().min(1).max(7).optional().nullable(),
  objective: z.string().max(80).optional().nullable(),
  level: z.string().max(80).optional().nullable(),
  structure: z.any().optional(),
});

export const saveProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => programSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const payload = {
      coach_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      duration_weeks: data.duration_weeks ?? null,
      frequency_per_week: data.frequency_per_week ?? null,
      objective: data.objective ?? null,
      level: data.level ?? null,
      structure: data.structure ?? {},
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("programs")
        .update(payload)
        .eq("id", data.id)
        .eq("coach_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { program: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("programs")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { program: row };
  });

export const listPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const { data, error } = await supabaseAdmin
      .from("programs")
      .select("id, name, description, duration_weeks, frequency_per_week, objective, level, created_at")
      .eq("coach_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { programs: data ?? [] };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "member");
    if (rErr) throw new Error(rErr.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { members: [] };

    const [{ data: profiles }, { data: assignments }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name, created_at")
        .in("id", ids),
      supabaseAdmin
        .from("assignments")
        .select("member_id, program_id, active, start_date")
        .in("member_id", ids)
        .eq("active", true),
    ]);

    const programIds = Array.from(
      new Set((assignments ?? []).map((a) => a.program_id).filter(Boolean)),
    );
    let programsById = new Map<string, string>();
    if (programIds.length > 0) {
      const { data: progs } = await supabaseAdmin
        .from("programs")
        .select("id, name")
        .in("id", programIds);
      programsById = new Map((progs ?? []).map((p) => [p.id, p.name]));
    }

    const assignMap = new Map<string, any>();
    (assignments ?? []).forEach((a: any) => {
      assignMap.set(a.member_id, a);
    });

    const members = (profiles ?? []).map((p) => {
      const a = assignMap.get(p.id);
      return {
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        created_at: p.created_at,
        program_name: a ? programsById.get(a.program_id) ?? null : null,
        program_id: a?.program_id ?? null,
      };
    });
    return { members };
  });


const inviteSchema = z.object({
  email: z.string().email().max(255),
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
  redirect_to: z.string().url(),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: result, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        redirectTo: data.redirect_to,
        data: {
          first_name: data.first_name ?? null,
          last_name: data.last_name ?? null,
        },
      },
    );
    if (error) throw new Error(error.message);
    return { user_id: result.user?.id ?? null, email: data.email };
  });

const assignSchema = z.object({
  member_id: z.string().uuid(),
  program_id: z.string().uuid(),
  start_date: z.string().optional(),
});

export const assignProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    // Deactivate previous assignments for this member
    await supabaseAdmin
      .from("assignments")
      .update({ active: false })
      .eq("member_id", data.member_id)
      .eq("active", true);
    const { data: row, error } = await supabaseAdmin
      .from("assignments")
      .insert({
        member_id: data.member_id,
        program_id: data.program_id,
        active: true,
        start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { assignment: row };
  });
