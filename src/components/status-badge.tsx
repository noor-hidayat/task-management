import type { Priority, WorkStatus } from "@/types";
import { statusLabel, statusVariant, priorityLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: WorkStatus; className?: string }) {
  return (
    <Badge variant={statusVariant[status]} className={cn(className)}>
      {statusLabel[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={priority}>{priorityLabel[priority]}</Badge>;
}

export function TypeBadge({ type }: { type: "core" | "adhoc" }) {
  return (
    <Badge variant="outline" className="font-normal">
      {type === "core" ? "Core Work" : "Ad-hoc"}
    </Badge>
  );
}
