import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlignLeft,
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
  Send,
  Users,
  X,
} from "lucide-react";

import { IssueStatusBadge, PriorityBadge } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { dmyToISO, toDMY } from "@/components/task-form-dialog";
import { RichTextView } from "@/components/rich-text-editor";
import { avatarColor, initials } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useIssues, useUsers } from "@/hooks/useSupabaseLists";
import { updateIssue } from "@/lib/api/issues";
import { addComment } from "@/lib/api/related";
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
  const { data: issues, reload } = useIssues();
  const { data: users } = useUsers();

  const issue: Issue | undefined = useMemo(
    () => issues.find((i) => i.number === number),
    [issues, number]
  );
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [number]);

  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeDraft, setCloseDraft] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdDraft, setHoldDraft] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dialogAssignees, setDialogAssignees] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [assigneeComment, setAssigneeComment] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  useEffect(() => {
    setAttachments(toAttachmentItems(issue?.evidences ?? []));
  }, [issue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (!issue) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/issues"><MoveLeft className="h-4 w-4" /> Kembali ke Issues</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Issue tidak ditemukan.</p>
      </div>
    );
  }

  const isClosed = issue.status === "closed";
  const comments: Comment[] = issue.comments ?? [];
  const actorId = currentUser?.id ?? "";

  const openCloseDialog = () => {
    setCloseDraft(issue.resolution ?? "");
    setCloseOpen(true);
  };

  const confirmClose = async () => {
    const resolution = closeDraft.trim();
    if (!resolution) return;
    await updateIssue(issue.id, { status: "closed", resolution, closedById: actorId || null });
    reload();
    setCloseOpen(false);
  };

  const reopen = async () => {
    await updateIssue(issue.id, { status: "open", holdReason: "" });
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
    reload();
    setHoldOpen(false);
  };

  const resumeIssue = async () => {
    await updateIssue(issue.id, { status: "in_progress" });
    reload();
  };

  const startIssue = async () => {
    await updateIssue(issue.id, { status: "in_progress" });
    reload();
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
    const assigneeId = profiles.find((u) => u.name === v.assignedTo)?.id;
    const patch: Parameters<typeof updateIssue>[1] = {
      title: v.title,
      description: v.description,
      priority: v.priority,
      dueDate: toDMY(v.dueISO) || issue.dueDate,
      plant: v.plant,
      location: v.location,
      assigneeIds: assigneeId ? [assigneeId] : [],
    };
    if (v.assignedTeamId && v.assignedTeamId !== issue.assignedTeamId) {
      patch.assignedTeamId = v.assignedTeamId;
    }
    await updateIssue(issue.id, patch);
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
    reload();
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
    if (target?.preview) URL.revokeObjectURL(target.preview);
    if (target?.url && target.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
    if (target?.driveFileId) {
      await deleteAttachment(target.id, target.driveFileId);
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    if (target) {
      await logActivity("issue", issue.id, `removed attachment (${target.name})`, actorId);
    }
    reload();
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

  const postComment = async () => {
    const clean = draft.trim();
    if (!clean) return;
    await addComment("issue", issue.id, actorId, clean);
    setDraft("");
    reload();
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
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Action <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isClosed ? (
                      <DropdownMenuItem onClick={reopen}>
                        <RotateCcw className="h-4 w-4" /> Reopen Issue
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => setEditOpen(true)}>
                          <Pencil className="h-4 w-4" /> Edit Issue
                        </DropdownMenuItem>
                        {issue.status === "open" ? (
                          <DropdownMenuItem onClick={startIssue}>
                            <Play className="h-4 w-4" /> Start Issue
                          </DropdownMenuItem>
                        ) : issue.status === "on_hold" ? (
                          <DropdownMenuItem onClick={resumeIssue}>
                            <Play className="h-4 w-4" /> Resume Issue
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

                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </section>



          {/* Description — label di atas, konten full-width */}
          <section className="space-y-2">
            <SectionTitle icon={<AlignLeft />} title="Description" />
            <div className="rounded-lg border bg-muted/30 px-3 py-2 min-h-[9lh]">
              <RichTextView html={issue.description} />
            </div>
          </section>

          {/* Resolution — hanya tampil setelah issue closed */}
          {isClosed && (
          <section className="space-y-3">
            <SectionTitle icon={<FileText />} title="Resolution" />
            <div className="space-y-1">
              <p className="text-sm">{issue.resolution || "—"}</p>
              <p className="text-xs text-muted-foreground">
                Closed by {issue.closedBy ?? "—"}{issue.closedAt ? ` · ${issue.closedAt}` : ""}
              </p>
            </div>
          </section>
          )}
          <div className="border-t" />

          {/* Comments — di bawah description, di atas activity */}
          <section className="space-y-4">
            <SectionTitle title="Comments" icon={<AlignLeft />} count={comments.length} />
            <div className="flex items-center gap-2 rounded-xl border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
              <Textarea
                id="issue-comment"
                aria-label="Add comment"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
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
                        <span className="text-xs text-muted-foreground">{c.time ?? c.at}</span>
                      </div>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.text}</p>
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
              <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
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

        {/* Details panel kanan — Status | Priority | Due Date | Plant | Location | Assigned To */}
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
              <DetailField icon={<CircleDot />} label="Status">
                <IssueStatusBadge status={issue.status} />
              </DetailField>
              {issue.status === "on_hold" && issue.holdReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">On Hold Reason</p>
                  <p className="mt-0.5 text-sm">{issue.holdReason}</p>
                </div>
              )}
              <DetailField icon={<Flag />} label="Priority">
                <PriorityBadge priority={issue.priority} />
              </DetailField>
              <DetailField icon={<Factory />} label="Plant">
                <span className="text-sm">{issue.plant || "—"}</span>
              </DetailField>
              <DetailField icon={<MapPin />} label="Location">
                <span className="text-sm">{issue.location || "—"}</span>
              </DetailField>
              <DetailField icon={<CalendarDays />} label="Due Date">
                <span className="text-sm">{issue.dueDate || "—"}</span>
              </DetailField>
              <DetailField
                icon={<Paperclip />}
                label="Attachment"
                action={
                  <AddButton label="Add attachment" onClick={() => fileInputRef.current?.click()} />
                }
              >
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
                </div>
              </DetailField>
            </div>
          </div>
        </aside>
      </div>

      {/* Edit Issue */}
      <IssueFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        dialogTitle="Edit Issue"
        dialogDescription="Ubah issue — form yang sama seperti report issue."
        submitLabel="Simpan"
        initial={{
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          assignedTo: issue.assignedTo,
          reportedTeamId: issue.reportedTeamId,
          assignedTeamId: issue.assignedTeamId,
          plant: issue.plant,
          location: issue.location,
          dueISO: dmyToISO(issue.dueDate),
        }}
        onSubmit={submitEdit}
      />

      {/* Close Issue — wajib isi resolution */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Issue</DialogTitle>
            <DialogDescription>
              Tulis resolution sebelum menutup #{issue.number}.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="issue-resolution">Resolution</FieldLabel>
              <Textarea
                id="issue-resolution"
                value={closeDraft}
                onChange={(e) => setCloseDraft(e.target.value)}
                placeholder="cth: Fitting dikencangkan, tekanan kembali normal…"
                rows={4}
                className="resize-y"
                autoFocus
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmClose} disabled={!closeDraft.trim()}>
              Close Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* On Hold — wajib isi reason */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>On Hold</DialogTitle>
            <DialogDescription>
              Tulis alasan menunda #{issue.number}.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="issue-hold-reason">Reason</FieldLabel>
              <Textarea
                id="issue-hold-reason"
                value={holdDraft}
                onChange={(e) => setHoldDraft(e.target.value)}
                placeholder="cth: Menunggu sparepart dari vendor…"
                rows={4}
                className="resize-y"
                autoFocus
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmHold} disabled={!holdDraft.trim()}>
              On Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview attachment */}
      <AttachmentPreviewDialog item={previewItem} onOpenChange={(o) => !o && setPreviewItem(null)} />

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
              <div className="rounded-xl border bg-background transition-shadow focus-within:ring-1 focus-within:ring-ring">
                {dialogAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
                    {dialogAssignees.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-1.5 font-normal"
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
                        ? "Search to add more people…"
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
              <p className="text-xs text-muted-foreground">
                Type @ to search, press Enter to add.
              </p>
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
