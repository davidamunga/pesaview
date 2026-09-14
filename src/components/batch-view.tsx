import { useEffect, useRef, useState, type RefObject } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { PasswordPrompt } from "@/components/password-prompt";
import { Button } from "@/components/ui/button";
import type { BatchJob, ExportFormat } from "@/lib/batchJob";
import { pickDirectory } from "@/lib/pickPdf";
import { cn, isTauri } from "@/lib/utils";
import { runBatchJob } from "@/services/batchService";
import { TabulaService } from "@/services/tabulaService";
import type { OpenedPdf, StatementTemplate } from "@/types";

interface BatchViewProps {
  jobs: BatchJob[];
  templates: StatementTemplate[];
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onJobsChange: (next: BatchJob[]) => void;
  onClose: () => void;
  onOpenEditor: (pdf: OpenedPdf) => void;
}

function folderLabel(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function statusCopy(job: BatchJob): string {
  if (job.status === "waiting") return "Ready";
  if (job.status === "finding") return "Finding tables…";
  if (job.status === "extracting") return "Extracting…";
  if (job.status === "saved") {
    const name = job.outputPath?.split(/[\\/]/).pop();
    return name ? `Saved ${name}` : "Saved";
  }
  if (job.status === "needs-password") return "Needs a password";
  if (job.status === "no-layout") return "No layout in the library";
  return job.error || "Could not extract";
}

export function BatchView({
  jobs,
  templates,
  headingRef,
  onJobsChange,
  onClose,
  onOpenEditor,
}: BatchViewProps) {
  const [outputDir, setOutputDir] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [running, setRunning] = useState(false);
  const [editorError, setEditorError] = useState("");
  const jobsRef = useRef(jobs);
  const takenRef = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const outputDirRef = useRef(outputDir);
  jobsRef.current = jobs;
  outputDirRef.current = outputDir;

  useEffect(() => {
    takenRef.current = new Set();
  }, [outputDir, format]);

  const patch = (id: string, update: Partial<BatchJob>) => {
    const next = jobsRef.current.map((job) => (job.id === id ? { ...job, ...update } : job));
    jobsRef.current = next;
    onJobsChange(next);
  };

  const locked = jobs.find((job) => job.status === "needs-password");
  const blocked = jobs.find((job) => job.status === "no-layout");
  const saved = jobs.filter((job) => job.status === "saved").length;
  const current = jobs.find((job) => job.status === "finding" || job.status === "extracting");
  const canStart = isTauri() && Boolean(outputDir) && !running && jobs.some((job) => job.status === "waiting");

  const runQueue = async (dir = outputDirRef.current) => {
    if (!dir || runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setEditorError("");
    const first = jobsRef.current.find(
      (job) => job.status === "waiting" || (job.status === "needs-password" && job.password),
    );
    if (first) patch(first.id, { status: "finding" });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      for (const job of jobsRef.current) {
        if (controller.signal.aborted) break;
        if (job.status === "saved" || job.status === "error" || job.status === "no-layout") {
          continue;
        }
        if (job.status === "needs-password" && !job.password) {
          break;
        }
        try {
          const result = await runBatchJob({
            path: job.path,
            name: job.name,
            password: job.password,
            templates,
            format,
            outputDir: dir,
            takenNames: takenRef.current,
            signal: controller.signal,
            onStatus: (status) => patch(job.id, { status, error: undefined }),
          });
          if (controller.signal.aborted) {
            patch(job.id, { status: "waiting" });
            break;
          }
          if (result.status === "saved") {
            patch(job.id, {
              status: "saved",
              outputPath: result.outputPath,
              templateName: result.templateName,
              error: undefined,
            });
            continue;
          }
          if (result.status === "needs-password") {
            patch(job.id, { status: "needs-password", error: result.error, password: undefined });
            break;
          }
          if (result.status === "no-layout") {
            patch(job.id, { status: "no-layout", error: undefined });
            break;
          }
          patch(job.id, { status: "error", error: result.error });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            patch(job.id, { status: "waiting" });
            break;
          }
          const message = error instanceof Error ? error.message : String(error);
          patch(job.id, { status: "error", error: message });
        }
      }
    } finally {
      abortRef.current = null;
      runningRef.current = false;
      setRunning(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    void TabulaService.cancel();
  };

  const chooseFolder = async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setOutputDir(dir);
    void runQueue(dir);
  };

  const unlock = (password: string, applyToRest?: boolean) => {
    if (!locked) return;
    const secret = password.trim();
    const next = jobsRef.current.map((job) => {
      if (job.id === locked.id) {
        return { ...job, password: secret, status: "waiting" as const, error: undefined };
      }
      if (applyToRest && job.status === "waiting") {
        return { ...job, password: secret };
      }
      return job;
    });
    jobsRef.current = next;
    onJobsChange(next);
    void runQueue();
  };

  const skipLocked = () => {
    if (!locked) return;
    patch(locked.id, { status: "error", error: "Skipped — this statement needs a password." });
    void runQueue();
  };

  const skipBlocked = () => {
    if (!blocked) return;
    void runQueue();
  };

  const openEditor = async (job: BatchJob) => {
    setEditorError("");
    try {
      const data = await readFile(job.path);
      onOpenEditor({ path: job.path, name: job.name, data, password: job.password });
    } catch {
      setEditorError("Could not open that PDF in the editor.");
    }
  };

  const summary = running
    ? current
      ? `${saved} of ${jobs.length} saved · ${statusCopy(current)} ${current.name}`
      : `${saved} of ${jobs.length} saved`
    : outputDir
      ? `${jobs.length} statements · ${folderLabel(outputDir)} · ${format.toUpperCase()} — press Start`
      : `${jobs.length} statements · choose a folder, then Start`;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col px-8 pt-6 pb-8">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl leading-tight font-semibold tracking-tight outline-none"
          >
            Several statements
          </h1>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            Choose a folder, then Start. Each file is detected and written there. The queue
            pauses if a file needs a password or a layout.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={running} onClick={() => void chooseFolder()}>
            {outputDir ? folderLabel(outputDir) : "Choose folder…"}
          </Button>
          <div className="flex items-center gap-0.5">
            <Button
              variant={format === "csv" ? "secondary" : "ghost"}
              size="sm"
              disabled={running}
              onClick={() => setFormat("csv")}
            >
              CSV
            </Button>
            <Button
              variant={format === "xlsx" ? "secondary" : "ghost"}
              size="sm"
              disabled={running}
              onClick={() => setFormat("xlsx")}
            >
              Excel
            </Button>
          </div>
          <Button size="sm" disabled={!canStart} onClick={() => void runQueue()}>
            Start
          </Button>
          {running ? (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        {outputDir ? (
          <p className="truncate text-xs text-muted-foreground" title={outputDir}>
            {outputDir}
          </p>
        ) : null}
        {blocked && !running && !locked ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <p className="min-w-0 flex-1 text-muted-foreground">
              {blocked.name} has no matching layout.
            </p>
            <Button size="xs" onClick={() => void openEditor(blocked)}>
              Open in editor
            </Button>
            <Button variant="ghost" size="xs" onClick={skipBlocked}>
              Skip
            </Button>
          </div>
        ) : null}

        <ul className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/25">
          {jobs.map((job) => (
            <li
              key={job.id}
              className={cn(
                "flex items-baseline justify-between gap-3 border-b px-4 py-2.5 last:border-b-0",
                (job.status === "finding" || job.status === "extracting") && "bg-card",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={job.name}>
                  {job.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">{statusCopy(job)}</p>
              </div>
              {(job.status === "no-layout" || job.status === "error" || job.status === "needs-password") &&
              !running ? (
                <Button variant="ghost" size="xs" onClick={() => void openEditor(job)}>
                  Open in editor
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {summary}
        </p>
        {editorError ? <p className="text-sm text-destructive">{editorError}</p> : null}
        {!isTauri() ? (
          <p className="text-sm text-destructive">Extracting several statements needs the desktop app.</p>
        ) : null}
      </div>

      {locked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 p-6">
          <PasswordPrompt
            fileName={locked.name}
            error={locked.error}
            allowApplyToRest
            work={running && current?.id === locked.id ? (current.status === "finding" ? "detecting" : "unlocking") : null}
            onSubmit={unlock}
            onCancel={skipLocked}
          />
        </div>
      )}
    </div>
  );
}
