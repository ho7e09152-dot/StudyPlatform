import type { WorkspaceDocument } from "@/lib/api/services/workspaceApi";

const STORAGE_KEY = "study-demo-library-documents";

export const initialDemoDocuments: WorkspaceDocument[] = [
  {
    id: "demo-doc-os",
    authorName: "김서연",
    title: "운영체제 스케줄링 핵심 정리",
    bodyMarkdown: "## 스케줄링 기준\n\n- **응답 시간**: 요청부터 첫 응답까지\n- **반환 시간**: 도착부터 종료까지\n- **대기 시간**: 준비 큐에서 기다린 시간\n\n> 라운드 로빈은 타임 퀀텀이 너무 크면 FCFS와 비슷해진다.\n\n### 다음에 확인할 것\n\n- [ ] MLFQ 우선순위 이동 규칙\n- [ ] 기아 상태와 에이징",
    version: 2,
    createdAt: "2026-07-21T22:30:00+09:00",
    updatedAt: "2026-07-23T19:10:00+09:00",
    canEdit: true,
  },
  {
    id: "demo-doc-algorithm",
    authorName: "이준호",
    title: "큐 문제를 풀 때 확인할 패턴",
    bodyMarkdown: "## 먼저 확인하기\n\n1. 입력 순서를 보존해야 하는가?\n2. 우선순위가 계속 바뀌는가?\n3. 원형 순회가 필요한가?\n\n```python\nfrom collections import deque\nqueue = deque()\n```",
    version: 1,
    createdAt: "2026-07-23T21:40:00+09:00",
    updatedAt: "2026-07-23T21:40:00+09:00",
    canEdit: false,
  },
];

export function loadDemoDocuments() {
  if (typeof window === "undefined") return initialDemoDocuments;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialDemoDocuments;
  try {
    return JSON.parse(stored) as WorkspaceDocument[];
  } catch {
    return initialDemoDocuments;
  }
}

export function saveDemoDocuments(documents: WorkspaceDocument[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

export function plainText(markdown: string) {
  return markdown.replace(/[#>*_`\[\]-]/g, " ").replace(/\s+/g, " ").trim();
}
