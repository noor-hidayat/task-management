import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Gambar di dalam Note Editor (Word/Notion-like).
 *
 * Arsitektur:
 * - Selama editing, gambar BARU hidup sebagai blob: URL + File di memori
 *   (instant preview, nol orphan bila dialog dibatalkan).
 * - Saat Save, `persistNoteImages()` mengunggah blob ke Cloudflare R2 (lewat
 *   Edge Function `drive`, action `upload-note`) dengan key
 *   `notes/{user_id}/{note_id}/{unique}-{nama}.webp` dan menulis ulang HTML
 *   dengan `data-storage-path`. Database TIDAK menyimpan binary/base64.
 * - Saat tampil (editor & read-only), `resolveNoteImageUrls()` menukar
 *   `data-storage-path` menjadi presigned GET URL berumur pendek (dibuat
 *   server-side lewat action `sign-note`). Bucket R2 privat; otorisasi mengikuti
 *   permission Note (owner / shared / admin).
 * - Gambar LAMA yang masih di bucket Supabase (`notes/...`) tetap dibaca
 *   (fallback) sampai selesai migrasi manual.
 * - Caption auto-numbering `Gambar {H1 section}.{sequence}` dihitung dari DOM
 *   (`renumberNoteImages`), mengikuti H1 dan diperbarui saat hapus/pindah.
 */

/** Umur presigned URL (detik) — pendek agar URL kedaluwarsa tidak bisa disebar bebas. */
const SIGNED_URL_TTL = 3600;
/** Batas dimensi upload agar file tetap ringan (aspect ratio dipertahankan). */
const MAX_UPLOAD_DIM = 2560;
/** Batas dimensi untuk mode lokal (tanpa Supabase, dataURL di localStorage). */
const MAX_LOCAL_DIM = 1280;

/* ── Edge Function `drive` client (R2) ────────────────────────── */

const FUNCTIONS_BASE = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive`;

async function authHeaders(json = false): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session?.access_token ?? anon}`,
    apikey: anon,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function r2Error(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({ error: res.statusText }));
  return new Error(body?.error || fallback);
}

/** File gambar yang masih blob (belum diunggah) + path storage yang dibuang saat save. */
export type PendingNoteImages = {
  files: Map<string, File | Blob>;
  removedPaths: string[];
};

export function emptyPendingNoteImages(): PendingNoteImages {
  return { files: new Map(), removedPaths: [] };
}

