export function getPageTransitionPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const isSettingsSection = segments[0] === "settings" && segments.length <= 2;

  return isSettingsSection ? "/settings" : pathname;
}
