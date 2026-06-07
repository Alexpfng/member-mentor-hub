import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ENABLED } from "@/lib/app-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!SUPABASE_ENABLED) return;
    if (typeof window === "undefined") return;

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return;
    } catch {
      // fall through
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
  // role-vs-path check is non-blocking — render children immediately.
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (cancelled || !userData.user) return;

        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (cancelled) return;

        const role = (roleRow?.role as "coach" | "member" | null) ?? "member";
        const path = router.state.location.pathname;

        if (role === "coach" && path.startsWith("/membre")) {
          setRedirecting(true);
          router.navigate({ to: "/coach" });
        } else if (role === "member" && path.startsWith("/coach")) {
          setRedirecting(true);
          router.navigate({ to: "/membre" });
        }
      } catch (err) {
        console.error("[_authenticated] role check failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.state.location.pathname]);

  if (redirecting) {
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
        REDIRECTION…
      </div>
    );
  }
  return <Outlet />;
}
