import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor, extractChecklist, isEmptyHtml, stripChecklist } from "@/components/rich-text-editor";
import { toDMY, tomorrowISO } from "@/components/task-form-dialog";
import { initials, avatarColor } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { listProfiles } from "@/lib/api/profiles";
import { createWork } from "@/lib/api/works";
import { useTeams, useUsers } from "@/hooks/useSupabaseLists";

const createTaskSchema = z.object({
  title: z.string().min(3, "Title minimal 3 karakter."),
  description: z.string().min(1, "Description wajib diisi."),
  priority: z.enum(["low", "medium", "high"]),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
});

export type CreateTaskValues = z.infer<typeof createTaskSchema>;

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTaskValues) => void;
}) {
  const { data: users } = useUsers();
  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      assignee: "",
      dueDate: tomorrowISO(),
    },
  });

  const resetAll = () => {
    form.reset();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetAll();
    onOpenChange(v);
  };

  const handleSubmit = (v: CreateTaskValues) => {
    const data = { ...v };
    onSubmit(data);
    handleOpenChange(false);
  };

  const handleClose = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-semibold">Create Task</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            Create a new task
          </DialogDescription>
        </DialogHeader>

        <form id="create-task-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            {/* Kiri: Title + Description */}
            <div className="grid content-start gap-4">
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-title">Task title *</FieldLabel>
                    <Input
                      {...field}
                      id="ct-title"
                      placeholder="What needs to be done?"
                      aria-invalid={fieldState.invalid}
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Description</FieldLabel>
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      users={users.map((u) => u.name)}
                      placeholder="Add details or instructions..."
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            {/* Kanan: Assignee, Priority, Due date */}
            <div className="grid content-start gap-4 md:border-l md:pl-4">
              <Controller
                name="assignee"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-assignee">Assignee</FieldLabel>
                    <Select value={field.value || ""} onValueChange={(v) => field.onChange(v)}>
                      <SelectTrigger aria-invalid={fieldState.invalid} id="ct-assignee">
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.name}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={`text-[9px] ${avatarColor(u.name)}`}>
                                  {initials(u.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{u.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="priority"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-priority">Priority</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={fieldState.invalid} id="ct-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="dueDate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-due-date">Due date</FieldLabel>
                    <Input
                      id="ct-due-date"
                      type="date"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </div>
        </form>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-task-form">
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const { data: teams } = useTeams();
  const handleCreate = async (v: CreateTaskValues) => {
    if (!currentUser) return;
    const defaultTeam = teams.find((t) => t.id === currentUser.teamId) ?? teams[0];
    const cleanDesc = stripChecklist(v.description);
    const checklistItems = extractChecklist(v.description).map((t) => t.title);
    const profiles = await listProfiles();
    const assignee = v.assignee
      ? profiles.find((u) => u.name === v.assignee)
      : undefined;
    await createWork({
      title: v.title,
      type: "adhoc",
      priority: v.priority,
      status: "todo",
      assignedToId: assignee?.id ?? currentUser.id,
      teamId: defaultTeam?.id ?? currentUser.teamId ?? "",
      shift: currentUser.shift ?? "Shift 1",
      dueDate: v.dueDate ? toDMY(v.dueDate) : toDMY(tomorrowISO()),
      description: isEmptyHtml(cleanDesc) ? "" : cleanDesc,
      evidenceRequired: false,
      createdById: currentUser.id,
      checklist: checklistItems,
    });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <Plus className="h-4 w-4" />
        <span>Create Task</span>
      </Button>
      <CreateTaskDialog open={open} onOpenChange={setOpen} onSubmit={handleCreate} />
    </>
  );
}