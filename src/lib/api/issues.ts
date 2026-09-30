import { supabase } from "@/lib/supabase";
import type { HandoverEntry, Issue, Priority, IssueStatus } from "@/types";
import { makeNameMap, nameOf } from "./mappers";
import { fetchActivityMap, fetchAttachmentMap, fetchCommentMap } from "./related";

interface IssueRow {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: Priority;
  created_by: string | null;
  assigned_to: string | null;
  reported_team_id: string | null;
  assigned_team_id: string | null;
  plant: string | null;
  location: string | null;
  due_date: string | null;
  resolution: string | null;
  closed_by: string | null;
  closed_at: string | null;
  hold_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface HandoverRow {
  id: string;
  issue_id: string;
  from_team_id: string | null;
  to_team_id: string | null;
  actor_id: string | null;
  note: string | null;
  at: string;
}

export async function fetchIssueLookups() {
  const [{ data: profiles }, { data: teams }] = await Promise.all([
    supabase.from("profiles").select("id, name"),
    supabase.from("teams").select("id, name"),
  ]);
  const names = makeNameMap(profiles as { id: string; name: string }[] | null);
  const teamNameById = makeNameMap(teams as { id: string; name: string }[] | null);
  return { names, teamNameById };
}

export async function listIssues(): Promise<Issue[]> {
  const { names, teamNameById } = await fetchIssueLookups();

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as IssueRow[];
  const ids = rows.map((r) => r.id);

  const [assigneeRes, handoverRes, attachmentMap, activityMap, commentMap] = await Promise.all([
    ids.length
      ? supabase.from("issue_assignees").select("issue_id, user_id").in("issue_id", ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from("issue_handovers")
          .select("id, issue_id, from_team_id, to_team_id, actor_id, note, at")
          .in("issue_id", ids)
          .order("at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    fetchAttachmentMap("issue", names),
    fetchActivityMap("issue", names),
    fetchCommentMap("issue", names),
  ]);

  const assigneesByIssue = new Map<string, string[]>();
  for (const a of assigneeRes.data ?? []) {
    const iid = a.issue_id as string;
    if (!assigneesByIssue.has(iid)) assigneesByIssue.set(iid, []);
    assigneesByIssue.get(iid)!.push(a.user_id as string);
  }

  const handoversByIssue = new Map<string, HandoverEntry[]>();
  for (const h of (handoverRes.data ?? []) as HandoverRow[]) {
    const list = handoversByIssue.get(h.issue_id) ?? [];
    list.push({
      id: h.id,
      fromTeamId: h.from_team_id ?? undefined,
      fromTeam: h.from_team_id ? nameOf(teamNameById, h.from_team_id) : undefined,
      toTeamId: h.to_team_id ?? "",
      toTeam: nameOf(teamNameById, h.to_team_id, "—"),
      at: h.at,
      actor: nameOf(names, h.actor_id, "—"),
      note: h.note ?? undefined,
    });
    handoversByIssue.set(h.issue_id, list);
  }

  return rows.map((r) => {
    const assigneeIds = assigneesByIssue.get(r.id) ?? [];
    const assignees = assigneeIds
      .map((id) => names.get(id))
      .filter((v): v is string => Boolean(v));
    const issue: Issue = {
      id: r.id,
      number: r.number,
      title: r.title,
      description: r.description ?? "",
      status: r.status,
      priority: r.priority,
      createdBy: nameOf(names, r.created_by, "—"),
      assignedTo: nameOf(names, r.assigned_to, "—"),
      assignees: assignees.length > 0 ? assignees : undefined,
      reportedTeamId: r.reported_team_id ?? undefined,
      reportedTeam: nameOf(teamNameById, r.reported_team_id, "—"),
      assignedTeamId: r.assigned_team_id ?? undefined,
      assignedTeam: nameOf(teamNameById, r.assigned_team_id, "—"),
      handoverHistory: handoversByIssue.get(r.id) ?? [],
      plant: r.plant ?? "",
      location: r.location ?? "",
      dueDate: r.due_date ?? "",
      resolution: r.resolution ?? undefined,
      closedBy: r.closed_by ? nameOf(names, r.closed_by) : undefined,
      closedAt: r.closed_at ?? undefined,
      holdReason: r.hold_reason ?? undefined,
      evidences: attachmentMap.get(r.id) ?? [],
      comments: commentMap.get(r.id) ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      activities: activityMap.get(r.id) ?? [],
    };
    return issue;
  });
}

export interface CreateIssueInput {
  title: string;
  description: string;
  priority: Priority;
  createdById: string;
  assigneeIds: string[];
  reportedTeamId: string;
  assignedTeamId: string;
  plant: string;
  location: string;
  dueDate: string;
}

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const primaryAssignee = input.assigneeIds[0] ?? null;
  const { data, error } = await supabase
    .from("issues")
    .insert({
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: "open",
      created_by: input.createdById,
      assigned_to: primaryAssignee,
      reported_team_id: input.reportedTeamId || null,
      assigned_team_id: input.assignedTeamId || input.reportedTeamId || null,
      plant: input.plant,
      location: input.location,
      due_date: input.dueDate,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (input.assigneeIds.length) {
    await supabase
      .from("issue_assignees")
      .insert(input.assigneeIds.map((uid) => ({ issue_id: data.id, user_id: uid })));
  }
  const [issue] = await listIssuesByIds([data.id]);
  return issue;
}

export async function updateIssue(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    status: IssueStatus;
    priority: Priority;
    assigneeIds: string[];
    assignedTeamId: string;
    resolution: string;
    holdReason: string;
    dueDate: string;
    plant: string;
    location: string;
    closedById: string | null;
  }>
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.assignedTeamId !== undefined) dbPatch.assigned_team_id = patch.assignedTeamId || null;
  if (patch.resolution !== undefined) dbPatch.resolution = patch.resolution;
  if (patch.holdReason !== undefined) dbPatch.hold_reason = patch.holdReason;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
  if (patch.plant !== undefined) dbPatch.plant = patch.plant;
  if (patch.location !== undefined) dbPatch.location = patch.location;

  if (patch.assigneeIds) {
    dbPatch.assigned_to = patch.assigneeIds[0] ?? null;
    await supabase.from("issue_assignees").delete().eq("issue_id", id);
    if (patch.assigneeIds.length) {
      await supabase
        .from("issue_assignees")
        .insert(patch.assigneeIds.map((uid) => ({ issue_id: id, user_id: uid })));
    }
  }

  if (patch.status === "closed") {
    dbPatch.closed_at = new Date().toISOString();
    dbPatch.closed_by = patch.closedById ?? null;
  } else if (patch.status !== undefined) {
    dbPatch.closed_at = null;
    dbPatch.closed_by = null;
  }

  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from("issues").update(dbPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteIssue(id: string): Promise<void> {
  const { error } = await supabase.from("issues").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Serah terima issue ke tim lain: update assigned_team + catat history + activity. */
export async function handoverIssue(
  id: string,
  toTeamId: string,
  toTeamName: string,
  actorId: string,
  actorName: string,
  fromTeamId: string | null,
  fromTeamName: string | null
): Promise<void> {
  const { error } = await supabase
    .from("issues")
    .update({ assigned_team_id: toTeamId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("issue_handovers").insert({
    issue_id: id,
    from_team_id: fromTeamId,
    to_team_id: toTeamId,
    actor_id: actorId,
  });
  await supabase.from("activities").insert({
    owner_type: "issue",
    owner_id: id,
    text: `handed over from ${fromTeamName ?? "—"} to ${toTeamName}`,
    actor_id: actorId,
  });
  void actorName;
}

export async function listIssuesByIds(ids: string[]): Promise<Issue[]> {
  if (ids.length === 0) return [];
  const all = await listIssues();
  return all.filter((i) => ids.includes(i.id));
}
