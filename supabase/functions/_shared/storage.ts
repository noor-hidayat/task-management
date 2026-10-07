// Object storage adapter — Supabase Storage.
//
// Menggantikan adapter Cloudflare R2 (dan sebelumnya Google Drive). Antarmuka
// sengaja dibuat setara supaya Edge Function `drive` nyaris tidak berubah:
//   rootFolderId() → rootPrefix()
//   ensureFolder() → folderPrefix()   (Storage "folder" = prefix path)
//   uploadFile / getFileMeta / downloadFile / deleteFile  → sama
//
// Konsep: Supabase Storage itu flat object store — "folder" hanyalah prefix.
// Key objek contoh: "issue-IS-000042/1759999999999-a1b2c3d4-bukti.png".
//
// Dua bucket privat:
//   - `attachments` → file evidence task/issue (key bebas, mis. "issue-XXX/...").
//   - `notes`       → gambar di dalam note. Path = "{user_id}/{note_id}/file".
//     Key yang dipakai aplikasi tetap berformat "notes/{user_id}/{note_id}/file";
//     adapter ini yang membuang prefix "notes/" saat menyentuh bucket `notes`.
//
// Akses: Edge Function memakai SERVICE ROLE (bypass RLS) dan melakukan
// pengecekan hak akses sendiri (canAccessOwner / canAccessNote), sama seperti
// model kredensial server-side R2. Bucket tetap privat (tak ada akses langsung).
//
// Tidak butuh secret tambahan: SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
// otomatis di-inject Supabase ke setiap Edge Function.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Bucket untuk file evidence task/issue. */
export const ATTACHMENT_BUCKET = "attachments";
/** Bucket untuk gambar note. */
export const NOTE_BUCKET = "notes";
/** Prefix key gambar note (dipertahankan demi kompatibilitas data lama). */
const NOTE_KEY_PREFIX = "notes/";

