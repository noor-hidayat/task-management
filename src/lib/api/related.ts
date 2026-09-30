import { supabase } from "@/lib/supabase";
import type { Activity, Comment, Evidence } from "@/types";
import { formatBytes, nameOf, type NameMap } from "./mappers";

type OwnerKind = "work" | "issue";

interface AttachmentRow {
  id: string;
  owner_id: string;
  drive_file_id: string;
  file_name: string;
  file_type: string | null;
  file_size: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/**
 * Peta owner_id → daftar Evidence.
 * URL preview dibentuk dari Edge Function `drive?action=download`.
 */
export async function fetchAttachmentMap(
  ownerType: OwnerKind,
  names: NameMap
): Promise<Map<string, Evidence[]>> {
  const { data } = await supabase
    .from("attachments")
    .select("id, owner_id, drive_file_id, file_name, file_type, file_size, uploaded_by, created_at")
    .eq("owner_type", ownerType);

  const map = new Map<string, Evidence[]>();
  for (const r of (data ?? []) as AttachmentRow[]) {
    const list = map.get(r.owner_id) ?? [];
    list.push({
      id: r.id,
      fileName: r.file_name,
      fileType: r.file_type ?? "",
      fileSize: r.file_size ?? "",
      uploadedBy: nameOf(names, r.uploaded_by, "—"),
      uploadedAt: r.created_at,
      // URL unduh via Edge Function (JWT dipasang saat fetch).
      dataUrl: undefined,
      driveFileId: r.drive_file_id,
    });
    map.set(r.owner_id, list);
  }
  return map;
}

interface ActivityRow {
  id: string;
  owner_id: string;
  text: string;
  actor_id: string | null;
  at: string;
}

export async function fetchActivityMap(
  ownerType: OwnerKind,
  names: NameMap
): Promise<Map<string, Activity[]>> {
  const { data } = await supabase
    .from("activities")
    .select("id, owner_id, text, actor_id, at")
    .eq("owner_type", ownerType)
    .order("at", { ascending: true });

  const map = new Map<string, Activity[]>();
  for (const r of (data ?? []) as ActivityRow[]) {
    const list = map.get(r.owner_id) ?? [];
    list.push({
      id: r.id,
      at: r.at,
      text: r.text,
      actor: nameOf(names, r.actor_id, "—"),
    });
    map.set(r.owner_id, list);
  }
  return map;
}

interface CommentRow {
  id: string;
  owner_id: string;
  text: string;
  author_id: string | null;
  created_at: string;
}

export async function fetchCommentMap(
  ownerType: OwnerKind,
  names: NameMap
): Promise<Map<string, Comment[]>> {
  const { data } = await supabase
    .from("comments")
    .select("id, owner_id, text, author_id, created_at")
    .eq("owner_type", ownerType)
    .order("created_at", { ascending: true });

  const map = new Map<string, Comment[]>();
  for (const r of (data ?? []) as CommentRow[]) {
    const list = map.get(r.owner_id) ?? [];
    list.push({
      id: r.id,
      author: nameOf(names, r.author_id, "—"),
      text: r.text,
      at: r.created_at,
    });
    map.set(r.owner_id, list);
  }
  return map;
}

export async function addComment(
  ownerType: OwnerKind,
  ownerId: string,
  authorId: string,
  text: string
): Promise<void> {
  const { error } = await supabase.from("comments").insert({
    owner_type: ownerType,
    owner_id: ownerId,
    author_id: authorId,
    text,
  });
  if (error) throw new Error(error.message);
}

export { formatBytes };
