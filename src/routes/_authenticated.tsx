import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkRole() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      const role = (roleRow?.role as "coach" | "member" | null) ?? "member";
      const path = router.state.location.pathname;
      if (cancelled) return;
      if (role === "coach" && path.startsWith("/membre")) {
        router.navigate({ to: "/coach" });
      } else if (role === "member" && path.startsWith("/coach")) {
        router.navigate({ to: "/membre" });
      }
      setChecked(true);
    }
    checkRole();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.state.location.pathname]);

  if (!checked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green, #0F1F12)", color: "rgba(255,255,255,0.5)", fontFamily: "var(--cst-mono, monospace)", fontSize: 11, letterSpacing: "0.18em" }}>
        CHARGEMENT…
      </div>
    );
  }
  return <Outlet />;
}
