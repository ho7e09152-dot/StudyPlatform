"use client";

import { CheckCircle2, X } from "lucide-react";

export function Toast({
  title,
  detail,
  onClose,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
}) {
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <button type="button" aria-label="알림 닫기" onClick={onClose}>
        <X size={17} />
      </button>
    </div>
  );
}
