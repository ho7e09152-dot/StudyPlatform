import type {
  MemberSubmissionFile,
  StudyMember,
  StudySession,
  Workspace,
} from "../domain/types";

const members: StudyMember[] = [
  {
    id: "member-a",
    gitlabUserId: 101,
    username: "gitlab-user-a",
    displayName: "김서연",
    avatar: "A",
    color: "#6d52b5",
    fileName: "member-a.md",
    role: "OWNER",
    status: "ACTIVE",
    accessLevel: 30,
  },
  {
    id: "member-b",
    gitlabUserId: 102,
    username: "gitlab-user-b",
    displayName: "이준호",
    avatar: "B",
    color: "#a15169",
    fileName: "member-b.md",
    role: "MEMBER",
    status: "ACTIVE",
    accessLevel: 30,
  },
  {
    id: "member-c",
    gitlabUserId: 103,
    username: "gitlab-user-c",
    displayName: "박민지",
    avatar: "C",
    color: "#3d7175",
    fileName: "member-c.md",
    role: "MANAGER",
    status: "ACTIVE",
    accessLevel: 40,
  },
];

const sessions: Record<string, StudySession> = {
  "2026-07-21": {
    date: "2026-07-21",
    folder: "260721",
    revision: 1,
    type: "cs",
    title: "운영체제 스케줄링 정리",
    description: "CPU 스케줄링 알고리즘을 비교해 정리합니다.",
    status: "active",
    deadline: "2026-07-21T23:59:00+09:00",
    createdAt: "2026-07-20T20:00:00+09:00",
    createdBy: "gitlab-user-b",
    updatedAt: "2026-07-20T20:00:00+09:00",
    updatedBy: "gitlab-user-b",
    items: [
      {
        id: "item-cpu-scheduling",
        order: 1,
        title: "스케줄링 비교표",
        type: "cs",
        submitType: "text",
        required: true,
        status: "active",
      },
    ],
    archivedItems: [],
    lastCommitId: "6cf13d1",
  },
  "2026-07-22": {
    date: "2026-07-22",
    folder: "260722",
    revision: 1,
    type: "free",
    title: "이번 주 회고",
    description: "자유 형식으로 한 주의 학습을 회고합니다.",
    status: "active",
    deadline: "2026-07-22T23:59:00+09:00",
    createdAt: "2026-07-21T20:00:00+09:00",
    createdBy: "gitlab-user-a",
    updatedAt: "2026-07-21T20:00:00+09:00",
    updatedBy: "gitlab-user-a",
    items: [
      {
        id: "item-weekly-retro",
        order: 1,
        title: "주간 회고 한 편",
        type: "free",
        submitType: "text",
        required: true,
        status: "active",
      },
    ],
    archivedItems: [],
    lastCommitId: "ca900a8",
  },
  "2026-07-23": {
    date: "2026-07-23",
    folder: "260723",
    revision: 3,
    type: "algorithm",
    title: "큐와 배열 집중 학습",
    description: "풀이를 작성하고 링크를 항목별로 제출합니다.",
    status: "active",
    deadline: "2026-07-23T23:59:00+09:00",
    createdAt: "2026-07-21T20:00:00+09:00",
    createdBy: "gitlab-user-a",
    updatedAt: "2026-07-23T00:05:00+09:00",
    updatedBy: "gitlab-user-b",
    change: {
      changed: true,
      message: "두 번째 문제가 삼각 달팽이에서 프로세스로 변경되었습니다.",
      reason: "난이도 조정",
    },
    items: [
      {
        id: "item-a8f11c",
        order: 1,
        title: "행렬 테두리 회전하기",
        type: "algorithm",
        source: "programmers",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/77485",
        submitType: "link",
        required: true,
        status: "active",
      },
      {
        id: "item-b712dd",
        order: 2,
        title: "프로세스",
        type: "algorithm",
        source: "programmers",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/42587",
        submitType: "link",
        required: true,
        status: "active",
        replaces: "item-old22",
      },
    ],
    archivedItems: [
      {
        id: "item-old22",
        order: 2,
        title: "삼각 달팽이",
        type: "algorithm",
        submitType: "link",
        required: true,
        status: "replaced",
        replacedBy: "item-b712dd",
      },
    ],
    lastCommitId: "abc123e",
  },
  "2026-07-24": {
    date: "2026-07-24",
    folder: "260724",
    revision: 1,
    type: "english",
    title: "영어 표현과 듣기",
    description: "표현을 정리하고 영어 영상을 시청합니다.",
    status: "active",
    deadline: "2026-07-24T23:59:00+09:00",
    createdAt: "2026-07-22T21:00:00+09:00",
    createdBy: "gitlab-user-c",
    updatedAt: "2026-07-22T21:00:00+09:00",
    updatedBy: "gitlab-user-c",
    items: [
      {
        id: "item-daily-phrases",
        order: 1,
        title: "오늘의 표현 10개",
        type: "english",
        submitType: "text",
        required: true,
        status: "active",
      },
      {
        id: "item-listening",
        order: 2,
        title: "영어 영상 15분 듣기",
        type: "english",
        submitType: "link",
        required: true,
        status: "active",
      },
      {
        id: "item-summary",
        order: 3,
        title: "한 문단 요약",
        type: "english",
        submitType: "text",
        required: true,
        status: "active",
      },
    ],
    archivedItems: [],
    lastCommitId: "b86b4d9",
  },
};

function file(
  session: StudySession,
  member: StudyMember,
  entries: MemberSubmissionFile["submissions"],
): MemberSubmissionFile {
  return {
    version: 1,
    memberId: member.id,
    gitlabUserId: member.gitlabUserId,
    username: member.username,
    date: session.folder,
    sessionRevision: session.revision,
    sessionType: session.type,
    updatedAt: entries.map((entry) => entry.updatedAt).sort().at(-1) ?? session.updatedAt,
    submissions: entries,
    lastCommitId: `commit-${session.folder}-${member.id}`,
  };
}

