import { supabase } from "@/lib/supabase";
import type { Team } from "@/types";

interface TeamRow {
  id: string;
  name: string;
  leader_id: string | null;
  active: boolean;
}

export async function listTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, leader_id, active")
    .order("name");
  if (error) throw new Error(error.message);

  const teams = (data ?? []) as TeamRow[];

  // Ambil anggota per tim via profiles.team_id.
  const { data: memberRows } = await supabase
    .from("profiles")
    .select("id, team_id")
    .not("team_id", "is", null);

  const membersByTeam = new Map<string, string[]>();
  for (const m of memberRows ?? []) {
    const tid = m.team_id as string;
    if (!membersByTeam.has(tid)) membersByTeam.set(tid, []);
    membersByTeam.get(tid)!.push(m.id as string);
  }

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    leaderId: t.leader_id ?? "",
    memberIds: membersByTeam.get(t.id) ?? [],
    active: t.active,
  }));
}

export async function createTeam(input: {
  name: string;
  leaderId: string;
  memberIds: string[];
  active: boolean;
}): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: input.name, leader_id: input.leaderId || null, active: input.active })
    .select("id, name, leader_id, active")
    .single();
  if (error) throw new Error(error.message);

  await setTeamMembers(data.id, input.memberIds);
  return {
    id: data.id,
    name: data.name,
    leaderId: data.leader_id ?? "",
    memberIds: input.memberIds,
    active: data.active,
  };
}

export async function updateTeam(
  id: string,
  patch: Partial<Pick<Team, "name" | "leaderId" | "active" | "memberIds">>
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.leaderId !== undefined) dbPatch.leader_id = patch.leaderId || null;
  if (patch.active !== undefined) dbPatch.active = patch.active;

  if (Object.keys(dbPatch).length > 0) {
    const { error } = await supabase.from("teams").update(dbPatch).eq("id", id);
    if (error) throw new Error(error.message);
  }
  if (patch.memberIds) await setTeamMembers(id, patch.memberIds);
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Set keanggotaan tim: user lama yang tidak ada di daftar → team_id null. */
async function setTeamMembers(teamId: string, memberIds: string[]): Promise<void> {
  // Lepas user yang sebelumnya anggota tim ini tapi tidak ada di daftar baru.
  const { data: current } = await supabase
    .from("profiles")
    .select("id")
    .eq("team_id", teamId);
  const toRemove = (current ?? [])
    .map((r) => r.id)
    .filter((id) => !memberIds.includes(id));
  if (toRemove.length > 0) {
    await supabase.from("profiles").update({ team_id: null }).in("id", toRemove);
  }
  if (memberIds.length > 0) {
    await supabase.from("profiles").update({ team_id: teamId }).in("id", memberIds);
  }
}
