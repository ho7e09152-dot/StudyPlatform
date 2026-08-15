import type { CommitRules } from "./types";

export const DEFAULT_COMMIT_RULES: CommitRules = {
  submissionTemplate: "{action}: {name} · {date} · {item}",
  submissionGuidance:
    "기본 규칙을 그대로 사용하거나 알아보기 쉽게 수정할 수 있습니다.",
};

export const COMMIT_RULE_VARIABLES = [
  { key: "action", token: "{action}", label: "작업" },
  { key: "name", token: "{name}", label: "사용자 이름" },
  { key: "date", token: "{date}", label: "학습 날짜" },
  { key: "item", token: "{item}", label: "항목 이름" },
  { key: "itemId", token: "{itemId}", label: "항목 ID" },
  { key: "session", token: "{session}", label: "일정 이름" },
] as const;

export type CommitRuleContext = Record<(typeof COMMIT_RULE_VARIABLES)[number]["key"], string>;

const VARIABLE_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const SUPPORTED_VARIABLES = new Set<string>(COMMIT_RULE_VARIABLES.map(({ key }) => key));
const MAX_LENGTH_CONTEXT: CommitRuleContext = {
  action: "update",
  name: "가".repeat(40),
  date: "2026-08-13",
  item: "가".repeat(50),
  itemId: "item-1234567890123456",
  session: "가".repeat(80),
};

export function normalizeCommitRules(rules?: Partial<CommitRules> | null): CommitRules {
  return {
    submissionTemplate:
      rules?.submissionTemplate ?? DEFAULT_COMMIT_RULES.submissionTemplate,
    submissionGuidance:
      rules?.submissionGuidance ?? DEFAULT_COMMIT_RULES.submissionGuidance,
  };
}

export function renderCommitMessage(template: string, context: CommitRuleContext) {
  return template.replace(VARIABLE_PATTERN, (token, key: string) =>
    SUPPORTED_VARIABLES.has(key) ? context[key as keyof CommitRuleContext] : token,
  );
}

export function validateCommitRules(rules: CommitRules) {
  if (!rules.submissionTemplate.trim()) return "커밋 메시지 규칙을 입력해 주세요.";
  if (!rules.submissionGuidance.trim()) return "제출 화면 안내 문구를 입력해 주세요.";
  if (rules.submissionGuidance.length > 240) return "안내 문구는 240자 이내로 입력해 주세요.";
  const unknown = [...rules.submissionTemplate.matchAll(VARIABLE_PATTERN)]
    .map((match) => match[1])
    .find((key) => !SUPPORTED_VARIABLES.has(key));
  if (unknown) return `지원하지 않는 변수입니다: {${unknown}}`;
  if (renderCommitMessage(rules.submissionTemplate, MAX_LENGTH_CONTEXT).length > 200) {
    return "커밋 메시지 규칙은 적용 후 200자 이내가 되도록 작성해 주세요.";
  }
  return "";
}
