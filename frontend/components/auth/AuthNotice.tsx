import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import type { LoginNoticeState } from "@/lib/auth/loginState";

export function AuthNotice({ notice }: { notice: LoginNoticeState }) {
  const Icon = notice.tone === "danger"
    ? AlertCircle
    : notice.tone === "warning"
      ? TriangleAlert
      : Info;

  return (
    <div
      className={`auth-notice auth-notice--${notice.tone}`}
      role="alert"
      aria-live="polite"
    >
      <Icon size={18} aria-hidden="true" />
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.description}</p>
      </div>
    </div>
  );
}
