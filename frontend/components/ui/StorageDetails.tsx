import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function StorageDetails({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`storage-details${className ? ` ${className}` : ""}`}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronRight size={17} aria-hidden="true" />
      </summary>
      <div className="storage-details__content">{children}</div>
    </details>
  );
}
