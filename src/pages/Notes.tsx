import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleDot,
  FileText,
  ListChecks,
  Lock,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextView, extractMentions, sanitizeRichHtml } from "@/components/rich-text-editor";
import { NoteFormDialog, type NoteFormValues } from "@/components/note-form-dialog";
import { PageSkeleton } from "@/components/page-skeleton";
import { avatarColor, initials, stripHtml } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNotes } from "@/hooks/useNotes";
import { useUsers } from "@/hooks/useSupabaseLists";
import {
  addNoteRelation,
  createNote,
  deleteNote,
  removeNoteRelationByTarget,
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
import type { Note, NoteRelatedType } from "@/types";

type ListFilter = "all" | "mine" | "shared";

function previewOf(note: Note): string {
  const plain = stripHtml(note.content || "");
  return plain.slice(0, 120);
}

const NOTE_CATEGORIES = ["personal", "working"] as const;

/** Kategori = tag khusus personal/working. Return lowercase atau null. */
function categoryOf(note: Note): string | null {
  const found = note.tags.find((t) => NOTE_CATEGORIES.includes(t.toLowerCase() as (typeof NOTE_CATEGORIES)[number]));
  return found ? found.toLowerCase() : null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Share dialog (owner only, read-only "Can view") ── */

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

  useEffect(() => {
    if (open) setQuery("");
  }, [open ]);

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
      await shareNote(note.id, userId);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share Note
          </DialogTitle>
          <DialogDescription>
            Shared users have read-only access. New notes are private by default.
          </DialogDescription>
        </DialogHeader>
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
                  <span className="block text-xs text-muted-foreground">Can view</span>
                </span>
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
                <Lock className="h-3.5 w-3.5" /> Only me — this note is private.
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
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState<ListFilter>("all");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        // "Shared with me" = readable notes I don't own.
        if (filter === "mine" && !n.isOwner) return false;
        if (filter === "shared" && n.isOwner) return false;
        if (tagFilter && !n.tags.includes(tagFilter)) return false;
        if (!q) return true;
        const hay = `${n.title}\n${stripHtml(n.content)}\n${n.tags.join(" ")}\n${n.ownerName}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => +new Date(b.rawUpdatedAt) - +new Date(a.rawUpdatedAt));
  }, [notes, filter, query, tagFilter]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
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

  const handleCreate = () => {
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (v: NoteFormValues) => {
    if (!currentUser) return;
    const images: PendingNoteImages = v.images ?? emptyPendingNoteImages();
    const note = await createNote({
      title: v.title,
      content: v.content,
      tags: v.tags,
      ownerId: currentUser.id,
      ownerName: currentUser.name,
    });
    // Upload semua gambar ke path asli noteId, lalu simpan HTML final (R2 key).
    const content = await persistNoteImages(note.content, images, {
      userId: currentUser.id,
      noteId: note.id,
    });
    await updateNote(note.id, { content });
    for (const r of v.relations) {
      await addNoteRelation(note.id, r.relatedType, r.relatedId);
    }
    reload();
    setFilter("all");
    setQuery("");
    setTagFilter(null);
    setSelectedId(note.id);
  };

  const handleEditSubmit = async (v: NoteFormValues) => {
    if (!selected || !selected.isOwner) return;
    const images: PendingNoteImages = v.images ?? emptyPendingNoteImages();
    const content = await persistNoteImages(v.content, images, {
      userId: selected.ownerId,
      noteId: selected.id,
    });
    await updateNote(selected.id, {
      title: v.title,
      content,
      tags: v.tags,
    });
    // Sinkronkan relasi: tambah yang baru, hapus yang dibuang di pop-up.
    const prevKeys = new Set(
      selected.relations.map((r) => `${r.relatedType}:${r.relatedId}`)
    );
    const nextKeys = new Set(
      v.relations.map((r) => `${r.relatedType}:${r.relatedId}`)
    );
    for (const r of v.relations) {
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
        content: v.content,
        users,
        fromId: currentUser?.id ?? null,
        fromName: currentUser?.name,
        title: "You were mentioned in a note",
        message: (v.title || "Note").slice(0, 80),
        link: "/notes",
      });
    } catch {
      /* abaikan */
    }
    reload();
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

  const listPane = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-none lg:w-[340px] lg:shrink-0">
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
        <Button onClick={handleCreate} disabled={!currentUser} size="sm" className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Note</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as ListFilter)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">My Notes{counts.mine > 0 ? ` (${counts.mine})` : ""}</TabsTrigger>
          <TabsTrigger value="shared">Shared{counts.shared > 0 ? ` (${counts.shared})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

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

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
            <NotebookPen className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No notes found</p>
            <p className="text-xs text-muted-foreground">
              {query || tagFilter ? "Try a different search or tag." : "Create your first private note."}
            </p>
            {!query && !tagFilter && (
              <Button variant="outline" size="sm" onClick={handleCreate}>
                <Plus className="h-4 w-4" /> New Note
              </Button>
            )}
          </div>
        ) : (
          filtered.map((n) => {
            const active = n.id === selectedId;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedId(n.id)}
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
                {n.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {n.tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                    {n.tags.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{n.tags.length - 4}</span>
                    )}
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{n.isOwner ? "You" : n.ownerName}</span>
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
      {/* Header: [Category / Title (H2)]                    [Share] [...] */}
      {/*         [Author • datetime]                                         */}
      {(() => {
        const category = categoryOf(selected);
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
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {category && (
                      <>
                        <span className="shrink-0 text-sm font-medium text-muted-foreground capitalize">
                          # {capitalize(category)}
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground/50">/</span>
                      </>
                    )}
                    <span className="min-w-0 flex-1 text-sm font-medium break-words">
                      {selected.title || "Untitled note"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback
                          className={cn("text-[8px]", avatarColor(selected.ownerName))}
                        >
                          {initials(selected.ownerName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground/80">
                        {selected.isOwner ? "You" : selected.ownerName}
                      </span>
                    </span>
                    <span aria-hidden>•</span>
                    <span>{selected.updatedAt}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                        selected.shared
                          ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {selected.shared ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {selected.shared ? "Shared" : "Only me"}
                    </span>
                    {!selected.isOwner && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                        Read-only
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-xl font-bold break-words md:text-2xl">
                    {selected.title || "Untitled note"}
                  </h2>
                </div>
              </div>
              {selected.isOwner && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
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
          <p className="text-xs text-muted-foreground">No related Tasks or Issues yet.</p>
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
      <Button variant="outline" size="sm" onClick={handleCreate}>
        <Plus className="h-4 w-4" /> New Note
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-5.5rem)] lg:flex-row lg:overflow-hidden">
      {/* Mobile: list-first — show list OR detail */}
      <div className={cn("lg:hidden", selectedId ? "hidden" : "flex flex-col")}>{!selectedId && listPane}</div>
      <div className={cn("min-h-0 flex-1 lg:hidden", selectedId ? "block" : "hidden")}>
        {selectedId && detailPane}
      </div>
      {/* Desktop: side by side */}
      <div className="hidden min-h-0 lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:pr-1">
        {listPane}
      </div>
      <div className="hidden min-h-0 flex-1 lg:block lg:overflow-y-auto lg:rounded-xl lg:border lg:p-5">
        {detailPane}
      </div>

      <ShareDialog note={selected} open={shareOpen} onOpenChange={setShareOpen} onChanged={reload} />

      {/* New Note — pop-up */}
      <NoteFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        dialogTitle="New Note"
        submitLabel="Create"
        onSubmit={handleCreateSubmit}
      />

      {/* Edit Note — pop-up (owner only) */}
      <NoteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        dialogTitle="Edit Note"
        initial={
          selected
            ? {
                title: selected.title,
                content: selected.content,
                tags: selected.tags,
                relations: selected.relations,
              }
            : undefined
        }
        onSubmit={handleEditSubmit}
      />

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
