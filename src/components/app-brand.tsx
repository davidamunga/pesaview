import { PesaViewLogo } from "@/components/pesaview-logo";
import { APP_VERSION } from "@/lib/appMeta";

export function AppBrand() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <PesaViewLogo className="size-7 shrink-0" />
      <p className="shrink-0 text-base leading-none font-semibold tracking-tight">
        PesaView
      </p>
      <span className="shrink-0 text-xs leading-none tabular-nums text-muted-foreground">
        {APP_VERSION}
      </span>
    </div>
  );
}
