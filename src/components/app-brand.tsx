import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { PesaViewLogo } from "@/components/pesaview-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  APP_VERSION,
  AUTHOR_NAME,
  AUTHOR_URL,
  FEEDBACK_URL,
  WHATS_NEW_URL,
} from "@/lib/appMeta";
import { isTauri } from "@/lib/utils";

async function openExternal(url: string) {
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function AppBrand() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <PesaViewLogo className="size-7 shrink-0" />
        <p className="shrink-0 text-base leading-none font-semibold tracking-tight">
          PesaView
        </p>
        <button
          type="button"
          className="shrink-0 rounded-sm px-1 py-0.5 text-xs leading-none font-medium tabular-nums text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-chrome"
          aria-haspopup="dialog"
          aria-expanded={open}
          title="About, feedback, and who makes PesaView"
          onClick={() => setOpen(true)}
        >
          {APP_VERSION}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>PesaView {APP_VERSION}</DialogTitle>
            <DialogDescription>
              {AUTHOR_NAME} makes this. Statements stay on this computer — no
              upload, no account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter variant="bare" className="flex-wrap sm:justify-start">
            <Button
              variant="outline"
              onClick={() => void openExternal(FEEDBACK_URL)}
            >
              Feedback
            </Button>
            <Button
              variant="ghost"
              onClick={() => void openExternal(WHATS_NEW_URL)}
            >
              What’s new
            </Button>
            <Button
              variant="ghost"
              onClick={() => void openExternal(AUTHOR_URL)}
            >
              {AUTHOR_NAME}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
