import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SeedAccount = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "coach" | "member";
};

const ACCOUNTS: SeedAccount[] = [
  {
    email: "leocolognesi@gmail.com",
    password: "ColoSmart2024!",
    first_name: "Léo",
    last_name: "Colognesi",
    role: "coach",
  },
  {
    email: "morin.td@gmail.com",
    password: "TeddyBeta2024!",
    first_name: "Teddy",
    last_name: "Morin",
    role: "member",
  },
];

/**
 * Idempotent seed of the two beta accounts (Léo coach + Teddy member).
 * Safe to run multiple times — skips accounts that already exist.
 */
export const seedBetaAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const results: Array<{ email: string; status: string; user_id?: string }> = [];

  for (const acct of ACCOUNTS) {
    // 1. Check if profile already exists for this email
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", acct.email)
      .maybeSingle();

    let userId: string;

    if (existing?.id) {
      userId = existing.id;
      results.push({ email: acct.email, status: "already_exists", user_id: userId });
    } else {
      // 2. Create the auth user (auto-confirm email so they can log in immediately)
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: acct.email,
        password: acct.password,
        email_confirm: true,
        user_metadata: { first_name: acct.first_name, last_name: acct.last_name },
      });
      if (error || !data.user) {
        results.push({ email: acct.email, status: `error: ${error?.message ?? "unknown"}` });
        continue;
      }
      userId = data.user.id;
      results.push({ email: acct.email, status: "created", user_id: userId });
    }

    // 3. Ensure profile exists with correct first/last name (trigger may have created a partial one)
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: acct.email,
        first_name: acct.first_name,
        last_name: acct.last_name,
      },
      { onConflict: "id" },
    );

    // 4. Ensure correct role in user_roles
    //    The trigger inserts 'member' by default — overwrite for the coach.
    if (acct.role === "coach") {
      // Remove any existing 'member' row, insert 'coach'
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "coach" });
    } else {
      // Ensure a 'member' row exists
      const { data: rolesExisting } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "member")
        .maybeSingle();
      if (!rolesExisting) {
        await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "member" });
      }
    }
  }

  return { ok: true, results };
});
