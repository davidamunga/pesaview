import type { RefObject } from "react";
import { Check, CircleX, Minus, Plus, Redo2, Undo2, Zap } from "lucide-react";
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
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
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
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  headingRef,
}: SelectToolbarProps) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2.5 overflow-x-auto bg-background px-3 py-1.5">
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
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={zoom <= 0.5}
          title="Zoom out"
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          <Minus />
        </Button>
        <button
          type="button"
          title="Fit page"
          aria-label={zoom === 1 ? "Page is fitted" : "Fit page"}
          className="h-7 min-w-11 rounded-md px-1 text-xs tabular-nums text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onZoomFit}
        >
          {Math.round(zoom * 100) === 100 ? "Fit" : `${Math.round(zoom * 100)}%`}
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={zoom >= 4}
          title="Zoom in"
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          <Plus />
        </Button>
      </div>
      {method === "lattice" && (
        <p className="text-xs text-muted-foreground">Using ruled lines</p>
      )}
      <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
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
              <Button variant="ghost" size="xs" disabled={busy} title="If columns look wrong">
                Columns
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
          <p id="continue-hint" className="sr-only">
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
