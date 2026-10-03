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

/** Status tampilan task: "cancelled" menimpa status dasar. */
export type WorkDisplayStatus = WorkStatus | "cancelled";
export function workDisplayStatus(w: { status: WorkStatus; cancelled?: boolean }): WorkDisplayStatus {
  return w.cancelled ? "cancelled" : w.status;
}

/** Status tampilan issue: "cancelled" menimpa status dasar. */
export type IssueDisplayStatus = IssueStatus | "cancelled";
export function issueDisplayStatus(i: { status: IssueStatus; cancelled?: boolean }): IssueDisplayStatus {
  return i.cancelled ? "cancelled" : i.status;
}

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

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format tanggal/waktu untuk ditampilkan di UI: "26 Sep 2026 14:45".
 * Menerima ISO string, epoch, atau objek Date. Mengembalikan "—" bila kosong/tidak valid.
 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

/** Format tanggal saja: "26 Sep 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** HTML (rich text) -> teks polos satu baris untuk preview tabel/kartu. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function initials(name: string) {  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MONTHS_SHORT_LC: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Apakah tanggal "26 Sep 2026" (atau ISO) sudah lewat dari hari ini?
 * Dipakai untuk menandai tugas overdue di daftar mobile.
 */
export function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  let d: Date | null = null;
  const m = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (m) {
    const month = MONTHS_SHORT_LC[m[2].toLowerCase()];
    if (month !== undefined) d = new Date(Number(m[3]), month, Number(m[1]));
  } else {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
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
