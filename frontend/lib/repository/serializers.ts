import type {
  MemberSubmissionFile,
  StudySession,
  Workspace,
} from "../domain/types";

function yamlString(value: string) {
  return /[:#\n]/.test(value) ? JSON.stringify(value) : value;
}

export function serializeSession(session: StudySession) {
  const items = session.items
    .filter((item) => item.status === "active")
    .map(
      (item) => `  - id: ${item.id}
    order: ${item.order}
    title: ${yamlString(item.title)}
${item.source ? `    source: ${item.source}\n` : ""}${item.url ? `    url: ${item.url}\n` : ""}    submitType: ${item.submitType}
    required: ${item.required}
    status: ${item.status}`,
    )
    .join("\n\n");

  return `version: 1
revision: ${session.revision}

date: ${session.date}
type: ${session.type}
title: ${yamlString(session.title)}
description: ${yamlString(session.description)}
status: ${session.status}
deadline: ${session.deadline}
${session.secondaryDeadline ? `secondaryDeadline: ${session.secondaryDeadline}\n` : ""}

updatedAt: ${session.updatedAt}
updatedBy:
  username: ${session.updatedBy}
${
  session.change
    ? `\nchange:\n  changed: true\n  message: ${yamlString(session.change.message)}\n  reason: ${yamlString(session.change.reason)}\n`
    : ""
}
items:
${items}
`;
}

export function serializeMemberFile(
  session: StudySession,
  file: MemberSubmissionFile,
) {
  const submissions = file.submissions
    .map(
      (entry) => `  - itemId: ${entry.itemId}
    type: ${entry.type}
${entry.language ? `    language: ${entry.language}\n` : ""}    value: ${yamlString(entry.value)}
    submittedAt: ${entry.submittedAt}
    updatedAt: ${entry.updatedAt}`,
    )
    .join("\n\n");

  const body = session.items
    .filter((item) => item.status === "active")
    .map((item) => {
      const entry = file.submissions.find(
        (submission) => submission.itemId === item.id,
      );
      return `## ${item.title}\n\n${entry?.value ?? "(미제출)"}`;
    })
    .join("\n\n");

  return `---
version: 1
memberId: ${file.memberId}
gitlabUserId: ${file.gitlabUserId}
username: ${file.username}
date: ${file.date}
sessionRevision: ${file.sessionRevision}
sessionType: ${file.sessionType}
updatedAt: ${file.updatedAt}

submissions:
${submissions}
---

# ${session.title}

${body}
`;
}

export function getRepositoryFiles(workspace: Workspace) {
  type RepositoryFile = {
    path: string;
    kind: "yaml" | "markdown";
    content: string;
  };

  return Object.values(workspace.sessions)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((session) => {
      const files: RepositoryFile[] = [
        {
          path: `${session.folder}/session.yml`,
          kind: "yaml" as const,
          content: serializeSession(session),
        },
      ];

      workspace.members.forEach((member) => {
        const file = workspace.submissions[`${session.folder}/${member.id}`];
        if (file) {
          files.push({
            path: `${session.folder}/${member.fileName}`,
            kind: "markdown" as const,
            content: serializeMemberFile(session, file),
          });
        }
      });

      return files;
    });
}
