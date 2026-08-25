import { normalizeExerciseFeedbackKey } from "./exercise-feedback";

type FeedbackBucket = {
  lastRpeAt: number;
  lastRpe: number | null;
  pain: boolean;
  tooHard: boolean;
  tooEasy: boolean;
  failure: boolean;
  weights: number[];
  comments: Array<{ text: string; at: number }>;
};

type LogRow = {
  exercise_name: string | null;
  rpe: number | null;
  completed: boolean | null;
  logged_at: string | null;
  weight_kg?: number | null;
  reps?: number | null;
  note?: string | null;
};

type FeedbackRow = {
  exercise_name: string | null;
  rpe: number | null;
  felt_too_hard: boolean | null;
  felt_too_easy: boolean | null;
  could_not_do: boolean | null;
  created_at: string | null;
  member_comment?: string | null;
};

type PainRow = {
  exercise_name: string | null;
};

function ts(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ensureBucket(
  acc: Record<string, FeedbackBucket>,
  name: string | null | undefined,
) {
  const key = normalizeExerciseFeedbackKey(name);
  if (!key) return null;
  if (!acc[key]) {
    acc[key] = {
      lastRpeAt: 0,
      lastRpe: null,
      pain: false,
      tooHard: false,
      tooEasy: false,
      failure: false,
      weights: [],
      comments: [],
    };
  }
  return { key, bucket: acc[key] };
}

function normalizeCoachRpeValue(value: number) {
  const clamped = Math.max(0, Math.min(10, Number(value)));
  return Math.round(clamped * 2) / 2;
}

function registerLatestRpe(bucket: FeedbackBucket, value: number | null, at: number) {
  if (value == null) return;
  const normalized = normalizeCoachRpeValue(Number(value));
  if (at >= bucket.lastRpeAt) {
    bucket.lastRpeAt = at;
    bucket.lastRpe = normalized;
  }
}

/** Un même commentaire peut arriver par la série ET par le bloc : on ne le
 *  garde qu'une fois, et on privilégie le plus récent à l'affichage. */
function registerComment(bucket: FeedbackBucket, value: string | null | undefined, at: number) {
  const text = String(value ?? "").trim();
  if (!text) return;
  const existing = bucket.comments.find((entry) => entry.text === text);
  if (existing) {
    existing.at = Math.max(existing.at, at);
    return;
  }
  bucket.comments.push({ text, at });
}

/** Commentaires du plus récent au plus ancien, bornés pour ne pas noyer la carte. */
const MAX_MEMBER_COMMENTS = 4;

function formatComments(comments: Array<{ text: string; at: number }>) {
  return [...comments]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_MEMBER_COMMENTS)
    .map((entry) => entry.text);
}

function registerWeight(bucket: FeedbackBucket, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return;
  const numeric = Number(value);
  if (numeric <= 0) return;
  bucket.weights.push(numeric);
}

function formatLoadLabel(weights: number[]) {
  const unique = [...new Set(weights.map((value) => Math.round(value * 100) / 100))].sort(
    (a, b) => a - b,
  );
  if (unique.length === 0) return null;
  if (unique.length === 1) return `${unique[0]}kg`;
  return `${unique[0]}–${unique[unique.length - 1]}kg`;
}

export function buildCoachExerciseFeedback({
  logs,
  feedbacks,
  pains,
}: {
  logs: LogRow[];
  feedbacks: FeedbackRow[];
  pains: PainRow[];
}) {
  const acc: Record<string, FeedbackBucket> = {};

  logs.forEach((row) => {
    const entry = ensureBucket(acc, row.exercise_name);
    if (!entry) return;
    registerLatestRpe(entry.bucket, row.rpe, ts(row.logged_at));
    registerWeight(entry.bucket, row.weight_kg);
    registerComment(entry.bucket, row.note, ts(row.logged_at));
    if (entry.bucket && row.completed === false) entry.bucket.failure = true;
  });

  feedbacks.forEach((row) => {
    const entry = ensureBucket(acc, row.exercise_name);
    if (!entry) return;
    if (row.felt_too_hard) entry.bucket.tooHard = true;
    if (row.felt_too_easy) entry.bucket.tooEasy = true;
    if (row.could_not_do) entry.bucket.failure = true;
    registerLatestRpe(entry.bucket, row.rpe, ts(row.created_at));
    registerComment(entry.bucket, row.member_comment, ts(row.created_at));
  });

  pains.forEach((row) => {
    const entry = ensureBucket(acc, row.exercise_name);
    if (!entry) return;
    entry.bucket.pain = true;
  });

  return Object.fromEntries(
    Object.entries(acc).map(([key, value]) => [
      key,
      {
        rpe: value.lastRpe,
        pain: value.pain,
        tooHard: value.tooHard,
        tooEasy: value.tooEasy,
        failure: value.failure,
        loadLabel: formatLoadLabel(value.weights),
        comments: formatComments(value.comments),
      },
    ]),
  );
}

export function getQuickRpePopoverPlacement({
  anchorTop,
  anchorBottom,
  popoverHeight,
  viewportHeight,
  margin = 12,
}: {
  anchorTop: number;
  anchorBottom: number;
  popoverHeight: number;
  viewportHeight: number;
  margin?: number;
}) {
  const roomBelow = viewportHeight - anchorBottom - margin;
  const roomAbove = anchorTop - margin;
  if (roomBelow >= popoverHeight) return "bottom";
  if (roomAbove >= popoverHeight) return "top";
  return roomAbove > roomBelow ? "top" : "bottom";
}
