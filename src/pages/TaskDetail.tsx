import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlignLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Download,
  Factory,
  FileText,
  Flag,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  MoveLeft,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FileUploadDialog } from "@/components/file-upload-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { TaskFormDialog, dmyToISO, toDMY } from "@/components/task-form-dialog";
import { RichTextView, sanitizeRichHtml, extractChecklist, type RichCheckItem, checklistToHtml, stripChecklist, injectChecklist } from "@/components/rich-text-editor";

import { initials, avatarColor } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useSupabaseLists";
import { useWork } from "@/hooks/useWork";
import {
  updateWork,
  deleteWork,
  replaceChecklist,
  logActivity,
} from "@/lib/api/works";
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { addComment } from "@/lib/api/related";
import {
  uploadAttachment,
  deleteAttachment,
  fetchAttachmentObjectUrl,
} from "@/lib/api/attachments";
import type { Priority, WorkStatus } from "@/types";

function nowLabel() {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type AttachmentItem = {
  id: string;
  name: string;
  meta: string;
  kind: "image" | "file";
  preview?: string;
  /** URL untuk preview/unduh (object URL file lokal / dataUrl tersimpan). */
  url?: string;
  mime?: string;
  driveFileId?: string;
};
type SubTask = { id: string; title: string; done: boolean };
type Comment = { id: string; author: string; time: string; text: string };

/** Field vertikal untuk panel Details kanan: label di atas, value di bawah */
function DetailField({
  icon,
  label,
  children,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <span className="ml-1.5">{label}</span>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
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
  const { user: currentUser } = useAuth();
  const { data: allUsers } = useUsers();
  const { data: base, loading: worksLoading, reload, refreshAttachments, refreshChecklist } = useWork(number);
  // Display state — diedit lewat dialog Edit, bukan input inline
  const [title, setTitle] = useState(base?.title ?? "");
  const [priority, setPriority] = useState<Priority>(base?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(base?.dueDate ?? "");
  const [status, setStatus] = useState<WorkStatus>(base?.status ?? "todo");
  const [cancelled, setCancelled] = useState(!!base?.cancelled);
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const navigate = useNavigate();
  

  useEffect(() => {
    if (!base) return;
    setTitle(base.title);
    setPriority(base.priority);
    setDueDate(base.dueDate);
    setStatus(base.status);
    setCancelled(!!base.cancelled);
  }, [base]);

  // ---- Assigned To ----
  const [assignees, setAssignees] = useState<string[]>(base ? [base.assignedTo] : []);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [pendingAssignees, setPendingAssignees] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [dialogComment, setDialogComment] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAssignees(base ? [base.assignedTo] : []);
  }, [base]);

  /** Simpan perubahan ke Supabase + catat aktivitas. Realtime subscription akan refresh. */
  const persist = useCallback(
    async (patch: Parameters<typeof updateWork>[1], activity?: string) => {
      if (!base) return;
      await updateWork(base.id, patch);
      if (activity) await logActivity("work", base.id, activity, currentUser?.id ?? null);
    },
    [base, currentUser]
  );

  const atMatch = pickerQuery.match(/@([\w ]*)$/);
  const pickerNormalized = atMatch ? atMatch[1].toLowerCase().trim() : null;
  const pickerSuggestions = useMemo(
    () =>
      pickerNormalized === null
        ? []
        : allUsers.filter(
            (u) =>
              !assignees.includes(u.name) &&
              !pendingAssignees.includes(u.name) &&
              u.name.toLowerCase().includes(pickerNormalized)
          ),
    [assignees, pendingAssignees, pickerNormalized, allUsers]
  );
  const addPending = (name: string) => {
    const clean = name.replace(/^@/, "").trim();
    if (!clean) return;
    const found =
      allUsers.find((u) => u.name.toLowerCase() === clean.toLowerCase()) ??
      allUsers.find((u) => u.name.toLowerCase().includes(clean.toLowerCase()));
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
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  // Object URL (hasil fetch dari Drive) per attachment id.
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});

  // Bangun daftar attachment dari evidences + ambil object URL untuk preview.
  useEffect(() => {
    if (!base) {
      setAttachments([]);
      return;
    }
    const items: AttachmentItem[] = base.evidences.map((e) => ({
      id: e.id,
      name: e.fileName,
      meta: `${e.fileSize} • ${e.uploadedBy}`,
      kind: /jpg|jpeg|png|gif|webp|image/i.test(`${e.fileType} ${e.fileName}`)
        ? "image"
        : "file",
      preview: objectUrls[e.id] && /^image\//i.test(e.fileType) ? objectUrls[e.id] : undefined,
      url: objectUrls[e.id],
      mime: e.fileType,
      driveFileId: e.driveFileId,
    }));
    setAttachments(items);
  }, [base, objectUrls]);

  // Fetch object URL untuk tiap evidence yang belum punya, revoke saat berubah/unmount.
  useEffect(() => {
    if (!base) return;
    const ids = new Set(base.evidences.map((e) => e.id));
    // Revoke URL untuk attachment yang sudah tidak ada.
    for (const [id, url] of objectUrlsRef.current.entries()) {
      if (!ids.has(id)) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(id);
      }
    }
    let active = true;
    (async () => {
      const additions: Record<string, string> = {};
      for (const e of base.evidences) {
        if (!e.driveFileId || objectUrlsRef.current.has(e.id)) continue;
        try {
          const url = await fetchAttachmentObjectUrl(e.driveFileId);
          if (!url) continue;
          if (!active) {
            URL.revokeObjectURL(url);
            continue;
          }
          objectUrlsRef.current.set(e.id, url);
          additions[e.id] = url;
        } catch {
          /* preview tidak tersedia */
        }
      }
      if (active && Object.keys(additions).length > 0) {
        setObjectUrls((prev) => ({ ...prev, ...additions }));
      }
    })();
    return () => {
      active = false;
    };
  }, [base]);

  // Revoke semua object URL saat unmount.
  useEffect(() => {
    const store = objectUrlsRef.current;
    return () => {
      for (const url of store.values()) URL.revokeObjectURL(url);
      store.clear();
    };
  }, []);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !base) return;
    setUploadError(null);
    try {
      const list = Array.from(files);
      for (const f of list) {
        await uploadAttachment("work", base.id, base.number, f);
      }
      await logActivity(
        "work",
        base.id,
        list.length === 1 ? `added attachment (${list[0].name})` : `added ${list.length} attachments`,
        currentUser?.id ?? null
      );
      await refreshAttachments();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
  };
  const downloadItem = (a: AttachmentItem) => {
    if (!a.url) return;
    const el = document.createElement("a");
    el.href = a.url;
    el.download = a.name;
    el.click();
  };
  const removeAttachment = async (id: string) => {
    if (!base) return;
    const target = attachments.find((a) => a.id === id);
    // Optimistic: cleanup URL + hapus dari UI
    const url = objectUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(id);
      setObjectUrls((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    // Background delete
    if (target?.driveFileId) {
      deleteAttachment(id, target.driveFileId)
        .then(() =>
          logActivity(
            "work",
            base.id,
            `removed attachment (${target.name})`,
            currentUser?.id ?? null
          )
        )
        .catch((e) => {
          console.error("delete attachment error:", e);
          refreshAttachments();
        });
    }
  };

  // ---- Checklist (extract dari description HTML) ----
  const checklistFromDesc: RichCheckItem[] = useMemo(
    () => extractChecklist(base?.description || ""),
    [base?.description]
  );
  const [subTasks, setSubTasks] = useState<SubTask[]>(() =>
    checklistFromDesc.map((c, i) => ({ id: `check-${i}`, title: c.title, done: c.done }))
  );
  useEffect(() => {
    if (!base) return;
    setSubTasks(checklistFromDesc.map((c, i) => ({ id: `check-${i}`, title: c.title, done: c.done })));
  }, [base, checklistFromDesc]);
  const subDoneCount = subTasks.filter((s) => s.done).length;
  const checkProgress =
    subTasks.length === 0 ? 0 : Math.round((subDoneCount / subTasks.length) * 100);
  const toggleSubTask = async (id: string) => {
    if (!base) return;
    const next = subTasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    setSubTasks(next);
    // Update checklist di dalam HTML description
    const newDesc =
      stripChecklist(base.description || "") +
      (stripChecklist(base.description || "") ? "<p><br></p>" : "") +
      checklistToHtml(next.map((s) => ({ title: s.title, done: s.done })));
    await persist({ description: newDesc });
  };

  const startTask = async () => {
    setStatus("in_progress");
    await persist({ status: "in_progress" }, "started task");
  };

  const reopenTask = async () => {
    setStatus("in_progress");
    await persist({ status: "in_progress" }, "reopened task");
  };

  const completeTask = async () => {
    setStatus("completed");
    await persist({ status: "completed", progress: 100 }, "completed task");
    setCompleteOpen(false);
  };

  const cancelTask = async () => {
    setCancelled(true);
    await persist({ cancelled: true }, "cancelled task");
    setCancelOpen(false);
  };

  const deleteTask = async () => {
    if (!base) return;
    setDeleteError(null);
    try {
      await deleteWork(base.id);
      setDeleteOpen(false);
      navigate("/tasks");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete task");
    }
  };

  // ---- Comments ----
  const toLocalComments = (w: NonNullable<typeof base>): Comment[] =>
    (w.comments ?? []).map((c) => ({
      id: c.id,
      author: c.author,
      time: c.time ?? c.at ?? "",
      text: c.text,
    }));
  const [comments, setComments] = useState<Comment[]>([]);
  useEffect(() => {
    setComments(base ? toLocalComments(base) : []);
    setDraft("");
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionActive, setMentionActive] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return allUsers.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 3);
  }, [mentionQuery, allUsers]);
  const updateMention = (value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    // "@" diikuti kata (boleh multi-kata) tanpa newline. Spasi ganda / newline
    // menghentikan mention agar query tidak "bocor" menelan seluruh teks.
    const m = before.match(/@([\w]+(?:\s[\w]+)*)$/);
    if (m) {
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
    const names = [...allUsers.map((u) => u.name)].sort((a, b) => b.length - a.length);
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
  const postComment = async () => {
    if (!base) return;
    const clean = draft.trim();
    if (!clean) return;
    const authorId = currentUser?.id ?? null;
    if (!authorId) return;
    const at = nowLabel();
    const entry = { id: `c-${Date.now()}`, author: currentUser?.name ?? "—", time: at, text: clean };
    setComments((prev) => [...prev, entry]);
    // Simpan comment ke database agar bisa dilihat user lain & persist
    await addComment("work", base.id, authorId, clean);
    await logActivity("work", base.id, "commented", authorId);
    // Kirim notifikasi mention ke setiap user yang disebut (@Nama), kecuali diri sendiri.
    await notifyMentions({
      content: clean,
      users: allUsers,
      fromId: authorId,
      fromName: currentUser?.name,
        title: "You were mentioned",
      message: clean.length > 80 ? `${clean.slice(0, 80)}…` : clean,
      link: `/tasks/${base.number}`,
    });
    setDraft("");
    setMentionQuery(null);
    if (commentInputRef.current) commentInputRef.current.style.height = "auto";
  };
  const submitAssigneeDialog = async () => {
    if (!base) return;
    const added = pendingAssignees.filter((p) => !assignees.includes(p));
    if (added.length > 0) {
      setAssignees((prev) => [...prev, ...added]);
    }
    const notes: string[] = [];
    let nextComments = comments;
    if (added.length > 0) {
      const primary = allUsers.find((u) => u.name === added[0]);
      if (primary) await updateWork(base.id, { assignedToId: primary.id });
      notes.push(`assigned ${added.join(", ")}`);
    }
    if (dialogComment.trim()) {
      const at = nowLabel();
      const entry = {
        id: `c-${Date.now()}`,
        author: currentUser?.name ?? "—",
        time: at,
        text: dialogComment.trim(),
      };
      nextComments = [...comments, entry];
      setComments(nextComments);
    }
    if (notes.length > 0 || dialogComment.trim()) {
      await logActivity(
        "work",
        base.id,
        notes.length > 0 ? notes.join("; ") : "added a note",
        currentUser?.id ?? null
      );
    }
    for (const name of added) {
      if (name === currentUser?.name) continue;
      const target = allUsers.find((u) => u.name === name);
      if (!target) continue;
      await pushNotification({
        type: "assignment",
        title: "New task assigned",
        message: base.title,
        fromId: currentUser?.id ?? null,
        forUserId: target.id,
        link: `/tasks/${base.number}`,
      });
    }
    setPendingAssignees([]);
    setPickerQuery("");
    setDialogComment("");
    setAssigneeDialogOpen(false);
  };

  if (worksLoading || !base) {
    return (
      <div className="flex flex-col gap-6 lg:h-[calc(100svh-5.5rem)]">
        {/* Breadcrumb skeleton */}
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Main + Sidebar layout */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-6">
          {/* Main content skeleton */}
          <main className="min-w-0 flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-7 w-96" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </main>

          {/* Sidebar skeleton */}
          <aside className="w-full space-y-4 lg:w-80 lg:shrink-0">
            <div className="space-y-3 rounded-xl border p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-3 rounded-xl border p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-3 rounded-xl border p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-full" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Panel Details dipakai dua kali: aside di desktop, bottom sheet di mobile.
  const detailsFields = (
    <div className="space-y-4">
      <DetailField
        icon={<Users />}
        label="Assigned To"
        action={<AddButton label="Add assignees" onClick={openAssigneeDialog} />}
      >
        {assignees.length > 0 ? (
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
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </DetailField>
      <DetailField icon={<Flag />} label="Priority">
        <PriorityBadge priority={priority} />
      </DetailField>
      <DetailField icon={<Factory />} label="Plant">
        <span className="text-sm">{base?.plant || "—"}</span>
      </DetailField>
      <DetailField icon={<MapPin />} label="Location">
        <span className="text-sm">{base?.location || "—"}</span>
      </DetailField>
      <DetailField icon={<CalendarDays />} label="Due Date">
        <span className="text-sm">{dueDate || "—"}</span>
      </DetailField>
      <DetailField
        icon={<Paperclip />}
        label="Attachment"
        action={
          <AddButton label="Add attachment" onClick={() => setUploadDialogOpen(true)} />
        }
      >
        <div className="space-y-2">
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Attachment.</p>
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
                  <Attachment key={a.id} size="sm" className="w-full cursor-pointer" title="Preview">
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
          {uploadError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Upload gagal: {uploadError}
            </p>
          )}
        </div>
      </DetailField>
    </div>
  );

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

      {/* ===== Main scroll | Details panel kanan ===== */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
        <main className="min-w-0 flex-1 space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <h3 className="min-w-0 flex-1 text-lg font-bold leading-snug tracking-tight sm:truncate sm:leading-none">
                  {title || "Untitled task"}
                </h3>
                <StatusBadge status={cancelled ? "cancelled" : status} className="mt-0.5 shrink-0 sm:mt-0" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* Mobile: buka panel Details sebagai bottom sheet */}
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setDetailsOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" /> Details
                </Button>
                {(currentUser?.role === "admin" ||
                  (currentUser?.name ? assignees.includes(currentUser.name) : false)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Action <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {status === "completed" ? (
                      <DropdownMenuItem onClick={reopenTask}>
                        <RotateCcw className="h-4 w-4" /> Reopen
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => setEditOpen(true)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {status === "todo" ? (
                          <DropdownMenuItem onClick={startTask}>
                            <Play className="h-4 w-4" /> Start
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
                            <CheckCircle2 className="h-4 w-4" /> Complete
                          </DropdownMenuItem>
                        )}
                        {!cancelled && (
                          <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                            <Ban className="h-4 w-4" /> Cancel
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </div>
            </div>
          </section>

          {/* Description */}
          <section className="space-y-3">
            <SectionTitle icon={<FileText />} title="Description" />
            <div
              className="rich-content resize-none text-sm bg-muted/30 rounded-lg border border-input px-3 py-2 min-h-[14rem] font-sans whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(stripChecklist(base?.description || "")) }}
            />
          </section>

          {/* Checklist — hanya tampil jika ada checklist di description */}
          {subTasks.length > 0 && (
            <>
              <section className="space-y-3">
                <SectionTitle icon={<ListChecks />} title="Checklist" count={subTasks.length} />
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
              </section>
              <div className="border-t" />
            </>
          )}

          {/* Comments — di bawah description, di atas activity */}
            <section className="space-y-4">
              <SectionTitle title="Comments" icon={<AlignLeft />} count={comments.length} />
            <div className="relative">
                <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 focus-within:ring-1 focus-within:ring-ring">
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
                    className="h-7 max-h-16 min-h-7 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-0.5 text-sm shadow-none focus-visible:ring-0"
                  />
                  <Button
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-md"
                    onClick={postComment}
                    disabled={!draft.trim()}
                    aria-label="Send comment"
                    title="Kirim"
                  >
                    <SendHorizontal className="h-3.5 w-3.5" />
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
            <div>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
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
            </section>
            <div className="border-t" />

            {/* Activity */}
            <section className="space-y-4">
              <SectionTitle title="Activity" icon={<CircleDot />} count={base.activities.length} />
              {base.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
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

        {/* Details panel kanan — desktop saja */}
        <aside className="hidden min-w-0 lg:block lg:w-[320px] lg:shrink-0 lg:border-l lg:pl-6">
          <div className="space-y-4 lg:sticky lg:top-0">{detailsFields}</div>
        </aside>
      </div>

      {/* Details — bottom sheet di mobile */}
      <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <BottomSheetContent aria-describedby={undefined}>
          <div className="flex shrink-0 items-center justify-between px-5 pb-2">
            <BottomSheetTitle>Details</BottomSheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(false)} aria-label="Tutup">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-6">{detailsFields}</div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Edit — popup sama persis kayak Create Task */}
      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        dialogTitle="Edit"
        showAssignee={false}
        showTeam={false}
        initial={{
          title,
          description: base.description,
          priority,
          dueISO: dmyToISO(dueDate),
          plant: base.plant,
          location: base.location,
          checklist: subTasks,
        }}
        onSubmit={async (v) => {
          const nextDue = toDMY(v.dueISO) || "—";
          const nextChecklist = v.checklist;
          setTitle(v.title);
          setPriority(v.priority);
          setDueDate(nextDue);
          setSubTasks(nextChecklist);
          await updateWork(base.id, {
            title: v.title,
            description: v.description,
            priority: v.priority,
            dueDate: nextDue,
            plant: v.plant,
            location: v.location,
          });
          await replaceChecklist(
            base.id,
            nextChecklist.map((s) => ({ id: s.id, label: s.title, done: s.done }))
          );
          await refreshChecklist();
          await reload();
          await logActivity("work", base.id, "edited task", currentUser?.id ?? null);
        }}
      />

      {/* Complete — checklist wajib selesai, attachment dianjurkan (opsional) */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete</DialogTitle>
            <DialogDescription>
              {subTasks.length > 0 && subTasks.some((s) => !s.done)
                ? "Complete all checklist items first."
                : "Are you sure this task is complete?"}
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
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
                    <Paperclip className="h-4 w-4" /> Tambah file
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {attachments.length > 0 ? `${attachments.length} file(s) attached` : "No files yet"}
                  </span>
                </div>
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
                {subTasks.length > 0 && subTasks.some((s) => !s.done) ? "Close" : "Cancel"}
            </Button>
            {!(subTasks.length > 0 && subTasks.some((s) => !s.done)) && (
              <Button onClick={completeTask}>
                Complete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview attachment */}
      <AttachmentPreviewDialog item={previewItem} onOpenChange={(o) => !o && setPreviewItem(null)} />

      {/* Upload attachment */}
      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onFilesSelected={onPickFiles}
      />

      {/* Cancel — konfirmasi */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel</DialogTitle>
            <DialogDescription>
              Yakin ingin membatalkan task ini? Task akan ditandai Cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={cancelTask}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete — konfirmasi */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!o) setDeleteError(null); setDeleteOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus task ini? Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={deleteTask}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add assignees popup */}
      <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add assignees</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="assignee-picker">
                Assignees
                {pendingAssignees.length > 0 && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {pendingAssignees.length}
                  </span>
                )}
              </FieldLabel>
              <div className="space-y-2 min-w-0 w-full">
                {pendingAssignees.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto w-full scrollbar-hide pb-1" style={{ scrollbarWidth: 'none' }}>
                    {pendingAssignees.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-1.5 font-normal flex-shrink-0"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className={`text-[8px] ${avatarColor(name)}`}>
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-32 truncate">{name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() => removePending(name)}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border bg-background transition-shadow focus-within:ring-1 focus-within:ring-ring">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                      placeholder={
                        pendingAssignees.length > 0
                          ? "Add more…"
                          : "Search people by name…"
                      }
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
                              addPending(u.name);
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
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="assignee-comment">Comment <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
              <Textarea
                id="assignee-comment"
                value={dialogComment}
                onChange={(e) => setDialogComment(e.target.value)}
                placeholder="Add a note for the new assignees…"
                rows={3}
                className="resize-y"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigneeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitAssigneeDialog}
              disabled={pendingAssignees.length === 0 && !dialogComment.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
