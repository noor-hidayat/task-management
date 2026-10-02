import { supabase } from "@/lib/supabase";
import type { IssueType } from "@/types";
import { formatDateTime } from "@/lib/format";

interface IssueTypeRow {
  id: string;
  name: string;
  created_at: string;
}

export async function listIssueTypes(): Promise<IssueType[]> {
  const { data, error } = await supabase
    .from("issue_types")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: IssueTypeRow) => ({
    id: r.id,
    name: r.name,
    createdAt: formatDateTime(r.created_at),
  }));
}

export async function createIssueType(input: { name: string }): Promise<IssueType> {
  const { data, error } = await supabase
    .from("issue_types")
    .insert({ name: input.name })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const row = data as IssueTypeRow;
  return {
    id: row.id,
    name: row.name,
    createdAt: formatDateTime(row.created_at),
  };
}

export async function updateIssueType(id: string, patch: { name: string }): Promise<void> {
  const { error } = await supabase
    .from("issue_types")
    .update({ name: patch.name })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteIssueType(id: string): Promise<void> {
  const { error } = await supabase.from("issue_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
