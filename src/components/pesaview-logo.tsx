import pesaviewLogo from "@/assets/pesaview-logo.svg";
import { cn } from "@/lib/utils";

interface PesaViewLogoProps {
  className?: string;
}

export function PesaViewLogo({ className }: PesaViewLogoProps) {
  return (
    <span className={cn("inline-flex size-6 overflow-clip", className)}>
      <img src={pesaviewLogo} alt="" width={24} height={24} className="size-full" />
    </span>
  );
}
