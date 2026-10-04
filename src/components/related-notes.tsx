import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, NotebookPen, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { listNotesForTarget } from "@/lib/api/notes";
import type { Note, NoteRelatedType } from "@/types";

/**
 * Notes yang terhubung ke sebuah Task/Issue — sisi baca dari relasi dua arah
 * (Note → Task/Issue dikelola dari halaman Notes; di sini hanya ditampilkan).
 */
export function RelatedNotes({
  relatedType,
  relatedId,
}: {
  relatedType: NoteRelatedType;
  relatedId: string;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listNotesForTarget(relatedType, relatedId, user?.id)
      .then((d) => {
        if (active) setNotes(d);
      })
      .catch(() => {
        if (active) setNotes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [relatedType, relatedId, user?.id]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading related notes...</p>;
  }

  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li key={n.id}>
            <Link
              to={`/notes?note=${n.id}`}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
            >
              <NotebookPen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{n.title || "Untitled note"}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {n.isOwner ? "You" : n.ownerName} • {n.updatedAt}
                </span>
              </span>
              <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
                {n.shared ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {n.shared ? "Shared" : "Private"}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
