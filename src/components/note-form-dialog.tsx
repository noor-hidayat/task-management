import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDot, ListChecks, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor, isEmptyHtml, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { emptyPendingNoteImages, type PendingNoteImages } from "@/lib/api/noteImages";
import { useIssues, useUsers, useWorks } from "@/hooks/useSupabaseLists";
import { cn } from "@/lib/utils";
import type { NoteRelatedType } from "@/types";

const NOTE_CATEGORIES = ["personal", "working"] as const;

export type NoteRelationDraft = {
  relatedType: NoteRelatedType;
  relatedId: string;
  relatedNumber?: string;
  relatedTitle?: string;
};

export type NoteFormValues = {
  title: string;
  content: string;
  tags: string[];
  relations: NoteRelationDraft[];
  /** File gambar blob + path storage yang dibuang (diisi editor saat submit). */
  images: PendingNoteImages;
};

/**
 * Pop-up form untuk New Note / Edit Note — layout yang sama seperti
 * TaskFormDialog: Title + Content di kiri, Category + Related di kanan.
 */
export function NoteFormDialog({
  open,
  onOpenChange,
  initial,
  dialogTitle,
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<NoteFormValues>;
  dialogTitle: string;
  submitLabel?: string;
  onSubmit: (values: NoteFormValues) => void | Promise<void>;
}) {
  const { data: users } = useUsers();
  const { data: works } = useWorks();
  const { data: issues } = useIssues();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [relations, setRelations] = useState<NoteRelationDraft[]>(initial?.relations ?? []);
  const [relTab, setRelTab] = useState<NoteRelatedType>("task");
  const [relQuery, setRelQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<RichTextEditorHandle | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setContent(initial?.content ?? "");
    setTags(initial?.tags ?? []);
    setRelations(initial?.relations ?? []);
    setRelTab("task");
    setRelQuery("");
    setSaving(false);
    editorRef.current?.resetPendingImages();
  }, [open ]); // eslint-disable-line react-hooks/exhaustive-deps

  const category = useMemo(
    () => tags.find((t) => (NOTE_CATEGORIES as readonly string[]).includes(t)) ?? null,
    [tags]
  );

  const setCategory = (c: string | null) => {
    setTags((prev) => {
      const rest = prev.filter((t) => !(NOTE_CATEGORIES as readonly string[]).includes(t));
      if (!c) return rest;
      return [c, ...rest];
    });
  };

  const addedKeys = useMemo(
    () => new Set(relations.map((r) => `${r.relatedType}:${r.relatedId}`)),
    [relations]
  );

  const results = useMemo(() => {
    const q = relQuery.trim().toLowerCase();
    if (relTab === "task") {
      return works
        .filter((w) => !addedKeys.has(`task:${w.id}`))
        .filter(
          (w) =>
            !q ||
            w.title.toLowerCase().includes(q) ||
            w.number.toLowerCase().includes(q)
        )
        .slice(0, 6);
    }
    return issues
      .filter((i) => !addedKeys.has(`issue:${i.id}`))
      .filter(
        (i) =>
          !q || i.title.toLowerCase().includes(q) || i.number.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [relTab, relQuery, works, issues, addedKeys]);

  const addRelation = (type: NoteRelatedType, id: string) => {
    if (addedKeys.has(`${type}:${id}`)) return;
    if (type === "task") {
      const w = works.find((x) => x.id === id);
      if (!w) return;
      setRelations((prev) => [
        ...prev,
        { relatedType: type, relatedId: id, relatedNumber: w.number, relatedTitle: w.title },
      ]);
    } else {
      const i = issues.find((x) => x.id === id);
      if (!i) return;
      setRelations((prev) => [
        ...prev,
        { relatedType: type, relatedId: id, relatedNumber: i.number, relatedTitle: i.title },
      ]);
    }
  };

  const canSubmit = title.trim().length > 0 || !isEmptyHtml(content);

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim() || "Untitled note",
        content,
        tags,
        relations,
        images: editorRef.current?.getPendingImages() ?? emptyPendingNoteImages(),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-[1fr_280px]">
          {/* Kiri: Title + Content */}
          <div className="grid content-start gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nf-title">Title</Label>
              <Input
                id="nf-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label>Content</Label>
              <RichTextEditor
                ref={editorRef}
                value={content}
                onChange={setContent}
                users={users.map((u) => u.name)}
                placeholder="Write something... Use @ to mention, insert tables and images..."
                height={280}
                imageSupport
                fullscreen
              />
            </div>
          </div>
          {/* Kanan: Category + Related */}
          <div className="grid content-start gap-4 md:border-l md:pl-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <div className="flex gap-1.5">
                {(NOTE_CATEGORIES as readonly string[]).map((c) => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(active ? null : c)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>
                Related
                {relations.length > 0 && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {relations.length}
                  </span>
                )}
              </Label>
              {relations.length > 0 && (
                <ul className="space-y-1">
                  {relations.map((r) => (
                    <li
                      key={`${r.relatedType}:${r.relatedId}`}
                      className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs"
                    >
                      {r.relatedType === "task" ? (
                        <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <CircleDot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {r.relatedTitle ?? r.relatedId}
                        </span>
                        {r.relatedNumber && (
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {r.relatedNumber}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove relation"
                        onClick={() =>
                          setRelations((prev) =>
                            prev.filter(
                              (x) =>
                                !(x.relatedType === r.relatedType && x.relatedId === r.relatedId)
                            )
                          )
                        }
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Tabs value={relTab} onValueChange={(v) => setRelTab(v as NoteRelatedType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="task">Task</TabsTrigger>
                  <TabsTrigger value="issue">Issue</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={relQuery}
                  onChange={(e) => setRelQuery(e.target.value)}
                  placeholder={relTab === "task" ? "Search tasks..." : "Search issues..."}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {results.map((r) =>
                  relTab === "task" ? (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => addRelation("task", r.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                      >
                        <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.title}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {r.number}
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={(r as { id: string }).id}>
                      <button
                        type="button"
                        onClick={() => addRelation("issue", (r as { id: string }).id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                      >
                        <CircleDot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {(r as { title: string }).title}
                          </span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {(r as { number: string }).number}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                )}
                {results.length === 0 && (
                  <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No {relTab === "task" ? "tasks" : "issues"} found.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
