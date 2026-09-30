import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCoreWorks, useTeams } from "@/hooks/useSupabaseLists";
import { createCoreWork, updateCoreWork, deleteCoreWork } from "@/lib/api/coreWorks";
import type { CoreWorkDef } from "@/types";

interface CoreWorkFormValues {
  name: string;
  description: string;
  teamId: string;
  frequency: string;
  schedule: string;
  evidenceRequired: boolean;
  checklist: string[];
  status: CoreWorkDef["status"];
}

function CoreWorkFormDialog({
  initialData,
  initialTeamId,
  onSubmit,
  children: _children,
}: {
  initialData?: CoreWorkDef | null;
  initialTeamId?: string;
  onSubmit: (data: CoreWorkFormValues) => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const { data: teams } = useTeams();
  const isEditing = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [team, setTeam] = useState(initialTeamId ?? "");
  const [frequency, setFrequency] = useState(initialData?.frequency ?? "daily");
  const [schedule, setSchedule] = useState(initialData?.schedule ?? "");
  const [evidenceRequired, setEvidenceRequired] = useState(initialData?.evidenceRequired ?? false);
  const [checklistText, setChecklistText] = useState(initialData?.checklist.join(", ") ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(initialData?.status ?? "active");
  const [teamTouched, setTeamTouched] = useState(isEditing);

  useEffect(() => {
    if (!initialData) {
      setName("");
      setDescription("");
      setFrequency("daily");
      setSchedule("");
      setEvidenceRequired(false);
      setChecklistText("");
      setStatus("active");
    } else {
      setName(initialData.name);
      setDescription(initialData.description);
      setFrequency(initialData.frequency);
      setSchedule(initialData.schedule);
      setEvidenceRequired(initialData.evidenceRequired);
      setChecklistText(initialData.checklist.join(", "));
      setStatus(initialData.status);
    }
  }, [initialData]);

  useEffect(() => {
    if (isEditing) {
      setTeam(initialTeamId ?? "");
      return;
    }
    if (!teamTouched && teams[0]) setTeam(teams[0].id);
  }, [initialTeamId, isEditing, teamTouched, teams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !team) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      teamId: team,
      frequency,
      schedule,
      evidenceRequired,
      checklist: checklistText.split(",").map((s) => s.trim()).filter(Boolean),
      status,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {isEditing ? "Simpan" : "New Core Work"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Core Work" : "Core Work Definition"}</DialogTitle>
          <DialogDescription>Name, team, frequency, evidence & checklist.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Machine Daily Inspection" autoFocus required />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi pekerjaan rutin..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Team</Label>
              <Select value={team} onValueChange={(v) => { setTeam(v); setTeamTouched(true); }}>
                <SelectTrigger><SelectValue placeholder="Pilih tim" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="shift">Per Shift</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Schedule</Label>
              <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="cth: S1 · 07:00" />
            </div>
            <div className="grid gap-2">
              <Label>Checklist (pisahkan dengan koma)</Label>
              <Input value={checklistText} onChange={(e) => setChecklistText(e.target.value)} placeholder="Check oil, Check temperature, Check pressure" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Evidence Required</Label>
            <Select value={evidenceRequired.toString()} onValueChange={(v) => setEvidenceRequired(v === "true")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Required</SelectItem>
                <SelectItem value="false">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" asChild>
              <DialogClose>Cancel</DialogClose>
            </Button>
            <Button type="submit" disabled={!name.trim() || !team}>{isEditing ? "Simpan" : "Tambah"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CoreWork() {
  const { data: coreWorkList, reload } = useCoreWorks();
  const { data: teams } = useTeams();

  const teamIdByName = (name: string) => teams.find((t) => t.name === name)?.id ?? "";
  const isEmptyTeam = (name: string) => !!name && !teams.some((t) => t.name === name);

  const handleCreate = async (data: CoreWorkFormValues) => {
    await createCoreWork(data);
    reload();
  };

  const handleUpdate = async (id: string, data: CoreWorkFormValues) => {
    await updateCoreWork(id, data);
    reload();
  };

  const handleDelete = async (id: string) => {
    await deleteCoreWork(id);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Core Work"
        description="Definition / template pekerjaan rutin → Schedule / Shift → Work Instance → Execution"
        actions={
          <CoreWorkFormDialog onSubmit={handleCreate} />
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {coreWorkList.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{c.name}</CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </div>
                <Badge variant={c.status === "active" ? "completed" : "secondary"}>
                  {c.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Team</p>
                  <p className="font-medium">{c.team}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Frequency</p>
                  <p className="font-medium">{c.frequency}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Schedule</p>
                  <p className="font-medium">{c.schedule || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Evidence</p>
                  <p className="font-medium">{c.evidenceRequired ? "Required" : "Optional"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CHECKLIST</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {c.checklist.map((x) => (
                    <Badge key={x} variant="outline" className="font-normal">{x}</Badge>
                  ))}
                </div>
              </div>
              {c.todayInstance && (
                <p className="rounded-lg bg-muted/60 p-2 font-mono text-xs">
                  Today instance: {c.todayInstance} → execution sama seperti task
                </p>
              )}
              <div className="flex gap-2 pt-2 border-t">
                <CoreWorkFormDialog
                  initialData={c}
                  initialTeamId={isEmptyTeam(c.team) ? "" : teamIdByName(c.team)}
                  onSubmit={(data) => handleUpdate(c.id, data)}
                >
                  <Button variant="outline" size="sm" className="flex-1">
                    Edit
                  </Button>
                </CoreWorkFormDialog>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDelete(c.id)}
                >
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
