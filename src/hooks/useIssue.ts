import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listIssuesByIds, fetchIssueLookups } from "@/lib/api/issues";
import { fetchCommentMap, fetchActivityMap, fetchAttachmentMap } from "@/lib/api/related";
import type { Issue } from "@/types";

interface UseIssueResult {
  data: Issue | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  refreshComments: () => void;
  refreshActivities: () => void;
  refreshAttachments: () => void;
}

/**
 * Hook untuk fetch & listen perubahan 1 issue saja (by number).
 * Granular update: setiap bagian hanya refresh data yang berubah.
 */
export function useIssue(issueNumber: string | null | undefined): UseIssueResult {
  const [issueId, setIssueId] = useState<string | null>(null);
  const [data, setData] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve number → id sekali
  useEffect(() => {
    if (!issueNumber) {
      setIssueId(null);
      return;
    }
    supabase
      .from("issues")
      .select("id")
      .eq("number", issueNumber)
      .maybeSingle()
      .then(({ data: row }) => setIssueId(row?.id ?? null));
  }, [issueNumber]);

  /** Fetch ulang seluruh issue. */
  const reload = useCallback(() => {
    if (!issueId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    listIssuesByIds([issueId])
      .then((list) => {
        setData(list[0] ?? null);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Gagal memuat issue"))
      .finally(() => setLoading(false));
  }, [issueId]);

  /** Hanya refresh comments. */
  const refreshComments = useCallback(async () => {
    if (!issueId) return;
    try {
      const { names } = await fetchIssueLookups();
      const map = await fetchCommentMap("issue", names);
      const comments = map.get(issueId) ?? [];
      setData((prev) => (prev ? { ...prev, comments } : prev));
    } catch {
      // abaikan
    }
  }, [issueId]);

  /** Hanya refresh activities. */
  const refreshActivities = useCallback(async () => {
    if (!issueId) return;
    try {
      const { names } = await fetchIssueLookups();
      const map = await fetchActivityMap("issue", names);
      const activities = map.get(issueId) ?? [];
      setData((prev) => (prev ? { ...prev, activities } : prev));
    } catch {
      // abaikan
    }
  }, [issueId]);

  /** Hanya refresh attachments. */
  const refreshAttachments = useCallback(async () => {
    if (!issueId) return;
    try {
      const { names } = await fetchIssueLookups();
      const map = await fetchAttachmentMap("issue", names);
      const evidences = map.get(issueId) ?? [];
      setData((prev) => (prev ? { ...prev, evidences } : prev));
    } catch {
      // abaikan
    }
  }, [issueId]);

  useEffect(() => {
    reload();
    if (!issueId) return;

    const channel = supabase.channel(`rt-issue-${issueId}`);

    // Issues table → reload full (status/title/dll)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "issues", filter: `id=eq.${issueId}` },
      () => reload()
    );

    // Issue assignees → reload full
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "issue_assignees", filter: `issue_id=eq.${issueId}` },
      () => reload()
    );

    // Issue handovers → reload full
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "issue_handovers", filter: `issue_id=eq.${issueId}` },
      () => reload()
    );

    // Comments → refreshComments
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments", filter: `owner_id=eq.${issueId}` },
      () => refreshComments()
    );

    // Activities → refreshActivities
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities", filter: `owner_id=eq.${issueId}` },
      () => refreshActivities()
    );

    // Attachments → refreshAttachments
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attachments", filter: `owner_id=eq.${issueId}` },
      () => refreshAttachments()
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, refreshComments, refreshActivities, refreshAttachments, issueId]);

  return { data, loading, error, reload, refreshComments, refreshActivities, refreshAttachments };
}
