"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";

export function PreSubmissionWarning({
  onClose,
  onProceed,
  onContinueLearning,
  continueHref,
}: {
  onClose: () => void;
  onProceed: () => void;
  onContinueLearning?: () => void;
  continueHref?: string;
}) {
  return (
    <Modal title="아직 내 학습을 완료하지 않았어요" onClose={onClose}>
      <div className="submission-warning-dialog">
        <p>다른 팀원의 제출을 먼저 보면 학습에 영향을 줄 수 있어요. 내 필수 학습을 완료한 뒤 확인하는 것을 권장합니다.</p>
        <div className="modal-actions">
          <button type="button" className="button button--ghost" onClick={onProceed}>그래도 보기</button>
          {continueHref ? (
            <Link href={continueHref} className="button button--primary" onClick={onClose}>내 학습 계속하기</Link>
          ) : (
            <button type="button" className="button button--primary" onClick={onContinueLearning}>내 학습 계속하기</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
