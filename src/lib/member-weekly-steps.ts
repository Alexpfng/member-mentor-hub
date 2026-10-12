export type StepEntry = { date: string; steps: number | null };

export type WeeklySteps = {
  monday: string;
  total: number;
  daysTracked: number;
  goal: number | null;
  goalReached: boolean | null;
};

function mondayISO(date: string) {
  const monday = new Date(`${date}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function buildMemberWeeklySteps(entries: StepEntry[], dailyGoal: number | null) {
  const byDate = new Map<string, number>();
  for (const entry of entries) {
    if (Number.isFinite(entry.steps)) byDate.set(entry.date, entry.steps as number);
  }

  const weeks = new Map<string, number[]>();
  for (const [date, steps] of byDate) {
    const monday = mondayISO(date);
    const values = weeks.get(monday) ?? [];
    values.push(steps);
    weeks.set(monday, values);
  }

  return [...weeks.entries()]
    .map(([monday, values]): WeeklySteps => {
      const total = values.reduce((sum, steps) => sum + steps, 0);
      const goal = dailyGoal != null ? dailyGoal * values.length : null;
      return {
        monday,
        total,
        daysTracked: values.length,
        goal,
        goalReached: goal == null ? null : total >= goal,
      };
    })
    .sort((a, b) => a.monday.localeCompare(b.monday));
}
