// Edge Function: drive
// Router untuk operasi file evidence ke object storage (Cloudflare R2).
//
// Endpoint (POST JSON kecuali upload = multipart/form-data):
//   ?action=upload   form-data: owner_type, owner_id, owner_label, file
//   ?action=download  json: { file_id }  → stream bytes
//   ?action=delete    json: { file_id, attachment_id }
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
  downloadFile,
  folderPrefix,
  getFileMeta,
  rootPrefix,
  uploadFile,
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

/* ── util ───────────────────────────────────────────────────── */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
