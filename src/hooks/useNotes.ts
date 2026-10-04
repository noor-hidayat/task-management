import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listNotes } from "@/lib/api/notes";
import { useAuth } from "@/contexts/AuthContext";
import type { Note } from "@/types";

interface UseNotesResult {
  data: Note[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useNotes(): UseNotesResult {
  const { user } = useAuth();
  const [data, setData] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listNotes(user?.id)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    reload();
    const channel = supabase.channel(`rt-notes-${user?.id ?? "anon"}`);
    for (const t of ["notes", "note_shares", "note_relations"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => reload());
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, user?.id]);

  return { data, loading, error, reload };
}
