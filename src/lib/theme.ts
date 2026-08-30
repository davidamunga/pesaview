import { isTauri } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pesaview-theme";

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private mode can throw.
  }
  return "system";
}

export function writeThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function prefersDarkScheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveTheme(preference, prefersDarkScheme());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  void syncNativeTheme(preference);
}

async function syncNativeTheme(preference: ThemePreference) {
  if (!isTauri()) return;
  try {
    const { setTheme } = await import("@tauri-apps/api/app");
    await setTheme(preference === "system" ? null : preference);
  } catch {
    // Browser preview or older WebView.
  }
}
