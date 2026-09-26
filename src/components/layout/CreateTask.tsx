import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2, X } from "lucide-react";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
import { initials } from "@/lib/format";
import { users } from "@/lib/mock";

const createTaskSchema = z.object({
  title: z.string().min(3, "Title minimal 3 karakter."),
  description: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  module: z.string().min(1, "Pilih module."),
  assignees: z.array(z.string()).min(1, "Pilih minimal 1 assignee."),
  subTasks: z.array(
    z.object({ name: z.string().min(2, "Minimal 2 karakter.") })
  ),
});

type CreateTaskValues = z.infer<typeof createTaskSchema>;

export function CreateTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      module: "",
      assignees: [],
      subTasks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subTasks",
  });

  const [newSub, setNewSub] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");

  // Rekomendasi hanya muncul saat ketik @, maksimal 3
  const atMatch = assigneeQuery.match(/@([\w ]*)$/);
  const assigneeNormalized = atMatch ? atMatch[1].toLowerCase().trim() : null;

  const resetAll = () => {
    form.reset();
    setNewSub("");
    setAssigneeQuery("");
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

  const onSubmit = (_v: CreateTaskValues) => {
    // Belum ada backend — tutup dan reset dulu
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Isi title, description, priority, dan tabel sub-task.
          </DialogDescription>
        </DialogHeader>
        <form id="create-task-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ct-title">Title</FieldLabel>
                  <Input
                    {...field}
                    id="ct-title"
                    placeholder="cth: Check Machine Line 4"
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
                    placeholder="Tulis deskripsi pekerjaan..."
                    rows={3}
                    className="resize-y"
                    aria-invalid={fieldState.invalid}
                  />
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
                  <FieldLabel>Priority</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={fieldState.invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
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
              name="module"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Module</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Pilih module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="module-1">Module 1</SelectItem>
                      <SelectItem value="module-2">Module 2</SelectItem>
                      <SelectItem value="module-3">Module 3</SelectItem>
                      <SelectItem value="module-4">Module 4</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            </div>
            <Controller
              name="assignees"
              control={form.control}
              render={({ field, fieldState }) => {
                const selected = field.value ?? [];
                const suggestions =
                  assigneeNormalized === null
                    ? []
                    : users
                        .filter(
                          (u) =>
                            !selected.includes(u.name) &&
                            u.name
                              .toLowerCase()
                              .includes(assigneeNormalized)
                        )
                        .slice(0, 3);
                const addName = (name: string) => {
                  const clean = name.replace(/^@/, "").trim();
                  if (!clean) return;
                  const found =
                    users.find(
                      (u) => u.name.toLowerCase() === clean.toLowerCase()
                    ) ??
                    users.find((u) =>
                      u.name.toLowerCase().includes(clean.toLowerCase())
                    );
                  const toAdd = found?.name ?? clean;
                  if (selected.includes(toAdd)) {
                    setAssigneeQuery("");
                    return;
                  }
                  field.onChange([...selected, toAdd]);
                  setAssigneeQuery("");
                };
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-assignees">Assignees</FieldLabel>
                    {selected.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selected.map((name: string) => (
                          <Badge
                            key={name}
                            variant="secondary"
                            className="inline-flex items-center gap-1.5 py-1 pr-1 pl-1.5 font-normal"
                          >
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px]">
                                {initials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-32 truncate">{name}</span>
                            <button
                              type="button"
                              aria-label={`Hapus ${name}`}
                              onClick={() =>
                                field.onChange(
                                  selected.filter((a: string) => a !== name)
                                )
                              }
                              className="rounded-full p-0.5 hover:bg-muted"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Input
                        id="ct-assignees"
                        value={assigneeQuery}
                        onChange={(e) => setAssigneeQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" ||
                            e.key === "Tab" ||
                            e.key === ","
                          ) {
                            e.preventDefault();
                            if (suggestions.length > 0) {
                              addName(suggestions[0].name);
                            } else if (assigneeQuery.trim()) {
                              addName(assigneeQuery);
                            }
                          } else if (
                            e.key === "Backspace" &&
                            assigneeQuery === "" &&
                            selected.length > 0
                          ) {
                            field.onChange(selected.slice(0, -1));
                          }
                        }}
                        placeholder="Ketik @username… cth: @Operator B"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute right-0 left-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
                          {suggestions.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addName(u.name);
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-accent"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                  {initials(u.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 truncate font-medium">
                                {u.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                @{u.name.toLowerCase().replace(/\s+/g, "")}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />
            <Field>
              <FieldLabel>
                Sub-tasks{" "}
                <span className="font-normal text-muted-foreground">
                  {fields.length} baris
                </span>
              </FieldLabel>
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada sub-task. Tambahkan lewat kolom di bawah.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub-task</TableHead>
                        <TableHead className="w-10 text-right">
                          <span className="sr-only">Hapus</span>
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
                                Hapus baris {i + 1}
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
                  placeholder="Ketik sub-task baru…"
                  autoComplete="off"
                />
                <Button type="button" variant="outline" onClick={addRow}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
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
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <Plus className="h-4 w-4" />
        <span>Create Task</span>
      </Button>
      <CreateTaskDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
