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
      // getSession() reads the persisted session from localStorage (no network),
      // so it is reliable on a cold load / direct URL / full reload — unlike
      // getUser() which makes a network call that may not be ready yet and
      // would wrongly bounce the user to /login.
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return;
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
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (cancelled || !user) return;

        const { data: roleRow, error: roleErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;

        // Only redirect on a DEFINITE role mismatch. If the role lookup failed
        // or returned nothing, do NOT bounce — server functions still enforce
        // access, and a transient null role must never kick a coach off /coach.
        const role = roleErr ? null : (roleRow?.role as "coach" | "member" | null);
        if (!role) return;
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
