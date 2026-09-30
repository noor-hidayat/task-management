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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tomorrowISO } from "@/components/task-form-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useSupabaseLists";
import type { Priority } from "@/types";

export type IssueFormValues = {
  title: string;
  priority: Priority;
  assignedTo: string;
  reportedTeamId: string;
  assignedTeamId: string;
  plant: string;
  location: string;
  /** ISO yyyy-mm-dd (untuk input date) */
  dueISO: string;
};

const DEFAULTS: Omit<IssueFormValues, "assignedTo" | "reportedTeamId" | "assignedTeamId"> = {
  title: "",
  priority: "medium",
  plant: "",
  location: "",
  dueISO: tomorrowISO(),
};

export function IssueFormDialog({
  open,
  onOpenChange,
  initial,
  dialogTitle,
  dialogDescription,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<IssueFormValues>;
  dialogTitle: string;
  dialogDescription?: string;
  submitLabel: string;
  onSubmit: (values: IssueFormValues) => void;
}) {
  const { user: currentUser } = useAuth();
  const { data: users } = useUsers();
  const defaultTeamId = currentUser?.teamId ?? "";
  const [title, setTitle] = useState(initial?.title ?? DEFAULTS.title);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? DEFAULTS.priority);
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? currentUser?.name ?? "");
  const [plant, setPlant] = useState(initial?.plant ?? DEFAULTS.plant);
  const [location, setLocation] = useState(initial?.location ?? DEFAULTS.location);
  const [dueISO, setDueISO] = useState(initial?.dueISO ?? tomorrowISO());

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? DEFAULTS.title);
    setPriority(initial?.priority ?? DEFAULTS.priority);
    setAssignedTo(initial?.assignedTo ?? currentUser?.name ?? "");
    setPlant(initial?.plant ?? DEFAULTS.plant);
    setLocation(initial?.location ?? DEFAULTS.location);
    setDueISO(initial?.dueISO ?? tomorrowISO());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = title.trim().length > 0 && assignedTo.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      priority,
      assignedTo,
      reportedTeamId: defaultTeamId,
      assignedTeamId: defaultTeamId,
      plant: plant.trim(),
      location: location.trim(),
      dueISO,
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
        <form onSubmit={handleSubmit} className="grid gap-4 py-2 md:grid-cols-[1fr_240px]">
          {/* Kiri: Title */}
          <div className="grid content-start gap-4">
            <div className="grid gap-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cth: Tekanan oli mesin Line 4 tidak stabil"
                autoFocus
              />
            </div>
          </div>
          {/* Kanan: Assigned To, Priority, Plant, Location */}
          <div className="grid content-start gap-4 md:border-l md:pl-4">
            <div className="grid gap-2">
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-plant">Plant</Label>
              <Input
                id="issue-plant"
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                placeholder="cth: Plant 1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-location">Location</Label>
              <Input
                id="issue-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="cth: Line 4 · Area Produksi"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-due">Due Date</Label>
              <Input
                id="issue-due"
                type="date"
                value={dueISO}
                onChange={(e) => setDueISO(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!valid}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
