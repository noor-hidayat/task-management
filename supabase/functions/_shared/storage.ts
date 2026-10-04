// Object storage adapter — Cloudflare R2 (S3-compatible).
//
// Menggantikan adapter Google Drive. Antarmuka sengaja dibuat setara supaya
// Edge Function `drive` nyaris tidak berubah:
//   rootFolderId() → rootPrefix()
//   ensureFolder() → folderPrefix()   (R2 tidak punya folder: prefix = "folder")
//   uploadFile / getFileMeta / downloadFile / deleteFile  → sama
//
// Konsep: R2 itu flat object store. "Folder" hanyalah prefix key.
// Key objek contoh: "issue-IS-000042/1759999999999-a1b2c3d4-bukti.png"
//
// Secrets yang dibutuhkan (supabase secrets set):
//   R2_ACCOUNT_ID            (dipakai untuk menurunkan endpoint)
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
//   R2_ENDPOINT              (opsional; default https://<account>.r2.cloudflarestorage.com)
//   R2_REGION                (opsional; default "auto")
//   R2_PREFIX                (opsional; prefix root, mis. "tims")

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const SERVICE = "s3";

interface StorageClient {
  client: AwsClient;
  endpoint: string;
  bucket: string;
}

let cached: StorageClient | null = null;

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ${name} belum diset.`);
  return value;
}

function getClient(): StorageClient {
  if (cached) return cached;

  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const endpoint =
    Deno.env.get("R2_ENDPOINT") ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  if (!endpoint) {
    throw new Error("R2_ENDPOINT atau R2_ACCOUNT_ID belum diset.");
  }

  cached = {
    client: new AwsClient({
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      service: SERVICE,
      region: Deno.env.get("R2_REGION") ?? "auto",
    }),
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket: required("R2_BUCKET"),
  };
  return cached;
}

/* ── Key & URL ──────────────────────────────────────────────── */

/** Encode satu path segment sesuai aturan canonical URI S3 (ketat). */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeSegment).join("/");
}

function objectUrl(key: string): string {
  const { endpoint, bucket } = getClient();
  return `${endpoint}/${encodeSegment(bucket)}/${encodeKey(key)}`;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

/** Bersihkan nama file agar aman jadi bagian key. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").slice(0, 180) || "file";
}

/**
 * Ubah byte menjadi body request yang aman untuk `fetch`.
 * TS lib DOM baru membedakan `Uint8Array<ArrayBuffer>` vs `<ArrayBufferLike>`,
 * jadi salin ke buffer sendiri agar tipe-nya pasti `BodyInit`.
 */
function toBodyInit(bytes: Uint8Array): BodyInit {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy as unknown as BodyInit;
}

export function baseName(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] ?? key;
}

/* ── Prefix (pengganti folder) ──────────────────────────────── */

/** Prefix root dari env (opsional). */
export function rootPrefix(): string {
  return trimSlashes(Deno.env.get("R2_PREFIX") ?? "");
}

/** Gabung prefix induk dengan nama sub-prefix. R2 tidak perlu "membuat" apa pun. */
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
  const { client } = getClient();
  const key = objectKey(opts.prefix, opts.fileName);

  const res = await client.fetch(objectUrl(key), {
    method: "PUT",
    headers: { "Content-Type": opts.mimeType || "application/octet-stream" },
    body: toBodyInit(opts.bytes),
  });
  if (!res.ok) {
    throw new Error(`Gagal upload ke R2: ${res.status} ${await res.text()}`);
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
  const { client } = getClient();
  const res = await client.fetch(objectUrl(key), { method: "HEAD" });
  if (!res.ok) throw new Error(`File tidak ditemukan: ${res.status}`);

  const length = Number(res.headers.get("content-length"));
  return {
    id: key,
    name: baseName(key),
    mimeType: res.headers.get("content-type") ?? "application/octet-stream",
    size: Number.isFinite(length) ? length : undefined,
  };
}

export async function downloadFile(key: string): Promise<Response> {
  const { client } = getClient();
  return await client.fetch(objectUrl(key), { method: "GET" });
}

export async function deleteFile(key: string): Promise<void> {
  const { client } = getClient();
  const res = await client.fetch(objectUrl(key), { method: "DELETE" });
  // 404 dianggap sudah terhapus.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Gagal hapus objek R2: ${res.status} ${await res.text()}`);
  }
}

/* ── Kapasitas bucket & batas kuota ─────────────────────────── */

export interface BucketUsage {
  /** Total byte seluruh objek di bucket (ground truth). */
  totalBytes: number;
  /** Jumlah objek. */
  objectCount: number;
  /** Berapa halaman listing yang dibaca. */
  pages: number;
  /** True bila listing dihentikan sebelum selesai (bucket sangat besar). */
  truncated: boolean;
}

/** Batas aman listing halaman (1000 objek/halaman) agar tak menggantung. */
const MAX_LIST_PAGES = 500;

