export function safeAppReturnUrl(value: string | null | undefined, fallback = "/today") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return fallback;
  }

  return value;
}
