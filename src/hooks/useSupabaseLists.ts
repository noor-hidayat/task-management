import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listWorks } from "@/lib/api/works";
import { listIssues } from "@/lib/api/issues";
import { listIssueTypes } from "@/lib/api/issue-types";
import { listTeams } from "@/lib/api/teams";
import { listProfiles } from "@/lib/api/profiles";
import { listLocations, listPlants, type SiteOption } from "@/lib/api/sites";
import type { Issue, Team, User, WorkItem, IssueType } from "@/types";

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useSupabaseList<T>(
  loader: () => Promise<T>,
  initial: T,
  tables: string[]
): AsyncState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    loader()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Gagal memuat data"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
    // Langganan realtime untuk tabel-tabel terkait.
    const channel = supabase.channel(`rt-${tables.join("-")}-${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => reload());
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { data, loading, error, reload };
}

export function useWorks(): AsyncState<WorkItem[]> {
  return useSupabaseList(() => listWorks(), [] as WorkItem[], ["works", "work_assignees", "work_checklist", "attachments", "activities", "comments"]);
}

export function useIssues(): AsyncState<Issue[]> {
  return useSupabaseList(
    () => listIssues(),
    [] as Issue[],
    ["issues", "issue_assignees", "issue_handovers", "attachments", "activities", "comments"]
  );
}

export function useTeams(): AsyncState<Team[]> {
  return useSupabaseList(() => listTeams(), [] as Team[], ["teams", "profiles"]);
}

export function useUsers(): AsyncState<User[]> {
  return useSupabaseList(() => listProfiles(), [] as User[], ["profiles"]);
}

export function usePlants(): AsyncState<SiteOption[]> {
  return useSupabaseList(() => listPlants(), [] as SiteOption[], ["plants"]);
}

export function useLocations(): AsyncState<SiteOption[]> {
  return useSupabaseList(() => listLocations(), [] as SiteOption[], ["locations"]);
}

export function useIssueTypes(): AsyncState<IssueType[]> {
  return useSupabaseList(() => listIssueTypes(), [] as IssueType[], ["issue_types"]);
}
