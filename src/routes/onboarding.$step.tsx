import { createFileRoute } from "@tanstack/react-router";
import Onboarding from "../pages/auth/Onboarding";

export const Route = createFileRoute("/onboarding/$step")({
  component: Onboarding,
});
