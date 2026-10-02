import { useState, useMemo, useRef, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus, Search, X } from "lucide-react";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { useLocations, usePlants, useTeams, useUsers } from "@/hooks/useSupabaseLists";

const createTaskSchema = z.object({
  title: z.string().min(3, "Title minimal 3 karakter."),
  description: z.string().min(1, "Description wajib diisi."),
  priority: z.enum(["low", "medium", "high"]),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  plant: z.string().optional(),
  location: z.string().optional(),
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
  const { data: plants } = usePlants();
  const { data: locations } = useLocations();
  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      assignee: "",
      dueDate: tomorrowISO(),
      plant: "",
      location: "",
    },
  });

  const [pendingAssignee, setPendingAssignee] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const atMatch = pickerQuery.match(/@([\w ]*)$/);
  const pickerNormalized = atMatch ? atMatch[1].toLowerCase().trim() : pickerQuery.toLowerCase().trim();
  const pickerSuggestions = useMemo(
    () =>
      pickerNormalized === ""
        ? []
        : users.filter((u) => u.name.toLowerCase().includes(pickerNormalized)),
    [pickerNormalized, users]
  );

  const addAssignee = (name: string) => {
    const clean = name.replace(/^@/, "").trim();
    if (!clean) return;
    const found =
      users.find((u) => u.name.toLowerCase() === clean.toLowerCase()) ??
      users.find((u) => u.name.toLowerCase().includes(clean.toLowerCase()));
    const toAdd = found?.name ?? clean;
    setPendingAssignee(toAdd);
    form.setValue("assignee", toAdd);
    setPickerQuery("");
    pickerInputRef.current?.focus();
  };

  const removeAssignee = () => {
    setPendingAssignee("");
    form.setValue("assignee", "");
    setPickerQuery("");
  };

  useEffect(() => {
    if (!open) {
      setPendingAssignee("");
      setPickerQuery("");
    }
  }, [open]);

  const resetAll = () => {
    form.reset();
    setPendingAssignee("");
    setPickerQuery("");
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
          <DialogTitle className="text-lg font-semibold">New Task</DialogTitle>
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
                    <div className="rounded-xl border bg-background transition-shadow focus-within:ring-1 focus-within:ring-ring">
                      {pendingAssignee && (
                        <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
                          <Badge variant="secondary" className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-1.5 font-normal">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className={`text-[8px] ${avatarColor(pendingAssignee)}`}>
                                {initials(pendingAssignee)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-32 truncate">{pendingAssignee}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${pendingAssignee}`}
                              onClick={removeAssignee}
                              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </div>
                      )}
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          ref={pickerInputRef}
                          id="ct-assignee"
                          value={pickerQuery}
                          onChange={(e) => setPickerQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
                              e.preventDefault();
                              if (pickerSuggestions.length > 0) {
                                addAssignee(pickerSuggestions[0].name);
                              } else if (pickerQuery.trim()) {
                                addAssignee(pickerQuery);
                              }
                            } else if (
                              e.key === "Backspace" &&
                              pickerQuery === "" &&
                              pendingAssignee
                            ) {
                              removeAssignee();
                            }
                          }}
                          placeholder={pendingAssignee ? "Search to add more people…" : "Search people by name…"}
                          autoComplete="off"
                          className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                        />
                        {pickerSuggestions.length > 0 && (
                          <div className="absolute right-2 left-2 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
                            {pickerSuggestions.slice(0, 3).map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addAssignee(u.name);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                              >
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className={`text-[10px] ${avatarColor(u.name)}`}>
                                    {initials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{u.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    @{u.name.toLowerCase().replace(/\s+/g, "")}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
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

              <Controller
                name="plant"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-plant">Plant</FieldLabel>
                    <Select
                      value={field.value || "__none"}
                      onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                    >
                      <SelectTrigger aria-invalid={fieldState.invalid} id="ct-plant">
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
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="location"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ct-location">Location</FieldLabel>
                    <Select
                      value={field.value || "__none"}
                      onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                    >
                      <SelectTrigger aria-invalid={fieldState.invalid} id="ct-location">
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
    const work = await createWork({
      title: v.title,
      type: "adhoc",
      priority: v.priority,
      status: "todo",
      assignedToId: assignee?.id ?? currentUser.id,
      teamId: defaultTeam?.id ?? currentUser.teamId ?? "",
      shift: currentUser.shift ?? "Shift 1",
      dueDate: v.dueDate ? toDMY(v.dueDate) : toDMY(tomorrowISO()),
      description: isEmptyHtml(cleanDesc) ? "" : cleanDesc,
      plant: v.plant?.trim() ?? "",
      location: v.location?.trim() ?? "",
      evidenceRequired: false,
      createdById: currentUser.id,
      checklist: checklistItems,
    });
    if (assignee && assignee.id !== currentUser.id) {
      await pushNotification({
        type: "assignment",
        title: "New task assigned",
        message: work.title,
        fromId: currentUser.id,
        forUserId: assignee.id,
        link: `/tasks/${work.number}`,
      });
    }
    // Kirim notifikasi mention
    await notifyMentions({
      content: v.description,
      users: profiles,
      fromId: currentUser.id,
      fromName: currentUser.name,
        title: "You were mentioned in a task",
      message: work.title,
      link: `/tasks/${work.number}`,
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