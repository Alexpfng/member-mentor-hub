type AdapterWeekHorizontalScrollWidthInput = {
  dayCount: number;
  dayWidth?: number;
  addDayWidth?: number;
  gap?: number;
};

export function adapterWeekHorizontalScrollWidth({
  dayCount,
  dayWidth = 360,
  addDayWidth = 140,
  gap = 14,
}: AdapterWeekHorizontalScrollWidthInput): number {
  if (dayCount <= 0) return 0;
  return dayCount * dayWidth + addDayWidth + dayCount * gap;
}
