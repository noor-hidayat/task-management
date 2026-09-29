import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlignLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Download,
  FileText,
  Flag,
  Image as ImageIcon,
  ListChecks,
  MoveLeft,
  Paperclip,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Users,
  X,
} from "lucide-react";

import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { AttachmentPreviewDialog } from "@/components/attachment-preview";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { TaskFormDialog, dmyToISO, toDMY } from "@/components/task-form-dialog";
import { RichTextView, extractChecklist, isEmptyHtml, stripChecklist } from "@/components/rich-text-editor";
import { initials, avatarColor } from "@/lib/format";
import { currentUser, users } from "@/lib/mock";
import { loadWorks } from "@/lib/storage";
import type { Priority, WorkStatus } from "@/types";

type AttachmentItem = {
  id: string;
  name: string;
  meta: string;
  kind: "image" | "file";
  preview?: string;
  /** URL untuk preview/unduh (object URL file lokal / dataUrl tersimpan). */
  url?: string;
  mime?: string;
};
type SubTask = { id: string; title: string; done: boolean };
type Comment = { id: string; author: string; time: string; text: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Baris display: icon + label + value (bukan input) */
function DetailRow({
  icon,
  label,
  children,
  alignTop,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={`flex gap-3 ${alignTop ? "items-start" : "items-center"}`}>
      <span className="h-3.5 w-3.5 shrink-0 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:mt-0.5">
        {icon}
      </span>
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="ml-1 min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <h3 className="text-sm font-semibold leading-none tracking-tight">{title}</h3>
        {typeof count === "number" && (
          <Badge variant="secondary" className="font-normal">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}

export function TaskDetail() {
  const { number } = useParams();
  const [allWorks, setAllWorks] = useState(() => loadWorks());
  useEffect(() => {
    setAllWorks(loadWorks());
    const reload = () => setAllWorks(loadWorks());
    window.addEventListener("tm:works:updated", reload);
    return () => window.removeEventListener("tm:works:updated", reload);
  }, [number]);
  const base = useMemo(
    () => allWorks.find((w) => w.number === number) ?? allWorks[0],
    [allWorks, number]
  );
  // Display state — diedit lewat dialog Edit, bukan input inline
  const [title, setTitle] = useState(base.title);
  const [description, setDescription] = useState(base.description);
  const [priority, setPriority] = useState<Priority>(base.priority);
  const [dueDate, setDueDate] = useState(base.dueDate);
  const [status, setStatus] = useState<WorkStatus>(base.status);
  const [cancelled, setCancelled] = useState(!!base.cancelled);
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => {
    setTitle(base.title);
    setDescription(base.description);
    setPriority(base.priority);
    setDueDate(base.dueDate);
    setStatus(base.status);
    setCancelled(!!base.cancelled);
  }, [base]);

  // ---- Assigned To ----
  const [assignees, setAssignees] = useState<string[]>([base.assignedTo]);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [pendingAssignees, setPendingAssignees] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [dialogComment, setDialogComment] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAssignees([base.assignedTo]);
  }, [base]);

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

  // ---- Attachment ----
  const [attachments, setAttachments] = useState<AttachmentItem[]>(() =>
    base.evidences.map((e) => ({
      id: e.id,
      name: e.fileName,
      meta: `${e.fileSize} • ${e.uploadedBy}`,
      kind: /jpg|jpeg|png|gif|webp|image/i.test(`${e.fileType} ${e.fileName}`)
        ? "image"
        : "file",
      url: e.dataUrl,
      mime: e.fileType,
    }))
  );
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completeFileRef = useRef<HTMLInputElement>(null);
  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const next: AttachmentItem[] = Array.from(files).map((f, i) => {
      const isImage = f.type.startsWith("image/");
      const url = URL.createObjectURL(f);
      return {
        id: `local-${Date.now()}-${i}`,
        name: f.name,
        meta: `${formatSize(f.size)} • You`,
        kind: isImage ? "image" : "file",
        preview: isImage ? url : undefined,
        url,
        mime: f.type,
      };
    });
    setAttachments((prev) => [...prev, ...next]);
  };
  const downloadItem = (a: AttachmentItem) => {
    if (!a.url) return;
    const el = document.createElement("a");
    el.href = a.url;
    el.download = a.name;
    el.click();
  };
  const removeAttachment = (id: string) =>
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      if (target?.url && target.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });

  // ---- Checklist (gabungan tersimpan + hasil tombol checklist di description) ----
  const mergeChecklist = (stored: SubTask[], html: string): SubTask[] => {
    const next = [...stored];
    const have = new Set(stored.map((s) => s.title.toLowerCase()));
    extractChecklist(html).forEach((t, i) => {
      if (!have.has(t.title.toLowerCase())) {
        have.add(t.title.toLowerCase());
        next.push({ id: `desc-${Date.now()}-${i}`, title: t.title, done: t.done });
      }
    });
    return next;
  };
  const [subTasks, setSubTasks] = useState<SubTask[]>(() =>
    mergeChecklist(
      base.checklist.map((c) => ({ id: c.id, title: c.label, done: c.done })),
      base.description
    )
  );
  useEffect(() => {
    setSubTasks(
      mergeChecklist(
        base.checklist.map((c) => ({ id: c.id, title: c.label, done: c.done })),
        base.description
      )
    );
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const subDoneCount = subTasks.filter((s) => s.done).length;
  const checkProgress =
    subTasks.length === 0 ? 0 : Math.round((subDoneCount / subTasks.length) * 100);
  const toggleSubTask = (id: string) =>
    setSubTasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));

  // ---- Comments ----
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
    if (commentInputRef.current) commentInputRef.current.style.height = "auto";
  };
  const submitAssigneeDialog = () => {
    if (pendingAssignees.length > 0) {
      setAssignees((prev) => [
        ...prev,
        ...pendingAssignees.filter((p) => !prev.includes(p)),
      ]);
    }
    if (dialogComment.trim()) {
      setComments((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          author: currentUser.name,
          time: "Baru saja",
          text: dialogComment.trim(),
        },
      ]);
    }
    setPendingAssignees([]);
    setPickerQuery("");
    setDialogComment("");
    setAssigneeDialogOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100svh-5.5rem)]">
      {/* Breadcrumb */}
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/tasks" aria-label="Back to Tasks">
            <MoveLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link to="/tasks" className="transition-colors hover:text-foreground">
                Tasks
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-mono">#{base.number}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ===== Main scroll | Comments panel fixed ===== */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
        <main className="min-w-0 flex-1 space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-6">
          <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-lg font-bold leading-none tracking-tight">
                {title || "Untitled task"}
              </h3>
              {cancelled && <Badge variant="destructive">Cancelled</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Action <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {status === "completed" ? (
                    <DropdownMenuItem onClick={() => setStatus("in_progress")}>
                      <RotateCcw className="h-4 w-4" /> Reopen Task
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" /> Edit Task
                      </DropdownMenuItem>
                      {status === "todo" ? (
                        <DropdownMenuItem onClick={() => setStatus("in_progress")}>
                          <Play className="h-4 w-4" /> Start Task
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
                          <CheckCircle2 className="h-4 w-4" /> Complete Task
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={openAssigneeDialog}>
                        <Users className="h-4 w-4" /> Assigned To
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="h-4 w-4" /> Add Attachment
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          </section>
          {/* Status | Priority | Due Date | Assigned To — display rows */}
          <div className="space-y-1.5">
              <DetailRow icon={<CircleDot />} label="Status">
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                </span>
              </DetailRow>
              <DetailRow icon={<Flag />} label="Priority">
                <PriorityBadge priority={priority} />
              </DetailRow>
              <DetailRow icon={<CalendarDays />} label="Due Date">
                <span className="text-sm">{dueDate || "—"}</span>
              </DetailRow>
              <DetailRow icon={<Users />} label="Assigned To">
                <span className="flex items-center gap-2">
                  <span className="flex items-center -space-x-2">
                    {assignees.map((name) => (
                      <Avatar
                        key={name}
                        title={name}
                        className="h-6 w-6 cursor-default border-2 border-background"
                      >
                        <AvatarFallback className={`text-[10px] ${avatarColor(name)}`}>
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {assignees.length === 0 && (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </span>
                </span>
              </DetailRow>
            </div>

            {/* Attachment — display row sama kayak Assigned To */}
            <DetailRow icon={<Paperclip />} label="Attachment" alignTop>
              <div className="space-y-2">
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
                  <p className="text-sm text-muted-foreground">Belum ada attachment.</p>
                ) : (
                  <AttachmentGroup>
                    {attachments.map((a) =>
                      a.preview ? (
                        <Attachment key={a.id} orientation="vertical" size="sm" className="cursor-pointer" title="Preview">
                          <AttachmentTrigger aria-label={`Preview ${a.name}`} onClick={() => setPreviewItem(a)} />
                          <AttachmentMedia variant="image">
                            <img
                              src={a.preview}
                              alt={a.name}
                              className="h-full w-full object-cover"
                            />
                          </AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>{a.name}</AttachmentTitle>
                            <AttachmentDescription>{a.meta}</AttachmentDescription>
                          </AttachmentContent>
                          <AttachmentActions>
                            <AttachmentAction
                              aria-label={`Remove ${a.name}`}
                              onClick={() => removeAttachment(a.id)}
                            >
                              <X />
                            </AttachmentAction>
                          </AttachmentActions>
                        </Attachment>
                      ) : (
                        <Attachment key={a.id} size="sm" className="w-56 cursor-pointer" title="Preview">
                          <AttachmentTrigger aria-label={`Preview ${a.name}`} onClick={() => setPreviewItem(a)} />
                          <AttachmentMedia>
                            {a.kind === "image" ? <ImageIcon /> : <FileText />}
                          </AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>{a.name}</AttachmentTitle>
                            <AttachmentDescription>{a.meta}</AttachmentDescription>
                          </AttachmentContent>
                          <AttachmentActions>
                            {a.url && (
                              <AttachmentAction aria-label={`Download ${a.name}`} onClick={() => downloadItem(a)}>
                                <Download />
                              </AttachmentAction>
                            )}
                            <AttachmentAction
                              aria-label={`Remove ${a.name}`}
                              onClick={() => removeAttachment(a.id)}
                            >
                              <X />
                            </AttachmentAction>
                          </AttachmentActions>
                        </Attachment>
                      )
                    )}
                  </AttachmentGroup>
                )}
              </div>
            </DetailRow>

            {/* Description — label di atas, konten full-width */}
            <section className="space-y-2">
              <SectionTitle icon={<AlignLeft />} title="Description" />
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <RichTextView html={description} />
              </div>
            </section>

            {/* Checklist — tanpa kotak */}
            <section className="space-y-3">
              <SectionTitle icon={<ListChecks />} title="Checklist" count={subTasks.length} />
              {subTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Progress value={checkProgress} className="h-1.5 flex-1" />
                    <span className="shrink-0">
                      {subDoneCount}/{subTasks.length} · {checkProgress}%
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {subTasks.map((s) => (
                      <li
                        key={s.id}
                        className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={s.done}
                          onCheckedChange={() => toggleSubTask(s.id)}
                          aria-label={s.title}
                          id={`sub-${s.id}`}
                        />
                        <label
                          htmlFor={`sub-${s.id}`}
                          className={`flex-1 cursor-pointer text-sm ${
                            s.done ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          {s.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {subTasks.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada checklist.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Tambah / ubah checklist lewat tombol Edit.
              </p>
            </section>
            <div className="border-t" />

            {/* Activity — ikut scroll di Main Content */}
            <section className="space-y-4">
              <SectionTitle title="Activity" icon={<CircleDot />} count={base.activities.length} />
              {base.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
              ) : (
                <ol className="relative ml-2 grid grid-cols-1 gap-4 border-l pl-4">
                  {base.activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className={`text-[8px] ${avatarColor(a.actor)}`}>
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
            </section>
          </main>

          {/* Comments panel kanan — fixed, hanya list yang scroll */}
          <aside className="flex min-h-0 flex-col gap-4 lg:w-[360px] lg:shrink-0 lg:border-l lg:pl-6">
            <div className="shrink-0">
              <SectionTitle title="Comments" icon={<AlignLeft />} count={comments.length} />
            </div>
            <div className="max-h-96 min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
              ) : (
                <ul className="space-y-4">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className={`text-[10px] ${avatarColor(c.author)}`}>
                          {initials(c.author)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs font-medium">{c.author}</span>
                          <span className="text-xs text-muted-foreground">{c.time}</span>
                        </div>
                        <p className="mt-0.5 text-sm whitespace-pre-wrap">
                          {renderWithMentions(c.text)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="shrink-0">
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
                  <Textarea
                    ref={commentInputRef}
                    id="task-comment"
                    aria-label="Add comment"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      updateMention(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length
                      );
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
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
                          setMentionActive(
                            (i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length
                          );
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          insertMention(
                            mentionSuggestions[mentionActive]?.name ?? mentionSuggestions[0].name
                          );
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
                    placeholder="add comment..."
                    rows={1}
                    className="h-9 max-h-28 min-h-9 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg"
                    onClick={postComment}
                    disabled={!draft.trim()}
                    aria-label="Send comment"
                    title="Kirim"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                  <div className="absolute right-0 bottom-full left-0 z-50 mb-1 overflow-hidden rounded-md border bg-popover shadow-md">
                    {mentionSuggestions.map((u, i) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(u.name);
                        }}
                        className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm ${
                          i === mentionActive ? "bg-accent" : ""
                        }`}
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
            </div>
          </aside>
        </div>

      {/* Edit Task — popup sama persis kayak Create Task */}
      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        dialogTitle="Edit Task"
        dialogDescription="Ubah task — form yang sama seperti create task."
        submitLabel="Simpan"
        showAssignee={false}
        showTeam={false}
        initial={{
          title,
          description,
          priority,
          dueISO: dmyToISO(dueDate),
          checklist: subTasks,
        }}
        onSubmit={(v) => {
          const cleanDesc = stripChecklist(v.description);
          setTitle(v.title);
          setDescription(isEmptyHtml(cleanDesc) ? "" : cleanDesc);
          setPriority(v.priority);
          setDueDate(toDMY(v.dueISO) || "—");
          setSubTasks(mergeChecklist(v.checklist, v.description));
        }}
      />

      {/* Complete Task — checklist wajib selesai, attachment dianjurkan (opsional) */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              {subTasks.length > 0 && subTasks.some((s) => !s.done)
                ? "Selesaikan semua checklist terlebih dahulu."
                : "Yakin task ini sudah selesai?"}
            </DialogDescription>
          </DialogHeader>
          {subTasks.length > 0 && subTasks.some((s) => !s.done) ? (
            <div className="space-y-2 py-2">
              <p className="text-sm">
                Checklist {subTasks.filter((s) => s.done).length}/{subTasks.length} selesai. Tersisa:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {subTasks
                  .filter((s) => !s.done)
                  .map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
              </ul>
            </div>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel>Attachment (dianjurkan, tidak wajib)</FieldLabel>
                <input
                  ref={completeFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onPickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => completeFileRef.current?.click()}>
                    <Paperclip className="h-4 w-4" /> Tambah file
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {attachments.length > 0 ? `${attachments.length} file terlampir` : "Belum ada file"}
                  </span>
                </div>
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              {subTasks.length > 0 && subTasks.some((s) => !s.done) ? "Tutup" : "Batal"}
            </Button>
            {!(subTasks.length > 0 && subTasks.some((s) => !s.done)) && (
              <Button
                onClick={() => {
                  setStatus("completed");
                  setCompleteOpen(false);
                }}
              >
                Complete Task
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview attachment */}
      <AttachmentPreviewDialog item={previewItem} onOpenChange={(o) => !o && setPreviewItem(null)} />

      {/* Popup tambah assignee */}
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
                        <AvatarFallback className="text-[8px]">{initials(name)}</AvatarFallback>
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
