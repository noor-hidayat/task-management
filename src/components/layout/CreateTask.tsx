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
import { tomorrowISO } from "@/components/task-form-dialog";
import { initials, avatarColor } from "@/lib/format";
import { users, currentUser } from "@/lib/mock";
import { loadWorks, saveWorks, notifyWorksUpdated } from "@/lib/storage";

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
  const handleCreate = (v: CreateTaskValues) => {
    const works_ = loadWorks();
    const uid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const existing = new Set(works_.map((w) => w.number));
    let seq = 131 + works_.length;
    let num = `TK-${String(seq).padStart(6, "0")}`;
    while (existing.has(num)) { seq += 1; num = `TK-${String(seq).padStart(6, "0")}`; }
    const now = new Date();
    const cleanDesc = stripChecklist(v.description);
    const checklistItems = extractChecklist(v.description).map((t, i) => ({
      id: `cl-${Date.now()}-${i}`,
      label: t.title,
      done: t.done,
    }));
    works_.unshift({
      id: `w-${uid}`,
      number: num,
      title: v.title,
      type: "adhoc",
      status: "todo",
      priority: v.priority,
      createdBy: currentUser.name,
      assignedTo: v.assignee || currentUser.name,
      team: "Production A",
      teamId: "t-prod-a",
      shift: "Shift 1",
      dueDate: v.dueDate ? new Date(v.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      description: isEmptyHtml(cleanDesc) ? "" : cleanDesc,
      progress: 0,
      evidenceRequired: false,
      evidences: [],
      checklist: checklistItems,
      note: "",
      createdAt: now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      updatedAt: now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      activities: [],
      comments: [],
    });
    saveWorks(works_);
    notifyWorksUpdated();
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