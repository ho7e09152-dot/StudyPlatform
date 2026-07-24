import type { SessionType, SubmissionType } from "./types";

export const REFERENCE_DATE = "2026-07-23";

export const SESSION_TYPE_META: Record<
  SessionType,
  { label: string; short: string; tone: string }
> = {
  algorithm: { label: "알고리즘", short: "ALG", tone: "violet" },
  english: { label: "영어", short: "ENG", tone: "blue" },
  cs: { label: "컴퓨터 과학", short: "CS", tone: "rose" },
  free: { label: "자유주제", short: "FREE", tone: "olive" },
};

export const SUBMISSION_TYPE_LABEL: Record<SubmissionType, string> = {
  link: "링크",
  text: "텍스트",
  code: "코드",
  mixed: "Markdown",
};

export const GITLAB_ACCESS_LABEL: Record<number, string> = {
  10: "Guest",
  20: "Reporter",
  30: "Developer",
  40: "Maintainer",
  50: "Owner",
};
