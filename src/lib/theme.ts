import { isTauri } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pesaview-theme";

/** Matches --chrome so the native title bar and header sit on the same fill. */
export const WINDOW_CHROME: Record<ResolvedTheme, string> = {
  light: "#efeee9",
  dark: "#1c211d",
};

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

export function applyWindowChrome() {
  const macos = /Mac/i.test(navigator.userAgent) && !/like Mac/i.test(navigator.userAgent);
  document.documentElement.classList.toggle("tauri", isTauri());
  document.documentElement.classList.toggle("macos", macos);
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveTheme(preference, prefersDarkScheme());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  applyWindowChrome();
  void syncNativeChrome(preference, resolved);
}

async function syncNativeChrome(preference: ThemePreference, resolved: ResolvedTheme) {
  if (!isTauri()) return;
  try {
    const { setTheme } = await import("@tauri-apps/api/app");
    await setTheme(preference === "system" ? null : preference);
  } catch {
    // Browser preview or older WebView.
  }
  const hex = WINDOW_CHROME[resolved];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_native_background", { hex });
  } catch {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setBackgroundColor(hex);
    } catch {
      // Missing permission or older runtime — CSS chrome still matches.
    }
  }
}
