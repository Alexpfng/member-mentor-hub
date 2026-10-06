import { displayProgramDayLabel, type WeekDay } from "@/lib/program-weeks";
import type { Json } from "@/integrations/supabase/types";

export type MemberWeekDetail = {
  label: string;
  type: string | null;
  isRest: boolean;
  exercises: Json[];
};

export function buildMemberWeekDetails(days: WeekDay[] | null | undefined): MemberWeekDetail[] {
  return (days ?? []).map((day, index) => ({
    label: displayProgramDayLabel(day, index),
    type: day.type ?? null,
    isRest: day.type?.toLocaleLowerCase("fr-FR") === "repos",
    exercises: Array.isArray(day.exercises) ? (day.exercises as Json[]) : [],
  }));
}