function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Hitung pemakaian bucket sebenarnya dengan menjumlahkan ukuran semua objek
 * (S3 ListObjectsV2, dipaginasi). Ini ground truth: tahan terhadap objek
 * "yatim" (mis. sisa era Drive) yang tak lagi ada barisnya di DB, sehingga
 * angka yang dipakai untuk menolak upload tidak pernah salah hitung.
 */
export async function getBucketUsage(): Promise<BucketUsage> {
  const { client, bucket, endpoint } = getClient();
  const base = `${endpoint}/${encodeSegment(bucket)}`;
  let continuationToken: string | undefined;
  let totalBytes = 0;
  let objectCount = 0;
  let pages = 0;
  let truncated = false;

  for (let i = 0; i < MAX_LIST_PAGES; i++) {
    const url = new URL(base);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1000");
    if (continuationToken) {
      url.searchParams.set("continuation-token", continuationToken);
    }

    const res = await client.fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      throw new Error(`Gagal membaca ukuran bucket: ${res.status} ${await res.text()}`);
    }
    const xml = await res.text();
    pages++;

    for (const block of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const sizeMatch = block[1].match(/<Size>(\d+)<\/Size>/);
      totalBytes += sizeMatch ? Number(sizeMatch[1]) : 0;
      objectCount++;
    }

    truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    if (!truncated) break;

    const tokenMatch = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
    if (!tokenMatch) break;
    continuationToken = xmlUnescape(tokenMatch[1]);
  }

  return { totalBytes, objectCount, pages, truncated };
}

/** Batas default: 9 GiB (aman di bawah kuota gratis R2 10 GB). */
const DEFAULT_MAX_BYTES = 9 * 1024 * 1024 * 1024;

/** Batas kapasitas dari env `R2_MAX_BYTES` (byte). Default 9 GiB. */
export function maxStorageBytes(): number {
  const raw = Deno.env.get("R2_MAX_BYTES");
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

/** Upload bytes gambar note ke prefix notes/{userId}/{noteId}/ */
export async function uploadNoteImage(opts: {
  userId: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<NoteImageUploadResult> {
  const { client } = getClient();
  const prefix = `notes/${opts.userId}/${opts.noteId}`;
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const key = [prefix, `${unique}-${safeFileName(opts.fileName)}`].join("/");

  const res = await client.fetch(objectUrl(key), {
    method: "PUT",
    headers: { "Content-Type": opts.mimeType || "image/webp" },
    body: toBodyInit(opts.bytes),
  });
  if (!res.ok) {
    throw new Error(`Gagal upload note image ke R2: ${res.status} ${await res.text()}`);
  }
  return { key, name: opts.fileName, size: opts.bytes.length };
}

/** Buat presigned GET URL untuk akses browser langsung ke R2. */
export async function presignNoteImageGet(key: string, ttlSeconds = 3600): Promise<string> {
  const { client, endpoint, bucket } = getClient();
  const url = `${endpoint}/${encodeSegment(bucket)}/${encodeKey(key)}`;
  const signed = await client.sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
    expiresIn: ttlSeconds,
  });
  return signed.url;
}

/** Hapus beberapa objek note image (array key). */
export async function deleteNoteImages(keys: string[]): Promise<void> {
  const { client } = getClient();
  const uniq = [...new Set(keys?.filter(Boolean) ?? [])];
  if (uniq.length === 0) return;
  for (const key of uniq) {
    const res = await client.fetch(objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Gagal hapus note image ${key}: ${res.status} ${await res.text()}`);
    }
  }
}

/** Hapus seluruh folder gambar note (prefix notes/{userId}/{noteId}/). */
export async function deleteNoteImageFolder(userId: string, noteId: string): Promise<void> {
  const { client, bucket, endpoint } = getClient();
  const prefix = `notes/${userId}/${noteId}/`;
  const base = `${endpoint}/${encodeSegment(bucket)}`;
  let continuationToken: string | undefined;

  for (let i = 0; i < 100; i++) {
    const url = new URL(base);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("max-keys", "1000");
    if (continuationToken) {
      url.searchParams.set("continuation-token", continuationToken);
    }

    const res = await client.fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      throw new Error(`Gagal list note images: ${res.status} ${await res.text()}`);
    }
    const xml = await res.text();

    const keys: string[] = [];
    for (const block of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const keyMatch = block[1].match(/<Key>([\s\S]*?)<\/Key>/);
      if (keyMatch) keys.push(xmlUnescape(keyMatch[1]));
    }
    if (keys.length > 0) {
      for (const key of keys) {
        const delRes = await client.fetch(objectUrl(key), { method: "DELETE" });
        if (!delRes.ok && delRes.status !== 404) {
          throw new Error(`Gagal hapus ${key}: ${delRes.status} ${await delRes.text()}`);
        }
      }
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    if (!truncated) break;

    const tokenMatch = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
    if (!tokenMatch) break;
    continuationToken = xmlUnescape(tokenMatch[1]);
  }
}
