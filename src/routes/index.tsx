import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DEMO_ROLE, SUPABASE_ENABLED } from "@/lib/app-mode";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (!SUPABASE_ENABLED) {
      throw redirect({ to: DEFAULT_DEMO_ROLE === "coach" ? "/coach" : "/membre" });
    }

    // Never rely on the browser Supabase client during SSR. On the server we
    // don't have the user's local session, so trying to resolve it can turn a
    // simple unauthenticated visit into a hard 500.
    if (typeof window === "undefined") {
      throw redirect({ to: "/login" });
    }

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        throw redirect({ to: "/login" });
      }

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const role = (roleRow?.role as string | undefined) ?? "member";

      throw redirect({ to: role === "coach" ? "/coach" : "/membre" });
    } catch (error) {
      if (error != null && typeof error === "object" && "to" in error) {
        throw error;
      }
      throw redirect({ to: "/login" });
    }
  },
});
