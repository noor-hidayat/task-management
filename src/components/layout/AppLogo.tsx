import { CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
}

export function AppLogo({ className, iconClassName }: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <CheckSquare className={cn("h-5 w-5 text-primary-foreground", iconClassName)} />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-semibold leading-tight">Team Work</span>
        <span className="text-xs text-muted-foreground leading-tight">Task Management</span>
      </div>
    </div>
  );
}
