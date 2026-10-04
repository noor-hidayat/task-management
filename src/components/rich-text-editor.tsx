import { useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  AtSign,
  List,
  ListOrdered,
  ListChecks,
  Minus,
  Maximize,
  Minimize,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Table as TableIcon,
  Type,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  downloadNoteImage,
  emptyPendingNoteImages,
  extractImagePaths,
  nextCaptionAt,
  randImageId,
  renumberNoteImages,
  resolveNoteImageUrls,
  type PendingNoteImages,
} from "@/lib/api/noteImages";
import { ImageCropDialog } from "@/components/image-crop-dialog";

/** Sanitasi ringan untuk HTML hasil editor: buang script & event handler. */
export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed|form|button)[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=[^\s>]+/gi, "")
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/href='javascript:[^']*'/gi, "href='#'")
    .replace(/src="javascript:[^"]*"/gi, 'src=""');
}

/** Tampilan read-only untuk HTML hasil editor (dipakai di halaman detail). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const clean = (html || "").trim();
  if (!clean) return <span className="text-sm text-muted-foreground">—</span>;
  if (!/<[a-z][\s\S]*>/i.test(clean)) {
    return <p className={cn("text-sm whitespace-pre-wrap", className)}>{clean}</p>;
  }
  return (
    <div
      className={cn("rich-content text-sm", className)}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(clean) }}
    />
  );
}

function isEmptyHtml(html: string) {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length === 0;
}

/** Handle imperatif editor (dipakai dialog Note untuk ambil file gambar pending). */
export type RichTextEditorHandle = {
  getPendingImages(): PendingNoteImages;
  resetPendingImages(): void;
};

