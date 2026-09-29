import type { Issue, WorkItem } from "@/types";
import { issues as seedIssues, works as seedWorks } from "./mock";

const WORKS_KEY = "tm_works_v1";
const ISSUES_KEY = "tm_issues_v1";

export function loadWorks(): WorkItem[] {
  try {
    const raw = localStorage.getItem(WORKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrasi: status lama blocked/handover sudah dihapus → petakan ke in_progress
        return parsed.map((w) => {
          const s = w.status as string;
          return s === "blocked" || s === "handover"
            ? { ...w, status: "in_progress" as const }
            : w;
        });
      }
    }
  } catch {}
  return seedWorks;
}

export function saveWorks(data: WorkItem[]) {
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(data)); } catch {}
}

export function resetStorage() {
  try {
    localStorage.removeItem(WORKS_KEY);
    localStorage.removeItem(ISSUES_KEY);
  } catch {}
}

export function seedIfEmpty() {
  if (!localStorage.getItem(WORKS_KEY)) saveWorks(seedWorks);
  if (!localStorage.getItem(ISSUES_KEY)) saveIssues(seedIssues);
}

export function notifyWorksUpdated() {
  try { window.dispatchEvent(new CustomEvent("tm:works:updated")); } catch {}
}

export function loadIssues(): Issue[] {
  try {
    const raw = localStorage.getItem(ISSUES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Issue[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return seedIssues;
}

export function saveIssues(data: Issue[]) {
  try { localStorage.setItem(ISSUES_KEY, JSON.stringify(data)); } catch {}
}

export function notifyIssuesUpdated() {
  try { window.dispatchEvent(new CustomEvent("tm:issues:updated")); } catch {}
}
