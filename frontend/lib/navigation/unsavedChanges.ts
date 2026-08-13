"use client";

import { useEffect } from "react";

const activeGuards = new Set<symbol>();
const MESSAGE = "저장하지 않은 변경사항이 있습니다. 페이지를 나가시겠어요?";

export function confirmUnsavedChanges() {
  return activeGuards.size === 0 || window.confirm(MESSAGE);
}

export function useUnsavedChanges(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const guard = Symbol("unsaved-settings-form");
    let restoringHistory = false;
    activeGuards.add(guard);

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function followLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.href === window.location.href || target.origin !== window.location.origin) return;
      if (!confirmUnsavedChanges()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onPopState() {
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      if (!confirmUnsavedChanges()) {
        restoringHistory = true;
        window.history.forward();
      }
    }

    function onNavigate(event: Event) {
      const navigationEvent = event as Event & { navigationType?: string };
      if (navigationEvent.navigationType === "traverse" && !confirmUnsavedChanges()) event.preventDefault();
    }

    const navigation = (window as Window & { navigation?: EventTarget }).navigation;

    window.addEventListener("beforeunload", beforeUnload);
    if (navigation) navigation.addEventListener("navigate", onNavigate);
    else window.addEventListener("popstate", onPopState);
    document.addEventListener("click", followLink, true);
    return () => {
      activeGuards.delete(guard);
      window.removeEventListener("beforeunload", beforeUnload);
      if (navigation) navigation.removeEventListener("navigate", onNavigate);
      else window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", followLink, true);
    };
  }, [active]);
}
