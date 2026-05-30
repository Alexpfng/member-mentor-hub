import { createFileRoute } from "@tanstack/react-router";
import Signup from "../pages/auth/Signup";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
  component: Signup,
});
