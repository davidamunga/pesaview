import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { WizardStep } from "@/types";

const STEPS: { id: WizardStep; label: string; n: number }[] = [
  { id: "upload", label: "Upload", n: 1 },
  { id: "select", label: "Select tables", n: 2 },
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
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">PESAVIEW</p>
        {fileName && (
          <p className="max-w-[12rem] truncate text-xs text-foreground" title={fileName}>
            {fileName}
          </p>
        )}
      </div>
      <nav aria-label="Steps" className="mx-auto flex items-center gap-0.5">
        {STEPS.map((item, index) => {
          const active = step === item.id;
          const enabled = unlocked[item.id];
          return (
            <div key={item.id} className="flex items-center gap-1">
              {index > 0 && <span className="mx-0.5 h-px w-4 bg-border" aria-hidden />}
              <button
                type="button"
                disabled={!enabled}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs outline-none transition",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  active && "bg-primary text-primary-foreground",
                  !active && enabled && "text-foreground hover:bg-muted",
                  !enabled && "cursor-not-allowed text-muted-foreground",
                )}
                onClick={() => enabled && onStep(item.id)}
              >
                <span className="mr-1.5 font-medium tabular-nums">{item.n}</span>
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>
      <ThemeToggle />
    </header>
  );
}
