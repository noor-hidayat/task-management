import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listWorksByIds } from "@/lib/api/works";
import { fetchCommentMap, fetchActivityMap, fetchAttachmentMap } from "@/lib/api/related";
import { fetchLookups } from "@/lib/api/works";
import type { WorkItem, ChecklistItem, Activity, Evidence, Comment } from "@/types";

interface UseWorkResult {
  data: WorkItem | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  refreshComments: () => void;
  refreshActivities: () => void;
  refreshAttachments: () => void;
  refreshChecklist: () => void;
}

/**
 * Hook untuk fetch & listen perubahan 1 work item saja (by number).
 * Granular update: setiap bagian hanya refresh data yang berubah.
 */
export function useWork(workNumber: string | null | undefined): UseWorkResult {
  const [workId, setWorkId] = useState<string | null>(null);
  const [data, setData] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve number → id sekali
  useEffect(() => {
    if (!workNumber) {
      setWorkId(null);
      return;
    }
    supabase
      .from("works")
      .select("id")
      .eq("number", workNumber)
      .maybeSingle()
      .then(({ data: row }) => setWorkId(row?.id ?? null));
  }, [workNumber]);

  /** Fetch ulang seluruh work (dipakai saat struktur utama berubah). */
  const reload = useCallback(() => {
    if (!workId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    listWorksByIds([workId])
      .then((list) => {
        setData(list[0] ?? null);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Gagal memuat work"))
      .finally(() => setLoading(false));
  }, [workId]);

  /** Hanya refresh comments. */
  const refreshComments = useCallback(async () => {
    if (!workId) return;
    try {
      const { names } = await fetchLookups();
      const map = await fetchCommentMap("work", names);
      const comments = map.get(workId) ?? [];
      setData((prev) => (prev ? { ...prev, comments } : prev));
    } catch {
      // abaikan
    }
  }, [workId]);

  /** Hanya refresh activities. */
  const refreshActivities = useCallback(async () => {
    if (!workId) return;
    try {
      const { names } = await fetchLookups();
      const map = await fetchActivityMap("work", names);
      const activities = map.get(workId) ?? [];
      setData((prev) => (prev ? { ...prev, activities } : prev));
    } catch {
      // abaikan
    }
  }, [workId]);

  /** Hanya refresh attachments. */
  const refreshAttachments = useCallback(async () => {
    if (!workId) return;
    try {
      const { names } = await fetchLookups();
      const map = await fetchAttachmentMap("work", names);
      const evidences = map.get(workId) ?? [];
      setData((prev) => (prev ? { ...prev, evidences } : prev));
    } catch {
      // abaikan
    }
  }, [workId]);

  /** Hanya refresh checklist. */
  const refreshChecklist = useCallback(async () => {
    if (!workId) return;
    try {
      const { names } = await fetchLookups();
      const { data: checklistData } = await supabase
        .from("work_checklist")
        .select("id, work_id, label, done, position")
        .eq("work_id", workId)
        .order("position");
      const checklist: ChecklistItem[] = (checklistData ?? []).map((c) => ({
        id: c.id,
        label: c.label,
        done: c.done,
      }));
      setData((prev) => (prev ? { ...prev, checklist } : prev));
    } catch {
      // abaikan
    }
  }, [workId]);

  useEffect(() => {
    reload();
    if (!workId) return;

    const channel = supabase.channel(`rt-work-${workId}`);

    // Perubahan pada works (judul/status/dll) → reload full
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "works", filter: `id=eq.${workId}` },
      () => reload()
    );

    // Checklist berubah → refreshChecklist (granular)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "work_checklist", filter: `work_id=eq.${workId}` },
      () => refreshChecklist()
    );

    // Comments → hanya refresh comments
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments", filter: `owner_id=eq.${workId}` },
      () => refreshComments()
    );

    // Activities → refreshActivities
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities", filter: `owner_id=eq.${workId}` },
      () => refreshActivities()
    );

    // Attachments → refreshAttachments
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attachments", filter: `owner_id=eq.${workId}` },
      () => refreshAttachments()
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, refreshComments, refreshActivities, refreshAttachments, refreshChecklist, workId]);

  return { data, loading, error, reload, refreshComments, refreshActivities, refreshAttachments, refreshChecklist };
}