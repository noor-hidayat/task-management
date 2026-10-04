// Edge Function: drive
// Router untuk operasi file evidence ke object storage (Cloudflare R2).
//
// Endpoint (POST JSON kecuali upload = multipart/form-data):
//   ?action=upload   form-data: owner_type, owner_id, owner_label, file
//   ?action=download  json: { file_id }  → stream bytes
//   ?action=delete    json: { file_id, attachment_id }
//   ?action=usage     (GET/POST)         → kapasitas bucket + sisa kuota
//
// Upload diblokir (HTTP 507) bila pemakaian bucket + file baru melewati batas
// aman (default 9 GiB, atur lewat secret R2_MAX_BYTES) supaya tak menembus
// kuota gratis R2 (10 GB).
//
// Verifikasi JWT Supabase (verify_jwt=true di config.toml), dan cek
// keanggotaan user terhadap owner entity sebelum upload/download/delete.
//
// Catatan: nama fungsi tetap "drive" (kompatibel dengan frontend). Kolom DB
// `drive_file_id` kini berisi object key R2, `drive_folder_id` berisi prefix.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json } from "../_shared/cors.ts";
import {
  deleteFile,
  deleteNoteImageFolder,
  deleteNoteImages,
  downloadFile,
  exceedsLimit,
  folderPrefix,
  formatBytesHuman,
  getBucketUsage,
  getFileMeta,
  maxStorageBytes,
  presignNoteImageGet,
  rootPrefix,
  uploadFile,
  uploadNoteImage,
} from "../_shared/storage.ts";

type OwnerKind = "work" | "issue";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Klien dengan JWT user → tunduk pada RLS.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "upload":
        return await handleUpload(req, supabase, user.id);
      case "download":
        return await handleDownload(req, supabase);
      case "delete":
        return await handleDelete(req, supabase, user.id);
      case "usage":
        return await handleUsage();
      case "upload-note":
        return await handleUploadNote(req, supabase, user.id);
      case "sign-note":
        return await handleSignNote(req, supabase, user.id);
      case "delete-note":
        return await handleDeleteNote(req, supabase, user.id);
      case "delete-note-folder":
        return await handleDeleteNoteFolder(req, supabase, user.id);
      default:
        return errorResponse("Unknown action", 404);
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});

/* ── Access check via RLS: pastikan baris owner terlihat user ── */
async function canAccessOwner(
  supabase: ReturnType<typeof createClient>,
  ownerType: OwnerKind,
  ownerId: string
): Promise<boolean> {
  const table = ownerType === "work" ? "works" : "issues";
  const { data } = await supabase.from(table).select("id").eq("id", ownerId).maybeSingle();
  return Boolean(data);
}

/* ── Upload ─────────────────────────────────────────────────── */
async function handleUpload(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const form = await req.formData();
  const ownerType = String(form.get("owner_type") ?? "") as OwnerKind;
  const ownerId = String(form.get("owner_id") ?? "");
  const ownerLabel = String(form.get("owner_label") ?? ownerId).replace(/[^\w.-]+/g, "_");
  const file = form.get("file");

  if (ownerType !== "work" && ownerType !== "issue")
    return errorResponse("owner_type harus 'work' atau 'issue'", 400);
  if (!ownerId) return errorResponse("owner_id wajib", 400);
  if (!(file instanceof File)) return errorResponse("file wajib (multipart)", 400);

  if (!(await canAccessOwner(supabase, ownerType, ownerId)))
    return errorResponse("Tidak berhak mengakses entitas ini", 403);

  // Sub-prefix per issue/task: {owner_type}-{label}
  const prefix = folderPrefix(rootPrefix(), `${ownerType}-${ownerLabel}`);

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Gate kuota: cek pemakaian bucket sebenarnya SEBELUM menyimpan apa pun.
  // Kalau total (terpakai + file ini) melewati batas (default 9 GiB), tolak.
  const limit = maxStorageBytes();
  let usage;
  try {
    usage = await getBucketUsage();
  } catch (e) {
    return errorResponse(
      `Tidak bisa memeriksa kapasitas storage: ${e instanceof Error ? e.message : String(e)}`,
      503
    );
  }
  if (exceedsLimit(usage.totalBytes, bytes.length, limit)) {
    const sisa = Math.max(0, limit - usage.totalBytes);
    return errorResponse(
      `Storage penuh — sisa kapasitas ${formatBytesHuman(sisa)} dari batas ` +
        `${formatBytesHuman(limit)} (terpakai ${formatBytesHuman(usage.totalBytes)}). ` +
        `Hapus file lama untuk mengosongkan ruang.`,
      507
    );
  }

  const uploaded = await uploadFile({
    prefix,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
  });

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      drive_file_id: uploaded.id,
      drive_folder_id: prefix,
      file_name: uploaded.name,
      file_type: file.type || "",
      file_size: formatSize(bytes.length),
      uploaded_by: userId,
    })
    .select()
    .single();

  if (error) return errorResponse(`Gagal simpan metadata: ${error.message}`, 500);

  return json({ attachment: data, drive_file_id: uploaded.id });
}

