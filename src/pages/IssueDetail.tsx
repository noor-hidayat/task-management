import { useEffect, useMemo, useRef, useState } from "react";
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
  MapPin,
  MoveLeft,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { IssueStatusBadge, PriorityBadge } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { sanitizeRichHtml, stripChecklist } from "@/components/rich-text-editor";
import { RichTextEditor } from "@/components/rich-text-editor";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

import { avatarColor, initials } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useSupabaseLists";
import { useIssue } from "@/hooks/useIssue";
import { format } from "date-fns";
import { updateIssue, deleteIssue } from "@/lib/api/issues";
import { addComment } from "@/lib/api/related";
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { logActivity } from "@/lib/api/works";
import { listProfiles } from "@/lib/api/profiles";
import { deleteAttachment, fetchAttachmentObjectUrl, uploadAttachment } from "@/lib/api/attachments";
import type { Comment, Evidence, Issue } from "@/types";

type AttachmentItem = {
  id: string;
  name: string;
  meta: string;
  kind: "image" | "file";
  preview?: string;
  /** URL untuk preview/unduh (object URL). */
  url?: string;
  mime?: string;
  driveFileId?: string;
};

function toAttachmentItems(evidences: Evidence[]): AttachmentItem[] {
  return evidences.map((e) => {
    const kind = /jpg|jpeg|png|gif|webp|image/i.test(`${e.fileType} ${e.fileName}`) ? "image" : "file";
    return {
      id: e.id,
      name: e.fileName,
      meta: `${e.fileSize} • ${e.uploadedBy}`,
      kind,
      mime: e.fileType,
      driveFileId: e.driveFileId,
    };
  });
}

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

