import type { IssueStatus, Priority, WorkStatus } from "@/types";
import { issueStatusLabel, statusLabel, statusVariant, priorityLabel } from "@/lib/format";
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

const issueStatusVariant: Record<IssueStatus, "todo" | "progress" | "completed"> = {
  open: "todo",
  in_progress: "progress",
  on_hold: "todo",
  closed: "completed",
};

export function IssueStatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <Badge variant={issueStatusVariant[status]} className={cn(className)}>
      {issueStatusLabel[status]}
    </Badge>
  );
}
