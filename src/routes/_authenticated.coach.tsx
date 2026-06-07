import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

function CoachGate() {
  const { role, loading, user } = useAuth();
  if (loading || (user && role === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (role !== "coach") return <Navigate to="/membre" />;
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachGate,
});