export function IssueDetail() {
  const { number } = useParams();
  const { user: currentUser } = useAuth();
  const { data: users } = useUsers();
  const { data: issue, loading: issuesLoading, reload, refreshAttachments, refreshComments } = useIssue(number);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionActive, setMentionActive] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft("");
  }, [number]);

  const [editOpen, setEditOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState("");
  const [startTimeDraft, setStartTimeDraft] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeDraft, setCloseDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");
  const [endTimeDraft, setEndTimeDraft] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdDraft, setHoldDraft] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [dialogAssignees, setDialogAssignees] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [assigneeComment, setAssigneeComment] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  useEffect(() => {
    setAttachments(toAttachmentItems(issue?.evidences ?? []));
  }, [issue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const atMatch = pickerQuery.match(/@([\w ]*)$/);
  const pickerNormalized = atMatch ? atMatch[1].toLowerCase().trim() : null;
  const pickerSuggestions = useMemo(
    () =>
      pickerNormalized === null
        ? []
        : users.filter(
            (u) =>
              !dialogAssignees.includes(u.name) &&
              u.name.toLowerCase().includes(pickerNormalized)
          ),
    [dialogAssignees, pickerNormalized, users]
  );

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 3);
  }, [mentionQuery, users]);

  if (issuesLoading || !issue) {
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
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
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

  const isClosed = issue.status === "closed";
  const comments: Comment[] = issue.comments ?? [];
  const actorId = currentUser?.id ?? "";

  const openStartDialog = () => {
    const iso = issue.startDateTimeISO || new Date().toISOString();
    const d = new Date(iso);
    setStartDateDraft(format(d, "yyyy-MM-dd"));
    setStartTimeDraft(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`);
    setStartOpen(true);
  };

  const confirmStart = async () => {
    if (!startDateDraft || !startTimeDraft) return;
    const [h, m, s] = startTimeDraft.split(":").map(Number);
    const combined = new Date(`${startDateDraft}T00:00:00`);
    combined.setHours(h, m, s || 0);
    await updateIssue(issue.id, { status: "in_progress", startDatetime: combined.toISOString() });
    await logActivity("issue", issue.id, "started issue", actorId);
    reload();
    setStartOpen(false);
  };

  const openCloseDialog = () => {
    setCloseDraft(issue.resolution ?? "");
    const iso = issue.endDateTimeISO || new Date().toISOString();
    const d = new Date(iso);
    setEndDateDraft(format(d, "yyyy-MM-dd"));
    setEndTimeDraft(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`);
    setCloseOpen(true);
  };

  const confirmClose = async () => {
    const resolution = closeDraft.trim();
    if (!resolution || !endDateDraft || !endTimeDraft) return;
    const [h, m, s] = endTimeDraft.split(":").map(Number);
    const combined = new Date(`${endDateDraft}T00:00:00`);
    combined.setHours(h, m, s || 0);
    await updateIssue(issue.id, { status: "closed", resolution, endDatetime: combined.toISOString() });
    await logActivity("issue", issue.id, "closed issue", actorId);
    reload();
    setCloseOpen(false);
  };

  const reopen = async () => {
    await updateIssue(issue.id, { status: "open", holdReason: "" });
    await logActivity("issue", issue.id, "reopened issue", actorId);
    reload();
  };

  const openHoldDialog = () => {
    setHoldDraft(issue.holdReason ?? "");
    setHoldOpen(true);
  };

  const confirmHold = async () => {
    const reason = holdDraft.trim();
    if (!reason) return;
    await updateIssue(issue.id, { status: "on_hold", holdReason: reason });
    await logActivity("issue", issue.id, `put issue on hold (${reason})`, actorId);
    reload();
    setHoldOpen(false);
  };

  const resumeIssue = async () => {
    await updateIssue(issue.id, { status: "in_progress" });
    await logActivity("issue", issue.id, "resumed issue", actorId);
    reload();
  };

  const cancelIssue = async () => {
    await updateIssue(issue.id, { cancelled: true });
    await logActivity("issue", issue.id, "cancelled issue", actorId);
    reload();
    setCancelOpen(false);
  };

  const confirmDeleteIssue = async () => {
    setDeleteError(null);
    try {
      await deleteIssue(issue.id);
      setDeleteOpen(false);
      navigate("/issues");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete issue");
    }
  };

  const assignees: string[] =
    Array.isArray(issue.assignees) && issue.assignees.length > 0
      ? issue.assignees
      : issue.assignedTo
        ? [issue.assignedTo]
        : [];

  const addAssignee = (name: string) => {
    const clean = name.replace(/^@/, "").trim();
    if (!clean) return;
    const found =
      users.find((u) => u.name.toLowerCase() === clean.toLowerCase()) ??
      users.find((u) => u.name.toLowerCase().includes(clean.toLowerCase()));
    const toAdd = found?.name ?? clean;
    if (dialogAssignees.includes(toAdd)) {
      setPickerQuery("");
      return;
    }
    setDialogAssignees((prev) => [...prev, toAdd]);
    setPickerQuery("");
    pickerInputRef.current?.focus();
  };
  const removeAssignee = (name: string) =>
    setDialogAssignees((prev) => prev.filter((a) => a !== name));
  const openAssigneeDialog = () => {
    setDialogAssignees(assignees);
    setPickerQuery("");
    setAssigneeComment("");
    setAssigneeOpen(true);
  };

  const submitEdit = async (v: IssueFormValues) => {
    const profiles = await listProfiles();
    const assigneeIds = v.assignedTo
      .map((name) => profiles.find((u) => u.name === name)?.id)
      .filter((id): id is string => !!id);
    const patch: Parameters<typeof updateIssue>[1] = {
      title: v.title,
      description: v.description,
      priority: v.priority,
      plant: v.plant,
      location: v.location,
      assigneeIds,
      issueTypeId: v.issueTypeId,
    };
    if (v.assignedTeamId && v.assignedTeamId !== issue.assignedTeamId) {
      patch.assignedTeamId = v.assignedTeamId;
    }
    await updateIssue(issue.id, patch);
    await logActivity("issue", issue.id, "edited issue", actorId);
    reload();
  };

  const submitAssignee = async () => {
    const added = dialogAssignees.filter((a) => !assignees.includes(a));
    const removed = assignees.filter((a) => !dialogAssignees.includes(a));
    const changed = added.length > 0 || removed.length > 0;
    if (changed) {
      const ids = dialogAssignees
        .map((name) => users.find((u) => u.name === name)?.id)
        .filter((v): v is string => Boolean(v));
      await updateIssue(issue.id, { assigneeIds: ids });
      const parts: string[] = [];
      if (added.length > 0) parts.push(`assigned ${added.join(", ")}`);
      if (removed.length > 0) parts.push(`unassigned ${removed.join(", ")}`);
      if (parts.length > 0) {
        await logActivity("issue", issue.id, parts.join("; "), actorId);
      }
      for (const name of added) {
        if (name === currentUser?.name) continue;
        const target = users.find((u) => u.name === name);
        if (!target) continue;
        await pushNotification({
          type: "assignment",
          title: "New issue assigned",
          message: issue.title,
          fromId: currentUser?.id ?? null,
          forUserId: target.id,
          link: `/issues/${issue.number}`,
        });
      }
    }
    if (assigneeComment.trim()) {
      await addComment("issue", issue.id, actorId, assigneeComment.trim());
    }
    reload();
    setDialogAssignees([]);
    setPickerQuery("");
    setAssigneeComment("");
    setAssigneeOpen(false);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      const uploaded: AttachmentItem[] = [];
      for (const [idx, f] of Array.from(files).entries()) {
        const res = await uploadAttachment("issue", issue.id, issue.number, f);
        uploaded.push({
          id: `${res.attachmentId}-${idx}`,
          name: res.fileName,
          meta: `${res.fileSize} • ${currentUser?.name ?? "—"}`,
          kind: f.type.startsWith("image/") ? "image" : "file",
          mime: res.fileType,
          driveFileId: res.driveFileId,
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      if (uploaded.length > 0) {
        await logActivity(
          "issue",
          issue.id,
          uploaded.length === 1
            ? `added attachment (${uploaded[0].name})`
            : `added ${uploaded.length} attachments`,
          actorId
        );
      }
      refreshAttachments();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const downloadItem = async (a: AttachmentItem) => {
    const url = a.url ?? (a.driveFileId ? await fetchAttachmentObjectUrl(a.driveFileId) : null);
    if (!url) return;
    const el = document.createElement("a");
    el.href = url;
    el.download = a.name;
    el.click();
  };

  const removeAttachment = async (id: string) => {
    const target = attachments.find((a) => a.id === id);
    if (!target) return;
    // Optimistic: hapus dari UI dulu
    if (target.preview) URL.revokeObjectURL(target.preview);
    if (target.url && target.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    // Background delete
    if (target.driveFileId) {
      deleteAttachment(target.id, target.driveFileId)
        .then(() =>
          logActivity("issue", issue.id, `removed attachment (${target.name})`, actorId)
        )
        .catch(() => {
          // rollback optional — refreshAttachments bisa dipanggil jika perlu
          refreshAttachments();
        });
    }
  };

  const openPreview = async (a: AttachmentItem) => {
    if (!a.url && a.driveFileId) {
      const url = await fetchAttachmentObjectUrl(a.driveFileId);
      if (url) {
        const next = { ...a, url, preview: a.kind === "image" ? url : undefined };
        setAttachments((prev) => prev.map((x) => (x.id === a.id ? next : x)));
        setPreviewItem(next);
        return;
      }
    }
    setPreviewItem(a);
  };

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
    const names = [...users.map((u) => u.name)].sort((a, b) => b.length - a.length);
    if (names.length === 0) return <span>{text}</span>;
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
    const clean = draft.trim();
    if (!clean || !actorId) return;
    await addComment("issue", issue.id, actorId, clean);
    await logActivity("issue", issue.id, "commented", actorId);
    // Kirim notifikasi mention ke setiap user yang disebut (@Nama), kecuali diri sendiri.
    await notifyMentions({
      content: clean,
      users,
      fromId: currentUser?.id ?? null,
      fromName: currentUser?.name,
      title: "You were mentioned in an issue",
      message: clean.length > 80 ? `${clean.slice(0, 80)}…` : clean,
      link: `/issues/${issue.number}`,
    });
    setDraft("");
    setMentionQuery(null);
    if (commentInputRef.current) commentInputRef.current.style.height = "auto";
    refreshComments();
  };

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100svh-5.5rem)]">
      {/* Breadcrumb */}
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/issues" aria-label="Back to Issues">
            <MoveLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link to="/issues" className="transition-colors hover:text-foreground">
                Issues
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-mono">#{issue.number}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ===== Main scroll | Details panel kanan ===== */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
        <main className="min-w-0 flex-1 space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-6">
          <section className="space-y-4">
            <div className="flex flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-xl font-bold leading-tight tracking-tight">
                  {issue.title || "Untitled issue"}
                </h3>
                <IssueStatusBadge status={issue.cancelled ? "cancelled" : issue.status} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(currentUser?.role === "admin" ||
                  (currentUser?.name ? assignees.includes(currentUser.name) : false)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Action <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isClosed ? (
                      <DropdownMenuItem onClick={reopen}>
                        <RotateCcw className="h-4 w-4" /> Reopen
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => setEditOpen(true)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {issue.status === "open" ? (
                          <DropdownMenuItem onClick={openStartDialog}>
                            <Play className="h-4 w-4" /> Start
                          </DropdownMenuItem>
                        ) : issue.status === "on_hold" ? (
                          <DropdownMenuItem onClick={resumeIssue}>
                            <Play className="h-4 w-4" /> Resume
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={openHoldDialog}>
                              <Pause className="h-4 w-4" /> On Hold
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={openCloseDialog}>
                              <CheckCircle2 className="h-4 w-4" /> Completed
                            </DropdownMenuItem>
                          </>
                        )}
                        {!issue.cancelled && (
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
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(stripChecklist(issue?.description || "")) }}
            />
          </section>
          <div className="border-t" />

          {/* Resolution — hanya tampil setelah issue closed */}
          {isClosed && (
          <section className="space-y-3">
            <SectionTitle icon={<FileText />} title="Resolution" />
            <div
              className="rich-content text-sm bg-muted/30 rounded-lg border border-input px-3 py-2 font-sans"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(issue.resolution || "") }}
            />
          </section>
          )}

          {/* Start/End DateTime Table — tampil jika ada salah satu */}
          {(issue.startDateTime || issue.endDateTime) && (
          <section className="space-y-3">
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Start</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">End</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time in Minute</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2">{issue.startDateTime || "—"}</td>
                    <td className="px-3 py-2">{issue.endDateTime || "—"}</td>
                    <td className="px-3 py-2">
                      {issue.startDateTimeISO && issue.endDateTimeISO
                        ? Math.round((new Date(issue.endDateTimeISO).getTime() - new Date(issue.startDateTimeISO).getTime()) / 60000)
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          )}
          <div className="border-t" />

          {/* Comments — di bawah description, di atas activity */}
          <section className="space-y-4">
            <SectionTitle title="Comments" icon={<AlignLeft />} count={comments.length} />
            <div className="relative">
              <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 focus-within:ring-1 focus-within:ring-ring">
                <Textarea
                  ref={commentInputRef}
                  id="issue-comment"
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
                        <span className="text-xs text-muted-foreground">{c.time ?? c.at}</span>
                      </div>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap">
                        {renderWithMentions(c.text)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="border-t" />

          {/* Activity — ikut scroll di Main Content */}
          <section className="space-y-4">
            <SectionTitle title="Activity" icon={<CircleDot />} count={issue.activities.length} />
            {issue.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="relative ml-2 grid grid-cols-1 gap-4 border-l pl-4">
                {issue.activities.map((a) => (
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

        {/* Details panel kanan — Status | Priority | Issue Type | Plant | Location | Assigned To */}
        <aside className="min-w-0 lg:w-[320px] lg:shrink-0 lg:border-l lg:pl-6">
          <div className="space-y-4 lg:sticky lg:top-0">
            <div className="space-y-4">
              <DetailField
                icon={<Users />}
                label="Assignees"
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
              {issue.status === "on_hold" && issue.holdReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">On Hold Reason</p>
                  <p className="mt-0.5 text-sm">{issue.holdReason}</p>
                </div>
              )}
              <DetailField icon={<Tag />} label="Issue Type">
                <span className="text-sm">{issue.issueType || "—"}</span>
              </DetailField>
              <DetailField icon={<Flag />} label="Priority">
                <PriorityBadge priority={issue.priority} />
              </DetailField>
              <DetailField icon={<Factory />} label="Plant">
                <span className="text-sm">{issue.plant || "—"}</span>
              </DetailField>
              <DetailField icon={<MapPin />} label="Location">
                <span className="text-sm">{issue.location || "—"}</span>
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
                            <AttachmentTrigger aria-label={`Preview ${a.name}`} onClick={() => openPreview(a)} />
                            <AttachmentMedia variant="image">
                              <img src={a.preview} alt={a.name} className="h-full w-full object-cover" />
                            </AttachmentMedia>
                            <AttachmentContent>
                              <AttachmentTitle>{a.name}</AttachmentTitle>
                              <AttachmentDescription>{a.meta}</AttachmentDescription>
                            </AttachmentContent>
                            <AttachmentActions>
                              <AttachmentAction aria-label={`Remove ${a.name}`} onClick={() => removeAttachment(a.id)}>
                                <X />
                              </AttachmentAction>
                            </AttachmentActions>
                          </Attachment>
                        ) : (
                          <Attachment key={a.id} size="sm" className="w-full cursor-pointer" title="Preview">
                            <AttachmentTrigger aria-label={`Preview ${a.name}`} onClick={() => openPreview(a)} />
                            <AttachmentMedia>
                              {a.kind === "image" ? <ImageIcon /> : <FileText />}
                            </AttachmentMedia>
                            <AttachmentContent>
                              <AttachmentTitle>{a.name}</AttachmentTitle>
                              <AttachmentDescription>{a.meta}</AttachmentDescription>
                            </AttachmentContent>
                            <AttachmentActions>
                              {(a.url || a.driveFileId) && (
                                <AttachmentAction aria-label={`Download ${a.name}`} onClick={() => downloadItem(a)}>
                                  <Download />
                                </AttachmentAction>
                              )}
                              <AttachmentAction aria-label={`Remove ${a.name}`} onClick={() => removeAttachment(a.id)}>
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
          </div>
        </aside>
      </div>

      {/* Edit */}
      <IssueFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        dialogTitle="Edit"
        initial={{
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          assignedTo: assignees,
          reportedTeamId: issue.reportedTeamId,
          assignedTeamId: issue.assignedTeamId,
          plant: issue.plant,
          location: issue.location,
          issueTypeId: issue.issueTypeId ?? "",
        }}
        onSubmit={submitEdit}
      />

      {/* Start — wajib isi tanggal & jam mulai */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Issue</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="issue-start-date">Start Date</FieldLabel>
                <DatePicker
                  id="issue-start-date"
                  value={startDateDraft}
                  onChange={setStartDateDraft}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issue-start-time">Start Time</FieldLabel>
                <TimePicker
                  id="issue-start-time"
                  value={startTimeDraft}
                  onChange={setStartTimeDraft}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmStart} disabled={!startDateDraft || !startTimeDraft}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close — wajib isi resolution + tanggal & jam selesai */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-4xl max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Close Issue</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4 py-2 md:grid-cols-[1fr_300px]">
            {/* Kiri: Resolution (Rich Text) */}
            <div className="grid gap-4">
              <Field>
                <FieldLabel>Resolution</FieldLabel>
                <RichTextEditor
                  value={closeDraft}
                  onChange={setCloseDraft}
                  placeholder="e.g.: Fitting tightened, pressure back to normal…"
                  users={users.map((u) => u.name)}
                  height={300}
                />
              </Field>
            </div>
            {/* Kanan: End Date & Time */}
            <div className="grid content-start gap-4 md:border-l md:pl-4">
              <Field>
                <FieldLabel htmlFor="issue-end-date">End Date</FieldLabel>
                <DatePicker
                  id="issue-end-date"
                  value={endDateDraft}
                  onChange={setEndDateDraft}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issue-end-time">End Time</FieldLabel>
                <TimePicker
                  id="issue-end-time"
                  value={endTimeDraft}
                  onChange={setEndTimeDraft}
                />
              </Field>
            </div>
            <DialogFooter className="md:col-span-2">
              <Button variant="outline" onClick={() => setCloseOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmClose} disabled={!closeDraft.trim() || !endDateDraft || !endTimeDraft}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* On Hold — wajib isi reason */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="issue-hold-reason">Reason</FieldLabel>
              <Textarea
                id="issue-hold-reason"
                value={holdDraft}
                onChange={(e) => setHoldDraft(e.target.value)}
                placeholder="e.g.: Waiting for spare parts from vendor…"
                rows={4}
                className="resize-y"
                autoFocus
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmHold} disabled={!holdDraft.trim()}>
              Submit
            </Button>
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
              Yakin ingin membatalkan issue ini? Issue akan ditandai Cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={cancelIssue}>
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
              Yakin ingin menghapus issue ini? Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeleteIssue}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage assignees (multi-user) */}
      <Dialog open={assigneeOpen} onOpenChange={setAssigneeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage assignees</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="assignee-picker">
                Assignees
                {dialogAssignees.length > 0 && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {dialogAssignees.length}
                  </span>
                )}
              </FieldLabel>
              <div className="space-y-2 min-w-0 w-full">
                {dialogAssignees.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto w-full scrollbar-hide pb-1" style={{ scrollbarWidth: 'none' }}>
                    {dialogAssignees.map((name) => (
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
                          onClick={() => removeAssignee(name)}
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
                            addAssignee(pickerSuggestions[0].name);
                          } else if (pickerQuery.trim()) {
                            addAssignee(pickerQuery);
                          }
                        } else if (
                          e.key === "Backspace" &&
                          pickerQuery === "" &&
                          dialogAssignees.length > 0
                        ) {
                          removeAssignee(dialogAssignees[dialogAssignees.length - 1]);
                        }
                      }}
                      placeholder={
                        dialogAssignees.length > 0
                          ? "Add more…"
                          : "Search people by name…"
                      }
                      autoComplete="off"
                      className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                    />
                    {pickerSuggestions.length > 0 && (
                      <div className="absolute right-2 left-2 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                        {pickerSuggestions.slice(0, 8).map((u) => (
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
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="issue-assignee-comment">Comment <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
              <Textarea
                id="issue-assignee-comment"
                value={assigneeComment}
                onChange={(e) => setAssigneeComment(e.target.value)}
                placeholder="Add a note for the new assignees…"
                rows={3}
                className="resize-y"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigneeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAssignee}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
