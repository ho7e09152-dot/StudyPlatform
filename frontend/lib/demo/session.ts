const DEMO_SESSION_KEY = "study-ing-demo-session";

export function isDemoSessionActive() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) === "active";
  } catch {
    return false;
  }
}

export function startDemoSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DEMO_SESSION_KEY, "active");
  } catch {
    // A blocked sessionStorage still falls back to the regular auth flow.
  }
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // Login remains available even when browser storage is unavailable.
  }
}

export function getDemoEntryUrl(returnTo = "/today") {
  return `/demo?returnTo=${encodeURIComponent(returnTo)}`;
}