/* ── Download (proxy bytes) ─────────────────────────────────── */
async function handleDownload(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const { file_id } = await req.json().catch(() => ({}));
  let fileId = file_id as string | undefined;

  if (!fileId) return errorResponse("file_id wajib", 400);

  // Verifikasi metadata terlihat via RLS (user berhak atas attachment ini).
  const { data: att } = await supabase
    .from("attachments")
    .select("id, drive_file_id, file_type, file_name")
    .eq("drive_file_id", fileId)
    .maybeSingle();
  if (!att) return errorResponse("Attachment tidak ditemukan / akses ditolak", 403);

  const meta = await getFileMeta(fileId);
  const upstream = await downloadFile(fileId);
  if (!upstream.ok || !upstream.body)
    return errorResponse(`Gagal unduh dari storage: ${upstream.status}`, 502);

  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": att.file_type || meta.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(att.file_name)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

/* ── Delete ─────────────────────────────────────────────────── */
async function handleDelete(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const { file_id, attachment_id } = await req.json().catch(() => ({}));
  if (!attachment_id) return errorResponse("attachment_id wajib", 400);

  const { data: att } = await supabase
    .from("attachments")
    .select("id, drive_file_id, uploaded_by")
    .eq("id", attachment_id)
    .maybeSingle();
  if (!att) return errorResponse("Attachment tidak ditemukan / akses ditolak", 403);

  const fileId = ((file_id as string) || att.drive_file_id || "").trim();
  if (fileId) {
    try {
      await deleteFile(fileId);
    } catch (e) {
      // Jangan hapus metadata kalau objek di storage gagal dihapus: kalau
      // dibiarkan, objek jadi yatim (ada di bucket, tapi tak ada barisnya di
      // DB) dan tak akan pernah bisa dibersihkan lagi dari app.
      console.error("Storage delete error:", e);
      return errorResponse(
        `Gagal hapus file dari storage: ${e instanceof Error ? e.message : String(e)}`,
        502
      );
    }
  }

  const { error } = await supabase.from("attachments").delete().eq("id", attachment_id);
  if (error) return errorResponse(error.message, 500);

  return json({ ok: true, deleted_by: userId });
}

/* ── Usage (kapasitas bucket) ───────────────────────────────── */
async function handleUsage(): Promise<Response> {
  const limit = maxStorageBytes();
  try {
    const usage = await getBucketUsage();
    const sisa = Math.max(0, limit - usage.totalBytes);
    return json({
      total_bytes: usage.totalBytes,
      object_count: usage.objectCount,
      limit_bytes: limit,
      remaining_bytes: sisa,
      used_human: formatBytesHuman(usage.totalBytes),
      limit_human: formatBytesHuman(limit),
      remaining_human: formatBytesHuman(sisa),
      percent_used: limit > 0 ? Math.min(100, (usage.totalBytes / limit) * 100) : 0,
      full: usage.totalBytes >= limit,
      listing_truncated: usage.truncated,
    });
  } catch (e) {
    return errorResponse(
      `Gagal membaca kapasitas storage: ${e instanceof Error ? e.message : String(e)}`,
      502
    );
  }
}

/* ── util ───────────────────────────────────────────────────── */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Note Images (R2) ───────────────────────────────────────── */

async function canAccessNote(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  noteId: string
): Promise<boolean> {
  // Check if note exists and user has access via RLS (owner or shared)
  const { data } = await supabase
    .from("notes")
    .select("id, owner_id")
    .eq("id", noteId)
    .maybeSingle();
  if (!data) return false;
  // Owner can always access
  if (data.owner_id === userId) return true;
  // Check shared access
  const { data: shared } = await supabase
    .from("note_shares")
    .select("id")
    .eq("note_id", noteId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(shared);
}

/** Upload gambar note (multipart: userId, noteId, file) */
async function handleUploadNote(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const form = await req.formData();
  const noteId = String(form.get("note_id") ?? "");
  const file = form.get("file");

  if (!noteId) return errorResponse("note_id wajib", 400);
  if (!(file instanceof File)) return errorResponse("file wajib (multipart)", 400);
  if (!file.type.startsWith("image/")) return errorResponse("file harus gambar", 400);

  if (!(await canAccessNote(supabase, userId, noteId)))
    return errorResponse("Tidak berhak mengakses note ini", 403);

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Batas ukuran per gambar (mis. 10 MB)
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  if (bytes.length > MAX_IMAGE_BYTES)
    return errorResponse(`Gambar terlalu besar (maks 10 MB)`, 413);

  // Gate kuota: gambar note masuk bucket R2 yang sama, jadi ikut batas aman
  // (default 9 GiB) agar tidak menembus kuota gratis R2.
  const limit = maxStorageBytes();
  let usage;
  try {
    usage = await getBucketUsage();
  } catch (e) {
    return errorResponse(
      `Tidak bisa memeriksa kapasitas storage: ${e instanceof Error ? e.message : String(e)}`,
      503
    );
  }
  if (exceedsLimit(usage.totalBytes, bytes.length, limit)) {
    const sisa = Math.max(0, limit - usage.totalBytes);
    return errorResponse(
      `Storage penuh — sisa kapasitas ${formatBytesHuman(sisa)} dari batas ` +
        `${formatBytesHuman(limit)} (terpakai ${formatBytesHuman(usage.totalBytes)}). ` +
        `Hapus file lama untuk mengosongkan ruang.`,
      507
    );
  }

  const uploaded = await uploadNoteImage({
    userId,
    noteId,
    fileName: file.name,
    mimeType: file.type || "image/webp",
    bytes,
  });

  return json({ key: uploaded.key, name: uploaded.name, size: uploaded.size });
}

/** Presigned GET URL untuk array key gambar note */
async function handleSignNote(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const { paths } = await req.json().catch(() => ({}));
  const keys = (paths ?? []) as string[];

  if (!keys.length) return errorResponse("paths (array key) wajib", 400);

  // Verifikasi akses: semua key harus di prefix notes/{userId}/... atau note yang di-share
  // Cek prefix ownership sederhana: key harus contain notes/{userId}/
  // Atau jika shared, cek note_id dari key.
  for (const key of keys) {
    if (!key.startsWith(`notes/${userId}/`)) {
      // Extract noteId from key: notes/{uid}/{nid}/...
      const match = key.match(/^notes\/[^/]+\/([^/]+)\//);
      if (match) {
        const noteId = match[1];
        if (!(await canAccessNote(supabase, userId, noteId))) {
          return errorResponse("Akses ditolak ke salah satu gambar", 403);
        }
      } else {
        return errorResponse("Format key tidak valid", 400);
      }
    }
  }

  const urls: Record<string, string> = {};
  for (const key of keys) {
    try {
      urls[key] = await presignNoteImageGet(key, 3600);
    } catch (e) {
      console.warn(`Presign gagal ${key}:`, e);
    }
  }
  return json({ urls });
}

/** Hapus beberapa gambar note (array key) */
async function handleDeleteNote(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const { paths } = await req.json().catch(() => ({}));
  const keys = (paths ?? []) as string[];

  if (!keys.length) return errorResponse("paths (array key) wajib", 400);

  // Verifikasi akses sama seperti sign-note
  for (const key of keys) {
    if (!key.startsWith(`notes/${userId}/`)) {
      const match = key.match(/^notes\/[^/]+\/([^/]+)\//);
      if (match) {
        const noteId = match[1];
        if (!(await canAccessNote(supabase, userId, noteId))) {
          return errorResponse("Akses ditolak ke salah satu gambar", 403);
        }
      } else {
        return errorResponse("Format key tidak valid", 400);
      }
    }
  }

  try {
    await deleteNoteImages(keys);
  } catch (e) {
    return errorResponse(
      `Gagal hapus gambar: ${e instanceof Error ? e.message : String(e)}`,
      502
    );
  }
  return json({ ok: true, deleted: keys.length });
}

/** Hapus seluruh folder gambar note (note dihapus) */
async function handleDeleteNoteFolder(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const { note_id } = await req.json().catch(() => ({}));
  const noteId = note_id as string | undefined;

  if (!noteId) return errorResponse("note_id wajib", 400);

  if (!(await canAccessNote(supabase, userId, noteId)))
    return errorResponse("Tidak berhak menghapus gambar note ini", 403);

  try {
    await deleteNoteImageFolder(userId, noteId);
  } catch (e) {
    return errorResponse(
      `Gagal bersihkan folder gambar: ${e instanceof Error ? e.message : String(e)}`,
      502
    );
  }
  return json({ ok: true });
}
