import { supabase } from "@/lib/supabase";
import { formatBytes } from "./mappers";

type OwnerKind = "work" | "issue";

/**
 * Ubah error mentah dari Edge Function `drive` jadi pesan yang bisa ditindak.
 * Kasus paling sering: kredensial storage (R2) belum diset / salah, sehingga
 * upload & unduh SEMUA attachment ikut gagal. Tanpa ini, user cuma lihat pesan
 * mentah dan mengira sesinya habis.
 */
function friendlyStorageError(raw: string | undefined, fallback: string): string {
  const msg = raw ?? "";
  if (/R2_|belum diset|signature|access key|403|401.*r2/i.test(msg)) {
    return "Koneksi ke storage terputus — kredensial storage (R2) belum diset atau salah. Hubungi admin.";
  }
  if (/missing authorization|unauthorized|\b401\b/i.test(msg)) {
    return "Sesi login kamu sudah berakhir. Login ulang lalu coba lagi.";
  }
  return msg || fallback;
}

const FUNCTIONS_BASE = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive`;

/** Header auth untuk memanggil Edge Function. */
async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${session?.access_token ?? anon}`,
    apikey: anon,
  };
}

export interface UploadResult {
  attachmentId: string;
  driveFileId: string;
  fileName: string;
  fileSize: string;
  fileType: string;
}

/** Batas sisi terpanjang gambar (px) dan kualitas JPEG/WebP. */
const MAX_IMAGE_DIM = 1920;
const IMAGE_QUALITY = 0.82;
/** Di bawah ukuran ini gambar dianggap sudah kecil — tidak dikompres. */
const SKIP_BELOW_BYTES = 500 * 1024;

/**
 * Kompres gambar di browser: downscale ke MAX_IMAGE_DIM + kompresi quality.
 * Non-gambar, GIF animasi, dan SVG dikembalikan apa adanya.
 * Kalau hasil kompresi malah lebih besar, file asli yang dipakai.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  if (!bitmap) return file;
  try {
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < SKIP_BELOW_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const mime =
      file.type === "image/png"
        ? "image/png"
        : file.type === "image/webp"
          ? "image/webp"
          : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, mime, IMAGE_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/** Upload file ke storage + simpan metadata. Gambar dikompres otomatis dulu. */
export async function uploadAttachment(
  ownerType: OwnerKind,
  ownerId: string,
  ownerLabel: string,
  file: File
): Promise<UploadResult> {
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append("owner_type", ownerType);
  form.append("owner_id", ownerId);
  form.append("owner_label", ownerLabel);
  form.append("file", compressed);

  const res = await fetch(`${FUNCTIONS_BASE()}?action=upload`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(friendlyStorageError(err.error, "Upload gagal"));
  }
  const data = (await res.json()) as {
    attachment: { id: string; file_name: string; file_type: string; file_size: string };
    drive_file_id: string;
  };
  return {
    attachmentId: data.attachment.id,
    driveFileId: data.drive_file_id,
    fileName: data.attachment.file_name,
    fileSize: data.attachment.file_size || formatBytes(compressed.size),
    fileType: data.attachment.file_type,
  };
}

/** Hapus attachment (storage + DB). */
export async function deleteAttachment(attachmentId: string, driveFileId: string): Promise<void> {
  const res = await fetch(`${FUNCTIONS_BASE()}?action=delete`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ attachment_id: attachmentId, file_id: driveFileId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(friendlyStorageError(err.error, "Gagal menghapus attachment"));
  }
}

/**
 * Buat object URL untuk preview/unduh sebuah file evidence.
 * Mengambil bytes lewat Edge Function (proxy) sehingga file tetap privat.
 */
export async function fetchAttachmentObjectUrl(driveFileId: string): Promise<string | null> {
  const res = await fetch(`${FUNCTIONS_BASE()}?action=download`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: driveFileId }),
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
