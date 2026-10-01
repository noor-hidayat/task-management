import { useEffect, useState } from "react";

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
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLocations, usePlants, useTeams, useUsers } from "@/hooks/useSupabaseLists";
import type { Priority } from "@/types";

export type TaskChecklistDraft = { id: string; title: string; done: boolean };

export type TaskFormValues = {
  title: string;
  description: string;
  priority: Priority;
  /** ISO yyyy-mm-dd (untuk input date) */
  dueISO: string;
  assignedTo: string;
  teamId: string;
  plant: string;
  location: string;
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
  description: "",
  priority: "medium",
  dueISO: tomorrowISO(),
  teamId: "",
  plant: "",
  location: "",
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
  const { data: plants } = usePlants();
  const { data: locations } = useLocations();
  const { user: currentUser } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? DEFAULTS.title);
  const [description, setDescription] = useState(initial?.description ?? DEFAULTS.description);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? DEFAULTS.priority);
  const [dueISO, setDueISO] = useState(initial?.dueISO ?? DEFAULTS.dueISO);
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [teamId, setTeamId] = useState(initial?.teamId ?? DEFAULTS.teamId);
  const [plant, setPlant] = useState(initial?.plant ?? DEFAULTS.plant);
  const [location, setLocation] = useState(initial?.location ?? DEFAULTS.location);
  const checklist: TaskChecklistDraft[] = initial?.checklist ?? [];

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? DEFAULTS.title);
    setDescription(initial?.description ?? DEFAULTS.description);
    setPriority(initial?.priority ?? DEFAULTS.priority);
    setDueISO(initial?.dueISO ?? DEFAULTS.dueISO);
    setAssignedTo(initial?.assignedTo ?? "");
    setTeamId(initial?.teamId ?? DEFAULTS.teamId);
    setPlant(initial?.plant ?? DEFAULTS.plant);
    setLocation(initial?.location ?? DEFAULTS.location);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueISO,
      assignedTo,
      teamId,
      plant: plant.trim(),
      location: location.trim(),
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
          {/* Kiri: Title + Description */}
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
            <div className="grid gap-2">
              <Label>Description</Label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                users={users.map((u) => u.name)}
                placeholder="Deskripsi detail task..."
                height={200}
              />
            </div>
          </div>
          {/* Kanan: Assigned To, Team, Priority, Due Date */}
          <div className="grid content-start gap-4 md:border-l md:pl-4">
          {showAssignee && (
            <div className="grid gap-2">
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Assignee" />
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
                  <SelectValue placeholder="Select Team" />
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
            <Label>Plant</Label>
            <Select value={plant || "__none"} onValueChange={(v) => setPlant(v === "__none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Plant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {plants.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Location</Label>
            <Select value={location || "__none"} onValueChange={(v) => setLocation(v === "__none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
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