function entry(itemId: string, value: string, timestamp: string, type: "link" | "text" = "link") {
  return {
    itemId,
    type,
    value,
    submittedAt: timestamp,
    updatedAt: timestamp,
  } as const;
}

const mainSubmissions: Record<string, MemberSubmissionFile> = {};

members.forEach((member, index) => {
  const s21 = sessions["2026-07-21"];
  mainSubmissions[`260721/${member.id}`] = file(s21, member, [
    entry(
      "item-cpu-scheduling",
      ["FCFS·SJF·RR 비교 완료", "라운드로빈 타임퀀텀 정리", "선점·비선점 표 정리"][index],
      `2026-07-21T2${index}:10:00+09:00`,
      "text",
    ),
  ]);

  const s22 = sessions["2026-07-22"];
  mainSubmissions[`260722/${member.id}`] = file(s22, member, [
    entry(
      "item-weekly-retro",
      ["문제를 쪼개는 습관을 만들었다.", "복습 주기를 줄이기로 했다.", "작은 기록을 꾸준히 남겼다."][index],
      `2026-07-22T2${index}:15:00+09:00`,
      "text",
    ),
  ]);
});

const today = sessions["2026-07-23"];
mainSubmissions["260723/member-a"] = file(today, members[0], [
  entry("item-a8f11c", "https://blog.example.com/rotation", "2026-07-23T20:10:00+09:00"),
]);
mainSubmissions["260723/member-b"] = file(today, members[1], [
  entry("item-a8f11c", "https://blog.b.dev/rotate", "2026-07-23T19:40:00+09:00"),
  entry("item-b712dd", "https://blog.b.dev/process", "2026-07-23T21:32:00+09:00"),
]);
mainSubmissions["260723/member-c"] = file(today, members[2], [
  entry("item-a8f11c", "https://minji.log/rotation", "2026-07-23T18:20:00+09:00"),
  entry("item-b712dd", "https://minji.log/process", "2026-07-23T21:50:00+09:00"),
]);

const readingMembers: StudyMember[] = members.slice(0, 2).map((member) => ({
  ...member,
  fileName: `${member.id}.md`,
}));

const readingSession: StudySession = {
  date: "2026-07-23",
  folder: "260723",
  revision: 1,
  type: "cs",
  title: "Designing Data-Intensive Applications",
  description: "2장 데이터 모델과 질의 언어를 읽고 핵심 문장을 정리합니다.",
  status: "active",
  deadline: "2026-07-23T22:30:00+09:00",
  createdAt: "2026-07-20T18:00:00+09:00",
  createdBy: "gitlab-user-a",
  updatedAt: "2026-07-20T18:00:00+09:00",
  updatedBy: "gitlab-user-a",
  items: [
    {
      id: "item-ddia-summary",
      order: 1,
      title: "2장 핵심 내용 요약",
      type: "cs",
      submitType: "mixed",
      required: true,
      status: "active",
    },
    {
      id: "item-ddia-question",
      order: 2,
      title: "토론 질문 한 가지",
      type: "cs",
      submitType: "text",
      required: true,
      status: "active",
    },
  ],
  archivedItems: [],
  lastCommitId: "d17ca91",
};

export const initialWorkspaces: Workspace[] = [
  {
    id: "workspace-evening",
    name: "저녁 스터디",
    gitlabProjectId: 48213,
    gitlabProjectPath: "study-team/evening-workspace",
    defaultBranch: "main",
    repositoryBasePath: "",
    repositorySchemaVersion: 1,
    importMode: "COMPATIBLE",
    status: "ACTIVE",
    lastSyncedAt: "2026-07-23T21:58:00+09:00",
    members,
    sessions,
    submissions: mainSubmissions,
    settings: {
      timezone: "Asia/Seoul",
      requireChangeNoteWhenSubmitted: true,
      commitRules: {
        submissionTemplate: "{action}: {name} · {date} · {item}",
        submissionGuidance: "기본 규칙을 그대로 사용하거나 알아보기 쉽게 수정할 수 있습니다.",
      },
      notifications: {
        scheduleChanges: true,
        submissionMismatch: true,
        syncFailures: true,
      },
    },
  },
  {
    id: "workspace-reading",
    name: "CS 원서 읽기",
    gitlabProjectId: 50117,
    gitlabProjectPath: "study-team/cs-book-club",
    defaultBranch: "main",
    repositoryBasePath: "",
    repositorySchemaVersion: 1,
    importMode: "COMPATIBLE",
    status: "ACTIVE",
    lastSyncedAt: "2026-07-23T21:12:00+09:00",
    members: readingMembers,
    sessions: { "2026-07-23": readingSession },
    submissions: {
      "260723/member-a": file(readingSession, readingMembers[0], [
        entry(
          "item-ddia-summary",
          "## 관계형 모델\n\n데이터를 튜플의 집합으로 표현한다.",
          "2026-07-23T20:40:00+09:00",
          "text",
        ),
      ]),
    },
    settings: {
      timezone: "Asia/Seoul",
      requireChangeNoteWhenSubmitted: true,
      commitRules: {
        submissionTemplate: "{action}: {name} · {date} · {item}",
        submissionGuidance: "기본 규칙을 그대로 사용하거나 알아보기 쉽게 수정할 수 있습니다.",
      },
      notifications: {
        scheduleChanges: true,
        submissionMismatch: true,
        syncFailures: false,
      },
    },
  },
];
