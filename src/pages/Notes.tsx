import { useState } from "react";
import { NotebookPen, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Note = { id: string; title: string; body: string; at: string };

const seed: Note[] = [
  {
    id: "n-1",
    title: "Machine 4 — tunggu maintenance",
    body: "Pressure belum dicek, sudah handover ke Shift 2. Follow-up saat start shift berikutnya.",
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

  const add = () => {
    if (!title.trim() && !body.trim()) return;
    setNotes((prev) => [
      {
        id: `n-${Date.now()}`,
        title: title.trim() || "(Tanpa judul)",
        body: body.trim(),
        at: "26 Sep 2026 15:00",
      },
      ...prev,
    ]);
    setTitle("");
    setBody("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        description="Catatan shift pribadi — bukan activity system. Untuk history resmi lihat Task Detail → Activity."
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <Input
            placeholder="Judul catatan..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Tulis catatan shift..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button onClick={add}>
            <Plus className="h-4 w-4" /> Add Note
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="flex gap-3 p-4">
              <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <NotebookPen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.at}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotes((p) => p.filter((x) => x.id !== n.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
