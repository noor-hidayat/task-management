import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2, X, Paperclip } from "lucide-react";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

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
  FieldGroup,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { initials, avatarColor } from "@/lib/format";
import { users, currentUser } from "@/lib/mock";
import { loadWorks, saveWorks, notifyWorksUpdated, loadProjects, seedIfEmpty } from "@/lib/storage";

const createTaskSchema = z.object({
  title: z.string().min(3, "Title minimal 3 karakter."),
  description: z.string().min(1, "Description wajib diisi."),
  priority: z.enum(["low", "medium", "high"]),
  projectId: z.string().min(1, "Pilih project."),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  subTasks: z.array(
    z.object({ name: z.string().min(2, "Minimal 2 karakter.") })
  ),
  hasChecklist: z.boolean().default(false),
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
      projectId: "",
      assignee: "",
      dueDate: "",
      subTasks: [],
      hasChecklist: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subTasks",
  });

  const [newSub, setNewSub] = useState("");

  const resetAll = () => {
    form.reset();
    setNewSub("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetAll();
    onOpenChange(v);
  };

  const addRow = () => {
    const clean = newSub.trim();
    if (clean.length < 2) return;
    append({ name: clean });
    setNewSub("");
  };

  const handleSubmit = (v: CreateTaskValues) => {
    const data = { ...v };
    onSubmit(data);
    handleOpenChange(false);
  };

  const handleClose = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold">Create Task</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Create a new task
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form id="create-task-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          <FieldGroup>
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
                  <FieldLabel htmlFor="ct-desc">Description</FieldLabel>
                  <Textarea
                    {...field}
                    id="ct-desc"
                    placeholder="Add details or instructions..."
                    rows={4}
                    className="resize-y"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="projectId"
              control={form.control}
              render={({ field, fieldState }) => {
                seedIfEmpty();
                const projects = loadProjects();
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-project">Project *</FieldLabel>
                    <Select value={field.value || ""} onValueChange={(v) => field.onChange(v)}>
                      <SelectTrigger aria-invalid={fieldState.invalid} id="ct-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />

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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex items-center gap-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Controller
                  name="hasChecklist"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="ct-checklist"
                    />
                  )}
                />
                <label htmlFor="ct-checklist" className="text-sm font-medium cursor-pointer">
                  Add checklist
                </label>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 ml-auto">
                <Paperclip className="h-4 w-4" />
                <span>Add attachment</span>
              </Button>
            </div>

            <Field>
              <FieldLabel>
                Sub-tasks{" "}
                <span className="font-normal text-muted-foreground">
                  {fields.length} items
                </span>
              </FieldLabel>
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sub-tasks yet. Add them below.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub-task</TableHead>
                        <TableHead className="w-10 text-right">
                          <span className="sr-only">Delete</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((f, i) => (
                        <TableRow key={f.id}>
                          <TableCell>
                            <Controller
                              name={`subTasks.${i}.name`}
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                  <Input
                                    {...field}
                                    aria-label={`Sub-task ${i + 1}`}
                                    aria-invalid={fieldState.invalid}
                                    autoComplete="off"
                                  />
                                  {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                  )}
                                </Field>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => remove(i)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">
                                Delete row {i + 1}
                              </span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRow();
                    }
                  }}
                  placeholder="Type new sub-task…"
                  autoComplete="off"
                />
                <Button type="button" variant="outline" onClick={addRow}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </Field>
          </FieldGroup>
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
      projectId: v.projectId || undefined,
      shift: "Shift 1",
      dueDate: v.dueDate ? new Date(v.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      description: v.description,
      progress: 0,
      evidenceRequired: false,
      evidences: [],
      checklist: v.subTasks.map((s, i) => ({ id: `c-${Date.now()}-${i}`, label: s.name, done: false })),
      note: "",
      createdAt: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      updatedAt: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
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