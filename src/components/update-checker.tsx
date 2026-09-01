import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/utils";

const RELEASES_URL = "https://github.com/davidamunga/pesaview/releases";
const CHANGELOG_URL =
  "https://raw.githubusercontent.com/davidamunga/pesaview/main/CHANGELOG.md";

const dismissedVersions = new Set<string>();

interface UpdateCheckerProps {
  autoCheck?: boolean;
  showButton?: boolean;
}

function formatReleaseNotes(notes: string): string {
  return notes
    .split("\n")
    .map((line) => {
      if (line.match(/^###\s+(.+)/)) {
        return line.replace(/^###\s+/, "").toUpperCase() + ":";
      }
      return line;
    })
    .join("\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function extractVersionChanges(notes: string, version: string): string {
  const lines = notes.split("\n");
  const escapedVersion = version.replace(/\./g, "\\.");
  const heading = new RegExp(`^##\\s*v?${escapedVersion}(?:\\s|$)`, "i");

  let startIndex = -1;
  let endIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (heading.test(lines[i])) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) {
    return formatReleaseNotes(notes);
  }

  for (let i = startIndex; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  const versionChanges = lines.slice(startIndex, endIndex).join("\n").trim();
  return formatReleaseNotes(versionChanges || notes);
}

export function UpdateChecker({
  autoCheck = false,
  showButton = false,
}: UpdateCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);

  const installUpdate = useCallback(async (update: Update) => {
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      if (error instanceof Error) {
        console.error("Update installation failed:", error.message);
      }
      const openManually = await ask(
        "The automatic update couldn't be installed.\n\nYou can download the latest version directly from GitHub.",
        {
          title: "Update Failed",
          kind: "error",
          okLabel: "Download Manually",
          cancelLabel: "Dismiss",
        },
      );
      if (openManually) {
        await openUrl(RELEASES_URL);
      }
    }
  }, []);

  const checkForUpdates = useCallback(
    async (forceShow: boolean = true) => {
      try {
        setIsChecking(true);
        const update = await check();

        if (update) {
          if (!forceShow && dismissedVersions.has(update.version)) {
            return;
          }

          let releaseNotes = "No release notes available.";
          try {
            const response = await fetch(CHANGELOG_URL);
            if (response.ok) {
              const changelogText = await response.text();
              if (changelogText.trim()) {
                releaseNotes = changelogText;
              }
            } else if (update.body) {
              releaseNotes = update.body;
            }
          } catch {
            if (update.body) {
              releaseNotes = update.body;
            }
          }

          const formattedNotes = extractVersionChanges(
            releaseNotes,
            update.version,
          );
          const shouldUpdate = await ask(
            `A new version ${update.version} is available!\n\nWhat's New:\n${formattedNotes}\n\nDownload and install now? The app will restart automatically.`,
            {
              title: "Update Available",
              kind: "info",
              okLabel: "Update Now",
              cancelLabel: "Later",
            },
          );

          if (shouldUpdate) {
            await installUpdate(update);
          } else {
            dismissedVersions.add(update.version);
          }
        } else if (forceShow) {
          await message("You're running the latest version.", {
            title: "No Updates Available",
            kind: "info",
          });
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error("Update check failed:", error.message);
        }
        if (forceShow) {
          await message("Failed to check for updates. Please try again later.", {
            title: "Update Check Failed",
            kind: "error",
          });
        }
      } finally {
        setIsChecking(false);
      }
    },
    [installUpdate],
  );

  useEffect(() => {
    if (autoCheck && isTauri()) {
      void checkForUpdates(false);
    }
  }, [autoCheck, checkForUpdates]);

  if (!showButton || !isTauri()) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      aria-label={isChecking ? "Checking for updates" : "Check for updates"}
      title={isChecking ? "Checking for updates…" : "Check for updates"}
      disabled={isChecking}
      onClick={() => void checkForUpdates(true)}
    >
      <RefreshCw className={isChecking ? "animate-spin" : undefined} />
    </Button>
  );
}
