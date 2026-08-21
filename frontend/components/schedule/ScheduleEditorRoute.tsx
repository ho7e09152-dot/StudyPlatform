"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { canManageSchedules } from "@/lib/domain/permissions";
import { APP_ROUTES } from "@/lib/routes";
import { SessionEditorPage } from "./SessionEditorDialog";

export function ScheduleEditorRoute({
  date,
  initialStep = 1,
}: {
  date?: string;
  initialStep?: 1 | 2;
}) {
  const router = useRouter();
  const { workspace, referenceDate, currentUserId, saveSession } = useWorkspace();
  const session = date ? workspace.sessions[date] : undefined;
  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const canManage = canManageSchedules(currentMember);

  if (date && !session) {
    return (
      <div className="page-stack schedule-route-state" role="alert">
        <strong>일정을 찾을 수 없어요.</strong>
        <p>이미 취소되었거나 동기화 과정에서 변경된 일정일 수 있습니다.</p>
        <button type="button" className="button button--secondary" onClick={() => router.push(APP_ROUTES.schedule)}>학습 일정으로 돌아가기</button>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="page-stack schedule-route-state" role="alert">
        <strong>{date ? "항목을 편집할 권한이 없어요." : "항목을 추가할 권한이 없어요."}</strong>
        <p>Workspace 소유자와 관리자만 날짜별 항목을 만들고 수정할 수 있습니다.</p>
        <button type="button" className="button button--secondary" onClick={() => router.push(date ? APP_ROUTES.scheduleDetail(date) : APP_ROUTES.schedule)}>{date ? "일정 상세로 돌아가기" : "학습 일정으로 돌아가기"}</button>
      </div>
    );
  }

  return (
    <SessionEditorPage
      workspace={workspace}
      referenceDate={referenceDate}
      session={session}
      initialStep={initialStep}
      onExistingDateSelected={(selectedDate) => {
        if (session || !workspace.sessions[selectedDate]) return false;
        router.replace(`${APP_ROUTES.scheduleEdit(selectedDate)}?step=items`);
        return true;
      }}
      onSave={saveSession}
      onClose={() => router.push(session ? APP_ROUTES.scheduleDetail(session.date) : APP_ROUTES.schedule)}
    />
  );
}
