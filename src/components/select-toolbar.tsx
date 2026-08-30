import type { RefObject } from "react";
import { Check, CircleX, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatesMenu } from "@/components/templates-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { ExtractionMethod, StatementTemplate } from "@/types";

interface SelectToolbarProps {
  selectionCount: number;
  busy?: boolean;
  canAutodetect: boolean;
  method: ExtractionMethod;
  templates: StatementTemplate[];
  continueHint: string;
  canContinue: boolean;
  onMethodChange: (method: ExtractionMethod) => void;
  onApplyTemplate: (template: StatementTemplate) => void;
  onSaveTemplate: (name: string) => void;
  onClear: () => void;
  onAutodetect: () => void;
  onContinue: () => void;
  onChangePdf: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

export function SelectToolbar({
  selectionCount,
  busy,
  canAutodetect,
  method,
  templates,
  continueHint,
  canContinue,
  onMethodChange,
  onApplyTemplate,
  onSaveTemplate,
  onClear,
  onAutodetect,
  onContinue,
  onChangePdf,
  headingRef,
}: SelectToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-2.5 py-1.5">
      {headingRef ? (
        <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
          Select tables
        </h1>
      ) : null}
      <Button variant="ghost" size="xs" disabled={busy} onClick={onChangePdf}>
        Change PDF
      </Button>
      {method === "lattice" && (
        <p className="text-xs text-muted-foreground">Using ruled lines</p>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <TemplatesMenu
          templates={templates}
          disabled={busy}
          canSave={selectionCount > 0}
          onApply={onApplyTemplate}
          onSave={onSaveTemplate}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="xs" disabled={busy}>
                If columns look wrong
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>How text is read</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onMethodChange("stream")}>
                {method === "stream" ? <Check /> : <span className="size-4" />}
                Stream — flowing text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMethodChange("lattice")}>
                {method === "lattice" ? <Check /> : <span className="size-4" />}
                Lattice — ruled lines
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {canAutodetect && (
          <Button variant="outline" size="xs" disabled={busy} onClick={onAutodetect}>
            <Zap />
            Autodetect
          </Button>
        )}
        {selectionCount > 0 && (
          <Button variant="outline" size="xs" disabled={busy} onClick={onClear}>
            <CircleX />
            Clear boxes
          </Button>
        )}
        {!canContinue && (
          <p id="continue-hint" className="max-w-40 text-xs text-muted-foreground">
            {continueHint}
          </p>
        )}
        <Button
          disabled={!canContinue}
          aria-describedby={!canContinue ? "continue-hint" : undefined}
          title={!canContinue ? continueHint : undefined}
          size="xs"
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
