import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlignLeft,
  ArrowLeft,
  Calendar,
  CircleDot,
  FileText,
  Globe,
  Home,
  ListChecks,
  Lock,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Share2,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, RichTextView, extractMentions, isEmptyHtml, sanitizeRichHtml, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { useIssues, useUsers, useWorks } from "@/hooks/useSupabaseLists";
import { PageSkeleton } from "@/components/page-skeleton";
import { avatarColor, initials, stripHtml } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNotes } from "@/hooks/useNotes";
import {
  addNoteComment,
  addNoteRelation,
  createNote,
  deleteNote,
  deleteNoteComment,
  listNoteComments,
  removeNoteRelationByTarget,
  setNoteVisibility,
  setSharePermission,
  shareNote,
  unshareNote,
  updateNote,
} from "@/lib/api/notes";
import {
  emptyPendingNoteImages,
  finalizeNoteImageDeletions,
  deleteNoteImageFolder,
  persistNoteImages,
  resolveNoteImageUrls,
  type PendingNoteImages,
} from "@/lib/api/noteImages";
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { supabase } from "@/lib/supabase";
import type { Comment, Note, NotePermission, NoteRelatedType, NoteVisibility } from "@/types";

type ListFilter = "all" | "mine" | "shared";

type NoteRelationDraft = {
  relatedType: NoteRelatedType;
  relatedId: string;
  relatedNumber?: string;
  relatedTitle?: string;
};

function previewOf(note: Note): string {
  const plain = stripHtml(note.content || "");
  return plain.slice(0, 120);
}

/** Tag personal/working sudah dihapus — disembunyikan dari tampilan & dibuang saat simpan. */
const REMOVED_NOTE_TAGS = ["personal", "working"] as const;

function visibleTags(tags: string[]): string[] {
  return tags.filter((t) => !(REMOVED_NOTE_TAGS as readonly string[]).includes(t.toLowerCase()));
}

/* ── Share dialog (owner only): visibility Public/Private + per-user permission ── */

