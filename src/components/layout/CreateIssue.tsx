import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { toDMY, tomorrowISO } from "@/components/task-form-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { createIssue } from "@/lib/api/issues";
import { listProfiles } from "@/lib/api/profiles";

export function CreateIssueButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const handleCreate = async (v: IssueFormValues) => {
    if (!currentUser) return;
    const profiles = await listProfiles();
    const assignee = profiles.find((u) => u.name === v.assignedTo);
    const assigneeIds = assignee ? [assignee.id] : [];
    const issue = await createIssue({
      title: v.title,
      description: v.description,
      priority: v.priority,
      createdById: currentUser.id,
      assigneeIds,
      reportedTeamId: v.reportedTeamId,
      assignedTeamId: v.assignedTeamId,
      plant: v.plant,
      location: v.location,
      dueDate: toDMY(v.dueISO) || toDMY(tomorrowISO()),
    });
    setOpen(false);
    navigate(`/issues/${issue.number}`);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <Plus className="h-4 w-4" />
        <span>Create Issue</span>
      </Button>
      <IssueFormDialog
        open={open}
        onOpenChange={setOpen}
        dialogTitle="Create Issue"
        dialogDescription="Laporkan masalah — bisa dilengkapi attachment di halaman detail."
        submitLabel="Create Issue"
        onSubmit={handleCreate}
      />
    </>
  );
}
