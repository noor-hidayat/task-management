export type WorkStatus =
  | "todo"
  | "in_progress"
  | "completed";

export type Priority = "low" | "medium" | "high";

export type TaskType = "core" | "adhoc";

export type IssueStatus = "open" | "in_progress" | "on_hold" | "closed";

/** Nama role — merujuk ke public.roles.name. Bawaan: admin/leader/member. */
export type UserRole = string;

export interface User {
  id: string;
  name: string;
  username?: string;
  password?: string;
  initials?: string;
  role: UserRole;
  teamId?: string;
  shift?: string;
}

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  active: boolean;
  coreWorkCount: number;
}

export interface ShiftDef {
  id: string;
  name: string;
  code: string;
  start: string;
  end: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Evidence {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Isi file (data URL) untuk preview lokal sesaat — opsional. */
  dataUrl?: string;
  /** ID file di Google Drive (sumber sebenarnya). */
  driveFileId?: string;
}

export interface Activity {
  id: string;
  at: string;
  text: string;
  actor: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  time?: string;
  at?: string;
}

export interface WorkItem {
  id: string;
  number: string;
  title: string;
  type: TaskType;
  status: WorkStatus;
  priority: Priority;
  createdBy: string;
  assignedTo: string;
  team: string;
  teamId: string;
  shift: string;
  dueDate: string;
  description: string;
  progress: number;
  evidenceRequired: boolean;
  cancelled?: boolean;
  evidences: Evidence[];
  checklist: ChecklistItem[];
  comments?: Comment[];
  note: string;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
}

export interface CoreWorkDef {
  id: string;
  name: string;
  description: string;
  team: string;
  frequency: string;
  schedule: string;
  evidenceRequired: boolean;
  checklist: string[];
  status: "active" | "inactive";
  todayInstance?: string;
}

export interface ScheduleRow {
  user: string;
  userId: string;
  days: Record<string, string>;
}

export interface HandoverEntry {
  id: string;
  fromTeamId?: string;
  fromTeam?: string;
  toTeamId: string;
  toTeam: string;
  at: string;
  actor: string;
  note?: string;
}

export interface Issue {
  id: string;
  number: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  createdBy: string;
  assignedTo: string;
  /** Daftar penanggung jawab (multi-user). assignedTo = assignee utama/pertama. */
  assignees?: string[];
  /** Tim pelapor asli — tidak berubah saat handover. */
  reportedTeamId?: string;
  reportedTeam?: string;
  /** Tim yang sedang menangani issue — berubah saat handover. */
  assignedTeamId?: string;
  assignedTeam?: string;
  /** Riwayat serah terima antar tim. */
  handoverHistory?: HandoverEntry[];
  plant: string;
  location: string;
  dueDate: string;
  resolution?: string;
  closedBy?: string;
  closedAt?: string;
  holdReason?: string;
  evidences: Evidence[];
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
}

export type NotificationType =
  | "assignment"
  | "mention"
  | "progress"
  | "overdue"
  | "comment"
  | "handover";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Pihak yang memicu notifikasi. */
  from: string;
  /** Angka urut waktu (Date.now()) untuk sorting & label relatif. */
  timestamp: number;
  read: boolean;
  /** Tujuan saat diklik, mis. "/tasks/TK-000125". */
  link: string;
  /** Nama user yang menjadi target (kosong = untuk semua). */
  forUser?: string;
}
