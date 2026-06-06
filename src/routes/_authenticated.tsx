import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ENABLED } from "@/lib/app-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!SUPABASE_ENABLED) {
      return;
    }

    // Route auth is resolved client-side because the browser Supabase client
    // cannot read the user's local session during SSR.
    if (typeof window === "undefined") {
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        return;
      }
    } catch {
      // Fall through to the login redirect below.
    }

    throw redirect({
      to: "/login",
      search: { redirect: location.href },
    });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const [checked, setChecked] = useState(!SUPABASE_ENABLED);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      return;
    }

    let cancelled = false;

    async function checkRole() {
      try {
        const { data: userData, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error || !userData.user) {
          router.navigate({
            to: "/login",
            search: { redirect: router.state.location.href },
          });
          return;
        }

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
      } catch {
        if (cancelled) return;
        router.navigate({
          to: "/login",
          search: { redirect: router.state.location.href },
        });
      }
    }

    checkRole();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.state.location.pathname]);

  if (!checked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--cst-bg)",
          color: "var(--cst-text-muted)",
          fontFamily: "var(--cst-mono, monospace)",
          fontSize: 11,
          letterSpacing: "0.18em",
        }}
      >
        CHARGEMENT…
      </div>
    );
  }
  return <Outlet />;
}
