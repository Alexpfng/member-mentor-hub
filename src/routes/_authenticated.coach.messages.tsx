import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import CoachMessages from "../pages/coach/Messages";

const searchSchema = z.object({
  partner: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/coach/messages")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: CoachMessages,
});
