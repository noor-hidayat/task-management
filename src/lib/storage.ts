import type { WorkItem } from "@/types";
import { works as seedWorks } from "./mock";

const WORKS_KEY = "tm_works_v1";
const PROJECTS_KEY = "tm_projects_v1";

export type ProjectItem = {
  id: string;
  name: string;
  description: string;
  tasks: number;
  leads: string[];
  members: string[];
  attachments: number;
  comments: number;
};

export const projectsSeed: ProjectItem[] = [
  { id: "p1", name: "Production Line Optimization", description: "Optimasi jalur produksi untuk meningkatkan output", tasks: 12, leads: ["Supervisor A"], members: ["John Doe", "Jane Smith", "Bob Wilson"], attachments: 3, comments: 8 },
  { id: "p2", name: "Safety Audit Q4", description: "Audit keselamatan kuartal 4 tahun 2026", tasks: 8, leads: ["Supervisor A"], members: ["Alice Brown", "Charlie Davis"], attachments: 5, comments: 12 },
  { id: "p3", name: "Equipment Upgrade Phase 2", description: "Upgrade peralatan fase 2 di area produksi", tasks: 0, leads: ["Eve Johnson"], members: ["Eve Johnson"], attachments: 1, comments: 3 },
  { id: "p4", name: "Training Program 2026", description: "Program pelatihan karyawan tahun 2026", tasks: 15, leads: ["Mike Chen"], members: ["Mike Chen", "Sarah Lee", "Tom Harris", "Lisa Wang"], attachments: 8, comments: 20 },
  { id: "p5", name: "Warehouse Automation", description: "Automasi gudang dan tracking inventory", tasks: 6, leads: ["Operator A"], members: ["Operator A", "Operator B"], attachments: 2, comments: 5 },
  { id: "p6", name: "Quality Control Upgrade", description: "Upgrade sistem QC dan SOP baru", tasks: 4, leads: ["Supervisor A"], members: ["Supervisor A", "Operator C"], attachments: 4, comments: 9 },
];

export function loadWorks(): WorkItem[] {
  try {
    const raw = localStorage.getItem(WORKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return seedWorks;
}

export function saveWorks(data: WorkItem[]) {
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(data)); } catch {}
}

export function loadProjects(): ProjectItem[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectItem[];
      if (Array.isArray(parsed) && parsed.length > 0)
        return parsed.map((p) => ({ ...p, leads: p.leads ?? [], members: p.members ?? [] }));
    }
  } catch {}
  return projectsSeed;
}

export function saveProjects(data: ProjectItem[]) {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(data)); } catch {}
}

export function notifyProjectsUpdated() {
  try { window.dispatchEvent(new CustomEvent("tm:projects:updated")); } catch {}
}

export function resetStorage() {
  try {
    localStorage.removeItem(WORKS_KEY);
    localStorage.removeItem(PROJECTS_KEY);
  } catch {}
}

export function seedIfEmpty() {
  if (!localStorage.getItem(WORKS_KEY)) saveWorks(seedWorks);
  if (!localStorage.getItem(PROJECTS_KEY)) saveProjects(projectsSeed);
}

export function notifyWorksUpdated() {
  try { window.dispatchEvent(new CustomEvent("tm:works:updated")); } catch {}
}
