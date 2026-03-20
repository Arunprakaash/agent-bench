/**
 * Keeps `document.documentElement` in sync with localStorage + prefers-color-scheme.
 * Used on app shell mount so /auth (no sidebar) still respects theme.
 */
export function syncDocumentThemeFromStorage(): void {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = stored === "dark" || (!stored && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function getInitialDarkFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return stored === "dark" || (!stored && prefersDark);
}