export function randImageId(prefix = "img"): string {
  return `${prefix}_${Date.now().toString(36).slice(-4)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function extOf(file: File | Blob): string {
  if (file instanceof File) {
    const m = file.name.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  return "webp";
}

/** Konversi blob gambar ke webp (max dimensi), fallback ke blob asli bila gagal. */
export async function blobToWebp(blob: Blob, maxDim = MAX_UPLOAD_DIM): Promise<{ blob: Blob; ext: string }> {
  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(blob);
      try {
        const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, w, h);
          const out = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, "image/webp", 0.85)
          );
          if (out) return { blob: out, ext: "webp" };
        }
      } finally {
        if (typeof bmp.close === "function") bmp.close();
      }
    }
  } catch {
    /* jatuh ke blob asli */
  }
  return { blob, ext: extOf(blob) };
}

/** Downscale untuk mode lokal (tanpa Supabase): dataURL jpeg agar muat di localStorage. */
async function blobToDataUrl(blob: Blob, maxDim = MAX_LOCAL_DIM): Promise<string> {
  const { blob: shrunk } = await blobToWebp(blob, maxDim);
  if (shrunk.type === "image/webp") {
    // webp dataURL tetap didukung browser modern; pakai langsung.
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(shrunk);
    });
  }
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(shrunk);
  });
}

/** Ambil semua data-storage-path unik dari HTML note. */
export function extractImagePaths(html: string): string[] {
  try {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    const out = new Set<string>();
    doc.querySelectorAll("figure.rt-image[data-storage-path]").forEach((f) => {
      const p = (f as HTMLElement).dataset.storagePath;
      if (p) out.add(p);
    });
    return [...out];
  } catch {
    return [];
  }
}

/**
 * Simpan gambar blob ke Storage (R2 lewat Edge Function) dan tulis ulang HTML.
 * - figure dengan file pending (baru/crop/replace) → upload → set data-storage-path (R2 key).
 * - figure blob tanpa file (URL mati) → dibuang dari HTML.
 * - figure storage yang tidak berubah → dipertahankan (src dinormalisasi ke path).
 * - img telanjang (hasil paste) → dibungkus figure + diberi id.
 * - mode lokal (tanpa Supabase) → blob diubah jadi dataURL downscale.
 * - Gambar lama dari Supabase Storage (path notes/...) dibiarkan utuh; URL signed dibuat lewat EF.
 */
export async function persistNoteImages(
  html: string,
  pending: PendingNoteImages,
  opts: { userId: string; noteId: string }
): Promise<string> {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const body = doc.body;

  // Bungkus img telanjang menjadi figure (hasil paste dari luar).
  body.querySelectorAll("img").forEach((img) => {
    if ((img as HTMLElement).closest("figure.rt-image")) return;
    const src = img.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) return;
    const fig = doc.createElement("figure");
    fig.className = "rt-image";
    fig.setAttribute("data-image-id", randImageId());
    img.replaceWith(fig);
    fig.appendChild(img);
    const cap = doc.createElement("figcaption");
    cap.textContent = "";
    fig.appendChild(cap);
  });

  const figures = Array.from(body.querySelectorAll("figure.rt-image"));
  for (const figEl of figures) {
    const fig = figEl as HTMLElement;
    let id = fig.dataset.imageId;
    if (!id) {
      id = randImageId();
      fig.dataset.imageId = id;
    }
    const img = fig.querySelector("img") as HTMLImageElement | null;
    if (!img) {
      fig.remove();
      continue;
    }
    const src = img.getAttribute("src") ?? "";
    const storagePath = fig.dataset.storagePath || "";
    const file = pending.files.get(id) ?? (src.startsWith("blob:") ? pending.files.get(src) : undefined);

    if (file) {
      if (!isSupabaseConfigured) {
        try {
          img.setAttribute("src", await blobToDataUrl(file));
        } catch {
          fig.remove();
          continue;
        }
        pending.files.delete(id);
        pending.files.delete(src);
        continue;
      }
      const { blob, ext } = await blobToWebp(file);

      // Upload ke R2 lewat Edge Function
      const form = new FormData();
      form.append("note_id", opts.noteId);
      form.append("file", new File([blob], `image.${ext}`, { type: blob.type || `image/${ext}` }));

      const res = await fetch(`${FUNCTIONS_BASE()}?action=upload-note`, {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      if (!res.ok) throw await r2Error(res, "Upload gambar gagal");

      const data = (await res.json()) as { key: string; name: string; size: number };
      fig.dataset.storagePath = data.key;
      fig.removeAttribute("data-dirty");
      img.setAttribute("src", data.key); // simpan R2 key; resolveNoteImageUrls ganti ke presigned URL
      img.setAttribute("alt", captionTextOf(fig) || "Gambar note");
      pending.files.delete(id);
      pending.files.delete(src);
      if (src.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(src);
        } catch {
          /* abaikan */
        }
      }
      continue;
    }

    if (src.startsWith("blob:")) {
      // Blob tanpa file (mis. sesi hilang) — buang agar tidak tersimpan mati.
      fig.remove();
      continue;
    }
    if (storagePath) {
      // Pertahankan key R2 / path Supabase lama
      img.setAttribute("src", storagePath);
      img.setAttribute("alt", captionTextOf(fig) || "Gambar note");
      continue;
    }
    // Gambar eksternal (http) hasil paste — biarkan apa adanya (di luar storage).
  }

  renumberNoteImages(body);
  return body.innerHTML;
}

/** Hapus path storage (best effort — gagal hapus tidak menggagalkan save). */
export async function finalizeNoteImageDeletions(paths: string[]): Promise<void> {
  const uniq = [...new Set((paths ?? []).filter(Boolean))];
  if (uniq.length === 0 || !isSupabaseConfigured) return;
  try {
    const res = await fetch(`${FUNCTIONS_BASE()}?action=delete-note`, {
      method: "POST",
      headers: await authHeaders(true),
      body: JSON.stringify({ paths: uniq }),
    });
    if (!res.ok) console.warn("[note-images] gagal hapus file:", await res.text());
  } catch (e) {
    console.warn("[note-images] gagal hapus file:", e);
  }
}

/** Hapus seluruh folder gambar sebuah note (dipakai saat note dihapus). */
export async function deleteNoteImageFolder(userId: string, noteId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const res = await fetch(`${FUNCTIONS_BASE()}?action=delete-note-folder`, {
      method: "POST",
      headers: await authHeaders(true),
      body: JSON.stringify({ note_id: noteId }),
    });
    if (!res.ok) console.warn("[note-images] gagal bersihkan folder gambar:", await res.text());
  } catch (e) {
    console.warn("[note-images] gagal bersihkan folder gambar:", e);
  }
}

/* ── Presigned URL (R2 via Edge Function, cache sesi) ───────────── */

type CachedUrl = { url: string; exp: number };
const urlCache = new Map<string, CachedUrl>();

async function signedUrlsFor(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!isSupabaseConfigured) return out;
  const now = Date.now();
  const fresh = paths.filter((p) => {
    const c = urlCache.get(p);
    if (c && c.exp > now + 5 * 60 * 1000) {
      out.set(p, c.url);
      return false;
    }
    return true;
  });
  if (fresh.length > 0) {
    try {
      const res = await fetch(`${FUNCTIONS_BASE()}?action=sign-note`, {
        method: "POST",
        headers: await authHeaders(true),
        body: JSON.stringify({ paths: fresh }),
      });
      if (!res.ok) throw new Error(`Sign gagal: ${res.status}`);
      const data = (await res.json()) as { urls: Record<string, string> };
      for (const [path, url] of Object.entries(data.urls ?? {})) {
        urlCache.set(path, { url, exp: now + SIGNED_URL_TTL * 1000 });
        out.set(path, url);
      }
    } catch (e) {
      console.warn("[note-images] gagal buat presigned URL:", e);
    }
  }
  return out;
}

/**
 * Tukar data-storage-path menjadi presigned URL pada <img> di dalam container.
 * Mendukung R2 key (notes/...) DAN path Supabase lama (notes/...).
 * Dipakai editor (mode baca-tulis) maupun tampilan read-only. Idempotent.
 */
export async function resolveNoteImageUrls(container: HTMLElement): Promise<void> {
  const imgs = Array.from(
    container.querySelectorAll("figure.rt-image[data-storage-path] > img")
  ) as HTMLImageElement[];
  const wanted = new Map<string, HTMLImageElement[]>();
  for (const img of imgs) {
    const fig = img.closest("figure.rt-image") as HTMLElement | null;
    const path = fig?.dataset.storagePath;
    if (!path) continue;
    const cur = img.getAttribute("src") ?? "";
    if (cur.startsWith("blob:") || cur.startsWith("data:") || cur.startsWith("http")) continue;
    if (!wanted.has(path)) wanted.set(path, []);
    wanted.get(path)!.push(img);
  }
  if (wanted.size === 0) return;
  const urls = await signedUrlsFor([...wanted.keys()]);
  // Terapkan hanya bila figure masih menempel di container yang sama.
  for (const [path, list] of wanted) {
    const url = urls.get(path);
    if (!url) continue;
    for (const img of list) {
      if (img.isConnected && container.contains(img)) img.src = url;
    }
  }
}

/* ── Caption & auto-numbering Gambar {H1}.{seq} ─────────────── */

const CAPTION_RE = /^Gambar\s+(\d+)\.(\d+)\b([\s\S]*)$/;

function captionTextOf(fig: HTMLElement): string {
  return (fig.querySelector("figcaption")?.textContent ?? "").trim();
}

/**
 * Hitung ulang caption `Gambar {section}.{seq}`.
 * - Section = H1 pendahulu (1-based); konten sebelum H1 pertama = section 1.
 * - Suffix kustom (" — ...") dipertahankan; caption yang tidak berformat
 *   `Gambar N.M` (custom penuh) tidak disentuh.
 * - Figcaption yang sedang memegang caret dilewati agar caret tidak lompat.
 * - Return true bila ada caption yang diubah.
 */
export function renumberNoteImages(root: ParentNode): boolean {
  let nodes: Element[];
  try {
    nodes = Array.from(root.querySelectorAll("h1, figure.rt-image"));
  } catch {
    return false;
  }
  let sel: Selection | null = null;
  try {
    sel = (root.getRootNode() as Document).getSelection?.() ?? null;
  } catch {
    sel = null;
  }
  let sec = 0;
  const seq = new Map<number, number>();
  let changed = false;
  for (const n of nodes) {
    if (n.tagName === "H1") {
      sec++;
      continue;
    }
    const s = sec === 0 ? 1 : sec;
    const k = (seq.get(s) ?? 0) + 1;
    seq.set(s, k);
    const cap = (n as HTMLElement).querySelector("figcaption");
    if (!cap) continue;
    if (sel && sel.rangeCount > 0 && cap.contains(sel.anchorNode)) continue;
    const text = (cap.textContent ?? "").trim();
    if (text === "") {
      cap.textContent = `Gambar ${s}.${k}`;
      changed = true;
      continue;
    }
    const m = text.match(CAPTION_RE);
    if (!m) continue; // caption custom penuh — jangan sentuh
    const suffix = (m[3] ?? "").replace(/\s+$/, "");
    const want = `Gambar ${s}.${k}${suffix}`;
    if (text !== want) {
      cap.textContent = want;
      changed = true;
    }
  }
  return changed;
}

/** Caption default untuk gambar yang disisip di posisi node tertentu. */
export function nextCaptionAt(root: ParentNode, atNode: Node | null): string {
  let nodes: Element[];
  try {
    nodes = Array.from(root.querySelectorAll("h1, figure.rt-image"));
  } catch {
    return "Gambar 1.1";
  }
  let sec = 0;
  const seq = new Map<number, number>();
  for (const n of nodes) {
    if (
      atNode &&
      (n === atNode ||
        (typeof atNode.compareDocumentPosition === "function" &&
          (atNode.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0))
    ) {
      break;
    }
    if (n.tagName === "H1") sec++;
    else {
      const s = sec === 0 ? 1 : sec;
      seq.set(s, (seq.get(s) ?? 0) + 1);
    }
  }
  const s = sec === 0 ? 1 : sec;
  return `Gambar ${s}.${(seq.get(s) ?? 0) + 1}`;
}

/** Unduh bytes gambar storage (autentikasi) — untuk crop/replace tanpa masalah CORS.
 *  Hanya R2 via Edge Function proxy. */
export async function downloadNoteImage(path: string): Promise<Blob> {
  if (!isSupabaseConfigured) throw new Error("Storage tidak dikonfigurasi");

  const res = await fetch(`${FUNCTIONS_BASE()}?action=download`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({ file_id: path }),
  });
  if (!res.ok) throw new Error(`Unduh gambar gagal: ${res.status}`);
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("File kosong");
  return blob;
}
