type CoachRpeBadgeInput = {
  rpe_target?: string | number | null;
  memberRpe?: number | null;
  wasReset?: boolean | null;
};

function formatCoachRpeValue(value: string) {
  return value.replace(".", ",");
}

export function getCoachRpeBadgeLabel({ rpe_target, memberRpe, wasReset }: CoachRpeBadgeInput) {
  const rawValue = rpe_target == null ? "" : String(rpe_target).trim();
  const normalizedValue = rawValue.toLowerCase();

  if (normalizedValue === "échec" || normalizedValue === "echec") {
    return "ÉCHEC";
  }

  if (rawValue !== "" && !Number.isNaN(Number(rawValue.replace(",", ".")))) {
    return `RPE ${formatCoachRpeValue(rawValue.replace(",", "."))}`;
  }

  if (memberRpe != null) {
    return `RPE ${formatCoachRpeValue(String(memberRpe).replace(".", ","))}`;
  }

  if (wasReset) {
    return "RPE —";
  }

  return "RPE —";
}
