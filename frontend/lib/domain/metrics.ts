import type {
  DashboardMetrics,
  MemberProgress,
  StudyMember,
  StudySession,
  Workspace,
} from "./types";

export const SCORE_RULES = {
  primary: 10,
  secondary: 6,
} as const;

export interface MemberScore {
  member: StudyMember;
  points: number;
  maxPoints: number;
  primaryCount: number;
  secondaryCount: number;
  missedCount: number;
  rank: number;
}

export function getActiveRequiredItems(session: StudySession) {
  return session.items.filter(
    (item) => item.required && item.status === "active",
  );
}

export function getSubmissionKey(date: string, memberId: string) {
  return `${date}/${memberId}`;
}

export function getMemberProgress(
  workspace: Workspace,
  session: StudySession,
): MemberProgress[] {
  const requiredItems = getActiveRequiredItems(session);

  return workspace.members
    .filter((member) => member.status === "ACTIVE")
    .map((member) => {
      const file = workspace.submissions[getSubmissionKey(session.folder, member.id)];
      const completedItems = requiredItems.filter((item) =>
        file?.submissions.some((submission) => submission.itemId === item.id),
      ).length;
      const requiredCount = requiredItems.length;
      const completionRate = requiredCount
        ? Math.round((completedItems / requiredCount) * 100)
        : 100;
      const lastSubmittedAt = file?.submissions
        .map((submission) => submission.updatedAt)
        .sort()
        .at(-1);

      return {
        member,
        completedItems,
        requiredItems: requiredCount,
        completionRate,
        status:
          completedItems === 0
            ? "NOT_STARTED"
            : completedItems === requiredCount
              ? "COMPLETE"
              : "PARTIAL",
        lastSubmittedAt,
      };
    });
}

export function getDashboardMetrics(
  workspace: Workspace,
  session: StudySession,
): DashboardMetrics {
  const memberProgress = getMemberProgress(workspace, session);
  const completedMembers = memberProgress.filter(
    (member) => member.status === "COMPLETE",
  ).length;
  const submittedItems = memberProgress.reduce(
    (total, member) => total + member.completedItems,
    0,
  );
  const totalRequiredSubmissions = memberProgress.reduce(
    (total, member) => total + member.requiredItems,
    0,
  );

  return {
    completedMembers,
    totalMembers: memberProgress.length,
    memberCompletionRate: memberProgress.length
      ? Math.round((completedMembers / memberProgress.length) * 100)
      : 0,
    submittedItems,
    totalRequiredSubmissions,
    submissionRate: totalRequiredSubmissions
      ? Math.round((submittedItems / totalRequiredSubmissions) * 100)
      : 0,
  };
}

function getSubmissionPoints(
  submittedAt: string,
  deadline: string,
  secondaryDeadline?: string,
) {
  const submittedTime = new Date(submittedAt).getTime();
  if (submittedTime <= new Date(deadline).getTime()) {
    return SCORE_RULES.primary;
  }
  if (
    secondaryDeadline &&
    submittedTime <= new Date(secondaryDeadline).getTime()
  ) {
    return SCORE_RULES.secondary;
  }
  return 0;
}

export function getMemberScore(
  workspace: Workspace,
  sessions: StudySession[],
  member: StudyMember,
): Omit<MemberScore, "rank"> {
  let points = 0;
  let maxPoints = 0;
  let primaryCount = 0;
  let secondaryCount = 0;
  let missedCount = 0;

  sessions.forEach((session) => {
    const requiredItems = getActiveRequiredItems(session);
    const file =
      workspace.submissions[getSubmissionKey(session.folder, member.id)];

    requiredItems.forEach((item) => {
      maxPoints += SCORE_RULES.primary;
      const submission = file?.submissions.find(
        (entry) => entry.itemId === item.id,
      );
      if (!submission) {
        missedCount += 1;
        return;
      }

      const itemPoints = getSubmissionPoints(
        submission.submittedAt,
        session.deadline,
        session.secondaryDeadline,
      );
      points += itemPoints;
      if (itemPoints === SCORE_RULES.primary) primaryCount += 1;
      else if (itemPoints === SCORE_RULES.secondary) secondaryCount += 1;
      else missedCount += 1;
    });
  });

  return {
    member,
    points,
    maxPoints,
    primaryCount,
    secondaryCount,
    missedCount,
  };
}

export function getScoreboard(
  workspace: Workspace,
  sessions: StudySession[],
): MemberScore[] {
  const scores = workspace.members
    .filter((member) => member.status === "ACTIVE")
    .map((member) => getMemberScore(workspace, sessions, member))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.primaryCount - a.primaryCount ||
        a.member.displayName.localeCompare(b.member.displayName, "ko"),
    );

  return scores.map((score) => ({
    ...score,
    rank: scores.findIndex((candidate) => candidate.points === score.points) + 1,
  }));
}
