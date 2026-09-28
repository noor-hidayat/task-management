export type WorkStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "handover"
  | "completed";

export type Priority = "low" | "medium" | "high";

export type TaskType = "core" | "adhoc";

export type UserRole = "admin" | "leader" | "member";

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
  projectId?: string;
  blockedReason?: string;
  blockedNote?: string;
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

export interface Handover {
  id: string;
  taskNumber: string;
  taskTitle: string;
  from: string;
  fromShift: string;
  to: string;
  toShift: string;
  progress: number;
  note: string;
  status: "pending" | "accepted" | "completed";
  handoverAt: string;
  acceptedAt?: string;
}

export interface ScheduleRow {
  user: string;
  userId: string;
  days: Record<string, string>;
}
