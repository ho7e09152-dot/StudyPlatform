"use client";

import { CheckCircle2, X } from "lucide-react";
import { useExitTransition } from "@/lib/motion/useExitTransition";

export function Toast({
  title,
  detail,
  onClose,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
}) {
  const { motionState, requestClose } = useExitTransition(onClose);

  return (
    <div className="toast" role="status" data-motion-state={motionState}>
      <CheckCircle2 size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <button type="button" aria-label="알림 닫기" onClick={requestClose}>
        <X size={17} />
      </button>
    </div>
  );
}
