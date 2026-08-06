import { normalizeExerciseFeedbackKey } from "./exercise-feedback";

type FeedbackBucket = {
  rpeSum: number;
  rpeCount: number;
  lastRpeAt: number;
  lastRpe: number | null;
  pain: boolean;
  tooHard: boolean;
  tooEasy: boolean;
  failure: boolean;
};

type LogRow = {
  exercise_name: string | null;
  rpe: number | null;
  completed: boolean | null;
  logged_at: string | null;
};

type FeedbackRow = {
  exercise_name: string | null;
  rpe: number | null;
  felt_too_hard: boolean | null;
  felt_too_easy: boolean | null;
  could_not_do: boolean | null;
  created_at: string | null;
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
      rpeSum: 0,
      rpeCount: 0,
      lastRpeAt: 0,
      lastRpe: null,
      pain: false,
      tooHard: false,
      tooEasy: false,
      failure: false,
    };
  }
  return { key, bucket: acc[key] };
}

function registerLatestRpe(bucket: FeedbackBucket, value: number | null, at: number) {
  if (value == null) return;
  bucket.rpeSum += Number(value);
  bucket.rpeCount += 1;
  if (at >= bucket.lastRpeAt) {
    bucket.lastRpeAt = at;
    bucket.lastRpe = Number(value);
  }
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
    if (entry.bucket && row.completed === false) entry.bucket.failure = true;
  });

  feedbacks.forEach((row) => {
    const entry = ensureBucket(acc, row.exercise_name);
    if (!entry) return;
    if (row.felt_too_hard) entry.bucket.tooHard = true;
    if (row.felt_too_easy) entry.bucket.tooEasy = true;
    if (row.could_not_do) entry.bucket.failure = true;
    registerLatestRpe(entry.bucket, row.rpe, ts(row.created_at));
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
