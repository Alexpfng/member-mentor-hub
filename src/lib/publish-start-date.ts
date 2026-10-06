import { localDateISO } from "@/lib/local-date";

export function defaultPublishStartDate(
  currentStartDate?: string | null,
  todayISO = localDateISO(),
) {
  if (currentStartDate) return currentStartDate.slice(0, 10);
  return todayISO;
}