export function RichTextEditor({
  value,
  onChange,
  users = [],
  placeholder = "Write description…",
  height = 320,
  imageSupport = false,
  fullscreen: fullscreenProp = false,
  onFullscreenChange,
  ref: handleRef,
}: {
  value: string;
  onChange: (html: string) => void;
  users?: string[];
  placeholder?: string;
  height?: number;
  /** Aktifkan dukungan gambar (hanya Note). Editor lain (Task/Issue) biarkan false. */
  imageSupport?: boolean;
  /** Tampilkan tombol full page. Klik tombol memicu onFullscreenChange(true). */
  fullscreen?: boolean;
  /** Dipanggil saat tombol full page diklik (true) / ESC (false). */
  onFullscreenChange?: (fullscreen: boolean) => void;
  ref?: React.Ref<RichTextEditorHandle>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false });
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const [tableMenu, setTableMenu] = useState<{ kind: "row" | "col" | "all" | "image" } | null>(null);
  const [tableHover, setTableHover] = useState(false);
  const menuCellRef = useRef<HTMLTableCellElement | null>(null);
  const resizeRef = useRef<{
    dir: "col" | "row";
    table: HTMLTableElement;
    colIdx: number;
    rowIdx: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    tableWidth: number;
  } | null>(null);

  /* ── State gambar Note (aktif hanya bila imageSupport) ── */
  const pendingFiles = useRef(new Map<string, File | Blob>());
  const pendingUrls = useRef(new Map<string, string>());
  const removedPaths = useRef<string[]>([]);
  const seenPaths = useRef<Set<string> | null>(null);
  const seenValueRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetRef = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuImageRef = useRef<HTMLElement | null>(null);
  const imgResizeRef = useRef<{ id: string; startX: number; startW: number; maxW: number } | null>(null);
  const cropRevokeRef = useRef<string | null>(null);
  const [imageHover, setImageHover] = useState(false);
  const [selImageId, setSelImageId] = useState<string | null>(null);
  const [selRect, setSelRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cropState, setCropState] = useState<{ src: string; imageId: string; revoke: boolean } | null>(null);

  useImperativeHandle(
    handleRef,
    () => ({
      getPendingImages: () => ({
        files: new Map(pendingFiles.current),
        removedPaths: [...removedPaths.current],
      }),
      resetPendingImages: () => {
        pendingFiles.current.clear();
        pendingUrls.current.clear();
        removedPaths.current = [];
        seenPaths.current = null; // seed ulang dari value saat sync berikutnya
        seenValueRef.current = null;
        setSelImageId(null);
        setSelRect(null);
      },
    }),
    []
  );

  /* Fullscreen: kunci scroll body + ESC keluar. Bila editor dipakai di dalam
     Dialog, panggil onFullscreenChange agar parent bisa menyesuaikan bila perlu. */
  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onFullscreenChange?.(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      onFullscreenChange?.(false);
    };
  }, [fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sinkron saat value direset dari luar (dialog dibuka ulang).
  // Dilewati saat user sedang mengetik (editor fokus) agar caret tidak lompat.
  // Sekalian migrasi indentasi lama (4 spasi non-breaking) jadi unit tab atomik.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Jangan timpa isi saat user sedang mengetik (fokus di dalam editor).
    if (el.contains(document.activeElement)) return;
    const normalized = (value || "").replace(
      /(?:&nbsp;){4}/g,
      '<span class="rt-tab" contenteditable="false">&nbsp;</span>'
    );
    if (el.innerHTML !== normalized) el.innerHTML = normalized;
    if (imageSupport) {
      if (seenPaths.current === null || seenValueRef.current !== normalized) {
        seenPaths.current = new Set(extractImagePaths(normalized));
        seenValueRef.current = normalized;
      }
      void resolveNoteImageUrls(el);
    }
  }, [value, imageSupport]);

  /** Sinkronkan bookkeeping gambar dengan DOM (tangkap hapus via keyboard/cut). */
  const reconcileImageState = () => {
    const el = ref.current;
    if (!el) return;
    const present = new Set<string>();
    const presentPaths = new Set<string>();
    el.querySelectorAll("figure.rt-image").forEach((f) => {
      const h = f as HTMLElement;
      if (h.dataset.imageId) present.add(h.dataset.imageId);
      if (h.dataset.storagePath) presentPaths.add(h.dataset.storagePath);
    });
    if (seenPaths.current === null) {
      seenPaths.current = presentPaths; // seed awal — belum ada yang dianggap dihapus
      return;
    }
    for (const prev of seenPaths.current) {
      if (!presentPaths.has(prev) && !removedPaths.current.includes(prev)) {
        removedPaths.current.push(prev);
      }
    }
    seenPaths.current = presentPaths;
    for (const id of [...pendingFiles.current.keys()]) {
      if (!present.has(id)) {
        pendingFiles.current.delete(id);
        const u = pendingUrls.current.get(id);
        if (u) {
          pendingUrls.current.delete(id);
          try {
            URL.revokeObjectURL(u);
          } catch {
            /* abaikan */
          }
        }
      }
    }
  };

  const emit = () => {
    if (ref.current && imageSupport) {
      reconcileImageState();
      renumberNoteImages(ref.current);
    }
    onChange(ref.current?.innerHTML ?? "");
    refreshActive();
  };

  const refreshActive = () => {
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
      });
    } catch {}
  };

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch {}
    emit();
  };

  const setBlock = (tag: "p" | "h1" | "h2" | "h3" | "blockquote" | "pre") => exec("formatBlock", tag);

  const addLink = () => {
    const sel = window.getSelection();
    const selected = sel?.toString().trim() ?? "";
    const url = window.prompt("URL link:", "https://");
    if (!url) return;
    ref.current?.focus();
    try {
      if (!selected) document.execCommand("insertText", false, url);
      document.execCommand("createLink", false, url);
    } catch {}
    emit();
  };

  const makeCheckItem = (): HTMLLIElement => {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.setAttribute("contenteditable", "false");
    li.appendChild(cb);
    li.appendChild(document.createTextNode(" "));
    return li;
  };

  /** Caret tepat di samping checkbox (awal teks item). */
  const caretToCheckItem = (li: HTMLLIElement, atEnd = false) => {
    const sel = window.getSelection();
    if (!sel) return;
    let target: Text | null = null;
    for (const n of Array.from(li.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").length > 0) {
        target = n as Text;
        if (!atEnd) break;
      }
    }
    if (!target) {
      target = document.createTextNode(" ");
      li.appendChild(target);
    }
    const range = document.createRange();
    range.setStart(target, atEnd ? target.length : 0);
    // Lewati spasi awal saat posisi di awal
    if (!atEnd && target.textContent?.startsWith(" ")) range.setStart(target, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const taskLiOf = (node: Node | null): HTMLLIElement | null => {
    if (!node || !ref.current) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const li = el?.closest("li") as HTMLLIElement | null;
    if (li && li.closest("ul.rt-task-list") && ref.current.contains(li)) return li;
    return null;
  };

  const liTextEmpty = (li: HTMLLIElement): boolean => {
    const clone = li.cloneNode(true) as HTMLLIElement;
    clone.querySelectorAll("input").forEach((i) => i.remove());
    return (clone.textContent ?? "").replace(/ /g, "").trim().length === 0;
  };

  const insertChecklist = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const ul = document.createElement("ul");
    ul.className = "rt-task-list";
    const li = makeCheckItem();
    ul.appendChild(li);
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(ul);
      // Paragraf kosong setelah list agar bisa keluar dari checklist
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      ul.after(p);
    } else {
      el.appendChild(ul);
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      el.appendChild(p);
    }
    caretToCheckItem(li);
    emit();
  };

  /** Enter di dalam item checklist: item kosong -> keluar list, else item baru. */
  const checklistEnter = (li: HTMLLIElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const ul = li.parentElement;
    if (liTextEmpty(li)) {
      // Item kosong: keluar dari checklist
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      if (ul && ul.children.length === 1) {
        ul.replaceWith(p);
      } else {
        ul?.after(p);
        li.remove();
      }
      const range = document.createRange();
      range.setStart(p, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      emit();
      return;
    }
    const range = sel.getRangeAt(0);
    const after = range.extractContents();
    const newLi = makeCheckItem();
    // Pindahkan sisa teks (setelah caret) ke item baru
    const fragNodes = Array.from(after.childNodes);
    // Buang <br> bawaan akhir li bila ada teks lain
    const hasText = fragNodes.some((n) => (n.textContent ?? "").replace(/ /g, "").trim().length > 0);
    for (const n of fragNodes) {
      if (n.nodeName === "BR" && hasText) continue;
      newLi.appendChild(n);
    }
    li.after(newLi);
    caretToCheckItem(newLi, true);
    // Pastikan ada paragraf setelah list terakhir agar bisa keluar
    const parentUl = newLi.parentElement;
    if (parentUl && !parentUl.nextElementSibling) {
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      parentUl.after(p);
    }
    emit();
  };

  const clearFormat = () => exec("removeFormat");

  const insertDivider = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand("insertHorizontalRule", false);
    } catch {}
    emit();
  };

  /* ── Table editing (insert / add-delete row/col, tab navigation) ── */

  /** Sel <td>/<th> tempat caret berada, bila ada. */
  const tableCellOf = (node: Node | null): HTMLTableCellElement | null => {
    if (!node || !ref.current) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const cell = el?.closest("td, th") as HTMLTableCellElement | null;
    if (cell && ref.current.contains(cell)) return cell;
    return null;
  };

  const insertTable = (rows = 3, cols = 3) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const table = document.createElement("table");
    table.className = "rt-table";
    const tbody = document.createElement("tbody");
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.innerHTML = "<br>";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(table);
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      table.after(p);
      const first = table.querySelector("td");
      if (first) {
        const nr = document.createRange();
        nr.setStart(first, 0);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    } else {
      el.appendChild(table);
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      el.appendChild(p);
    }
    emit();
  };

  /** Paste data tabular (mis. dari spreadsheet: sel dipisah Tab, baris dipisah newline). */
  const tsvToTable = (text: string): HTMLTableElement | null => {
    const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) return null;
    const grid = lines.map((l) => l.split("\t"));
    if (!grid.some((row) => row.length > 1)) return null;
    const table = document.createElement("table");
    table.className = "rt-table";
    const tbody = document.createElement("tbody");
    for (const row of grid) {
      const tr = document.createElement("tr");
      for (const val of row) {
        const td = document.createElement("td");
        td.textContent = val;
        if (!val) td.innerHTML = "<br>";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  };

  const onPaste = (e: React.ClipboardEvent) => {
    // Paste gambar (screenshot/file) — langsung jadi figure + caption.
    if (imageSupport) {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) {
        e.preventDefault();
        insertImageFiles(files);
        return;
      }
    }
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!text || !text.includes("	")) {
      // Paste HTML berisi <img> telanjang: biarkan default lalu bungkus jadi figure.
      if (imageSupport) {
        window.setTimeout(() => normalizeEditorImages(), 0);
      }
      return;
    }
    const table = tsvToTable(text);
    if (!table) return;
    e.preventDefault();
    const sel = window.getSelection();
    const el = ref.current;
    if (!el || !sel || sel.rangeCount === 0) {
      el?.appendChild(table);
      emit();
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(table);
    range.setStartAfter(table);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    emit();
  };

  /** Drop file gambar ke posisi drop; drop konten lain dibiarkan lalu numbering dirapikan. */
  const onDrop = (e: React.DragEvent) => {
    if (!imageSupport) return;
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      let range: Range | null = null;
      try {
        const doc = document as unknown as {
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
        };
        const r = doc.caretRangeFromPoint?.(e.clientX, e.clientY) ?? null;
        if (r && ref.current?.contains(r.startContainer)) range = r;
      } catch {
        /* abaikan — sisip di caret aktif */
      }
      insertImageFiles(files, range);
      return;
    }
    window.setTimeout(() => {
      if (ref.current) {
        renumberNoteImages(ref.current);
        emit();
      }
    }, 0);
  };

  /* ── Klik-kanan di garis tabel + resize kolom/baris ala Excel ── */

  const colIndexOf = (cell: HTMLTableCellElement): number =>
    Array.from(cell.parentElement?.children ?? []).indexOf(cell);

  /** Taruh caret di awal sel (dipakai saat klik-kanan agar toolbar tetap sinkron). */
  const caretToCellStart = (cell: HTMLTableCellElement) => {
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const insertRowAt = (cell: HTMLTableCellElement, where: "above" | "below") => {
    const row = cell.closest("tr");
    const table = cell.closest("table");
    if (!row || !table) return;
    const cols = row.children.length;
    const tr = document.createElement("tr");
    for (let i = 0; i < cols; i++) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      // Ikuti lebar kolom yang ada agar hasil resize tidak rusak.
      const refCell = row.children[i] as HTMLElement | undefined;
      if (refCell?.style.width) td.style.width = refCell.style.width;
      tr.appendChild(td);
    }
    if (where === "above") row.before(tr);
    else row.after(tr);
    emit();
  };

  const insertColAt = (cell: HTMLTableCellElement, where: "left" | "right") => {
    const table = cell.closest("table");
    if (!table) return;
    const idx = colIndexOf(cell) + (where === "right" ? 1 : 0);
    const widths: string[] = [];
    const firstRow = table.rows[0];
    if (firstRow) {
      for (const c of Array.from(firstRow.cells)) {
        widths.push((c as HTMLElement).style.width || "");
      }
    }
    for (const tr of Array.from(table.querySelectorAll("tr"))) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      const w = widths[Math.min(idx, widths.length - 1)] || widths[widths.length - 1];
      // Kolom baru meniru lebar kolom tetangga bila ada.
      const neighbor = tr.children[Math.min(idx, tr.children.length - 1)] as HTMLElement | undefined;
      td.style.width = neighbor?.style.width || w || "";
      const refCell = tr.children[idx] ?? null;
      tr.insertBefore(td, refCell);
    }
    emit();
  };

  const deleteRowAt = (cell: HTMLTableCellElement) => {
    const row = cell.closest("tr");
    const table = cell.closest("table");
    if (!row || !table) return;
    const tbody = row.parentElement;
    row.remove();
    if (tbody && tbody.querySelectorAll("tr").length === 0) table.remove();
    else if (table.querySelectorAll("tr").length === 0) table.remove();
    emit();
  };

  const deleteColAt = (cell: HTMLTableCellElement) => {
    const table = cell.closest("table");
    if (!table) return;
    const idx = colIndexOf(cell);
    for (const tr of Array.from(table.querySelectorAll("tr"))) {
      tr.children[idx]?.remove();
    }
    if (table.querySelectorAll("td, th").length === 0) table.remove();
    emit();
  };

  const deleteTableAt = (cell: HTMLTableCellElement) => {
    cell.closest("table")?.remove();
    emit();
  };

  /** Toggle header row: baris pertama <td> <-> <th>. */
  const toggleHeaderRow = (cell: HTMLTableCellElement) => {
    const table = cell.closest("table");
    if (!table) return;
    const firstRow = table.rows[0] as HTMLTableRowElement | null;
    if (!firstRow) return;
    const isHeader = firstRow.querySelector("th") !== null;
    for (const cellEl of Array.from(firstRow.cells)) {
      const newEl = document.createElement(isHeader ? "td" : "th");
      newEl.innerHTML = cellEl.innerHTML;
      // pindah style/attrs
      Array.from(cellEl.attributes).forEach((a) => newEl.setAttribute(a.name, a.value));
      cellEl.replaceWith(newEl);
    }
    emit();
  };

  /** Cek apakah baris pertama sudah header. */
  const isHeaderRow = (cell: HTMLTableCellElement): boolean => {
    const table = cell.closest("table");
    if (!table) return false;
    const firstRow = table.rows[0];
    return firstRow?.querySelector("th") !== null;
  };

  /** Excel: Enter = sel ke bawah, Shift+Enter = sel ke atas (kolom sama). */
  const moveTableRow = (delta: 1 | -1) => {
    const cell = tableCellOf(window.getSelection()?.anchorNode ?? null);
    const table = cell?.closest("table");
    if (!cell || !table) return;
    const rows = Array.from(table.rows);
    const tr = cell.parentElement as HTMLTableRowElement | null;
    const r = tr ? rows.indexOf(tr) : -1;
    const c = colIndexOf(cell);
    if (r < 0 || c < 0) return;
    let nr = r + delta;
    if (nr >= rows.length && delta > 0) {
      // Baris terakhir + Enter: tambah baris baru (konsisten dengan Tab).
      const cols = rows[0]?.cells.length ?? c + 1;
      const newTr = document.createElement("tr");
      for (let k = 0; k < cols; k++) {
        const td = document.createElement("td");
        td.innerHTML = "<br>";
        const refW = rows[0]?.cells[k] as HTMLElement | undefined;
        if (refW?.style.width) td.style.width = refW.style.width;
        newTr.appendChild(td);
      }
      (table.querySelector("tbody") ?? table).appendChild(newTr);
      emit();
      nr = rows.length; // indeks baris yang baru ditambah
    }
    if (nr < 0 || nr >= table.rows.length) return;
    const target = table.rows[nr]?.cells[Math.min(c, table.rows[nr].cells.length - 1)];
    if (!target) return;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    refreshActive();
  };

  /* ── Gambar Note (figure.rt-image + caption + numbering) ── */

  const figureOf = (node: Node | null): HTMLElement | null => {
    if (!node || !ref.current) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const fig = el?.closest("figure.rt-image") as HTMLElement | null;
    if (fig && ref.current.contains(fig)) return fig;
    return null;
  };

  const figcaptionOf = (node: Node | null): HTMLElement | null => {
    if (!node || !ref.current) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const cap = el?.closest("figcaption") as HTMLElement | null;
    if (cap && ref.current.contains(cap) && cap.closest("figure.rt-image")) return cap;
    return null;
  };

  const ensureFigureId = (fig: HTMLElement): string => {
    let id = fig.dataset.imageId;
    if (!id) {
      id = randImageId();
      fig.dataset.imageId = id;
    }
    return id;
  };

  /** Sisipkan file gambar sebagai figure + caption di posisi caret. */
  const insertImageFiles = (files: FileList | File[], atRange?: Range | null) => {
    const el = ref.current;
    if (!el || !imageSupport) return;
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    el.focus();
    const sel = window.getSelection();
    let range = atRange ?? (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
    if (!range || !el.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.collapse(false);
    let lastFig: HTMLElement | null = null;
    for (const file of list) {
      const id = randImageId();
      const url = URL.createObjectURL(file);
      pendingFiles.current.set(id, file);
      pendingUrls.current.set(id, url);
      const fig = document.createElement("figure");
      fig.className = "rt-image";
      fig.dataset.imageId = id;
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Gambar note";
      const cap = document.createElement("figcaption");
      cap.textContent = nextCaptionAt(el, range.startContainer);
      fig.appendChild(img);
      fig.appendChild(cap);
      range.insertNode(fig);
      range.setStartAfter(fig);
      range.collapse(true);
      lastFig = fig;
      img.onload = () => {
        try {
          if (!fig.isConnected || fig.style.width) return;
          const w = Math.min(img.naturalWidth || 720, 720);
          if (w > 0) {
            fig.style.width = `${w}px`;
            emit();
          }
        } catch {
          /* abaikan */
        }
      };
    }
    if (lastFig) {
      if (!lastFig.nextSibling) {
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        lastFig.after(p);
      }
      const after = lastFig.nextSibling;
      const r2 = document.createRange();
      if (after) {
        r2.selectNodeContents(after);
        r2.collapse(true);
      } else {
        r2.setStartAfter(lastFig);
        r2.collapse(true);
      }
      sel?.removeAllRanges();
      sel?.addRange(r2);
    }
    renumberNoteImages(el);
    emit();
  };

  /** Bungkus <img> telanjang hasil paste menjadi figure + caption. */
  const normalizeEditorImages = () => {
    const el = ref.current;
    if (!el || !imageSupport) return;
    let touched = false;
    el.querySelectorAll("img").forEach((img) => {
      if ((img as HTMLElement).closest("figure.rt-image")) return;
      const src = img.getAttribute("src") ?? "";
      if (!src) {
        img.remove();
        touched = true;
        return;
      }
      const fig = document.createElement("figure");
      fig.className = "rt-image";
      fig.dataset.imageId = randImageId();
      img.replaceWith(fig);
      fig.appendChild(img);
      const cap = document.createElement("figcaption");
      cap.textContent = "";
      fig.appendChild(cap);
      touched = true;
    });
    el.querySelectorAll("figure.rt-image").forEach((f) => {
      if (!(f as HTMLElement).dataset.imageId) {
        (f as HTMLElement).dataset.imageId = randImageId();
        touched = true;
      }
    });
    if (touched) {
      renumberNoteImages(el);
      emit();
    }
  };

  const deleteFigure = (fig: HTMLElement) => {
    const id = fig.dataset.imageId ?? "";
    const sp = fig.dataset.storagePath ?? "";
    const src = fig.querySelector("img")?.getAttribute("src") ?? "";
    if (id) {
      pendingFiles.current.delete(id);
      const u = pendingUrls.current.get(id);
      if (u) {
        pendingUrls.current.delete(id);
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* abaikan */
        }
      }
    }
    if (src.startsWith("blob:")) {
      const entry = [...pendingUrls.current.entries()].find(([, v]) => v === src);
      if (entry) {
        pendingUrls.current.delete(entry[0]);
        pendingFiles.current.delete(entry[0]);
      }
      try {
        URL.revokeObjectURL(src);
      } catch {
        /* abaikan */
      }
    }
    if (sp && !removedPaths.current.includes(sp)) removedPaths.current.push(sp);
    if (selImageId === id) {
      setSelImageId(null);
      setSelRect(null);
    }
    fig.remove();
    if (ref.current) renumberNoteImages(ref.current);
    emit();
  };

  const focusFigureCaption = (fig: HTMLElement) => {
    const el = ref.current;
    if (!el) return;
    let cap = fig.querySelector("figcaption") as HTMLElement | null;
    if (!cap) {
      cap = document.createElement("figcaption");
      cap.textContent = nextCaptionAt(el, fig);
      fig.appendChild(cap);
    }
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(cap);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  /** Enter di dalam caption: keluar ke paragraf setelah gambar (satu baris). */
  const exitCaption = (cap: HTMLElement) => {
    const fig = cap.closest("figure.rt-image");
    if (!fig || !ref.current) return;
    let next = fig.nextSibling;
    if (!next || (next as Element).nodeName !== "P") {
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      fig.after(p);
      next = p;
    }
    const r = document.createRange();
    r.selectNodeContents(next);
    r.collapse(true);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  const openCropForFigure = async (fig: HTMLElement) => {
    if (!imageSupport) return;
    const id = ensureFigureId(fig);
    const img = fig.querySelector("img") as HTMLImageElement | null;
    const storagePath = fig.dataset.storagePath ?? "";
    const pending = pendingFiles.current.get(id);
    try {
      let url = "";
      let revoke = false;
      if (pending) {
        url = URL.createObjectURL(pending);
        revoke = true;
      } else if (img && img.src.startsWith("blob:")) {
        url = img.src;
      } else if (storagePath) {
        const blob = await downloadNoteImage(storagePath);
        url = URL.createObjectURL(blob);
        revoke = true;
      } else if (img && /^https?:/.test(img.src)) {
        const res = await fetch(img.src);
        if (!res.ok) throw new Error("fetch gagal");
        url = URL.createObjectURL(await res.blob());
        revoke = true;
      } else {
        return;
      }
      cropRevokeRef.current = revoke ? url : null;
      setCropState({ src: url, imageId: id, revoke });
    } catch {
      /* sumber tak bisa dibaca (CORS/offline) — diamkan */
    }
  };

  const closeCropDialog = (open: boolean) => {
    if (!open) {
      if (cropRevokeRef.current) {
        try {
          URL.revokeObjectURL(cropRevokeRef.current);
        } catch {
          /* abaikan */
        }
        cropRevokeRef.current = null;
      }
      setCropState(null);
    }
  };

  const handleCropApply = (blob: Blob) => {
    const st = cropState;
    if (!st || !ref.current) return;
    const fig = ref.current.querySelector(
      `figure.rt-image[data-image-id="${CSS.escape(st.imageId)}"]`
    ) as HTMLElement | null;
    if (!fig) return;
    const img = fig.querySelector("img") as HTMLImageElement | null;
    const oldSrc = img?.getAttribute("src") ?? "";
    if (oldSrc.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(oldSrc);
      } catch {
        /* abaikan */
      }
    }
    pendingFiles.current.set(st.imageId, blob);
    const url = URL.createObjectURL(blob);
    pendingUrls.current.set(st.imageId, url);
    if (img) img.src = url;
    fig.dataset.dirty = "1";
    emit();
  };

  const requestReplaceImage = (fig: HTMLElement) => {
    replaceTargetRef.current = ensureFigureId(fig);
    replaceInputRef.current?.click();
  };

  const onToolbarImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? [...e.target.files] : [];
    e.target.value = "";
    if (files.length > 0) insertImageFiles(files);
  };

  const onReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const id = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !file.type.startsWith("image/") || !id || !ref.current) return;
    const fig = ref.current.querySelector(
      `figure.rt-image[data-image-id="${CSS.escape(id)}"]`
    ) as HTMLElement | null;
    if (!fig) return;
    const img = fig.querySelector("img") as HTMLImageElement | null;
    const oldSrc = img?.getAttribute("src") ?? "";
    if (oldSrc.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(oldSrc);
      } catch {
        /* abaikan */
      }
    }
    pendingFiles.current.set(id, file);
    const url = URL.createObjectURL(file);
    pendingUrls.current.set(id, url);
    if (img) img.src = url;
    fig.dataset.dirty = "1";
    emit();
  };

  const resetFigureSize = (fig: HTMLElement) => {
    fig.style.removeProperty("width");
    if (selImageId) positionOverlay(selImageId);
    emit();
  };

  const positionOverlay = (id: string | null) => {
    const wrap = wrapRef.current;
    const el = ref.current;
    if (!wrap || !el || !id) {
      setSelRect(null);
      return;
    }
    const fig = el.querySelector(
      `figure.rt-image[data-image-id="${CSS.escape(id)}"]`
    ) as HTMLElement | null;
    if (!fig) {
      setSelRect(null);
      return;
    }
    const w = wrap.getBoundingClientRect();
    const r = fig.getBoundingClientRect();
    setSelRect({ top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height });
  };

  const onEditorClick = (e: React.MouseEvent) => {
    if (!imageSupport) return;
    const t = e.target as Element;
    if (t.closest?.("[data-rt-img-overlay]")) return;
    const fig = t.closest?.("figure.rt-image") as HTMLElement | null;
    if (fig && ref.current?.contains(fig)) {
      const id = ensureFigureId(fig);
      setSelImageId(id);
      requestAnimationFrame(() => positionOverlay(id));
    } else {
      setSelImageId(null);
      setSelRect(null);
    }
  };

  const onImgResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el || !selImageId) return;
    const fig = el.querySelector(
      `figure.rt-image[data-image-id="${CSS.escape(selImageId)}"]`
    ) as HTMLElement | null;
    if (!fig) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    imgResizeRef.current = {
      id: selImageId,
      startX: e.clientX,
      startW: fig.offsetWidth,
      maxW: el.clientWidth,
    };
    window.addEventListener("pointermove", onImgResizeMove);
    window.addEventListener("pointerup", onImgResizeEnd, { once: true });
  };

  const onImgResizeMove = (e: PointerEvent) => {
    const st = imgResizeRef.current;
    const el = ref.current;
    if (!st || !el) return;
    const fig = el.querySelector(
      `figure.rt-image[data-image-id="${CSS.escape(st.id)}"]`
    ) as HTMLElement | null;
    if (!fig) return;
    const w = Math.max(80, Math.min(st.maxW - 8, st.startW + (e.clientX - st.startX)));
    fig.style.width = `${Math.round(w)}px`;
    positionOverlay(st.id);
  };

  const onImgResizeEnd = () => {
    window.removeEventListener("pointermove", onImgResizeMove);
    imgResizeRef.current = null;
    emit();
  };

  /** Ambil figure gambar yang sedang dipilih (selected). */
  const selectedFigure = (): HTMLElement | null => {
    const el = ref.current;
    if (!el || !selImageId) return null;
    return el.querySelector(
      `figure.rt-image[data-image-id="${CSS.escape(selImageId)}"]`
    ) as HTMLElement | null;
  };

  /**
   * Align gambar yang sedang dipilih. Gambar adalah elemen blok (figure),
   * jadi pakai margin auto untuk center/right dan margin 0 untuk left.
   */
  const alignSelectedImage = (align: "left" | "center" | "right" | "justify") => {
    const fig = selectedFigure();
    if (!fig) return;
    fig.style.marginLeft = align === "center" || align === "right" ? "auto" : "0";
    fig.style.marginRight = align === "center" ? "auto" : align === "right" ? "0" : "0";
    if (align === "left") {
      fig.style.marginLeft = "0";
      fig.style.marginRight = "auto";
    }
    if (align === "justify") {
      fig.style.marginLeft = "0";
      fig.style.marginRight = "auto";
      fig.style.width = "100%";
    }
    requestAnimationFrame(() => positionOverlay(selImageId));
    emit();
  };

  /** Jalankan align pada gambar terpilih bila ada, selain itu ke execCommand biasa. */
  const runAlign = (cmd: "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull") => {
    if (imageSupport && selectedFigure()) {
      const map = {
        justifyLeft: "left",
        justifyCenter: "center",
        justifyRight: "right",
        justifyFull: "justify",
      } as const;
      alignSelectedImage(map[cmd]);
      return;
    }
    exec(cmd);
  };

  useEffect(() => {
    if (!selImageId) return;
    const pos = () => positionOverlay(selImageId);
    window.addEventListener("resize", pos);
    window.addEventListener("scroll", pos, true);
    return () => {
      window.removeEventListener("resize", pos);
      window.removeEventListener("scroll", pos, true);
    };
  }, [selImageId]);

  const onTableContextMenu = (e: React.MouseEvent) => {
    // Mencatat sel/gambar + jenis menu; pembukaan menu ditangani ContextMenu shadcn.
    // Di luar tabel & gambar: biarkan menu bawaan browser (trigger disabled).
    const t = e.target as Element;
    if (imageSupport) {
      const fig = t.closest?.("figure.rt-image") as HTMLElement | null;
      if (fig && ref.current?.contains(fig)) {
        ensureFigureId(fig);
        menuImageRef.current = fig;
        setTableMenu({ kind: "image" });
        return;
      }
    }
    const cell = t.closest?.("td, th") as HTMLTableCellElement | null;
    if (!cell || !ref.current?.contains(cell)) return;
    try {
      caretToCellStart(cell);
    } catch {}
    menuCellRef.current = cell;
    // Vertikal (garis kolom) → menu kolom saja; horizontal (garis baris) → menu baris saja.
    const kind = menuKindAt(e, cell);
    setTableMenu((prev) => (prev?.kind === kind ? prev : { kind }));
  };

  const EDGE = 8;

  /** Jarak pointer ke tiap garis sel — dipakai menu klik-kanan. */
  const edgeDistances = (e: React.MouseEvent, cell: HTMLTableCellElement) => {
    const rect = cell.getBoundingClientRect();
    return {
      right: rect.right - e.clientX,
      left: e.clientX - rect.left,
      bottom: rect.bottom - e.clientY,
      top: e.clientY - rect.top,
    };
  };

  /** Tentukan menu apa yang muncul: garis vertikal → kolom, horizontal → baris. */
  const menuKindAt = (
    e: React.MouseEvent,
    cell: HTMLTableCellElement
  ): "row" | "col" | "all" => {
    const d = edgeDistances(e, cell);
    const nearV = (d.right >= 0 && d.right <= EDGE) || (d.left >= 0 && d.left <= EDGE);
    const nearH = (d.bottom >= 0 && d.bottom <= EDGE) || (d.top >= 0 && d.top <= EDGE);
    if (nearV && !nearH) return "col";
    if (nearH && !nearV) return "row";
    return "all";
  };

  type ResizeTarget =
    | { dir: "col"; cell: HTMLTableCellElement }
    | { dir: "row"; cell: HTMLTableCellElement }
    | { dir: "all"; cell: HTMLTableCellElement };

  /** Deteksi garis resize: tepi kanan/kiri → kolom, tepi bawah/atas → baris. */
  const resizeEdgeCell = (e: React.MouseEvent): ResizeTarget | null => {
    if (resizeRef.current) return null;
    const t = e.target as Element;
    const cell = t.closest?.("td, th") as HTMLTableCellElement | null;
    if (!cell || !ref.current?.contains(cell)) return null;
    const d = edgeDistances(e, cell);
    const nearRight = d.right >= 0 && d.right <= EDGE;
    const nearLeft = d.left >= 0 && d.left <= EDGE;
    const nearBottom = d.bottom >= 0 && d.bottom <= EDGE;
    const nearTop = d.top >= 0 && d.top <= EDGE;

    let colCell: HTMLTableCellElement | null = null;
    if (nearRight) colCell = cell;
    else if (nearLeft && cell.previousElementSibling) {
      colCell = cell.previousElementSibling as HTMLTableCellElement;
    }

    let rowCell: HTMLTableCellElement | null = null;
    if (nearBottom) rowCell = cell;
    else if (nearTop) {
      const tr = cell.parentElement as HTMLTableRowElement | null;
      const prevTr = tr?.previousElementSibling as HTMLTableRowElement | null;
      const idx = colIndexOf(cell);
      if (prevTr && prevTr.cells[idx]) rowCell = prevTr.cells[idx] as HTMLTableCellElement;
    }

    if (colCell && rowCell) return { dir: "all", cell };
    if (colCell) return { dir: "col", cell: colCell };
    if (rowCell) return { dir: "row", cell: rowCell };
    return null;
  };

  const onEditorMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    if (resizeRef.current) {
      el.style.cursor = resizeRef.current.dir === "col" ? "col-resize" : "row-resize";
      return;
    }
    const hit = resizeEdgeCell(e);
    el.style.cursor = !hit ? "" : hit.dir === "col" ? "col-resize" : hit.dir === "row" ? "row-resize" : "nwse-resize";
    // Lacak hover tabel/gambar agar ContextMenuTrigger aktif hanya di sana
    // (di luar itu klik-kanan memunculkan menu bawaan browser).
    const t = e.target as Element;
    const overCell = !!t.closest?.("td, th");
    setTableHover((prev) => (prev === overCell ? prev : overCell));
    const overImg = imageSupport && !!t.closest?.("figure.rt-image");
    setImageHover((prev) => (prev === overImg ? prev : overImg));
  };

  const rowIndexOf = (cell: HTMLTableCellElement): number => {
    const tr = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest("table");
    if (!tr || !table) return 0;
    return Array.from(table.rows).indexOf(tr as HTMLTableRowElement);
  };

  const onResizeMove = (e: MouseEvent) => {
    const st = resizeRef.current;
    if (!st) return;
    if (st.dir === "col") {
      const dx = e.clientX - st.startX;
      const next = Math.max(40, st.startWidth + dx);
      const diff = next - st.startWidth;
      for (const row of Array.from(st.table.rows)) {
        const c = row.cells[st.colIdx] as HTMLElement | undefined;
        if (c) c.style.width = `${next}px`;
      }
      st.table.style.width = `${st.tableWidth + diff}px`;
      st.table.style.tableLayout = "fixed";
    } else {
      const dy = e.clientY - st.startY;
      const next = Math.max(24, st.startHeight + dy);
      const row = st.table.rows[st.rowIdx];
      if (row) {
        for (const c of Array.from(row.cells)) {
          (c as HTMLElement).style.height = `${next}px`;
        }
      }
    }
  };

  const endResize = () => {
    resizeRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", endResize);
    emit();
  };

  const onEditorMouseDown = (e: React.MouseEvent) => {
    // Drag di garis tabel ala Excel — jangan pindahkan caret.
    const hit = resizeEdgeCell(e);
    if (hit && e.button === 0) {
      // Sudut (vertikal + horizontal): pilih yang jaraknya lebih dekat.
      let dir: "col" | "row" = hit.dir === "row" ? "row" : "col";
      let cell = hit.cell;
      if (hit.dir === "all") {
        const d = edgeDistances(e, hit.cell);
        const vDist = Math.min(d.right, d.left);
        const hDist = Math.min(d.bottom, d.top);
        dir = vDist <= hDist ? "col" : "row";
        if (dir === "col" && d.left < d.right && hit.cell.previousElementSibling) {
          cell = hit.cell.previousElementSibling as HTMLTableCellElement;
        } else if (dir === "row" && d.top < d.bottom) {
          const tr = hit.cell.parentElement as HTMLTableRowElement | null;
          const prevTr = tr?.previousElementSibling as HTMLTableRowElement | null;
          const idx = colIndexOf(hit.cell);
          if (prevTr && prevTr.cells[idx]) cell = prevTr.cells[idx] as HTMLTableCellElement;
        }
      }
      const table = cell.closest("table") as HTMLTableElement | null;
      if (!table) return;
      e.preventDefault();
      e.stopPropagation();
      if (dir === "col") {
        // Kunci lebar saat ini (px) agar drag terasa seperti Excel.
        const tableW = table.offsetWidth;
        table.style.width = `${tableW}px`;
        table.style.tableLayout = "fixed";
        for (const row of Array.from(table.rows)) {
          for (const c of Array.from(row.cells)) {
            (c as HTMLElement).style.width = `${(c as HTMLElement).offsetWidth}px`;
          }
        }
        resizeRef.current = {
          dir,
          table,
          colIdx: colIndexOf(cell),
          rowIdx: rowIndexOf(cell),
          startX: e.clientX,
          startY: e.clientY,
          startWidth: (cell as HTMLElement).offsetWidth,
          startHeight: (cell as HTMLElement).offsetHeight,
          tableWidth: tableW,
        };
        document.body.style.cursor = "col-resize";
      } else {
        // Kunci tinggi baris target agar drag vertikal stabil.
        const targetRow = table.rows[rowIndexOf(cell)];
        const h = (cell as HTMLElement).offsetHeight;
        if (targetRow) {
          for (const c of Array.from(targetRow.cells)) {
            if (!(c as HTMLElement).style.height) (c as HTMLElement).style.height = `${(c as HTMLElement).offsetHeight}px`;
          }
        }
        resizeRef.current = {
          dir,
          table,
          colIdx: colIndexOf(cell),
          rowIdx: rowIndexOf(cell),
          startX: e.clientX,
          startY: e.clientY,
          startWidth: (cell as HTMLElement).offsetWidth,
          startHeight: h,
          tableWidth: table.offsetWidth,
        };
        document.body.style.cursor = "row-resize";
      }
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onResizeMove);
      window.addEventListener("mouseup", endResize);
      return;
    }
    e.stopPropagation();
    ref.current?.focus();
  };

  // ---- Mention: deteksi "@..." sebelum caret ----
  const detectMention = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setMention(null);
      return;
    }
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !ref.current?.contains(node)) {
      setMention(null);
      return;
    }
    const before = node.textContent?.slice(0, sel.anchorOffset) ?? "";
    // "@" diikuti kata (boleh multi-kata); spasi ganda/newline menghentikan mention.
    const m = before.match(/@([\w]+(?:\s[\w]+)*)$/);
    if (m) setMention((prev) => ({ query: m[1], index: prev?.index ?? 0 }));
    else setMention(null);
  };

  const mentionList = mention
    ? users.filter((u) => u.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 5)
    : [];

  const insertMention = (name: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // Hapus "@query" sebelum caret
    const node = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const at = text.lastIndexOf("@", sel.anchorOffset - 1);
      if (at >= 0) {
        range.setStart(node, at);
        range.deleteContents();
      }
    }
    const span = document.createElement("span");
    span.className = "rt-mention";
    span.setAttribute("data-user", name);
    span.textContent = `@${name}`;
    range.insertNode(span);
    range.setStartAfter(span);
    range.insertNode(document.createTextNode(" "));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    setMention(null);
    emit();
  };

  /* ── Tab ala Word: satu unit tab atomik (hapus sekali = hilang satu tab) ── */

  /** Span .rt-tab yang bersebelahan langsung dengan caret (untuk hapus atomik). */
  const adjacentTab = (forward: boolean): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || !ref.current?.contains(node)) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const offset = sel.anchorOffset;
      if (!forward && offset === 0) {
        const prev = node.previousSibling;
        if (prev instanceof HTMLElement && prev.classList.contains("rt-tab")) return prev;
      }
      if (forward && offset === (node.textContent ?? "").length) {
        const next = node.nextSibling;
        if (next instanceof HTMLElement && next.classList.contains("rt-tab")) return next;
      }
      return null;
    }
    const el = node as HTMLElement;
    const idx = sel.anchorOffset;
    const child = (
      forward ? el.childNodes[idx] : idx > 0 ? el.childNodes[idx - 1] : undefined
    ) as ChildNode | undefined;
    if (child instanceof HTMLElement && child.classList.contains("rt-tab")) return child;
    return null;
  };

  /** Sisip satu unit tab (lebar seperti tab Word, bukan spasi). */
  const insertTabUnit = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    el.focus();
    const range = sel.getRangeAt(0);
    // Jangan hapus teks yang terseleksi — cukup pindah caret ke akhir seleksi.
    range.collapse(false);
    // Kalau caret nyangkut di dalam unit tab, keluar dulu ke belakangnya.
    const anchor = sel.anchorNode;
    const host =
      anchor instanceof Element
        ? anchor.closest(".rt-tab")
        : anchor?.parentElement?.closest(".rt-tab");
    if (host) {
      range.setStartAfter(host);
      range.collapse(true);
    }
    const span = document.createElement("span");
    span.className = "rt-tab";
    span.setAttribute("contenteditable", "false");
    span.innerHTML = "&nbsp;";
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    emit();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Hapus unit tab sekaligus (atomik) — Backspace maupun Delete.
    if (e.key === "Backspace" || e.key === "Delete") {
      const t = adjacentTab(e.key === "Delete");
      if (t) {
        e.preventDefault();
        t.remove();
        emit();
        return;
      }
    }
    // Escape: tutup seleksi gambar (bila tidak ada popup mention).
    if (e.key === "Escape" && selImageId && !(mention && mentionList.length > 0)) {
      setSelImageId(null);
      setSelRect(null);
      return;
    }

    // Align selected image via keyboard (Ctrl+Shift+L/C/R)
    if (imageSupport && selImageId && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      const align = e.key === "l" ? "left" : e.key === "r" ? "right" : e.key === "e" ? "center" : null;
      if (align) {
        e.preventDefault();
        alignSelectedImage(align);
        return;
      }
    }
    // Navigasi Tab di dalam tabel: pindah ke sel berikutnya.
    if (e.key === "Tab") {
      const cell = tableCellOf(
        (document.getSelection()?.anchorNode as Node | null) ?? null
      );
      if (cell) {
        e.preventDefault();
        const cells = Array.from(
          cell.closest("table")?.querySelectorAll("td, th") ?? []
        );
        const i = cells.indexOf(cell);
        const next = e.shiftKey ? cells[i - 1] : cells[i + 1];
        if (next) {
          const range = document.createRange();
          range.selectNodeContents(next);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } else if (!e.shiftKey) {
          // Sel terakhir: tambah baris baru agar Tab selalu bisa maju.
          const table = cell.closest("table");
          if (table) {
            const firstRow = table.rows[0];
            const cols =
              firstRow?.cells.length ?? cell.parentElement?.children.length ?? 1;
            const tr = document.createElement("tr");
            for (let i = 0; i < cols; i++) {
              const td = document.createElement("td");
              td.innerHTML = "<br>";
              const refW = firstRow?.cells[i] as HTMLElement | undefined;
              if (refW?.style.width) td.style.width = refW.style.width;
              tr.appendChild(td);
            }
            (table.querySelector("tbody") ?? table).appendChild(tr);
            emit();
          }
          requestAnimationFrame(() => {
            const fresh = Array.from(
              cell.closest("table")?.querySelectorAll("td, th") ?? []
            );
            const target = fresh[i + 1];
            if (target) {
              const range = document.createRange();
              range.selectNodeContents(target);
              range.collapse(false);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          });
        }
        return;
      }
    }
    if (e.key === "Enter") {
      // Mention diprioritaskan saat popup mention terbuka
      if (mention && mentionList.length > 0) {
        e.preventDefault();
        insertMention(mentionList[mention.index] ?? mentionList[0]);
        return;
      }
      // Enter di dalam caption gambar: keluar ke paragraf setelah gambar.
      if (imageSupport) {
        const cap = figcaptionOf(window.getSelection()?.anchorNode ?? null);
        if (cap) {
          e.preventDefault();
          exitCaption(cap);
          return;
        }
      }
      // Excel: Enter di tabel = pindah sel ke bawah, Shift+Enter = ke atas.
      // Alt+Enter dibiarkan lolos untuk baris baru di dalam sel.
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        const inCell = tableCellOf(window.getSelection()?.anchorNode ?? null);
        if (inCell) {
          e.preventDefault();
          moveTableRow(e.shiftKey ? -1 : 1);
          return;
        }
      }
      const li = taskLiOf(window.getSelection()?.anchorNode ?? null);
      if (li) {
        e.preventDefault();
        checklistEnter(li);
        return;
      }
    }
    if (mention && mentionList.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention({ ...mention, index: (mention.index + 1) % mentionList.length });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention({ ...mention, index: (mention.index - 1 + mentionList.length) % mentionList.length });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionList[mention.index] ?? mentionList[0]);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    // Tab di luar tabel: sisip satu unit tab ala Word (bukan spasi).
    // Shift+Tab menghapus satu unit tab sebelum caret. Ctrl/Meta/Alt+Tab
    // dibiarkan lolos agar fokus masih bisa dipindah secara native.
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) {
        const s = window.getSelection();
        // Seleksi aktif: jangan hapus apa-apa, cukup ciutkan caret.
        if (s && !s.isCollapsed) {
          s.collapseToStart();
          return;
        }
        const t = adjacentTab(false);
        if (t) {
          t.remove();
          emit();
          return;
        }
        // Fallback: hapus hingga 4 spasi biasa sebelum caret.
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const node = sel.anchorNode;
          if (node && node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? "";
            const m = text.slice(0, sel.anchorOffset).match(/ {1,4}$/);
            if (m) {
              const range = sel.getRangeAt(0);
              range.setStart(node, sel.anchorOffset - m[0].length);
              range.deleteContents();
              emit();
            }
          }
        }
        return;
      }
      insertTabUnit();
      return;
    }
  };

  const tool = "h-8 w-8 shrink-0";
  const toolActive = "bg-accent text-accent-foreground";
  const menuKind = tableMenu?.kind ?? "all";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring",
        fullscreen && "fixed inset-0 z-[60] flex flex-col rounded-none border-0"
      )}
    >
      {/* Toolbar */}
      <div className={cn(
        "flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5",
        fullscreen && "sticky top-0 z-10 bg-background"
      )}>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Heading 1" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("h1")}>
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Heading 2" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("h2")}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Heading 3" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("h3")}>
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Paragraf" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("p")}>
          <Type className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={cn(tool, active.bold && toolActive)} title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={cn(tool, active.italic && toolActive)} title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={cn(tool, active.underline && toolActive)} title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}>
          <Underline className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")}>
          <Strikethrough className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={tool} title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => runAlign("justifyLeft")}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => runAlign("justifyCenter")}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => runAlign("justifyRight")}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Justify" onMouseDown={(e) => e.preventDefault()} onClick={() => runAlign("justifyFull")}>
          <AlignJustify className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={cn(tool, active.ul && toolActive)} title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={cn(tool, active.ol && toolActive)} title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Checklist" onMouseDown={(e) => e.preventDefault()} onClick={insertChecklist}>
          <ListChecks className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Quote" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("blockquote")}>
          <Quote className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Code block" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("pre")}>
          <Code className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={tool} title="Link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Mention (@name)" onMouseDown={(e) => e.preventDefault()} onClick={() => { ref.current?.focus(); try { document.execCommand("insertText", false, "@"); } catch {} emit(); }}>
          <AtSign className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Divider" onMouseDown={(e) => e.preventDefault()} onClick={insertDivider}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={tool} title="Insert table (3×3)" onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 3)}>
          <TableIcon className="h-4 w-4" />
        </Button>
        {imageSupport && (
          <Button type="button" variant="ghost" size="icon" className={tool} title="Insert image (upload)" onMouseDown={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
          </Button>
        )}
        {fullscreenProp && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={tool}
            title={fullscreen ? "Keluar full page" : "Full page"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" className={tool} title="Clear format" onMouseDown={(e) => e.preventDefault()} onClick={clearFormat}>
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>

      {/* Area tulis */}
      <div ref={wrapRef} className={cn("relative", fullscreen && "flex-1 overflow-hidden")}>
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={!tableHover && !imageHover}>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Description"
          tabIndex={0}
          data-placeholder={placeholder}
          onMouseDown={onEditorMouseDown}
          onMouseMove={onEditorMouseMove}
          onContextMenu={onTableContextMenu}
          onClick={onEditorClick}
          onDrop={onDrop}
          onScroll={() => {
            if (selImageId) positionOverlay(selImageId);
          }}
          onInput={() => {
            emit();
            detectMention();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={detectMention}
          onPaste={onPaste}
          onMouseUp={refreshActive}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          className={cn("rich-content rt-editor overflow-y-auto px-3 py-2 text-sm outline-none", fullscreen && "h-full")}
          style={{ height: fullscreen ? undefined : height }}
        />
          </ContextMenuTrigger>
        {mention && mentionList.length > 0 && (
          <div className="absolute right-2 bottom-full left-2 z-50 mb-1 overflow-hidden rounded-md border bg-popover shadow-md">
            {mentionList.map((u, i) => (
              <button
                key={u}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-accent",
                  i === (mention.index % mentionList.length) && "bg-accent"
                )}
              >
                <span className="flex-1 truncate font-medium">{u}</span>
                <span className="text-xs text-muted-foreground">@{u}</span>
              </button>
            ))}
          </div>
        )}
        <ContextMenuContent
          className="w-52"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {menuKind === "image" ? (
            <>
              <ContextMenuItem
                onClick={() => menuImageRef.current && void openCropForFigure(menuImageRef.current)}
              >
                Crop Image
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => menuImageRef.current && focusFigureCaption(menuImageRef.current)}
              >
                Add/Edit Caption
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => menuImageRef.current && requestReplaceImage(menuImageRef.current)}
              >
                Replace Image
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const fig = menuImageRef.current;
                  if (fig) resetFigureSize(fig);
                }}
              >
                Reset Size
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => menuImageRef.current && deleteFigure(menuImageRef.current)}
              >
                Delete Image
              </ContextMenuItem>
            </>
          ) : (
            <>
          {menuKind !== "col" && (
            <>
              <ContextMenuItem
                onClick={() => menuCellRef.current && insertRowAt(menuCellRef.current, "above")}
              >
                Tambah baris di atas
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => menuCellRef.current && insertRowAt(menuCellRef.current, "below")}
              >
                Tambah baris di bawah
              </ContextMenuItem>
            </>
          )}
          {menuKind !== "row" && (
            <>
              <ContextMenuItem
                onClick={() => menuCellRef.current && insertColAt(menuCellRef.current, "left")}
              >
                Tambah kolom kiri
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => menuCellRef.current && insertColAt(menuCellRef.current, "right")}
              >
                Tambah kolom kanan
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          {menuKind !== "col" && (
            <ContextMenuItem
              onClick={() => menuCellRef.current && toggleHeaderRow(menuCellRef.current)}
            >
              {menuCellRef.current && isHeaderRow(menuCellRef.current)
                ? "Jadikan baris biasa"
                : "Jadikan header"}
            </ContextMenuItem>
          )}
          {(menuKind === "row" || menuKind === "all") && (
            <ContextMenuItem
              variant="destructive"
              onClick={() => menuCellRef.current && deleteRowAt(menuCellRef.current)}
            >
              Hapus baris
            </ContextMenuItem>
          )}
          {(menuKind === "col" || menuKind === "all") && (
            <ContextMenuItem
              variant="destructive"
              onClick={() => menuCellRef.current && deleteColAt(menuCellRef.current)}
            >
              Hapus kolom
            </ContextMenuItem>
          )}
          <ContextMenuItem
            variant="destructive"
            onClick={() => menuCellRef.current && deleteTableAt(menuCellRef.current)}
          >
            Hapus tabel
          </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
        </ContextMenu>
        {imageSupport && selImageId && selRect && (
          <div
            data-rt-img-overlay
            className="pointer-events-none absolute z-40 rounded-[2px] ring-2 ring-primary"
            style={{ top: selRect.top, left: selRect.left, width: selRect.width, height: selRect.height }}
          >
            <span
              data-rt-img-overlay
              onPointerDown={onImgResizeStart}
              className="pointer-events-auto absolute -right-2.5 -bottom-2.5 h-5 w-5 cursor-nwse-resize rounded-[4px] border-2 border-primary bg-background"
            />
          </div>
        )}
        <ImageCropDialog
          open={cropState !== null}
          src={cropState?.src ?? null}
          onOpenChange={closeCropDialog}
          onApply={handleCropApply}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={onToolbarImageFiles}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={onReplaceFile}
        />
      </div>
    </div>
  );
}

