import { supabase } from "@/lib/supabase";
import type { CoreWorkDef } from "@/types";
import { makeNameMap, nameOf } from "./mappers";

interface CoreWorkRow {
  id: string;
  name: string;
  description: string | null;
  team_id: string | null;
  frequency: string | null;
  schedule: string | null;
  evidence_required: boolean;
  checklist: string[] | null;
  status: CoreWorkDef["status"];
  today_instance: string | null;
}

export async function listCoreWorks(): Promise<CoreWorkDef[]> {
  const [{ data, error }, { data: teams }] = await Promise.all([
    supabase.from("core_works").select("*").order("name"),
    supabase.from("teams").select("id, name"),
  ]);
  if (error) throw new Error(error.message);
  const teamNameById = makeNameMap(teams as { id: string; name: string }[] | null);
  return ((data ?? []) as CoreWorkRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    team: nameOf(teamNameById, r.team_id, "—"),
    frequency: r.frequency ?? "",
    schedule: r.schedule ?? "",
    evidenceRequired: r.evidence_required,
    checklist: r.checklist ?? [],
    status: r.status,
    todayInstance: r.today_instance ?? undefined,
  }));
}

export async function createCoreWork(input: {
  name: string;
  description: string;
  teamId: string;
  frequency: string;
  schedule: string;
  evidenceRequired: boolean;
  checklist: string[];
  status: CoreWorkDef["status"];
}): Promise<void> {
  const { error } = await supabase.from("core_works").insert({
    name: input.name,
    description: input.description,
    team_id: input.teamId || null,
    frequency: input.frequency,
    schedule: input.schedule,
    evidence_required: input.evidenceRequired,
    checklist: input.checklist,
    status: input.status,
  });
  if (error) throw new Error(error.message);
}

export async function updateCoreWork(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    teamId: string;
    frequency: string;
    schedule: string;
    evidenceRequired: boolean;
    checklist: string[];
    status: CoreWorkDef["status"];
  }>
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.teamId !== undefined) dbPatch.team_id = patch.teamId || null;
  if (patch.frequency !== undefined) dbPatch.frequency = patch.frequency;
  if (patch.schedule !== undefined) dbPatch.schedule = patch.schedule;
  if (patch.evidenceRequired !== undefined) dbPatch.evidence_required = patch.evidenceRequired;
  if (patch.checklist !== undefined) dbPatch.checklist = patch.checklist;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from("core_works").update(dbPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCoreWork(id: string): Promise<void> {
  const { error } = await supabase.from("core_works").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
