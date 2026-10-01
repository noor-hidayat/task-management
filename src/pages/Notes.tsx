import { useState } from "react";
import {
  NotebookPen,
  Plus,
  Trash2,
  Calendar,
  Pin,
  MoreHorizontal,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Note = { id: string; title: string; body: string; at: string };

const seed: Note[] = [
  {
    id: "n-1",
    title: "Machine 4 — tunggu maintenance",
    body: "Pressure belum dicek di Shift 2. Follow-up saat start shift berikutnya.",
    at: "26 Sep 2026 14:50",
  },
  {
    id: "n-2",
    title: "Stok sparepart line 2",
    body: "Verify stock discrepancy selesai, tapi buffer menipis — buat task restock minggu depan.",
    at: "25 Sep 2026 16:05",
  },
];

export function Notes() {
  const [notes, setNotes] = useState<Note[]>(seed);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);

  const add = () => {
    if (!title.trim() && !body.trim()) return;
    setNotes((prev) => [
      {
        id: `n-${Date.now()}`,
        title: title.trim() || "(Tanpa judul)",
        body: body.trim(),
        at: new Date().toLocaleString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
    setTitle("");
    setBody("");
    setOpen(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Notes"
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Semua Catatan</h2>
        <p className="text-sm text-muted-foreground">{notes.length} notes</p>
      </div>

      <div className="grid gap-4">
        {notes.map((n) => (
          <Card
            key={n.id}
            className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary/60 to-primary/20" />
            <CardContent className="flex gap-4 p-5 pl-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm">
                <NotebookPen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{n.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pin className="mr-2 h-4 w-4" /> Pin note
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setNotes((p) => p.filter((x) => x.id !== n.id))
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {n.body}
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {n.at}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Catatan Baru
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Judul catatan..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Tulis catatan shift..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X className="h-4 w-4 mr-2" /> Batal
            </Button>
            <Button
              onClick={add}
              className="gap-2 shadow-sm"
              disabled={!title.trim() && !body.trim()}
            >
              <Plus className="h-4 w-4" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
