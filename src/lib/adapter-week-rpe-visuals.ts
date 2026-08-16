type CoachRpeBadgeInput = {
  rpe_target?: string | number | null;
  memberRpe?: number | null;
  memberRpeHidden?: boolean | null;
  wasReset?: boolean | null;
};

function formatCoachRpeValue(value: string) {
  return value.replace(".", ",");
}

export function getCoachRpeBadgeLabel({
  rpe_target,
  memberRpe,
  memberRpeHidden,
}: CoachRpeBadgeInput) {
  const rawValue = rpe_target == null ? "" : String(rpe_target).trim();
  const normalizedValue = rawValue.toLowerCase();

  if (normalizedValue === "échec" || normalizedValue === "echec") {
    return "ÉCHEC";
  }

  if (rawValue !== "" && !Number.isNaN(Number(rawValue.replace(",", ".")))) {
    return `RPE ${formatCoachRpeValue(rawValue.replace(",", "."))}`;
  }

  if (memberRpeHidden) {
    return "RPE —";
  }

  if (memberRpe != null) {
    return `RPE ${formatCoachRpeValue(String(memberRpe).replace(".", ","))}`;
  }

  return "RPE —";
}
