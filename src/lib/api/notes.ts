import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import { makeNameMap, nameOf } from "./mappers";
import type { Comment, Note, NotePermission, NoteRelatedType, NoteRelation, NoteShare, NoteVisibility } from "@/types";

interface NoteRow {
  id: string;
  owner_id: string | null;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  visibility: string | null;
  created_at: string;
  updated_at: string;
}

interface ShareRow {
  id: string;
  note_id: string;
  user_id: string;
  permission: string;
  created_at: string;
}

interface RelationRow {
  id: string;
  note_id: string;
  related_type: string;
  related_id: string;
  created_at: string;
}

function missingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /could not find the table|relation .* does not exist|42P01/i.test(msg);
}

/* ── Local fallback (dipakai bila Supabase belum dikonfigurasi / tabel belum ada) ── */

const LS_KEY = "tims.notes.v1";

type LocalNote = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  content: string;
  tags: string[];
  visibility?: NoteVisibility;
  shares: { userId: string; userName: string; permission?: NotePermission }[];
  relations: { relatedType: NoteRelatedType; relatedId: string; relatedNumber?: string; relatedTitle?: string }[];
  createdAt: string;
  updatedAt: string;
};

function loadLocal(): LocalNote[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalNote[];
  } catch {
    return [];
  }
}

function saveLocal(notes: LocalNote[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(notes));
  } catch {
    /* abaikan */
  }
}

function toNoteFromLocal(
  l: LocalNote,
  currentUserId: string | undefined
): Note {
  const isOwner = !currentUserId || l.ownerId === currentUserId;
  const myShare = currentUserId ? l.shares.find((s) => s.userId === currentUserId) : undefined;
  const canEdit = isOwner || myShare?.permission === "edit";
  return {
    id: l.id,
    ownerId: l.ownerId,
    ownerName: l.ownerName,
    title: l.title,
    content: l.content,
    tags: l.tags,
    shared: l.shares.length > 0,
    isOwner,
    canEdit,
    visibility: l.visibility ?? "private",
    shares: l.shares.map((s) => ({
      id: `${l.id}:${s.userId}`,
      userId: s.userId,
      userName: s.userName,
      permission: s.permission === "edit" ? "edit" : "view",
      createdAt: l.updatedAt,
    })),
    relations: l.relations.map((r, i) => ({
      id: `${l.id}:rel:${i}`,
      relatedType: r.relatedType,
      relatedId: r.relatedId,
      relatedNumber: r.relatedNumber,
      relatedTitle: r.relatedTitle,
      createdAt: l.updatedAt,
    })),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    rawCreatedAt: l.createdAt,
    rawUpdatedAt: l.updatedAt,
  };
}

/* ── Supabase mapping ─────────────────────────────────────────── */

function rowToNote(
  row: NoteRow,
  names: Map<string, string>,
  sharesByNote: Map<string, ShareRow[]>,
  relationsByNote: Map<string, RelationRow[]>,
  workMeta: Map<string, { number: string; title: string }>,
  issueMeta: Map<string, { number: string; title: string }>,
  currentUserId?: string
): Note {
  const shares: NoteShare[] = (sharesByNote.get(row.id) ?? []).map((s) => ({
    id: s.id,
    userId: s.user_id,
    userName: nameOf(names, s.user_id, "—"),
    permission: s.permission === "edit" ? "edit" : "view",
    createdAt: formatDateTime(s.created_at),
  }));
  const relations: NoteRelation[] = (relationsByNote.get(row.id) ?? []).map((r) => {
    const meta =
      r.related_type === "issue" ? issueMeta.get(r.related_id) : workMeta.get(r.related_id);
    return {
      id: r.id,
      relatedType: r.related_type as NoteRelatedType,
      relatedId: r.related_id,
      relatedNumber: meta?.number,
      relatedTitle: meta?.title,
      createdAt: formatDateTime(r.created_at),
    };
  });
  const ownerId = row.owner_id ?? "";
  const isOwner = currentUserId ? ownerId === currentUserId : true;
  const myShare = currentUserId
    ? shares.find((s) => s.userId === currentUserId)
    : undefined;
  return {
    id: row.id,
    ownerId,
    ownerName: nameOf(names, row.owner_id, "—"),
    title: row.title ?? "",
    content: row.content ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    shared: shares.length > 0,
    isOwner,
    canEdit: isOwner || myShare?.permission === "edit",
    visibility: row.visibility === "public" ? "public" : "private",
    shares,
    relations,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    rawCreatedAt: row.created_at,
    rawUpdatedAt: row.updated_at,
  };
}

