import { createFileRoute } from "@tanstack/react-router";
import LoginPage from "../pages/auth/Login";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "/",
  }),
  component: LoginPage,
});
