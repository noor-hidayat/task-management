import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams, useUsers } from "@/hooks/useSupabaseLists";
import type { Priority } from "@/types";

export type TaskChecklistDraft = { id: string; title: string; done: boolean };

export type TaskFormValues = {
  title: string;
  priority: Priority;
  /** ISO yyyy-mm-dd (untuk input date) */
  dueISO: string;
  assignedTo: string;
  teamId: string;
  checklist: TaskChecklistDraft[];
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-26" -> "26 Sep 2026" */
export function toDMY(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || !MONTH_ABBR[m - 1]) return iso;
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

/** ISO yyyy-mm-dd untuk besok (default due date = H+1). */
export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "26 Sep 2026" -> "2026-09-26" ("" kalau tidak valid) */
export function dmyToISO(dmy: string): string {
  const [d, m, y] = dmy.split(" ");
  const mi = MONTH_ABBR.indexOf(m);
  if (!d || mi < 0 || !y) return "";
  return `${y}-${String(mi + 1).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
}

const DEFAULTS: Omit<TaskFormValues, "assignedTo"> = {
  title: "",
  priority: "medium",
  dueISO: tomorrowISO(),
  teamId: "",
  checklist: [],
};

export function TaskFormDialog({
  open,
  onOpenChange,
  initial,
  dialogTitle,
  dialogDescription,
  submitLabel,
  showAssignee = true,
  showTeam = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<TaskFormValues>;
  dialogTitle: string;
  dialogDescription?: string;
  submitLabel: string;
  showAssignee?: boolean;
  showTeam?: boolean;
  onSubmit: (values: TaskFormValues) => void;
}) {
  const { data: teams } = useTeams();
  const { data: users } = useUsers();
  const { user: currentUser } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? DEFAULTS.title);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? DEFAULTS.priority);
  const [dueISO, setDueISO] = useState(initial?.dueISO ?? DEFAULTS.dueISO);
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? currentUser?.name ?? "");
  const [teamId, setTeamId] = useState(initial?.teamId ?? DEFAULTS.teamId);
  const checklist: TaskChecklistDraft[] = initial?.checklist ?? [];

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      priority,
      dueISO,
      assignedTo,
      teamId,
      checklist,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription && <DialogDescription>{dialogDescription}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-[1fr_240px]">
          {/* Kiri: Title */}
          <div className="grid content-start gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tf-title">Title</Label>
              <Input
                id="tf-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cth: Check Machine Line 4"
                autoComplete="off"
              />
            </div>
          </div>
          {/* Kanan: Assigned To, Team, Priority, Due Date */}
          {showAssignee && (
            <div className="grid gap-2">
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showTeam && (
            <div className="grid gap-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tf-due">Due Date</Label>
            <Input
              id="tf-due"
              type="date"
              value={dueISO}
              onChange={(e) => setDueISO(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
