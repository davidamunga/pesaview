import type { RefObject } from "react";
import { Check, CircleX, Redo2, Undo2, Zap } from "lucide-react";
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

const apple =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const undoShortcut = apple ? "⌘Z" : "Ctrl+Z";
const redoShortcut = apple ? "⌘⇧Z" : "Ctrl+Y";

interface SelectToolbarProps {
  selectionCount: number;
  busy?: boolean;
  canAutodetect: boolean;
  method: ExtractionMethod;
  templates: StatementTemplate[];
  continueHint: string;
  canContinue: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
    <div className="flex shrink-0 flex-wrap items-center gap-2 bg-background px-3 py-1.5">
      {headingRef ? (
        <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
          Select tables
        </h1>
      ) : null}
      <Button variant="ghost" size="xs" disabled={busy} onClick={onChangePdf}>
        Change PDF
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={busy || !canUndo}
        title={`Undo box (${undoShortcut})`}
        aria-keyshortcuts={undoShortcut}
        onClick={onUndo}
      >
        <Undo2 />
        Undo
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={busy || !canRedo}
        title={`Redo box (${redoShortcut})`}
        aria-keyshortcuts={redoShortcut}
        onClick={onRedo}
      >
        <Redo2 />
        Redo
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
