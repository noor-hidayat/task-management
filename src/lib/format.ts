import type { IssueStatus, Priority, WorkStatus } from "@/types";

export const statusLabel: Record<WorkStatus, string> = {
  todo: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export const statusVariant: Record<WorkStatus, "todo" | "progress" | "completed"> = {
  todo: "todo",
  in_progress: "progress",
  completed: "completed",
};

export const groupLabel: Record<WorkStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

export const priorityLabel: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const issueStatusLabel: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  on_hold: "On Hold",
  closed: "Closed",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColor(name: string): string {
  const colors = [
    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    "bg-pink-500/15 text-pink-700 dark:text-pink-400",
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}
