import { PesaViewLogo } from "@/components/pesaview-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdateChecker } from "@/components/update-checker";
import { cn } from "@/lib/utils";
import type { WizardStep } from "@/types";

const STEPS: { id: WizardStep; label: string; n: number }[] = [
  { id: "upload", label: "Upload", n: 1 },
  { id: "select", label: "Tables", n: 2 },
  { id: "review", label: "Review", n: 3 },
];

interface WizardHeaderProps {
  step: WizardStep;
  canSelect: boolean;
  canReview: boolean;
  fileName?: string;
  onStep: (step: WizardStep) => void;
}

export function WizardHeader({ step, canSelect, canReview, fileName, onStep }: WizardHeaderProps) {
  const unlocked: Record<WizardStep, boolean> = {
    upload: true,
    select: canSelect,
    review: canReview,
  };

  return (
    <header
      data-tauri-drag-region
      className="window-chrome grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 bg-chrome select-none shadow-[inset_0_-1px_0_0_color-mix(in_oklch,var(--foreground)_8%,transparent)]"
    >
      <div className="flex min-w-0 items-center gap-2.5 pl-3">
        <PesaViewLogo className="size-7 shrink-0" />
        <p className="shrink-0 text-base leading-none font-semibold tracking-tight">PesaView</p>
        {fileName ? (
          <>
            <span className="text-muted-foreground/40 leading-none" aria-hidden>
              ·
            </span>
            <p className="min-w-0 truncate text-sm leading-none text-muted-foreground" title={fileName}>
              {fileName}
            </p>
          </>
        ) : null}
      </div>

      <nav aria-label="Steps" className="flex shrink-0 items-center gap-6">
        {STEPS.map((item) => {
          const active = step === item.id;
          const enabled = unlocked[item.id];
          return (
            <button
              key={item.id}
              type="button"
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex h-7 items-center gap-2 outline-none transition",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-chrome",
                enabled && !active && "text-muted-foreground hover:text-foreground",
                !enabled && "cursor-not-allowed text-muted-foreground/40",
                active && "text-foreground",
              )}
              onClick={() => enabled && onStep(item.id)}
            >
              <span className="text-sm font-semibold tabular-nums">{item.n}</span>
              <span className={cn("text-sm leading-none", active && "font-semibold")}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex h-7 items-center justify-end gap-0.5 pr-3">
        <UpdateChecker showButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