let cached: SupabaseClient | null = null;

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ${name} belum diset.`);
  return value;
}

/** Klien Storage dengan service role (bypass RLS; hak akses dijaga EF). */
function getClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/* ── Key & bucket ───────────────────────────────────────────── */

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

/** Bersihkan nama file agar aman jadi bagian key. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").slice(0, 180) || "file";
}

export function baseName(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] ?? key;
}

/**
 * Petakan key aplikasi → (bucket, path) di Supabase Storage.
 * Key berawalan "notes/" masuk bucket `notes` (prefix dibuang); sisanya ke
 * bucket `attachments`.
 */
function resolve(key: string): { bucket: string; path: string } {
  const clean = trimSlashes(key);
  if (clean === NOTE_KEY_PREFIX.slice(0, -1) || clean.startsWith(NOTE_KEY_PREFIX)) {
    return { bucket: NOTE_BUCKET, path: clean.slice(NOTE_KEY_PREFIX.length) };
  }
  return { bucket: ATTACHMENT_BUCKET, path: clean };
}

/* ── Prefix (pengganti folder) ──────────────────────────────── */

/** Prefix root (opsional). Disimpan demi kompatibilitas; default kosong. */
export function rootPrefix(): string {
  return trimSlashes(Deno.env.get("STORAGE_PREFIX") ?? "");
}

/** Gabung prefix induk dengan nama sub-prefix. Storage tak perlu "membuat" apa pun. */
export function folderPrefix(parent: string, name: string): string {
  const child = trimSlashes(name).replace(/[^\w.-]+/g, "_");
  return [trimSlashes(parent), child].filter(Boolean).join("/");
}

/** Susun key unik: {prefix}/{timestamp}-{random}-{nama-asli} */
function objectKey(prefix: string, fileName: string): string {
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return [trimSlashes(prefix), `${unique}-${safeFileName(fileName)}`]
    .filter(Boolean)
    .join("/");
}

function toBodyInit(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy]);
}

/* ── Upload ─────────────────────────────────────────────────── */

export interface UploadResult {
  id: string;
  name: string;
  webViewLink?: string;
  size?: number;
}

export async function uploadFile(opts: {
  prefix: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  const client = getClient();
  const key = objectKey(opts.prefix, opts.fileName);

  const { error } = await client.storage.from(ATTACHMENT_BUCKET).upload(key, toBodyInit(opts.bytes), {
    contentType: opts.mimeType || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    throw new Error(`Gagal upload ke Supabase Storage: ${error.message}`);
  }

  return { id: key, name: opts.fileName, size: opts.bytes.length };
}

/* ── Metadata / download / delete ───────────────────────────── */

export async function getFileMeta(key: string): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}> {
  const client = getClient();
  const { bucket, path } = resolve(key);
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;

  const { data, error } = await client.storage.from(bucket).list(dir, {
    search: name,
    limit: 1,
  });
  if (error) throw new Error(`Gagal membaca metadata: ${error.message}`);
  const hit = (data ?? []).find((it) => it.name === name);
  if (!hit) throw new Error(`File tidak ditemukan: ${key}`);

  const meta = (hit.metadata ?? {}) as { size?: number; mimetype?: string };
  const size = Number(meta.size);
  return {
    id: key,
    name,
    mimeType: meta.mimetype ?? "application/octet-stream",
    size: Number.isFinite(size) ? size : undefined,
  };
}

export async function downloadFile(key: string): Promise<Response> {
  const client = getClient();
  const { bucket, path } = resolve(key);
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    return new Response(error?.message ?? "Not found", { status: 404 });
  }
  return new Response(data, {
    headers: { "Content-Type": data.type || "application/octet-stream" },
  });
}

export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  const { bucket, path } = resolve(key);
  const { error } = await client.storage.from(bucket).remove([path]);
  // Objek tak ada dianggap sudah terhapus (idempoten).
  if (error && !/not found|does not exist/i.test(error.message)) {
    throw new Error(`Gagal hapus objek: ${error.message}`);
  }
}

/* ── Kapasitas bucket & batas kuota ─────────────────────────── */

export interface BucketUsage {
  /** Total byte seluruh objek di semua bucket (ground truth). */
  totalBytes: number;
  /** Jumlah objek. */
  objectCount: number;
  /** Berapa kali listing dilakukan (diagnostik). */
  pages: number;
  /** True bila listing dihentikan sebelum selesai (bucket sangat besar). */
  truncated: boolean;
}

/** Batas iterasi listing agar tak menggantung. */
const MAX_LIST_PAGES = 500;
const PAGE_SIZE = 100;

/** Hitung pemakaian satu bucket secara rekursif (folder = prefix). */
async function listBucketUsage(
  client: SupabaseClient,
  bucket: string,
  budget: { pages: number }
): Promise<{ bytes: number; count: number; truncated: boolean }> {
  let bytes = 0;
  let count = 0;
  const stack: string[] = [""];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      if (budget.pages >= MAX_LIST_PAGES) return { bytes, count, truncated: true };
      const { data, error } = await client.storage.from(bucket).list(dir, {
        limit: PAGE_SIZE,
        offset,
      });
      budget.pages++;
      if (error) throw new Error(`Gagal membaca ukuran bucket: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const it of data) {
        if (!it.id || !it.metadata) {
          // Folder (placeholder) → telusuri isinya.
          stack.push(dir ? `${dir}/${it.name}` : it.name);
        } else {
          bytes += Number((it.metadata as { size?: number }).size ?? 0);
          count++;
        }
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return { bytes, count, truncated: false };
}

/**
 * Hitung pemakaian storage sebenarnya dengan menjumlahkan ukuran semua objek
 * di bucket `attachments` + `notes`. Ini ground truth: tahan terhadap objek
 * "yatim" yang tak lagi ada barisnya di DB.
 */
export async function getBucketUsage(): Promise<BucketUsage> {
  const client = getClient();
  const budget = { pages: 0 };
  let totalBytes = 0;
  let objectCount = 0;
  let truncated = false;
  for (const bucket of [ATTACHMENT_BUCKET, NOTE_BUCKET]) {
    const u = await listBucketUsage(client, bucket, budget);
    totalBytes += u.bytes;
    objectCount += u.count;
    truncated = truncated || u.truncated;
  }
  return { totalBytes, objectCount, pages: budget.pages, truncated };
}

