import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_EMAIL = "yeti-demo@colosmartraining.fr";
const DEMO_NAME = "Yéti";
const DEMO_PROGRAM = "Prépa trail · compte démo";
const startsByIp = new Map<string, number[]>();

function dateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function mondayOf(date: Date) {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
}

function limitDemoStarts(ip: string) {
  const now = Date.now();
  const attempts = (startsByIp.get(ip) ?? []).filter((at) => now - at < 60_000);
  if (attempts.length >= 20) throw new Error("Trop d’essais rapprochés. Réessaie dans une minute.");
  attempts.push(now);
  startsByIp.set(ip, attempts);
}

async function findDemoUser() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw new Error("Impossible de préparer le compte démo.");
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === DEMO_EMAIL);
    if (user) return user;
    if (data.users.length < 500) break;
  }
  return null;
}

async function ensureDemoUser() {
  let user = await findDemoUser();
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      email_confirm: true,
      app_metadata: { demo_mode: true },
      user_metadata: { first_name: DEMO_NAME, last_name: "" },
    });
    if (error || !data.user) throw new Error("Impossible de créer le compte démo.");
    user = data.user;
  } else if (user.app_metadata?.demo_mode !== true) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, demo_mode: true },
    });
    if (error || !data.user) throw new Error("Impossible de sécuriser le compte démo.");
    user = data.user;
  }

  const admin = supabaseAdmin as any;
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: user.id, email: DEMO_EMAIL, first_name: DEMO_NAME, last_name: "", is_demo: true });
  if (profileError) throw new Error("La base démo n’est pas encore initialisée.");

  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError) throw new Error("Impossible de préparer le profil démo.");
  if (!(roleRows ?? []).some((row: { role: string }) => row.role === "member")) {
    const { error } = await admin.from("user_roles").insert({ user_id: user.id, role: "member" });
    if (error) throw new Error("Impossible d’activer l’espace membre démo.");
  }

  await ensureDemoProgram(user.id, admin);

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (linkError || !link.properties?.hashed_token) {
    throw new Error("Impossible de démarrer la session démo.");
  }
  return { tokenHash: link.properties.hashed_token };
}

async function ensureDemoProgram(memberId: string, admin: any) {
  const { data: activeAssignment, error: assignmentError } = await admin
    .from("assignments")
    .select("id, program_id")
    .eq("member_id", memberId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (assignmentError) throw new Error("Impossible de charger le programme démo.");

  const { error: memberProfileError } = await admin.from("member_profiles").upsert({
    user_id: memberId,
    level: "intermédiaire",
    goal: "Préparer un trail de 30 km · 1 500 m D+",
    weight_kg: 112,
    height_cm: 198,
  });
  if (memberProfileError) throw new Error("Impossible de préparer le profil sportif démo.");
  if (activeAssignment) {
    const { error: programFlagError } = await admin
      .from("programs")
      .update({ is_demo: true })
      .eq("id", activeAssignment.program_id);
    if (programFlagError) throw new Error("Impossible d’isoler le programme démo.");
    return;
  }

  const { data: coachRole, error: coachError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "coach")
    .limit(1)
    .maybeSingle();
  if (coachError || !coachRole?.user_id) throw new Error("Le programme démo n’a pas de coach de référence.");

  const dayTemplates = [
    { day_number: 1, label: "Course · endurance fondamentale", exercises: [{ name: "Footing facile", sets: 1, reps: "45–60 min", rpe_target: 5 }] },
    { day_number: 2, label: "Renforcement · bas du corps", exercises: [{ name: "Step-up contrôlé", sets: 3, reps: "8 / jambe", rpe_target: 7 }, { name: "Fentes bulgares", sets: 3, reps: "8 / jambe", rpe_target: 7 }, { name: "Élévations tibiales", sets: 3, reps: "20", rpe_target: 6 }] },
    { day_number: 3, label: "Récupération · mobilité", exercises: [{ name: "Mobilité hanches et chevilles", sets: 1, reps: "15 min", rpe_target: 3 }] },
    { day_number: 4, label: "Course · côtes", exercises: [{ name: "Montées progressives", sets: 6, reps: "1 min", rpe_target: 7 }] },
    { day_number: 5, label: "Renforcement · gainage", exercises: [{ name: "Star plank", sets: 2, reps: "20 s / côté", rpe_target: 6 }, { name: "Pont fessier une jambe", sets: 3, reps: "10 / jambe", rpe_target: 6 }] },
  ];
  const structure = {
    weeks: Array.from({ length: 10 }, (_, index) => ({
      week_number: index + 1,
      label: `Semaine ${String(index + 1).padStart(2, "0")}`,
      days: dayTemplates,
    })),
  };
  const { data: program, error: programError } = await admin
    .from("programs")
    .insert({
      coach_id: coachRole.user_id,
      name: DEMO_PROGRAM,
      description: "Un exemple fictif de préparation trail, construit autour du profil Yéti.",
      duration_weeks: 10,
      frequency_per_week: 4,
      objective: "Trail · 30 km · 1 500 m D+",
      level: "intermédiaire",
      is_demo: true,
      structure,
    })
    .select("id")
    .single();
  if (programError || !program) throw new Error("Impossible de créer le programme démo.");

  const today = new Date();
  const currentMonday = mondayOf(today);
  const startDate = addDays(currentMonday, -35);
  const { error: newAssignmentError } = await admin.from("assignments").insert({
    member_id: memberId,
    program_id: program.id,
    start_date: dateISO(startDate),
    end_date: dateISO(addDays(startDate, 69)),
    active: true,
  });
  if (newAssignmentError) throw new Error("Impossible d’assigner le programme démo.");

  const planned = [
    { offset: 1, label: "Course · endurance fondamentale" },
    { offset: 2, label: "Renforcement · bas du corps" },
    { offset: 4, label: "Course · côtes" },
    { offset: 6, label: "Renforcement · gainage" },
  ].map((day) => ({
    member_id: memberId,
    program_id: program.id,
    week_number: 6,
    day_label: day.label,
    planned_date: dateISO(addDays(currentMonday, day.offset)),
    status: "planned",
  }));
  const { error: plannedError } = await admin.from("planned_sessions").insert(planned);
  if (plannedError) throw new Error("Impossible de préparer le planning démo.");

  const history = Array.from({ length: 5 }, (_, weekIndex) =>
    [1, 5].map((dayOffset, sessionIndex) => {
      const date = addDays(startDate, weekIndex * 7 + dayOffset);
      const label = sessionIndex === 0 ? "Course · endurance fondamentale" : "Renforcement · bas du corps";
      return {
        member_id: memberId,
        program_id: program.id,
        week_number: weekIndex + 1,
        day_number: sessionIndex + 1,
        session_label: label,
        date: dateISO(date),
        started_at: new Date(date.getTime() + 16 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(date.getTime() + 17 * 60 * 60 * 1000).toISOString(),
        duration_minutes: sessionIndex === 0 ? 52 : 40,
        overall_feeling: 7,
        status: "completed",
      };
    }),
  ).flat();
  const { error: historyError } = await admin.from("sessions").insert(history);
  if (historyError) throw new Error("Impossible de préparer les exemples de progression.");
}

export const createDemoSession = createServerFn({ method: "POST" }).handler(async () => {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  limitDemoStarts(forwarded || "unknown");
  const { tokenHash } = await ensureDemoUser();
  return { tokenHash };
});
