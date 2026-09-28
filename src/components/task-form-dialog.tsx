import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { currentUser, users } from "@/lib/mock";
import { loadProjects } from "@/lib/storage";
import type { Priority } from "@/types";

export type TaskChecklistDraft = { id: string; title: string; done: boolean };

export type TaskFormValues = {
  title: string;
  description: string;
  projectId: string;
  priority: Priority;
  /** ISO yyyy-mm-dd (untuk input date) */
  dueISO: string;
  assignedTo: string;
  teamId: string;
  checklist: TaskChecklistDraft[];
};

const TEAMS = [
  { name: "Production A", id: "t-prod-a" },
  { name: "Maintenance", id: "t-maint" },
];

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

/** "26 Sep 2026" -> "2026-09-26" ("" kalau tidak valid) */
export function dmyToISO(dmy: string): string {
  const [d, m, y] = dmy.split(" ");
  const mi = MONTH_ABBR.indexOf(m);
  if (!d || mi < 0 || !y) return "";
  return `${y}-${String(mi + 1).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const DEFAULTS: TaskFormValues = {
  title: "",
  description: "",
  projectId: "",
  priority: "medium",
  dueISO: "2026-09-26",
  assignedTo: currentUser.name,
  teamId: "t-prod-a",
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
  showTeam = true,
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
  const projects = useMemo(() => loadProjects(), []);

  const [title, setTitle] = useState(initial?.title ?? DEFAULTS.title);
  const [description, setDescription] = useState(initial?.description ?? DEFAULTS.description);
  const [projectId, setProjectId] = useState(initial?.projectId ?? DEFAULTS.projectId);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? DEFAULTS.priority);
  const [dueISO, setDueISO] = useState(initial?.dueISO ?? DEFAULTS.dueISO);
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? DEFAULTS.assignedTo);
  const [teamId, setTeamId] = useState(initial?.teamId ?? DEFAULTS.teamId);
  const [checklist, setChecklist] = useState<TaskChecklistDraft[]>(initial?.checklist ?? []);
  const [checkDraft, setCheckDraft] = useState("");

  // Reset tiap kali dialog dibuka (create kosong / edit terisi data task)
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? DEFAULTS.title);
    setDescription(initial?.description ?? DEFAULTS.description);
    setProjectId(initial?.projectId ?? DEFAULTS.projectId);
    setPriority(initial?.priority ?? DEFAULTS.priority);
    setDueISO(initial?.dueISO ?? DEFAULTS.dueISO);
    setAssignedTo(initial?.assignedTo ?? DEFAULTS.assignedTo);
    setTeamId(initial?.teamId ?? DEFAULTS.teamId);
    setChecklist(initial?.checklist ? [...initial.checklist] : []);
    setCheckDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addCheck = () => {
    const t = checkDraft.trim();
    if (!t) return;
    setChecklist((prev) => [...prev, { id: newId(), title: t, done: false }]);
    setCheckDraft("");
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      projectId,
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
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription && <DialogDescription>{dialogDescription}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-2">
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
          {(showAssignee || showTeam) && (
            <div className="grid grid-cols-2 gap-4">
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
                      {TEAMS.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select
              value={projectId || "__none"}
              onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tf-desc">Description</Label>
            <Textarea
              id="tf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tulis deskripsi pekerjaan..."
              rows={3}
              className="resize-y"
            />
          </div>
          <div className="grid gap-2">
            <Label>
              Checklist{" "}
              <span className="font-normal text-muted-foreground">
                {checklist.filter((c) => c.done).length} / {checklist.length}
              </span>
            </Label>
            {checklist.length > 0 && (
              <ul className="space-y-1">
                {checklist.map((c) => (
                  <li
                    key={c.id}
                    className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={c.done}
                      onCheckedChange={() =>
                        setChecklist((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x))
                        )
                      }
                      aria-label={c.title}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        c.done ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {c.title}
                    </span>
                    <button
                      type="button"
                      aria-label={`Hapus ${c.title}`}
                      onClick={() => setChecklist((prev) => prev.filter((x) => x.id !== c.id))}
                      className="rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={checkDraft}
                onChange={(e) => setCheckDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCheck();
                  }
                }}
                placeholder="Tambah item checklist…"
                autoComplete="off"
              />
              <Button variant="outline" onClick={addCheck} disabled={!checkDraft.trim()}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
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
