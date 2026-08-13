"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useExitTransition(onExited: () => void, duration = 150) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const callbackRef = useRef(onExited);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onExited;
  }, [onExited]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      callbackRef.current();
      return;
    }

    closingRef.current = true;
    setClosing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      callbackRef.current();
    }, duration);
  }, [duration]);

  return {
    closing,
    motionState: closing ? "closing" : "open",
    requestClose,
  } as const;
}