export { isEmptyHtml };

/**
 * Ambil item checklist dari HTML description.
 * Hanya <li> di dalam <ul class="rt-task-list"> (hasil tombol checklist editor).
 */
export type RichCheckItem = { title: string; done: boolean };

export function extractChecklist(html: string): RichCheckItem[] {
  const items: RichCheckItem[] = [];
  const lists = html.match(/<ul[^>]*rt-task-list[^>]*>([\s\S]*?)<\/ul>/gi) ?? [];
  for (const ul of lists) {
    const lis = ul.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
    for (const li of lis) {
      const done = /<input[^>]*checked/i.test(li);
      const text = li
        .replace(/<input[^>]*>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) items.push({ title: text, done });
    }
  }
  return items;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render daftar item menjadi blok checklist HTML untuk editor. */
export function checklistToHtml(items: { title: string; done: boolean }[]): string {
  if (items.length === 0) return "";
  const lis = items
    .map(
      (i) =>
        `<li><input type="checkbox"${i.done ? " checked" : ""} contenteditable="false"> ${escapeHtml(i.title)}</li>`
    )
    .join("");
  return `<ul class="rt-task-list">${lis}</ul>`;
}

/**
 * Suntik item checklist yang belum ada di HTML description (dipakai saat buka Edit),
 * agar tambah/hapus checklist cukup lewat description.
 */
export function injectChecklist(html: string, items: { title: string; done: boolean }[]): string {
  const have = new Set(extractChecklist(html).map((t) => t.title.toLowerCase()));
  const missing = items.filter((i) => !have.has(i.title.toLowerCase()));
  if (missing.length === 0) return html;
  const block = checklistToHtml(missing);
  if (!html.trim()) return block;
  return `${html}<p><br></p>${block}`;
}

/** Buang blok checklist (<ul class="rt-task-list">) dari HTML description. */
export function stripChecklist(html: string): string {
  return html.replace(/<ul[^>]*rt-task-list[^>]*>[\s\S]*?<\/ul>/gi, "").trim();
}

/** Ekstrak daftar user yang di-mention dari HTML (span.rt-mention dengan data-user). */
export function extractMentions(html: string): string[] {
  const matches = html.matchAll(/<span[^>]*class="[^"]*rt-mention[^"]*"[^>]*data-user="([^"]+)"[^>]*>/gi);
  const names = new Set<string>();
  for (const m of matches) {
    if (m[1]) names.add(m[1]);
  }
  return Array.from(names);
}
