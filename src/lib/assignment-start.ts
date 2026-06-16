export function deriveAssignmentStartDate(selectedDate: string, startWeek: number): string {
  const safeWeek = Number.isFinite(startWeek) && startWeek > 0 ? Math.floor(startWeek) : 1;
  const base = new Date(`${selectedDate}T00:00:00`);

  if (Number.isNaN(base.getTime())) {
    throw new Error("Date de début invalide");
  }

  base.setDate(base.getDate() - (safeWeek - 1) * 7);
  return base.toISOString().slice(0, 10);
}