export async function listNotes(currentUserId?: string): Promise<Note[]> {
  if (!isSupabaseConfigured) {
    return loadLocal()
      .filter((n) => !currentUserId || n.ownerId === currentUserId || n.shares.some((s) => s.userId === currentUserId))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .map((l) => toNoteFromLocal(l, currentUserId));
  }

  let rows: NoteRow[];
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("id, owner_id, title, content, tags, visibility, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    rows = (data ?? []) as NoteRow[];
  } catch (e) {
    if (missingTable(e)) {
      return loadLocal()
        .filter((n) => !currentUserId || n.ownerId === currentUserId || n.shares.some((s) => s.userId === currentUserId))
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .map((l) => toNoteFromLocal(l, currentUserId));
    }
    throw e;
  }

  const ids = rows.map((r) => r.id);
  const [{ data: profiles }, shareRes, relRes, worksRes, issuesRes] = await Promise.all([
    supabase.from("profiles").select("id, name"),
    ids.length
      ? supabase.from("note_shares").select("id, note_id, user_id, permission, created_at").in("note_id", ids)
      : Promise.resolve({ data: [] as ShareRow[] }),
    ids.length
      ? supabase.from("note_relations").select("id, note_id, related_type, related_id, created_at").in("note_id", ids)
      : Promise.resolve({ data: [] as RelationRow[] }),
    supabase.from("works").select("id, number, title"),
    supabase.from("issues").select("id, number, title"),
  ]);

  const names = makeNameMap(profiles as { id: string; name: string }[] | null);
  const sharesByNote = new Map<string, ShareRow[]>();
  for (const s of ((shareRes.data ?? []) as ShareRow[])) {
    if (!sharesByNote.has(s.note_id)) sharesByNote.set(s.note_id, []);
    sharesByNote.get(s.note_id)!.push(s);
  }
  const relationsByNote = new Map<string, RelationRow[]>();
  for (const r of ((relRes.data ?? []) as RelationRow[])) {
    if (!relationsByNote.has(r.note_id)) relationsByNote.set(r.note_id, []);
    relationsByNote.get(r.note_id)!.push(r);
  }
  const workMeta = new Map(
    ((worksRes.data ?? []) as { id: string; number: string; title: string }[]).map((w) => [
      w.id,
      { number: w.number, title: w.title },
    ])
  );
  const issueMeta = new Map(
    ((issuesRes.data ?? []) as { id: string; number: string; title: string }[]).map((w) => [
      w.id,
      { number: w.number, title: w.title },
    ])
  );

  return rows.map((row) =>
    rowToNote(row, names, sharesByNote, relationsByNote, workMeta, issueMeta, currentUserId)
  );
}

