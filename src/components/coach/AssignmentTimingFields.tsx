type AssignmentTimingFieldsProps = {
  durationWeeks: number | null | undefined;
  startDate: string;
  onStartDateChange: (value: string) => void;
  startWeek: number;
  onStartWeekChange: (value: number) => void;
  effectiveStartDate: string;
};

function formatDateLabel(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("fr-FR");
}

export default function AssignmentTimingFields({
  durationWeeks,
  startDate,
  onStartDateChange,
  startWeek,
  onStartWeekChange,
  effectiveStartDate,
}: AssignmentTimingFieldsProps) {
  const maxWeeks = Math.max(1, durationWeeks ?? 1);
  const weekOptions = Array.from({ length: maxWeeks }, (_, index) => index + 1);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
          DATE DE RÉFÉRENCE
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          style={{
            padding: "8px 10px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            color: "#fff",
            fontSize: 13,
          }}
        />
      </label>

      {maxWeeks > 1 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            COMMENCER À LA SEMAINE
          </span>
          <select
            value={startWeek}
            onChange={(event) => onStartWeekChange(Number(event.target.value) || 1)}
            style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
            }}
          >
            {weekOptions.map((week) => (
              <option key={week} value={week} style={{ color: "#111" }}>
                Semaine {week}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.5 }}>
        {startWeek > 1
          ? `La semaine ${startWeek} sera active le ${formatDateLabel(startDate)}. Début enregistré : ${formatDateLabel(effectiveStartDate)}.`
          : `Le programme démarrera le ${formatDateLabel(startDate)}.`}
      </div>
    </div>
  );
}
