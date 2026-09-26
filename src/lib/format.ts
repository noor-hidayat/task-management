import type { Priority, WorkStatus } from "@/types";

export const statusLabel: Record<WorkStatus, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  handover: "Handover",
  completed: "Completed",
};

export const statusVariant: Record<WorkStatus, "todo" | "progress" | "handover" | "completed"> = {
  todo: "todo",
  in_progress: "progress",
  handover: "handover",
  completed: "completed",
};

export const priorityLabel: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
