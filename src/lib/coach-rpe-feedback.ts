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

type SetRpeSession = {
  id: string;
  status: string | null;
  day_number?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
};

type SetRpeLog = {
  session_id: string | null;
  exercise_name: string | null;
  set_number: number | null;
  rpe: number | null;
  completed: boolean | null;
};

export function formatSetRpes(values: number[]) {
  return values.join(", ");
}

/** RPEs saisis pour chaque série de la dernière séance terminée de chaque exercice. */
export function buildLatestSetRpesByExercise(sessions: SetRpeSession[], logs: SetRpeLog[]) {
  const sessionsById = new Map(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => [session.id, session]),
  );
  const grouped = new Map<string, Array<{ sessionId: string; setNumber: number; rpe: number }>>();

  for (const log of logs) {
    if (log.completed === false || log.rpe == null || !log.session_id) continue;
    const session = sessionsById.get(log.session_id);
    const exerciseKey = normalizeExerciseFeedbackKey(log.exercise_name);
    if (!session || !exerciseKey) continue;
    const rows = grouped.get(exerciseKey) ?? [];
    rows.push({
      sessionId: session.id,
      setNumber: log.set_number ?? 0,
      rpe: Number(log.rpe),
    });
    grouped.set(exerciseKey, rows);
  }

  const result: Record<string, number[]> = {};
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  for (const [exerciseKey, rows] of grouped) {
    const latestSessionId = rows
      .map((row) => row.sessionId)
      .filter((id, index, all) => all.indexOf(id) === index)
      .sort((a, b) => {
        const sessionA = sessionById.get(a);
        const sessionB = sessionById.get(b);
        return (
          ts(sessionB?.ended_at ?? sessionB?.started_at) -
          ts(sessionA?.ended_at ?? sessionA?.started_at)
        );
      })[0];
    if (!latestSessionId) continue;
    result[exerciseKey] = rows
      .filter((row) => row.sessionId === latestSessionId)
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((row) => row.rpe);
  }
  return result;
}

/** RPE par jour de programme et exercice, depuis les séances terminées uniquement. */
export function buildLatestSetRpesByDay(sessions: SetRpeSession[], logs: SetRpeLog[]) {
  const sessionsById = new Map(
    sessions
      .filter((session) => session.status === "completed" && session.day_number != null)
      .map((session) => [session.id, session]),
  );
  const grouped = new Map<
    string,
    Array<{ dayNumber: number; sessionId: string; setNumber: number; rpe: number }>
  >();

  for (const log of logs) {
    if (log.completed === false || log.rpe == null || !log.session_id) continue;
    const session = sessionsById.get(log.session_id);
    const exerciseKey = normalizeExerciseFeedbackKey(log.exercise_name);
    if (!session || session.day_number == null || !exerciseKey) continue;
    const key = `${session.day_number}:${exerciseKey}`;
    const rows = grouped.get(key) ?? [];
    rows.push({
      dayNumber: session.day_number,
      sessionId: session.id,
      setNumber: log.set_number ?? 0,
      rpe: Number(log.rpe),
    });
    grouped.set(key, rows);
  }

  const result: Record<number, Record<string, number[]>> = {};
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  for (const [groupKey, rows] of grouped) {
    const latestSessionId = [...new Set(rows.map((row) => row.sessionId))].sort((a, b) => {
      const sessionA = sessionById.get(a);
      const sessionB = sessionById.get(b);
      return (
        ts(sessionB?.ended_at ?? sessionB?.started_at) -
        ts(sessionA?.ended_at ?? sessionA?.started_at)
      );
    })[0];
    if (!latestSessionId) continue;
    const { dayNumber } = rows[0];
    const exerciseKey = groupKey.slice(groupKey.indexOf(":") + 1);
    result[dayNumber] ??= {};
    result[dayNumber][exerciseKey] = rows
      .filter((row) => row.sessionId === latestSessionId)
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((row) => row.rpe);
  }
  return result;
}

function ts(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ensureBucket(acc: Record<string, FeedbackBucket>, name: string | null | undefined) {
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
