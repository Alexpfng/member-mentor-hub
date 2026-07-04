export type PrioritySessionEntry = {
  sessionId: string;
  createdAt: string;
  exercises: { name: string; rpe: number }[];
  maxRpe: number;
  label?: string | null;
};

export type PriorityMemberGroup = {
  type: "member_group";
  id: string;
  memberId: string;
  memberName: string;
  sessions: PrioritySessionEntry[];
  maxRpe: number;
  createdAt: string;
  priority: number;
};

export function hideSessionFromPriorityItems<T extends { type: string; sessionId?: string | null }>(
  items: Array<T | PriorityMemberGroup>,
  sessionId: string,
) {
  return items.flatMap((item) => {
    if (item.type === "member_group") {
      const group = item as PriorityMemberGroup;
      const sessions = group.sessions.filter((session) => session.sessionId !== sessionId);
      if (sessions.length === 0) return [];
      return [{ ...group, sessions }];
    }

    if ((item as T).sessionId === sessionId) return [];
    return [item];
  });
}

export function hideMessageFromPriorityItems<T extends { type: string; id: string }>(
  items: T[],
  messageId: string,
) {
  return items.filter((item) => !(item.type === "message" && item.id === messageId));
}

export function hideVideoFromPriorityItems<T extends { type: string; id: string }>(
  items: T[],
  videoId: string,
) {
  return items.filter((item) => !(item.type === "video" && item.id === videoId));
}
