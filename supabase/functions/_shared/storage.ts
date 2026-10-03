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
