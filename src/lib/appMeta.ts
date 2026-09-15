export function formatAppVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) return "v0.0.0";
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export const APP_VERSION = formatAppVersion(
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0",
);

export const FEEDBACK_URL = "https://pesaview.com/feedback";
export const WHATS_NEW_URL = "https://github.com/davidamunga/pesaview/releases";
export const AUTHOR_NAME = "David Amunga";
export const AUTHOR_URL = "https://davidamunga.com";