/** Batas default: 1 GiB (kuota storage gratis Supabase). */
const DEFAULT_MAX_BYTES = 1 * 1024 * 1024 * 1024;

/** Batas kapasitas dari env `STORAGE_MAX_BYTES` (byte). Default 1 GiB. */
export function maxStorageBytes(): number {
  const raw = Deno.env.get("STORAGE_MAX_BYTES");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

/** Apakah menambah `incomingBytes` akan melewati batas? */
export function exceedsLimit(
  usedBytes: number,
  incomingBytes: number,
  limitBytes: number
): boolean {
  return usedBytes + incomingBytes > limitBytes;
}

/** Format byte jadi teks ringkas (mis. "9.0 GB"). */
export function formatBytesHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* ── Note images helpers ──────────────────────────────────────── */

export interface NoteImageUploadResult {
  key: string;
  name: string;
  size: number;
}

/** Upload bytes gambar note ke bucket `notes` di path {userId}/{noteId}/. */
export async function uploadNoteImage(opts: {
  userId: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<NoteImageUploadResult> {
  const client = getClient();
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const path = `${opts.userId}/${opts.noteId}/${unique}-${safeFileName(opts.fileName)}`;

  const { error } = await client.storage.from(NOTE_BUCKET).upload(path, toBodyInit(opts.bytes), {
    contentType: opts.mimeType || "image/webp",
    upsert: true,
  });
  if (error) {
    throw new Error(`Gagal upload gambar note: ${error.message}`);
  }
  // Key yang disimpan di DB/HTML tetap berformat "notes/{uid}/{noteId}/file".
  return { key: `${NOTE_KEY_PREFIX}${path}`, name: opts.fileName, size: opts.bytes.length };
}

/** Buat signed GET URL untuk akses browser langsung ke Supabase Storage. */
export async function presignNoteImageGet(key: string, ttlSeconds = 3600): Promise<string> {
  const client = getClient();
  const { bucket, path } = resolve(key);
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Gagal membuat signed URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

/** Hapus beberapa objek note image (array key). */
export async function deleteNoteImages(keys: string[]): Promise<void> {
  const client = getClient();
  const uniq = [...new Set(keys?.filter(Boolean) ?? [])];
  if (uniq.length === 0) return;
  // Kelompokkan per bucket agar sekali panggil remove() bisa banyak path.
  const byBucket = new Map<string, string[]>();
  for (const key of uniq) {
    const { bucket, path } = resolve(key);
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(path);
  }
  for (const [bucket, paths] of byBucket) {
    const { error } = await client.storage.from(bucket).remove(paths);
    if (error && !/not found|does not exist/i.test(error.message)) {
      throw new Error(`Gagal hapus gambar: ${error.message}`);
    }
  }
}

/** Hapus seluruh folder gambar note (path {userId}/{noteId}/ di bucket notes). */
export async function deleteNoteImageFolder(userId: string, noteId: string): Promise<void> {
  const client = getClient();
  const prefix = `${userId}/${noteId}`;
  const stack: string[] = [prefix];
  const paths: string[] = [];
  let pages = 0;
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      if (pages >= MAX_LIST_PAGES) break;
      const { data, error } = await client.storage.from(NOTE_BUCKET).list(dir, {
        limit: PAGE_SIZE,
        offset,
      });
      pages++;
      if (error) throw new Error(`Gagal list gambar note: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const it of data) {
        const full = `${dir}/${it.name}`;
        if (!it.id || !it.metadata) stack.push(full);
        else paths.push(full);
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  if (paths.length === 0) return;
  const { error } = await client.storage.from(NOTE_BUCKET).remove(paths);
  if (error && !/not found|does not exist/i.test(error.message)) {
    throw new Error(`Gagal hapus folder gambar: ${error.message}`);
  }
}