function ShareDialog({
  note,
  open,
  onOpenChange,
  onChanged,
}: {
  note: Note | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const { data: users } = useUsers();
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<NoteVisibility>("private");

  useEffect(() => {
    if (open) {
      setQuery("");
      setVisibility(note?.visibility ?? "private");
    }
  }, [open, note?.visibility, note?.id]);

  const candidates = useMemo(() => {
    const sharedIds = new Set((note?.shares ?? []).map((s) => s.userId));
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.id !== note?.ownerId && u.id !== currentUser?.id && !sharedIds.has(u.id))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.username ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, note, query, currentUser?.id]);

  if (!note) return null;

  const doShare = async (userId: string) => {
    setBusy(userId);
    try {
      await shareNote(note.id, userId, "view");
      // Notifikasi ke user yang baru diberi akses (best effort).
      try {
        await pushNotification({
          type: "assignment",
          title: "Note shared with you",
          message: note.title || "Untitled note",
          fromId: currentUser?.id ?? null,
          forUserId: userId,
          link: `/notes?note=${note.id}`,
        });
      } catch {
        /* abaikan — share tetap berhasil */
      }
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const doRevoke = async (userId: string) => {
    setBusy(userId);
    try {
      await unshareNote(note.id, userId);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const doSetPermission = async (userId: string, permission: NotePermission) => {
    setBusy(userId);
    try {
      await setSharePermission(note.id, userId, permission);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const doSetVisibility = async (v: NoteVisibility) => {
    setBusy("__vis__");
    try {
      await setNoteVisibility(note.id, v);
      setVisibility(v);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share Note
          </DialogTitle>
          <DialogDescription>
            Choose who can access this note. Shared users are read-only unless you give Edit.
          </DialogDescription>
        </DialogHeader>

        {/* Visibility: Private / Public */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">General access</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy === "__vis__"}
              onClick={() => doSetVisibility("private")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
                visibility === "private"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/40"
              )}
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">Private</span>
                <span className="block text-[11px] text-muted-foreground">Only people added</span>
              </span>
            </button>
            <button
              type="button"
              disabled={busy === "__vis__"}
              onClick={() => doSetVisibility("public")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
                visibility === "public"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/40"
              )}
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">Public</span>
                <span className="block text-[11px] text-muted-foreground">Anyone can read</span>
              </span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {query.trim() && candidates.length > 0 && (
          <ul className="max-h-48 overflow-y-auto rounded-lg border">
            {candidates.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => doShare(u.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={cn("text-[10px]", avatarColor(u.name))}>
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    {u.username && (
                      <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                    )}
                  </span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">People with access</p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className={cn("text-[10px]", avatarColor(note.ownerName))}>
                  {initials(note.ownerName)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {note.ownerName} {note.ownerId === currentUser?.id && "(you)"}
                </span>
                <span className="block text-xs text-muted-foreground">Owner</span>
              </span>
            </li>
            {note.shares.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/40">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className={cn("text-[10px]", avatarColor(s.userName))}>
                    {initials(s.userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.userName}</span>
                </span>
                <Select
                  value={s.permission}
                  onValueChange={(v) => doSetPermission(s.userId, v as NotePermission)}
                  disabled={busy === s.userId}
                >
                  <SelectTrigger className="h-7 w-[104px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Can view</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === s.userId}
                  onClick={() => doRevoke(s.userId)}
                  className="h-7 px-2 text-xs"
                >
                  Remove
                </Button>
              </li>
            ))}
            {note.shares.length === 0 && (
              <li className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                {visibility === "public"
                  ? "Public — anyone signed in can read this note."
                  : "Only me — this note is private."}
              </li>
            )}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page: 3-column (TIMS sidebar + list + detail) ── */

export function Notes() {
  const { user: currentUser } = useAuth();
  const { data: notes, loading, error, reload } = useNotes();
  const { data: users } = useUsers();
  const { data: works } = useWorks();
  const { data: issues } = useIssues();
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState<ListFilter>("all");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Mode inline: view | create (note baru) | edit (note terpilih)
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftRelations, setDraftRelations] = useState<NoteRelationDraft[]>([]);
  const [draftSaving, setDraftSaving] = useState(false);
  const [relTab, setRelTab] = useState<NoteRelatedType>("task");
  const [relQuery, setRelQuery] = useState("");
  const [relPickerOpen, setRelPickerOpen] = useState(false);
  const editorRef = useRef<RichTextEditorHandle | null>(null);

  // Komentar note
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        // "Shared with me" = readable notes I don't own.
        if (filter === "mine" && !n.isOwner) return false;
        if (filter === "shared" && n.isOwner) return false;
        if (tagFilter && !n.tags.includes(tagFilter)) return false;
        if (!q) return true;
        const hay = `${n.title}\n${stripHtml(n.content)}\n${visibleTags(n.tags).join(" ")}\n${n.ownerName}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => +new Date(b.rawUpdatedAt) - +new Date(a.rawUpdatedAt));
  }, [notes, filter, query, tagFilter]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of visibleTags(n.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [notes]);

  const counts = useMemo(
    () => ({
      mine: notes.filter((n) => n.isOwner).length,
      shared: notes.filter((n) => !n.isOwner).length,
    }),
    [notes]
  );

  const selected: Note | null = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  // Keep selection valid when notes change
  useEffect(() => {
    if (selectedId && !notes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  const contentRef = useRef<HTMLDivElement>(null);

  // Resolve image signed URLs saat note dipilih
  useEffect(() => {
    if (contentRef.current && selected) {
      resolveNoteImageUrls(contentRef.current);
    }
  }, [selected]);

  // Deep link dari Task/Issue detail: /notes?note=<id>
  useEffect(() => {
    const target = searchParams.get("note");
    if (target && notes.some((n) => n.id === target)) setSelectedId(target);
  }, [searchParams, notes]);

  // Load komentar saat note dipilih (reset saat pindah note) + realtime.
  useEffect(() => {
    setCommentDraft("");
    if (!selected) {
      setComments([]);
      return;
    }
    let alive = true;
    const load = () => {
      listNoteComments(selected.id)
        .then(({ comments: c }) => {
          if (alive) setComments(c);
        })
        .catch(() => {
          if (alive) setComments([]);
        });
    };
    load();
    const channel = supabase
      .channel(`rt-note-comments-${selected.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `owner_id=eq.${selected.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const clean = commentDraft.trim();
    if (!clean || !selected || !currentUser) return;
    setCommentBusy(true);
    try {
      await addNoteComment(selected.id, currentUser.id, clean);
      try {
        await notifyMentions({
          content: clean,
          users,
          fromId: currentUser.id,
          fromName: currentUser.name,
          title: "You were mentioned in a note",
          message: clean.length > 80 ? `${clean.slice(0, 80)}…` : clean,
          link: `/notes?note=${selected.id}`,
        });
      } catch {
        /* abaikan — komentar tetap terkirim */
      }
      setCommentDraft("");
      if (commentInputRef.current) commentInputRef.current.style.height = "auto";
      const { comments: c } = await listNoteComments(selected.id);
      setComments(c);
    } finally {
      setCommentBusy(false);
    }
  };

  const removeComment = async (commentId: string) => {
    if (!selected) return;
    await deleteNoteComment(commentId);
    const { comments: c } = await listNoteComments(selected.id);
    setComments(c);
  };

  const isEditing = mode === "create" || (mode === "edit" && !!selected);

  const startCreate = () => {
    setDraftTitle("");
    setDraftContent("");
    setDraftRelations([]);
    setRelTab("task");
    setRelQuery("");
    setRelPickerOpen(false);
    setDraftSaving(false);
    editorRef.current?.resetPendingImages();
    setSelectedId(null);
    setMode("create");
  };

  const startEdit = () => {
    if (!selected) return;
    setDraftTitle(selected.title);
    setDraftContent(selected.content);
    setDraftRelations(
      selected.relations.map((r) => ({
        relatedType: r.relatedType,
        relatedId: r.relatedId,
        relatedNumber: r.relatedNumber,
        relatedTitle: r.relatedTitle,
      }))
    );
    setRelTab("task");
    setRelQuery("");
    setRelPickerOpen(false);
    setDraftSaving(false);
    editorRef.current?.resetPendingImages();
    setMode("edit");
  };

  const cancelEdit = () => {
    setMode("view");
    setDraftSaving(false);
    setRelPickerOpen(false);
    editorRef.current?.resetPendingImages();
  };

  const draftAddedKeys = useMemo(
    () => new Set(draftRelations.map((r) => `${r.relatedType}:${r.relatedId}`)),
    [draftRelations]
  );

  const relResults = useMemo(() => {
    const q = relQuery.trim().toLowerCase();
    if (relTab === "task") {
      return works
        .filter((w) => !draftAddedKeys.has(`task:${w.id}`))
        .filter(
          (w) =>
            !q ||
            w.title.toLowerCase().includes(q) ||
            w.number.toLowerCase().includes(q)
        )
        .slice(0, 6);
    }
    return issues
      .filter((i) => !draftAddedKeys.has(`issue:${i.id}`))
      .filter(
        (i) =>
          !q || i.title.toLowerCase().includes(q) || i.number.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [relTab, relQuery, works, issues, draftAddedKeys]);

  const addDraftRelation = (type: NoteRelatedType, id: string) => {
    if (draftAddedKeys.has(`${type}:${id}`)) return;
    if (type === "task") {
      const w = works.find((x) => x.id === id);
      if (!w) return;
      setDraftRelations((prev) => [
        ...prev,
        { relatedType: type, relatedId: id, relatedNumber: w.number, relatedTitle: w.title },
      ]);
    } else {
      const i = issues.find((x) => x.id === id);
      if (!i) return;
      setDraftRelations((prev) => [
        ...prev,
        { relatedType: type, relatedId: id, relatedNumber: i.number, relatedTitle: i.title },
      ]);
    }
  };

  const removeDraftRelation = (type: NoteRelatedType, id: string) => {
    setDraftRelations((prev) =>
      prev.filter((x) => !(x.relatedType === type && x.relatedId === id))
    );
  };

  const canSaveDraft = draftTitle.trim().length > 0 || !isEmptyHtml(draftContent);

  const saveDraft = async () => {
    if (!currentUser || draftSaving || !canSaveDraft) return;
    setDraftSaving(true);
    try {
      const images: PendingNoteImages =
        editorRef.current?.getPendingImages() ?? emptyPendingNoteImages();
      if (mode === "create") {
        const note = await createNote({
          title: draftTitle.trim() || "Untitled note",
          content: draftContent,
          tags: [],
          ownerId: currentUser.id,
          ownerName: currentUser.name,
        });
        // Upload semua gambar ke path asli noteId, lalu simpan HTML final (storage key).
        const content = await persistNoteImages(note.content, images, {
          userId: currentUser.id,
          noteId: note.id,
        });
        await updateNote(note.id, { content });
        for (const r of draftRelations) {
          await addNoteRelation(note.id, r.relatedType, r.relatedId);
        }
        try {
          await notifyMentions({
            content: draftContent,
            users,
            fromId: currentUser.id,
            fromName: currentUser.name,
            title: "You were mentioned in a note",
            message: (draftTitle.trim() || "Note").slice(0, 80),
            link: `/notes?note=${note.id}`,
          });
        } catch {
          /* abaikan — note tetap tersimpan */
        }
        reload();
        setFilter("all");
        setQuery("");
        setTagFilter(null);
        setSelectedId(note.id);
        setMode("view");
      } else if (mode === "edit" && selected && selected.isOwner) {
        const content = await persistNoteImages(draftContent, images, {
          userId: selected.ownerId,
          noteId: selected.id,
        });
        await updateNote(selected.id, {
          title: draftTitle.trim() || "Untitled note",
          content,
          tags: visibleTags(selected.tags),
        });
        // Sinkronkan relasi: tambah yang baru, hapus yang dibuang.
        const prevKeys = new Set(
          selected.relations.map((r) => `${r.relatedType}:${r.relatedId}`)
        );
        const nextKeys = new Set(
          draftRelations.map((r) => `${r.relatedType}:${r.relatedId}`)
        );
        for (const r of draftRelations) {
          if (!prevKeys.has(`${r.relatedType}:${r.relatedId}`)) {
            await addNoteRelation(selected.id, r.relatedType, r.relatedId);
          }
        }
        for (const r of selected.relations) {
          if (!nextKeys.has(`${r.relatedType}:${r.relatedId}`)) {
            await removeNoteRelationByTarget(selected.id, r.relatedType, r.relatedId);
          }
        }
        // Hapus file storage gambar yang dibuang
        await finalizeNoteImageDeletions(images.removedPaths);
        // Mention notifications (best effort, future behavior hook)
        try {
          await notifyMentions({
            content: draftContent,
            users,
            fromId: currentUser?.id ?? null,
            fromName: currentUser?.name,
            title: "You were mentioned in a note",
            message: (draftTitle.trim() || "Note").slice(0, 80),
            link: "/notes",
          });
        } catch {
          /* abaikan */
        }
        reload();
        setMode("view");
      }
    } finally {
      setDraftSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    // Hapus seluruh folder gambar note (best effort) sebelum baris note dihapus.
    await deleteNoteImageFolder(selected.ownerId, selected.id);
    await deleteNote(selected.id);
    setDeleteOpen(false);
    setSelectedId(null);
    reload();
  };

  if (loading) return <PageSkeleton />;

  /* ── Pane editor inline (create / edit): judul + editor + related + Save ── */
  const editPane = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 lg:hidden"
              onClick={cancelEdit}
              aria-label="Back to notes list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <Link
                  to="/"
                  aria-label="Home"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Home className="h-4 w-4" />
                </Link>
                <span className="shrink-0 text-sm text-muted-foreground/50">/</span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Notes
                </button>
                <span className="shrink-0 text-sm text-muted-foreground/50">/</span>
                <span className="min-w-0 flex-1 text-sm font-medium break-words">
                  {draftTitle || "Untitled note"}
                </span>
              </div>
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Note title..."
                autoComplete="off"
                aria-label="Note title"
                className="mt-1 border-transparent bg-transparent px-0 text-xl font-bold shadow-none focus-visible:border-input md:text-2xl"
              />
            </div>
          </div>
          {/* Mode edit: tombol Save (ganti Share) + Cancel, tanpa tombol ... */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canSaveDraft || draftSaving} onClick={() => void saveDraft()}>
              <span className="hidden sm:inline">
                {draftSaving ? "Saving..." : mode === "create" ? "Save" : "Update"}
              </span>
            </Button>
          </div>
        </div>
        <hr className="border-border" />
      </div>

      {/* Content — formatting via klik kanan, tanpa toolbar */}
      <div className="-mt-2">
        <RichTextEditor
          ref={editorRef}
          value={draftContent}
          onChange={setDraftContent}
          users={users.map((u) => u.name)}
          placeholder="Write something... Right-click for formatting. Use @ to mention, insert tables and images..."
          height={320}
          imageSupport
          toolbar={false}
          autoHeight
          inlineBar
        />
      </div>

      {/* Pembatas area isi note */}
      <hr className="border-border" />

      {/* Related Tasks / Issues — posisi sama seperti view */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Related</h3>
          {draftRelations.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {draftRelations.length}
            </Badge>
          )}
        </div>
        {draftRelations.length > 0 && (
          <ul className="space-y-1.5">
            {draftRelations.map((r) => (
              <li
                key={`${r.relatedType}:${r.relatedId}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                {r.relatedType === "task" ? (
                  <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.relatedTitle ?? r.relatedId}
                  </span>
                  {r.relatedNumber && (
                    <span className="block font-mono text-xs text-muted-foreground">
                      {r.relatedType === "task" ? "TASK" : "ISS"} — {r.relatedNumber}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label="Remove relation"
                  onClick={() => removeDraftRelation(r.relatedType, r.relatedId)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {relPickerOpen || draftRelations.length === 0 ? (
          <div className="space-y-2">
            <Tabs value={relTab} onValueChange={(v) => setRelTab(v as NoteRelatedType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="task">Task</TabsTrigger>
                <TabsTrigger value="issue">Issue</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={relQuery}
                onChange={(e) => setRelQuery(e.target.value)}
                placeholder={relTab === "task" ? "Search tasks..." : "Search issues..."}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {relResults.map((r) =>
                relTab === "task" ? (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => addDraftRelation("task", r.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {r.number}
                        </span>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={(r as { id: string }).id}>
                    <button
                      type="button"
                      onClick={() => addDraftRelation("issue", (r as { id: string }).id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <CircleDot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {(r as { title: string }).title}
                        </span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {(r as { number: string }).number}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              )}
              {relResults.length === 0 && (
                <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No {relTab === "task" ? "tasks" : "issues"} found.
                </li>
              )}
            </ul>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setRelPickerOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        )}
      </section>
    </div>
  );

  const listPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <h2 className="text-lg font-semibold tracking-tight">Notes</h2>
      {/* Sejajar dengan kartu list (inset kanan sama seperti area scroll) */}
      <div className="overflow-hidden pr-2 [scrollbar-gutter:stable]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes..."
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <Button onClick={startCreate} disabled={!currentUser} size="sm" className="shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Note</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Sejajar dengan kartu list (inset kanan sama seperti area scroll) */}
      <div className="overflow-hidden pr-2 [scrollbar-gutter:stable]">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ListFilter)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">My Notes{counts.mine > 0 ? ` (${counts.mine})` : ""}</TabsTrigger>
            <TabsTrigger value="shared">Shared{counts.shared > 0 ? ` (${counts.shared})` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(([t, c]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTagFilter((prev) => (prev === t ? null : t))}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                tagFilter === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              #{t}
              <span className="opacity-60">{c}</span>
            </button>
          ))}
          {tagFilter && (
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto pr-2 pb-2 [scrollbar-gutter:stable]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
            <NotebookPen className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No notes found</p>
            <p className="text-xs text-muted-foreground">
              {query || tagFilter ? "Try a different search or tag." : "Create your first private note."}
            </p>
            {!query && !tagFilter && (
              <Button variant="outline" size="sm" onClick={startCreate}>
                <Plus className="h-4 w-4" /> New Note
              </Button>
            )}
          </div>
        ) : (
          filtered.map((n) => {
            const active = n.id === selectedId;
            const vt = visibleTags(n.tags);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (isEditing) cancelEdit();
                  setSelectedId(n.id);
                }}
                className={cn(
                  "group w-full rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/30 hover:bg-muted/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {n.title || "Untitled note"}
                  </p>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      n.shared
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                        : "bg-muted text-muted-foreground"
                    )}
                    title={n.shared ? "Shared" : "Private"}
                  >
                    {n.shared ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {n.shared ? "Shared" : "Private"}
                  </span>
                </div>
                {previewOf(n) && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {previewOf(n)}
                  </p>
                )}
                {vt.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {vt.slice(0, 4).map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                    {vt.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{vt.length - 4}</span>
                    )}
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{n.isOwner ? "You" : n.ownerName}</span>
                  </span>
                  <span className="shrink-0">{n.updatedAt}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const detailPane = selected ? (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Header: [Home / Notes / Title]                        [Share] [...] */}
      {/*         [Author • datetime]                                         */}
      {(() => {
        return (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 lg:hidden"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to notes list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <Link
                      to="/"
                      aria-label="Home"
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Home className="h-4 w-4" />
                    </Link>
                    <span className="shrink-0 text-sm text-muted-foreground/50">/</span>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Notes
                    </button>
                    <span className="shrink-0 text-sm text-muted-foreground/50">/</span>
                    <span className="min-w-0 flex-1 text-sm font-medium break-words">
                      {selected.title || "Untitled note"}
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold break-words md:text-2xl">
                    {selected.title || "Untitled note"}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {selected.isOwner ? "You" : selected.ownerName}
                      </span>
                    </span>
                    <span aria-hidden>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{selected.updatedAt}</span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                        selected.visibility === "public"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : selected.shared
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {selected.visibility === "public" ? (
                        <Globe className="h-3 w-3" />
                      ) : selected.shared ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {selected.visibility === "public"
                        ? "Public"
                        : selected.shared
                          ? "Shared"
                          : "Only me"}
                    </span>
                    {!selected.canEdit && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                        Read-only
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {(selected.isOwner || selected.canEdit) && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {selected.isOwner && (
                    <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                      <Share2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={startEdit}>
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      {selected.isOwner && (
                        <DropdownMenuItem
                          onClick={() => setDeleteOpen(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <hr className="border-border" />
          </div>
        );
      })()}

      {/* Content (read-only view — edit lewat pop-up) */}
      <div className="min-h-0">
        <div
          ref={contentRef}
          className="rich-content text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(selected.content || "") }}
        />
      </div>

      {/* Related Tasks / Issues */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Related</h3>
          {selected.relations.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {selected.relations.length}
            </Badge>
          )}
        </div>
        {selected.relations.length === 0 ? (
          selected.isOwner || selected.canEdit ? (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">No related Tasks or Issues yet.</p>
          )
        ) : (
          <div className="space-y-3">
            {(["task", "issue"] as NoteRelatedType[]).map((kind) => {
              const items = selected.relations.filter((r) => r.relatedType === kind);
              if (items.length === 0) return null;
              return (
                <div key={kind} className="space-y-1.5">
                  <p className="text-xs font-medium capitalize text-muted-foreground">
                    {kind === "task" ? "Task" : "Issue"}
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        {kind === "task" ? (
                          <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <Link
                          to={kind === "task" ? `/tasks/${r.relatedNumber}` : `/issues/${r.relatedNumber}`}
                          className="min-w-0 flex-1 hover:underline"
                        >
                          <span className="block truncate font-medium">
                            {r.relatedTitle ?? r.relatedId}
                          </span>
                          {r.relatedNumber && (
                            <span className="block font-mono text-xs text-muted-foreground">
                              {kind === "task" ? "TASK" : "ISS"} — {r.relatedNumber}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Comments — semua user yang bisa baca note boleh komentar */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Comments</h3>
          {comments.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {comments.length}
            </Badge>
          )}
        </div>

        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet. Be the first to comment.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                  <AvatarFallback className={cn("text-[10px]", avatarColor(c.author))}>
                    {initials(c.author)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.author}</span>
                    {(c.time || c.at) && (
                      <span className="text-xs text-muted-foreground">{c.time ?? c.at}</span>
                    )}
                    {c.author === currentUser?.name && (
                      <button
                        type="button"
                        onClick={() => removeComment(c.id)}
                        className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                    {renderWithMentions(c.text)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={commentInputRef}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void postComment();
              }
            }}
            placeholder="Write a comment… use @ to mention"
            rows={2}
            className="min-h-[44px] resize-none text-sm"
          />
          <Button
            size="sm"
            disabled={commentBusy || !commentDraft.trim()}
            onClick={() => void postComment()}
            className="shrink-0"
          >
            <SendHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </section>

      {/* Mentions hint */}
      {extractMentions(selected.content).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Mentioned: {extractMentions(selected.content).map((m) => `@${m}`).join(", ")}
        </p>
      )}
    </div>
  ) : (
    <div className="hidden min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center lg:flex">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <NotebookPen className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-semibold">Select a note to view</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Notes are private by default. Share them explicitly when you need others to read.
      </p>
      <Button variant="outline" size="sm" onClick={startCreate}>
        <Plus className="h-4 w-4" /> New Note
      </Button>
    </div>
  );

  const showDetail = !!selectedId || mode !== "view";

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:-mt-4 lg:h-[calc(100svh-4.5rem)] lg:flex-row lg:gap-1 lg:overflow-hidden">
      {/* Mobile: list-first — show list OR detail */}
      <div className={cn("lg:hidden", showDetail ? "hidden" : "flex flex-col")}>{!showDetail && listPane}</div>
      <div className={cn("min-h-0 flex-1 lg:hidden", showDetail ? "block" : "hidden")}>
        {showDetail && (isEditing ? editPane : detailPane)}
      </div>
      {/* Desktop: side by side */}
      <div className="hidden min-h-0 min-w-0 lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:overflow-y-auto">
        {listPane}
      </div>
      {/* Garis vertikal pemisah list & isi note */}
      <div aria-hidden className="hidden w-px shrink-0 self-stretch bg-border lg:block" />
      <div className="hidden min-h-0 min-w-0 flex-1 lg:block lg:overflow-y-auto lg:p-5">
        {isEditing ? editPane : detailPane}
      </div>

      <ShareDialog note={selected} open={shareOpen} onOpenChange={setShareOpen} onChanged={reload} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete “{selected?.title || "Untitled note"}”? This cannot be
              undone. Shares and relations will be removed as well.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
