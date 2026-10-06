export type CatchupReason = "no_time" | "coach_request" | "member_request";

export type CatchupInfo =
  | { active: false }
  | {
      active: true;
      sourcePlannedId: string | null;
      sourceWeekNumber: number | null;
      sourcePlannedDate: string | null;
      reason: CatchupReason;
    };

type CatchupMetadataInput = {
  sourcePlannedId: string;
  sourceWeekNumber: number | null;
  sourcePlannedDate: string | null;
  reason?: CatchupReason;
};

type RowWithMetadata = {
  metadata?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function buildCatchupMetadata({
  sourcePlannedId,
  sourceWeekNumber,
  sourcePlannedDate,
  reason = "no_time",
}: CatchupMetadataInput) {
  return {
    catchup: true,
    source_planned_id: sourcePlannedId,
    source_week_number: sourceWeekNumber,
    source_planned_date: sourcePlannedDate,
    reason,
  };
}

export function getCatchupInfo(row: RowWithMetadata | null | undefined): CatchupInfo {
  const metadata = row?.metadata;
  if (!isRecord(metadata) || metadata.catchup !== true) return { active: false };

  const reason = metadata.reason === "coach_request" || metadata.reason === "member_request"
    ? metadata.reason
    : "no_time";
  const sourceWeekNumber =
    typeof metadata.source_week_number === "number" ? metadata.source_week_number : null;

  return {
    active: true,
    sourcePlannedId:
      typeof metadata.source_planned_id === "string" ? metadata.source_planned_id : null,
    sourceWeekNumber,
    sourcePlannedDate:
      typeof metadata.source_planned_date === "string" ? metadata.source_planned_date : null,
    reason,
  };
}

export function isCatchupPlannedSession(row: RowWithMetadata | null | undefined): boolean {
  return getCatchupInfo(row).active;
}

export function catchupFirst<T extends RowWithMetadata & { planned_date?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const priority = Number(isCatchupPlannedSession(b)) - Number(isCatchupPlannedSession(a));
    if (priority !== 0) return priority;
    return String(a.planned_date ?? "").localeCompare(String(b.planned_date ?? ""));
  });
}
