import type { ExpertSavedStep } from "./live-session-progress";

export type SessionSnapshot = {
  sessionId: string;
  stepIdx: number;
  phase: "intro" | "step" | "rest" | "recap";
  savedByStep: Record<number, ExpertSavedStep>;
  startedAt: number;
  updatedAt: number;
  expertRecapRpeByExercise: Record<string, number | null>;
  expertRecapCommentByExercise: Record<string, string>;
};

export function shouldPersistSessionSnapshot({
  phase,
  savedStepCount,
}: {
  phase: SessionSnapshot["phase"];
  savedStepCount: number;
}) {
  return !(phase === "intro" && savedStepCount === 0);
}

export function createSessionSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  return snapshot;
}
