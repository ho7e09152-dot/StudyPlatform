"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function PageTransition({ children, transitionKey }: { children: ReactNode; transitionKey?: string }) {
  const pathname = usePathname();
  const activeKey = transitionKey ?? pathname;
  const previousKey = useRef(activeKey);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previousKey.current === activeKey) return;
    previousKey.current = activeKey;
    contentRef.current?.focus({ preventScroll: true });
  }, [activeKey]);

  return (
    <div key={activeKey} ref={contentRef} className="motion-page" tabIndex={-1}>
      {children}
    </div>
  );
}
