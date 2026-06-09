import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import AdapterSemaine from "@/pages/coach/AdapterSemaine";

const searchSchema = z.object({
  week: z.coerce.number().int().min(0).max(200).optional(),
  weekId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/coach/membre/$memberId/adapter")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AdapterSemaine,
});
