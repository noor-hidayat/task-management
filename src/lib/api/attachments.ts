import { supabase } from "@/lib/supabase";
import { formatBytes } from "./mappers";

type OwnerKind = "work" | "issue";

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

/** Upload file ke Drive + simpan metadata. */
export async function uploadAttachment(
  ownerType: OwnerKind,
  ownerId: string,
  ownerLabel: string,
  file: File
): Promise<UploadResult> {
  const form = new FormData();
  form.append("owner_type", ownerType);
  form.append("owner_id", ownerId);
  form.append("owner_label", ownerLabel);
  form.append("file", file);

  const res = await fetch(`${FUNCTIONS_BASE()}?action=upload`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Upload gagal");
  }
  const data = (await res.json()) as {
    attachment: { id: string; file_name: string; file_type: string; file_size: string };
    drive_file_id: string;
  };
  return {
    attachmentId: data.attachment.id,
    driveFileId: data.drive_file_id,
    fileName: data.attachment.file_name,
    fileSize: data.attachment.file_size || formatBytes(file.size),
    fileType: data.attachment.file_type,
  };
}

/** Hapus attachment (Drive + DB). */
export async function deleteAttachment(attachmentId: string, driveFileId: string): Promise<void> {
  const res = await fetch(`${FUNCTIONS_BASE()}?action=delete`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ attachment_id: attachmentId, file_id: driveFileId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Gagal menghapus attachment");
  }
}

/**
 * Buat object URL untuk preview/unduh sebuah file Drive.
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
