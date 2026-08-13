import type { StudySession, Workspace } from "./types";

export function toFolderName(date: string) {
  const [year, month, day] = date.split("-");
  return `${year.slice(2)}${month}${day}`;
}

export function getDateKeyInTimeZone(
  date = new Date(),
  timeZone = "Asia/Seoul",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function formatDate(date: string, includeYear = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(includeYear ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00+09:00`));
}

export function formatDateTime(value: string, timeZone = "Asia/Seoul") {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function newStableItemId() {
  const random = Math.random().toString(36).slice(2, 9);
  return `item-${random}`;
}

export function percent(value: number) {
  return `${Math.round(value)}%`;
}
export function getWorkspaceRepositoryPath(basePath: string | undefined, relativePath: string) {
  return basePath ? `${basePath.replace(/\/+$/, "")}/${relativePath}` : relativePath;
}

export function getSessionRepositoryPath(
  workspace: Pick<Workspace, "repositoryBasePath" | "repositorySchemaVersion">,
  session: Pick<StudySession, "date" | "folder">,
) {
  const relativePath = workspace.repositorySchemaVersion >= 2
    ? `sessions/${session.date.slice(0, 4)}/${session.date}/session.yml`
    : `${session.folder}/session.yml`;
  return getWorkspaceRepositoryPath(workspace.repositoryBasePath, relativePath);
}

export function getSubmissionRepositoryPath(
  workspace: Pick<Workspace, "repositoryBasePath" | "repositorySchemaVersion">,
  session: Pick<StudySession, "date" | "folder">,
  fileName: string,
) {
  const relativePath = workspace.repositorySchemaVersion >= 2
    ? `sessions/${session.date.slice(0, 4)}/${session.date}/submissions/${fileName}`
    : `${session.folder}/${fileName}`;
  return getWorkspaceRepositoryPath(workspace.repositoryBasePath, relativePath);
}
