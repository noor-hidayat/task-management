import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Gambar di dalam Note Editor (Word/Notion-like).
 *
 * Arsitektur:
 * - Selama editing, gambar BARU hidup sebagai blob: URL + File di memori
 *   (instant preview, nol orphan bila dialog dibatalkan).
 * - Saat Save, `persistNoteImages()` mengunggah blob ke Supabase Storage privat
 *   (`notes/{user_id}/{note_id}/image-{id}.webp`) dan menulis ulang HTML dengan
 *   `data-storage-path`. Database TIDAK menyimpan binary/base64.
 * - Saat tampil (editor & read-only), `resolveNoteImageUrls()` menukar
 *   `data-storage-path` menjadi signed URL berumur pendek. Bucket privat +
 *   RLS mengikuti permission Note (owner / shared / admin).
 * - Caption auto-numbering `Gambar {H1 section}.{sequence}` dihitung dari DOM
 *   (`renumberNoteImages`), mengikuti H1 dan diperbarui saat hapus/pindah.
 */

export const NOTE_IMAGES_BUCKET = "notes";
/** Umur signed URL (detik) — pendek agar URL kedaluwarsa tidak bisa disebar bebas. */
const SIGNED_URL_TTL = 3600;
/** Batas dimensi upload agar file tetap ringan (aspect ratio dipertahankan). */
const MAX_UPLOAD_DIM = 2560;
/** Batas dimensi untuk mode lokal (tanpa Supabase, dataURL di localStorage). */
const MAX_LOCAL_DIM = 1280;

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
 * Simpan gambar blob ke Storage dan tulis ulang HTML.
 * - figure dengan file pending (baru/crop/replace) → upload (upsert) → set data-storage-path.
 * - figure blob tanpa file (URL mati) → dibuang dari HTML.
 * - figure storage yang tidak berubah → dipertahankan (src dinormalisasi ke path).
 * - img telanjang (hasil paste) → dibungkus figure + diberi id.
 * - mode lokal (tanpa Supabase) → blob diubah jadi dataURL downscale.
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
      const path = storagePath || `${opts.userId}/${opts.noteId}/image-${randImageId("image").replace(/^image_/, "")}.${ext}`;
      const { error } = await supabase.storage
        .from(NOTE_IMAGES_BUCKET)
        .upload(path, blob, {
          contentType: blob.type || "image/webp",
          upsert: true,
        });
      if (error) throw new Error(`Upload gambar gagal: ${error.message}`);
      fig.dataset.storagePath = path;
      fig.removeAttribute("data-dirty");
      img.setAttribute("src", path);
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
    const { error } = await supabase.storage.from(NOTE_IMAGES_BUCKET).remove(uniq);
    if (error) console.warn("[note-images] gagal hapus file:", error.message);
  } catch (e) {
    console.warn("[note-images] gagal hapus file:", e);
  }
}

/** Hapus seluruh folder gambar sebuah note (dipakai saat note dihapus). */
export async function deleteNoteImageFolder(userId: string, noteId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const prefix = `${userId}/${noteId}`;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(NOTE_IMAGES_BUCKET)
        .list(prefix, { limit: 1000 });
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return;
      const paths = data.map((f) => `${prefix}/${f.name}`);
      const { error: delErr } = await supabase.storage.from(NOTE_IMAGES_BUCKET).remove(paths);
      if (delErr) throw new Error(delErr.message);
      if (data.length < 1000) return;
    }
  } catch (e) {
    console.warn("[note-images] gagal bersihkan folder gambar:", e);
  }
}

/* ── Signed URL (cache sesi) ─────────────────────────────────── */

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
      const { data, error } = await supabase.storage
        .from(NOTE_IMAGES_BUCKET)
        .createSignedUrls(fresh, SIGNED_URL_TTL);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        if (row?.path && row?.signedUrl) {
          urlCache.set(row.path, { url: row.signedUrl, exp: now + SIGNED_URL_TTL * 1000 });
          out.set(row.path, row.signedUrl);
        }
      }
    } catch (e) {
      console.warn("[note-images] gagal buat signed URL:", e);
    }
  }
  return out;
}

/**
 * Tukar data-storage-path menjadi signed URL pada <img> di dalam container.
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

/** Unduh bytes gambar storage (autentikasi) — untuk crop/replace tanpa masalah CORS. */
export async function downloadNoteImage(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(NOTE_IMAGES_BUCKET).download(path);
  if (error || !data) throw new Error(`Unduh gambar gagal: ${error?.message ?? "unknown"}`);
  return data;
}
