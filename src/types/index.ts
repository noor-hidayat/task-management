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
  /** ID file di object storage (sumber sebenarnya). */
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
  /** Daftar penanggung jawab (multi-user). assignedTo = assignee utama/pertama. */
  assignees?: string[];
  team: string;
  teamId: string;
  shift: string;
  dueDate: string;
  description: string;
  plant: string;
  location: string;
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

export interface IssueType {
  id: string;
  name: string;
  createdAt: string;
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
  /** Issue type ID dan name */
  issueTypeId?: string;
  issueType?: string;
  resolution?: string;
  closedAt?: string;
  startDateTime?: string;
  endDateTime?: string;
  startDateTimeISO?: string;
  endDateTimeISO?: string;
  holdReason?: string;
  cancelled?: boolean;
  evidences: Evidence[];
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
}

/* ── Notes ─────────────────────────────────────────────────────── */

export type NotePermission = "view" | "edit";

export type NoteVisibility = "private" | "public";

export type NoteRelatedType = "task" | "issue";

export interface NoteShare {
  id: string;
  userId: string;
  userName: string;
  permission: NotePermission;
  createdAt: string;
}

export interface NoteRelation {
  id: string;
  relatedType: NoteRelatedType;
  /** UUID works/issues yang direlasikan. */
  relatedId: string;
  relatedNumber?: string;
  relatedTitle?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  /** HTML rich-text dari editor. */
  content: string;
  /** Tag kategorisasi saja — bukan relasi Task/Issue. */
  tags: string[];
  /** True bila note dibagikan ke ≥1 user lain. */
  shared: boolean;
  /** True bila current user adalah owner. */
  isOwner: boolean;
  /** True bila current user boleh mengubah note (owner / share 'edit'). */
  canEdit: boolean;
  /** 'private' (hanya owner+shared) atau 'public' (semua user bisa baca). */
  visibility: NoteVisibility;
  shares: NoteShare[];
  relations: NoteRelation[];
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
  /** ISO mentah untuk sorting. */
  rawUpdatedAt: string;
  rawCreatedAt: string;
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