export async function createNote(input: {
  title: string;
  content: string;
  tags: string[];
  ownerId: string;
  ownerName: string;
}): Promise<Note> {
  const now = new Date().toISOString();
  if (!isSupabaseConfigured) {
    const all = loadLocal();
    const entry: LocalNote = {
      id: `local-${Date.now()}`,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      title: input.title,
      content: input.content,
      tags: input.tags,
      shares: [],
      relations: [],
      createdAt: now,
      updatedAt: now,
    };
    saveLocal([entry, ...all]);
    return toNoteFromLocal(entry, input.ownerId);
  }
  try {
    const { data, error } = await supabase
      .from("notes")
      .insert({ owner_id: input.ownerId, title: input.title, content: input.content, tags: input.tags })
      .select("id, owner_id, title, content, tags, visibility, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    const [note] = await listNotes(input.ownerId).then((all) =>
      all.filter((n) => n.id === (data as NoteRow).id)
    );
    if (note) return note;
    const row = data as NoteRow;
    return {
      id: row.id,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      title: row.title ?? input.title,
      content: row.content ?? input.content,
      tags: row.tags ?? input.tags,
      shared: false,
      isOwner: true,
      canEdit: true,
      visibility: row.visibility === "public" ? "public" : "private",
      shares: [],
      relations: [],
      createdAt: formatDateTime(row.created_at),
      updatedAt: formatDateTime(row.updated_at),
      rawCreatedAt: row.created_at,
      rawUpdatedAt: row.updated_at,
    };
  } catch (e) {
    if (missingTable(e)) {
      const all = loadLocal();
      const entry: LocalNote = {
        id: `local-${Date.now()}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        title: input.title,
        content: input.content,
        tags: input.tags,
        shares: [],
        relations: [],
        createdAt: now,
        updatedAt: now,
      };
      saveLocal([entry, ...all]);
      return toNoteFromLocal(entry, input.ownerId);
    }
    throw e;
  }
}

export async function updateNote(
  id: string,
  patch: Partial<{ title: string; content: string; tags: string[] }>
): Promise<void> {
  if (id.startsWith("local-") || !isSupabaseConfigured) {
    const all = loadLocal();
    const next = all.map((n) =>
      n.id === id
        ? {
            ...n,
            title: patch.title ?? n.title,
            content: patch.content ?? n.content,
            tags: patch.tags ?? n.tags,
            updatedAt: new Date().toISOString(),
          }
        : n
    );
    saveLocal(next);
    return;
  }
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.content !== undefined) dbPatch.content = patch.content;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from("notes").update(dbPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteNote(id: string): Promise<void> {
  if (id.startsWith("local-") || !isSupabaseConfigured) {
    saveLocal(loadLocal().filter((n) => n.id !== id));
    return;
  }
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Sharing (owner-only; shared users read-only) ── */

export async function shareNote(
  noteId: string,
  userId: string,
  permission: NotePermission = "view"
): Promise<void> {
  if (noteId.startsWith("local-") || !isSupabaseConfigured) {
    const all = loadLocal();
    saveLocal(
      all.map((n) =>
        n.id === noteId
          ? {
              ...n,
              shares: n.shares.some((s) => s.userId === userId)
                ? n.shares.map((s) => (s.userId === userId ? { ...s, permission } : s))
                : [...n.shares, { userId, userName: userId, permission }],
              updatedAt: new Date().toISOString(),
            }
          : n
      )
    );
    return;
  }
  const { error } = await supabase
    .from("note_shares")
    .upsert({ note_id: noteId, user_id: userId, permission }, { onConflict: "note_id,user_id" });
  if (error) throw new Error(error.message);
}

/** Ubah permission share yang sudah ada (view ↔ edit). */
export async function setSharePermission(
  noteId: string,
  userId: string,
  permission: NotePermission
): Promise<void> {
  if (noteId.startsWith("local-") || !isSupabaseConfigured) {
    await shareNote(noteId, userId, permission);
    return;
  }
  const { error } = await supabase
    .from("note_shares")
    .update({ permission })
    .eq("note_id", noteId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Set visibility note: 'private' (hanya owner+shared) atau 'public' (semua user). */
export async function setNoteVisibility(noteId: string, visibility: NoteVisibility): Promise<void> {
  if (noteId.startsWith("local-") || !isSupabaseConfigured) {
    saveLocal(
      loadLocal().map((n) =>
        n.id === noteId ? { ...n, visibility, updatedAt: new Date().toISOString() } : n
      )
    );
    return;
  }
  const { error } = await supabase.from("notes").update({ visibility }).eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function unshareNote(noteId: string, userId: string): Promise<void> {
  if (noteId.startsWith("local-") || !isSupabaseConfigured) {
    saveLocal(
      loadLocal().map((n) =>
        n.id === noteId
          ? { ...n, shares: n.shares.filter((s) => s.userId !== userId), updatedAt: new Date().toISOString() }
          : n
      )
    );
    return;
  }
  const { error } = await supabase
    .from("note_shares")
    .delete()
    .eq("note_id", noteId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/* ── Relations ── */

export async function addNoteRelation(
  noteId: string,
  relatedType: NoteRelatedType,
  relatedId: string
): Promise<void> {
  if (noteId.startsWith("local-") || !isSupabaseConfigured) {
    const all = loadLocal();
    saveLocal(
      all.map((n) =>
        n.id === noteId &&
        !n.relations.some((r) => r.relatedType === relatedType && r.relatedId === relatedId)
          ? {
              ...n,
              relations: [...n.relations, { relatedType, relatedId }],
              updatedAt: new Date().toISOString(),
            }
          : n
      )
    );
    return;
  }
  const { error } = await supabase
    .from("note_relations")
    .upsert(
      { note_id: noteId, related_type: relatedType, related_id: relatedId },
      { onConflict: "note_id,related_type,related_id" }
    );
  if (error) throw new Error(error.message);
}

export async function removeNoteRelation(relationId: string): Promise<void> {
  if (relationId.includes(":rel:") || !isSupabaseConfigured) {
    const [noteId, , idx] = relationId.split(":rel:");
    void noteId;
    void idx;
    return;
  }
  const { error } = await supabase.from("note_relations").delete().eq("id", relationId);
  if (error) throw new Error(error.message);
}

export async function removeNoteRelationByTarget(
  noteId: string,
  relatedType: NoteRelatedType,
  relatedId: string
): Promise<void> {
  if (noteId.startsWith("local-") || !isSupabaseConfigured) {
    saveLocal(
      loadLocal().map((n) =>
        n.id === noteId
          ? {
              ...n,
              relations: n.relations.filter(
                (r) => !(r.relatedType === relatedType && r.relatedId === relatedId)
              ),
              updatedAt: new Date().toISOString(),
            }
          : n
      )
    );
    return;
  }
  const { error } = await supabase
    .from("note_relations")
    .delete()
    .eq("note_id", noteId)
    .eq("related_type", relatedType)
    .eq("related_id", relatedId);
  if (error) throw new Error(error.message);
}

/**
 * Notes yang terhubung ke sebuah Task/Issue (untuk panel dua arah di TaskDetail/IssueDetail).
 * RLS note_relations_select sudah mengizinkan baca bila bisa membaca Task/Issue-nya.
 */
export async function listNotesForTarget(
  relatedType: NoteRelatedType,
  relatedId: string,
  currentUserId?: string
): Promise<Note[]> {
  if (!isSupabaseConfigured) {
    return loadLocal()
      .filter((n) => n.relations.some((r) => r.relatedType === relatedType && r.relatedId === relatedId))
      .filter(
        (n) =>
          !currentUserId || n.ownerId === currentUserId || n.shares.some((s) => s.userId === currentUserId)
      )
      .map((l) => toNoteFromLocal(l, currentUserId));
  }
  try {
    const { data: rels, error: relErr } = await supabase
      .from("note_relations")
      .select("note_id")
      .eq("related_type", relatedType)
      .eq("related_id", relatedId);
    if (relErr) throw new Error(relErr.message);
    const noteIds = Array.from(new Set(((rels ?? []) as { note_id: string }[]).map((r) => r.note_id)));
    if (noteIds.length === 0) return [];
    const all = await listNotes(currentUserId);
    const pick = new Set(noteIds);
    return all.filter((n) => pick.has(n.id));
  } catch (e) {
    if (missingTable(e)) return [];
    throw e;
  }
}

/** Normalisasi tag: "#Meeting " -> "meeting". */
export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
}

export function parseTagsInput(raw: string): string[] {
  const parts = raw.split(/[#,\s]+/).map(normalizeTag).filter(Boolean);
  return Array.from(new Set(parts));
}

/* ── Comments (mirip task/issue: tabel public.comments, owner_type='note') ── */

interface NoteCommentRow {
  id: string;
  text: string;
  author_id: string | null;
  created_at: string;
}

/** Daftar komentar satu note (paling lama → terbaru), plus peta id→nama author. */
export async function listNoteComments(
  noteId: string
): Promise<{ comments: Comment[]; names: Map<string, string> }> {
  if (!isSupabaseConfigured || noteId.startsWith("local-")) return { comments: [], names: new Map() };
  const { data, error } = await supabase
    .from("comments")
    .select("id, text, author_id, created_at")
    .eq("owner_type", "note")
    .eq("owner_id", noteId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as NoteCommentRow[];
  const authorIds = Array.from(
    new Set(rows.map((r) => r.author_id).filter((v): v is string => Boolean(v)))
  );
  const names = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", authorIds);
    for (const p of (profiles ?? []) as { id: string; name: string }[]) names.set(p.id, p.name);
  }
  const comments: Comment[] = rows.map((r) => ({
    id: r.id,
    author: nameOf(names, r.author_id, "—"),
    text: r.text,
    at: formatDateTime(r.created_at),
  }));
  return { comments, names };
}

/** Tambah komentar pada note. */
export async function addNoteComment(
  noteId: string,
  authorId: string,
  text: string
): Promise<void> {
  if (!isSupabaseConfigured || noteId.startsWith("local-")) return;
  const { error } = await supabase
    .from("comments")
    .insert({ owner_type: "note", owner_id: noteId, author_id: authorId, text });
  if (error) throw new Error(error.message);
}

/** Hapus komentar (author sendiri atau admin, mengikuti RLS). */
export async function deleteNoteComment(commentId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}
