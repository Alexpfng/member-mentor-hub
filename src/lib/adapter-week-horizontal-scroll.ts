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

type AdapterWeekHorizontalScrollLimitInput = {
  scrollWidth: number;
  clientWidth: number;
};

export function adapterWeekHorizontalScrollLimit({
  scrollWidth,
  clientWidth,
}: AdapterWeekHorizontalScrollLimitInput): number {
  return Math.max(0, Math.round(scrollWidth - clientWidth));
}
