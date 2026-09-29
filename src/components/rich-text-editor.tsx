import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Type,
  Link2,
  AtSign,
  List,
  ListOrdered,
  ListChecks,
  RemoveFormatting,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sanitasi ringan untuk HTML hasil editor: buang script & event handler. */
export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/href='javascript:[^']*'/gi, "href='#'");
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

export function RichTextEditor({
  value,
  onChange,
  users = [],
  placeholder = "Tulis deskripsi…",
  height = 320,
}: {
  value: string;
  onChange: (html: string) => void;
  users?: string[];
  placeholder?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false });
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);

  // Sinkron saat value direset dari luar (dialog dibuka ulang).
  // Dilewati saat user sedang mengetik (editor fokus) agar caret tidak lompat.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  const emit = () => {
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

  const setBlock = (tag: "p" | "h1" | "h2") => exec("formatBlock", tag);

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
    const m = before.match(/@([\w ]*)$/);
    if (m && !m[0].includes("\n")) setMention((prev) => ({ query: m[1], index: prev?.index ?? 0 }));
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Mention diprioritaskan saat popup mention terbuka
      if (mention && mentionList.length > 0) {
        e.preventDefault();
        insertMention(mentionList[mention.index] ?? mentionList[0]);
        return;
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
  };

  const tool = "h-8 w-8 shrink-0";
  const toolActive = "bg-accent text-accent-foreground";

  return (
    <div className="overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
        <Button type="button" variant="ghost" size="icon" className={tool} title="Heading 1" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("h1")}>
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Heading 2" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock("h2")}>
          <Heading2 className="h-4 w-4" />
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
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={tool} title="Link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool} title="Mention (@nama)" onMouseDown={(e) => e.preventDefault()} onClick={() => { ref.current?.focus(); try { document.execCommand("insertText", false, "@"); } catch {} emit(); }}>
          <AtSign className="h-4 w-4" />
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
        <Button type="button" variant="ghost" size="icon" className={tool} title="Hapus format" onMouseDown={(e) => e.preventDefault()} onClick={clearFormat}>
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>

      {/* Area tulis */}
      <div className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Description"
          data-placeholder={placeholder}
          onInput={() => {
            emit();
            detectMention();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={detectMention}
          onMouseUp={refreshActive}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          className="rich-content rt-editor overflow-y-auto px-3 py-2 text-sm outline-none"
          style={{ height }}
        />
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
