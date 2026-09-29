import { useEffect, useRef, useState } from "react";
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
  RotateCcw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { dmyToISO, toDMY } from "@/components/task-form-dialog";
import { RichTextView } from "@/components/rich-text-editor";
import { avatarColor, initials } from "@/lib/format";
import { currentUser, users } from "@/lib/mock";
import { loadIssues, notifyIssuesUpdated, saveIssues } from "@/lib/storage";
import type { Comment, Evidence, Issue } from "@/types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
};

/** Batas isi file yang disimpan ke localStorage agar preview awet (1 MB). */
const PREVIEW_STORE_LIMIT = 1_000_000;

function readAsDataURL(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

function toAttachmentItems(evidences: Evidence[]): AttachmentItem[] {
  return evidences.map((e) => {
    const kind = /jpg|jpeg|png|gif|webp|image/i.test(`${e.fileType} ${e.fileName}`) ? "image" : "file";
    return {
      id: e.id,
      name: e.fileName,
      meta: `${e.fileSize} • ${e.uploadedBy}`,
      kind,
      preview: kind === "image" ? e.dataUrl : undefined,
      url: e.dataUrl,
      mime: e.fileType,
    };
  });
}

/** Baris display persis gaya TaskDetail: icon + label + value (bukan input) */
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

export function IssueDetail() {
  const { number } = useParams();
  const [issue, setIssue] = useState<Issue | undefined>(() =>
    loadIssues().find((i) => i.number === number)
  );
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setIssue(loadIssues().find((i) => i.number === number));
    setDraft("");
  }, [number]);

  useEffect(() => {
    const reload = () => {
      setIssue(loadIssues().find((i) => i.number === number));
    };
    window.addEventListener("tm:issues:updated", reload);
    return () => window.removeEventListener("tm:issues:updated", reload);
  }, [number]);

  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeDraft, setCloseDraft] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdDraft, setHoldDraft] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [pendingAssignee, setPendingAssignee] = useState("");
  const [assigneeComment, setAssigneeComment] = useState("");

  const [attachments, setAttachments] = useState<AttachmentItem[]>(() =>
    toAttachmentItems(issue?.evidences ?? [])
  );
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  useEffect(() => {
    setAttachments(toAttachmentItems(issue?.evidences ?? []));
  }, [issue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileInputRef = useRef<HTMLInputElement>(null);

  const persist = (base: Issue, patch: Partial<Issue>, activity?: string, actor = currentUser.name) => {
    const at = nowLabel();
    const next: Issue = {
      ...base,
      ...patch,
      updatedAt: at,
      activities: activity
        ? [...base.activities, { id: `a-${Date.now()}`, at, text: activity, actor }]
        : base.activities,
    };
    setIssue(next);
    saveIssues(loadIssues().map((i) => (i.id === base.id ? next : i)));
    notifyIssuesUpdated();
    return next;
  };

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

  const openCloseDialog = () => {
    setCloseDraft(issue.resolution ?? "");
    setCloseOpen(true);
  };

  const confirmClose = () => {
    const resolution = closeDraft.trim();
    if (!resolution) return;
    persist(
      issue,
      { status: "closed", resolution, closedBy: currentUser.name, closedAt: nowLabel() },
      "closed issue"
    );
    setCloseOpen(false);
  };

  const reopen = () => {
    persist(
      issue,
      { status: "open", closedBy: undefined, closedAt: undefined, holdReason: undefined },
      "reopened issue"
    );
  };

  const openHoldDialog = () => {
    setHoldDraft(issue.holdReason ?? "");
    setHoldOpen(true);
  };

  const confirmHold = () => {
    const reason = holdDraft.trim();
    if (!reason) return;
    persist(issue, { status: "on_hold", holdReason: reason }, "put on hold");
    setHoldOpen(false);
  };

  const resumeIssue = () => {
    persist(issue, { status: "in_progress" }, "resumed issue");
  };

  const startIssue = () => {
    persist(issue, { status: "in_progress" }, "status changed from Open to In Progress");
  };

  const submitEdit = (v: IssueFormValues) => {
    const activity =
      v.assignedTo !== issue.assignedTo
        ? `assignment changed from ${issue.assignedTo} to ${v.assignedTo}`
        : undefined;
    const { dueISO, ...rest } = v;
    persist(issue, { ...rest, dueDate: toDMY(dueISO) || issue.dueDate }, activity);
  };

  const submitAssignee = () => {
    if (!pendingAssignee) return;
    let next = issue;
    if (pendingAssignee !== issue.assignedTo) {
      next = persist(
        next,
        { assignedTo: pendingAssignee },
        `assignment changed from ${issue.assignedTo} to ${pendingAssignee}`
      );
    }
    if (assigneeComment.trim()) {
      const at = nowLabel();
      next = persist(next, {
        comments: [
          ...comments,
          { id: `c-${Date.now()}`, author: currentUser.name, time: at, text: assigneeComment.trim() },
        ],
      });
    }
    setPendingAssignee("");
    setAssigneeComment("");
    setAssigneeOpen(false);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const at = nowLabel();
    const items: AttachmentItem[] = [];
    const evidences: Evidence[] = [];
    for (const [idx, f] of Array.from(files).entries()) {
      const id = `local-${Date.now()}-${idx}`;
      const isImage = f.type.startsWith("image/");
      const url = URL.createObjectURL(f);
      // Simpan isi file kecil agar preview tetap ada setelah reload
      let dataUrl: string | undefined;
      try {
        if (f.size <= PREVIEW_STORE_LIMIT) dataUrl = await readAsDataURL(f);
      } catch {}
      items.push({
        id,
        name: f.name,
        meta: `${formatSize(f.size)} • ${currentUser.name}`,
        kind: isImage ? "image" : "file",
        preview: isImage ? url : undefined,
        url: dataUrl ?? url,
        mime: f.type,
      });
      evidences.push({
        id,
        fileName: f.name,
        fileType: f.type || "file",
        fileSize: formatSize(f.size),
        uploadedBy: currentUser.name,
        uploadedAt: at,
        dataUrl,
      });
    }
    setAttachments((prev) => [...prev, ...items]);
    persist(
      issue,
      { evidences: [...issue.evidences, ...evidences] },
      items.length === 1
        ? `added attachment (${items[0].name})`
        : `added ${items.length} attachments`
    );
  };

  const downloadItem = (a: AttachmentItem) => {
    if (!a.url) return;
    const el = document.createElement("a");
    el.href = a.url;
    el.download = a.name;
    el.click();
  };

  const removeAttachment = (id: string) => {
    const target = attachments.find((a) => a.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);
    if (target?.url && target.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    persist(
      issue,
      { evidences: issue.evidences.filter((e) => e.id !== id) },
      target ? `removed attachment (${target.name})` : undefined
    );
  };

  const postComment = () => {
    const clean = draft.trim();
    if (!clean) return;
    const at = nowLabel();
    persist(issue, {
      comments: [
        ...comments,
        { id: `c-${Date.now()}`, author: currentUser.name, time: at, text: clean },
      ],
    });
    setDraft("");
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

      {/* ===== Main scroll | Comments panel fixed ===== */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
        <main className="min-w-0 flex-1 space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-lg font-bold leading-none tracking-tight">
                  {issue.title || "Untitled issue"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
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
                        ) : issue.holdReason ? (
                          <DropdownMenuItem onClick={openCloseDialog}>
                            <CheckCircle2 className="h-4 w-4" /> Close Issue
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={openHoldDialog}>
                            <Pause className="h-4 w-4" /> On Hold
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setPendingAssignee(issue.assignedTo);
                            setAssigneeComment("");
                            setAssigneeOpen(true);
                          }}
                        >
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

          {/* Status | Priority | Plant | Location | Assigned To — display rows */}
          <div className="space-y-1.5">
            <DetailRow icon={<CircleDot />} label="Status">
              <span className="flex flex-wrap items-center gap-2">
                <IssueStatusBadge status={issue.status} />
              </span>
            </DetailRow>
            {issue.status === "on_hold" && issue.holdReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">On Hold Reason</p>
                <p className="mt-0.5 text-sm">{issue.holdReason}</p>
              </div>
            )}
            <DetailRow icon={<Flag />} label="Priority">
              <PriorityBadge priority={issue.priority} />
            </DetailRow>
            <DetailRow icon={<CalendarDays />} label="Due Date">
              <span className="text-sm">{issue.dueDate || "—"}</span>
            </DetailRow>
            <DetailRow icon={<Factory />} label="Plant">
              <span className="text-sm">{issue.plant || "—"}</span>
            </DetailRow>
            <DetailRow icon={<MapPin />} label="Location">
              <span className="text-sm">{issue.location || "—"}</span>
            </DetailRow>
            <DetailRow icon={<Users />} label="Assigned To">
              <span className="flex items-center gap-2">
                {issue.assignedTo ? (
                  <Avatar className="h-6 w-6 cursor-default border-2 border-background" title={issue.assignedTo}>
                    <AvatarFallback className={`text-[10px] ${avatarColor(issue.assignedTo)}`}>
                      {initials(issue.assignedTo)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </span>
            </DetailRow>
          </div>

          {/* Attachments — satu section untuk seluruh lifecycle issue */}
          <DetailRow icon={<Paperclip />} label="Attachments" alignTop>
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
          </DetailRow>

          {/* Description — label di atas, konten full-width */}
          <section className="space-y-2">
            <SectionTitle icon={<AlignLeft />} title="Description" />
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
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
                        <span className="text-xs text-muted-foreground">{c.time ?? c.at}</span>
                      </div>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0">
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

      {/* Ubah assignee */}
      <Dialog open={assigneeOpen} onOpenChange={setAssigneeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah assignee</DialogTitle>
            <DialogDescription>
              Pilih user penanggung jawab, tulis komentar sekalian jika perlu.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>User</FieldLabel>
              <Select value={pendingAssignee} onValueChange={setPendingAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="issue-assignee-comment">Komentar (opsional)</FieldLabel>
              <Textarea
                id="issue-assignee-comment"
                value={assigneeComment}
                onChange={(e) => setAssigneeComment(e.target.value)}
                placeholder="Tulis komentar untuk assignee baru…"
                rows={3}
                className="resize-y"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigneeOpen(false)}>
              Batal
            </Button>
            <Button onClick={submitAssignee} disabled={!pendingAssignee}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
