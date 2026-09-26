import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Image as ImageIcon, MoreHorizontal, Plus, Send, X } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
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
import { Textarea } from "@/components/ui/textarea";
import { initials, statusLabel } from "@/lib/format";
import { currentUser, users, works } from "@/lib/mock";
import type { Priority, WorkStatus } from "@/types";

const STATUS_ORDER: WorkStatus[] = [
  "todo",
  "in_progress",
  "handover",
  "completed",
];

export function TaskDetail() {
  const { number } = useParams();
  const base = useMemo(
    () => works.find((w) => w.number === number) ?? works[0],
    [number]
  );

  const [title, setTitle] = useState(base.title);
  const [description, setDescription] = useState(base.description);
  const [status, setStatus] = useState<WorkStatus>(base.status);
  const [assignees, setAssignees] = useState<string[]>([base.assignedTo]);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [pendingAssignees, setPendingAssignees] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [dialogComment, setDialogComment] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const [priority, setPriority] = useState<Priority>(base.priority);
  // Module — dummy dulu, nanti diganti data asli
  const [module, setModule] = useState("");
  const [cancelled, setCancelled] = useState(!!base.cancelled);

  // Shadow di bawah header judul — hanya muncul pas scroll
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Attachments — state lokal dari evidence bawaan + file baru
  type AttachmentItem = {
    id: string;
    name: string;
    meta: string;
    kind: "image" | "file";
  };
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const [attachments, setAttachments] = useState<AttachmentItem[]>(() =>
    base.evidences.map((e) => ({
      id: e.id,
      name: e.fileName,
      meta: `${e.fileSize} • ${e.uploadedBy}`,
      kind: /jpg|jpeg|png|gif|webp|image/i.test(`${e.fileType} ${e.fileName}`)
        ? "image"
        : "file",
    }))
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const next: AttachmentItem[] = Array.from(files).map((f, i) => ({
      id: `local-${Date.now()}-${i}`,
      name: f.name,
      meta: `${formatSize(f.size)} • You`,
      kind: f.type.startsWith("image/") ? "image" : "file",
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  // Assignees — popup tambah user pakai @ + komentar sekalian
  // Rekomendasi hanya muncul saat ketik @
  const atMatch = pickerQuery.match(/@([\w ]*)$/);
  const pickerNormalized = atMatch ? atMatch[1].toLowerCase().trim() : null;
  const pickerSuggestions = useMemo(
    () =>
      pickerNormalized === null
        ? []
        : users.filter(
            (u) =>
              !assignees.includes(u.name) &&
              !pendingAssignees.includes(u.name) &&
              u.name.toLowerCase().includes(pickerNormalized)
          ),
    [assignees, pendingAssignees, pickerNormalized]
  );

  const addPending = (name: string) => {
    const clean = name.replace(/^@/, "").trim();
    if (!clean) return;
    const found =
      users.find((u) => u.name.toLowerCase() === clean.toLowerCase()) ??
      users.find((u) => u.name.toLowerCase().includes(clean.toLowerCase()));
    const toAdd = found?.name ?? clean;
    if (assignees.includes(toAdd) || pendingAssignees.includes(toAdd)) {
      setPickerQuery("");
      return;
    }
    setPendingAssignees((prev) => [...prev, toAdd]);
    setPickerQuery("");
    pickerInputRef.current?.focus();
  };

  const removePending = (name: string) =>
    setPendingAssignees((prev) => prev.filter((a) => a !== name));

  const openAssigneeDialog = () => {
    setPendingAssignees([]);
    setPickerQuery("");
    setDialogComment("");
    setAssigneeDialogOpen(true);
  };

  const submitAssigneeDialog = () => {
    if (pendingAssignees.length > 0) {
      setAssignees((prev) => [
        ...prev,
        ...pendingAssignees.filter((p) => !prev.includes(p)),
      ]);
    }
    if (dialogComment.trim()) {
      const clean = dialogComment.trim();
      setComments((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, author: currentUser.name, time: "Baru saja", text: clean },
      ]);
    }
    setPendingAssignees([]);
    setPickerQuery("");
    setDialogComment("");
    setAssigneeDialogOpen(false);
  };

  // Sub-tasks — checkbox, diinput saat create task
  type SubTask = { id: string; title: string; done: boolean };
  const [subTasks, setSubTasks] = useState<SubTask[]>(() =>
    base.checklist.map((c) => ({ id: c.id, title: c.label, done: c.done }))
  );
  const subDoneCount = subTasks.filter((s) => s.done).length;

  const toggleSubTask = (id: string) =>
    setSubTasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));

  // Comments — diskusi per task, dukung @mention user lain
  type Comment = { id: string; author: string; time: string; text: string };
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionActive, setMentionActive] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 3);
  }, [mentionQuery]);

  const updateMention = (value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const m = before.match(/@([\w ]*)$/);
    if (m && !m[0].includes("\n")) {
      setMentionQuery(m[1]);
      setMentionStart(cursor - m[0].length);
      setMentionActive(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    const cursor = commentInputRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(cursor);
    const next = `${before}@${name} ${after}`;
    setDraft(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const el = commentInputRef.current;
      if (!el) return;
      const pos = before.length + name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const renderWithMentions = (text: string) => {
    const names = [...users.map((u) => u.name)].sort((a, b) => b.length - a.length);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@(${names.map(esc).join("|")})`, "g");
    const parts = text.split(re);
    return parts.map((p, i) =>
      names.includes(p) ? (
        <span key={i} className="font-medium text-primary">
          @{p}
        </span>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };

  const postComment = () => {
    const clean = draft.trim();
    if (!clean) return;
    setComments((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, author: currentUser.name, time: "Baru saja", text: clean },
    ]);
    setDraft("");
    setMentionQuery(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header — sticky, tidak ikut scroll */}
      <div
        className={`sticky top-14 z-20 -mx-4 -mt-4 bg-background px-4 py-3 transition-shadow ${stuck ? "shadow-[0_2px_8px_-2px_rgb(0_0_0/0.12)]" : ""}`}
      >
      <PageHeader
        title={
          <>
            <span>{title || "Untitled task"}</span>
            <StatusBadge status={status} />
            {cancelled && <Badge variant="destructive">Cancelled</Badge>}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {STATUS_ORDER.filter((s) => s !== status).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setStatus(s)}
                  >
                    {statusLabel[s]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatus("completed")}>
                  Complete
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCancelled((v) => !v)}
                >
                  {cancelled ? "Reopen task" : "Cancel task"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard.writeText(base.number)
                  }
                >
                  Copy task number
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      </div>

      {/* 2. Konten 2 kolom — form kiri, activity kanan */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* 2. Kolom kiri */}
      <div className="space-y-6">
      {/* 2a. Task Information — kolom input */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-bold leading-none tracking-tight">Task Information</h3>
        <div>
          <FieldGroup>
            {/* Title — Input */}
            <Field>
              <FieldLabel htmlFor="task-title">Task Title</FieldLabel>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cth: Check Machine Line 4"
                autoComplete="off"
              />
            </Field>

            {/* Description — Textarea di bawah Task Name */}
            <Field>
              <FieldLabel htmlFor="task-desc">Description</FieldLabel>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tulis deskripsi pekerjaan..."
                rows={4}
                className="resize-y"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Priority — Select */}
              <Field>
                <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as Priority)}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Module — dummy, nanti diganti data asli */}
              <Field>
                <FieldLabel htmlFor="task-module">Module</FieldLabel>
                <Select value={module} onValueChange={setModule}>
                  <SelectTrigger id="task-module">
                    <SelectValue placeholder="Pilih module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="module-1">Module 1</SelectItem>
                    <SelectItem value="module-2">Module 2</SelectItem>
                    <SelectItem value="module-3">Module 3</SelectItem>
                    <SelectItem value="module-4">Module 4</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

            </div>

            {/* Sub-tasks — hanya checkbox */}
            <Field>
              <FieldLabel>
                Sub-tasks{" "}
                <span className="font-normal text-muted-foreground">
                  {subDoneCount} / {subTasks.length}
                </span>
              </FieldLabel>
              {subTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada sub-task.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {subTasks.map((s) => (
                    <Field
                      key={s.id}
                      orientation="horizontal"
                      className="border-0 bg-transparent p-0 shadow-none"
                    >
                      <Checkbox
                        checked={s.done}
                        onCheckedChange={() => toggleSubTask(s.id)}
                        aria-label={s.title}
                        id={`sub-${s.id}`}
                      />
                      <label
                        htmlFor={`sub-${s.id}`}
                        className={`flex-1 cursor-pointer text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {s.title}
                      </label>
                    </Field>
                  ))}
                </div>
              )}
            </Field>
          </FieldGroup>
        </div>
      </section>

      {/* 2b. Comments */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold leading-none tracking-tight">
            Comments
          </h3>
          <Badge variant="secondary" className="font-normal">
            {comments.length}
          </Badge>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada komentar.
          </p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {initials(c.author)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-medium">{c.author}</span>
                    <span className="text-xs text-muted-foreground">{c.time}</span>
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{renderWithMentions(c.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Field>
          <FieldLabel htmlFor="task-comment">Tulis komentar</FieldLabel>
          <div className="relative">
          <Textarea
            ref={commentInputRef}
            id="task-comment"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionSuggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionActive((i) => (i + 1) % mentionSuggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionActive((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insertMention(mentionSuggestions[mentionActive]?.name ?? mentionSuggestions[0].name);
                  return;
                }
                if (e.key === "Escape") {
                  setMentionQuery(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                postComment();
              }
            }}
            onBlur={() => {
              setTimeout(() => setMentionQuery(null), 120);
            }}
            placeholder="Tulis komentar… ketik @ untuk mention user"
            rows={3}
            className="resize-y"
          />
          {mentionQuery !== null && mentionSuggestions.length > 0 && (
            <div className="absolute right-0 left-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
              {mentionSuggestions.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u.name);
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm ${i === mentionActive ? "bg-accent" : ""}`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    @{u.name.toLowerCase().replace(/\s+/g, "")}
                  </span>
                </button>
              ))}
            </div>
          )}
          </div>
        </Field>
        <div className="flex justify-end">
          <Button size="sm" onClick={postComment} disabled={!draft.trim()}>
            <Send className="h-4 w-4" /> Kirim
          </Button>
        </div>
      </section>
      </div>

      {/* 3. Kolom kanan */}
      <div className="space-y-6">
      {/* 3a. Assignees — avatar group + tombol plus */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold leading-none tracking-tight">
              Assignees
            </h3>
            <Badge variant="secondary" className="font-normal">
              {assignees.length}
            </Badge>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={openAssigneeDialog}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Tambah assignee</span>
          </Button>
        </div>
        {assignees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada assignee.</p>
        ) : (
          <div className="flex -space-x-2">
            {assignees.slice(0, 5).map((name) => (
              <Avatar key={name} title={name} className="h-9 w-9 ring-2 ring-card">
                <AvatarFallback className="text-[10px]">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 5 && (
              <Avatar className="h-9 w-9 ring-2 ring-card">
                <AvatarFallback className="bg-muted text-[10px]">
                  +{assignees.length - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </section>

      {/* 3b. Attachments — di bawah Assignees */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold leading-none tracking-tight">
              Attachments
            </h3>
            <Badge variant="secondary" className="font-normal">
              {attachments.length}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-4 w-4" /> Upload
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onPickFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {attachments.length === 0 ? (
          <Attachment
            state="idle"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachmentMedia>
              <Plus />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>Upload file</AttachmentTitle>
              <AttachmentDescription>PNG, JPG, PDF…</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ) : (
          <div className="space-y-2">
            {attachments.map((a) => (
              <Attachment key={a.id} size="sm" className="w-full">
                <AttachmentMedia>
                  {a.kind === "image" ? <ImageIcon /> : <FileText />}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{a.name}</AttachmentTitle>
                  <AttachmentDescription>{a.meta}</AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction aria-label={`Download ${a.name}`}>
                    <Download />
                  </AttachmentAction>
                  <AttachmentAction
                    aria-label={`Remove ${a.name}`}
                    onClick={() => removeAttachment(a.id)}
                  >
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ))}
            <Attachment
              state="idle"
              size="sm"
              className="w-full cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <AttachmentMedia>
                <Plus />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Tambah file</AttachmentTitle>
                <AttachmentDescription>Klik untuk upload</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
          </div>
        )}
      </section>

      {/* 3c. Activity — paling bawah */}
      <aside className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold leading-none tracking-tight">
            Activity
          </h3>
          <Badge variant="secondary" className="font-normal">
            {base.activities.length}
          </Badge>
        </div>
        {base.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada aktivitas.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {base.activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px]">
                      {initials(a.actor)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{a.actor}</span>
                </div>
                <p className="mt-1 text-sm">{a.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.at}</p>
              </li>
            ))}
          </ol>
        )}
      </aside>
      </div>
      </div>

      {/* Popup tambah assignee pakai @ + komentar sekalian */}
      <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah assignee</DialogTitle>
            <DialogDescription>
              Ketik @ untuk pilih user, tulis komentar sekalian jika perlu.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="assignee-picker">User</FieldLabel>
              {pendingAssignees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pendingAssignees.map((name) => (
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
                        onClick={() => removePending(name)}
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
                ref={pickerInputRef}
                id="assignee-picker"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
                    e.preventDefault();
                    if (pickerSuggestions.length > 0) {
                      addPending(pickerSuggestions[0].name);
                    } else if (pickerQuery.trim()) {
                      addPending(pickerQuery);
                    }
                  } else if (
                    e.key === "Backspace" &&
                    pickerQuery === "" &&
                    pendingAssignees.length > 0
                  ) {
                    removePending(pendingAssignees[pendingAssignees.length - 1]);
                  }
                }}
                placeholder="Ketik @username… cth: @Operator B"
                autoComplete="off"
              />
              {pickerSuggestions.length > 0 && (
                <div className="absolute right-0 left-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
                  {pickerSuggestions.slice(0, 3).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addPending(u.name);
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
            </Field>
            <Field>
              <FieldLabel htmlFor="assignee-comment">Komentar (opsional)</FieldLabel>
              <Textarea
                id="assignee-comment"
                value={dialogComment}
                onChange={(e) => setDialogComment(e.target.value)}
                placeholder="Tulis komentar untuk assignee baru…"
                rows={3}
                className="resize-y"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigneeDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={submitAssigneeDialog}
              disabled={pendingAssignees.length === 0 && !dialogComment.trim()}
            >
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
