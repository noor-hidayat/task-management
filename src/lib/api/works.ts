import { supabase } from "@/lib/supabase";
import type { ChecklistItem, WorkItem } from "@/types";
import { makeNameMap, nameOf } from "./mappers";
import { formatDateTime } from "@/lib/format";
import { fetchActivityMap, fetchAttachmentMap, fetchCommentMap } from "./related";
import { deleteAttachment } from "./attachments";

interface WorkRow {
  id: string;
  number: string;
  title: string;
  type: WorkItem["type"];
  status: WorkItem["status"];
  priority: WorkItem["priority"];
  created_by: string | null;
  assigned_to: string | null;
  team_id: string | null;
  shift: string | null;
  due_date: string | null;
  description: string | null;
  plant: string | null;
  location: string | null;
  progress: number;
  evidence_required: boolean;
  cancelled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Ambil peta id→(nama, nama tim) sekali untuk dipakai banyak mapper. */
export async function fetchLookups() {
  const [{ data: profiles }, { data: teams }] = await Promise.all([
    supabase.from("profiles").select("id, name"),
    supabase.from("teams").select("id, name"),
  ]);
  const names = makeNameMap(profiles as { id: string; name: string }[] | null);
  const teamNameById = makeNameMap(teams as { id: string; name: string }[] | null);
  return { names, teamNameById };
}

function rowToWork(
  row: WorkRow,
  names: Map<string, string>,
  teamNameById: Map<string, string>,
  checklist: ChecklistItem[]
): WorkItem {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority,
    createdBy: nameOf(names, row.created_by, "—"),
    assignedTo: nameOf(names, row.assigned_to, "—"),
    team: nameOf(teamNameById, row.team_id, "—"),
    teamId: row.team_id ?? "",
    shift: row.shift ?? "",
    dueDate: row.due_date ?? "",
    description: row.description ?? "",
    plant: row.plant ?? "",
    location: row.location ?? "",
    progress: row.progress,
    evidenceRequired: row.evidence_required,
    cancelled: row.cancelled,
    evidences: [],
    checklist,
    note: row.note ?? "",
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    activities: [],
  };
}

export async function listWorks(): Promise<WorkItem[]> {
  const { names, teamNameById } = await fetchLookups();

  const { data: worksData, error } = await supabase
    .from("works")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (worksData ?? []) as WorkRow[];
  const ids = rows.map((r) => r.id);

  const [checklistRes, attachmentMap, activityMap, commentMap] = await Promise.all([
    ids.length
      ? supabase
          .from("work_checklist")
          .select("id, work_id, label, done, position")
          .in("work_id", ids)
          .order("position")
      : Promise.resolve({ data: [] as never[] }),
    fetchAttachmentMap("work", names),
    fetchActivityMap("work", names),
    fetchCommentMap("work", names),
  ]);

  const checklistByWork = new Map<string, ChecklistItem[]>();
  for (const c of checklistRes.data ?? []) {
    const wid = c.work_id as string;
    if (!checklistByWork.has(wid)) checklistByWork.set(wid, []);
    checklistByWork.get(wid)!.push({ id: c.id, label: c.label, done: c.done });
  }

  return rows.map((row) => {
    const item = rowToWork(row, names, teamNameById, checklistByWork.get(row.id) ?? []);
    item.evidences = attachmentMap.get(row.id) ?? [];
    item.activities = activityMap.get(row.id) ?? [];
    item.comments = commentMap.get(row.id) ?? [];
    return item;
  });
}

export interface CreateWorkInput {
  title: string;
  type: WorkItem["type"];
  priority: WorkItem["priority"];
  status?: WorkItem["status"];
  assignedToId: string;
  teamId: string;
  shift: string;
  dueDate: string;
  description?: string;
  plant?: string;
  location?: string;
  evidenceRequired: boolean;
  createdById: string;
  checklist?: string[];
}

/** Kolom UUID di Postgres: string kosong / id mock (mis. "t-prod-a") harus jadi null, kalau tidak error 22P02. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuid(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export async function createWork(input: CreateWorkInput): Promise<WorkItem> {
  const { data, error } = await supabase
    .from("works")
    .insert({
      title: input.title,
      type: input.type,
      priority: input.priority,
      status: input.status ?? "todo",
      assigned_to: asUuid(input.assignedToId),
      team_id: asUuid(input.teamId),
      shift: input.shift,
      due_date: input.dueDate,
      description: input.description ?? "",
      plant: input.plant ?? "",
      location: input.location ?? "",
      evidence_required: input.evidenceRequired,
      created_by: asUuid(input.createdById),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (input.checklist?.length) {
    await supabase.from("work_checklist").insert(
      input.checklist.map((label, i) => ({ work_id: data.id, label, position: i }))
    );
  }
  if (input.assignedToId) {
    await logActivity("work", data.id, "created task", input.createdById);
  }
  const [work] = await listWorksByIds([data.id]);
  return work;
}

export async function updateWork(
  id: string,
  patch: Partial<{
    title: string;
    status: WorkItem["status"];
    priority: WorkItem["priority"];
    assignedToId: string;
    teamId: string;
    shift: string;
    dueDate: string;
    description: string;
    plant: string;
    location: string;
    progress: number;
    evidenceRequired: boolean;
    cancelled: boolean;
    note: string;
  }>
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.assignedToId !== undefined) dbPatch.assigned_to = asUuid(patch.assignedToId);
  if (patch.teamId !== undefined) dbPatch.team_id = asUuid(patch.teamId);
  if (patch.shift !== undefined) dbPatch.shift = patch.shift;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.plant !== undefined) dbPatch.plant = patch.plant;
  if (patch.location !== undefined) dbPatch.location = patch.location;
  if (patch.progress !== undefined) dbPatch.progress = patch.progress;
  if (patch.evidenceRequired !== undefined) dbPatch.evidence_required = patch.evidenceRequired;
  if (patch.cancelled !== undefined) dbPatch.cancelled = patch.cancelled;
  if (patch.note !== undefined) dbPatch.note = patch.note;

  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from("works").update(dbPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteWork(id: string): Promise<void> {
  // Hapus file Drive + metadata attachment satu per satu (best effort).
  // Sisa baris (comments/activities/notifications/attachments) dibersihkan
  // oleh trigger DB saat parent dihapus.
  const { data: atts } = await supabase
    .from("attachments")
    .select("id, drive_file_id")
    .eq("owner_type", "work")
    .eq("owner_id", id);
  for (const a of (atts ?? []) as { id: string; drive_file_id: string }[]) {
    try {
      await deleteAttachment(a.id, a.drive_file_id);
    } catch {
      // Diabaikan — trigger DB membersihkan sisa metadata.
    }
  }
  const { error } = await supabase.from("works").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Ganti seluruh checklist sebuah work. */
export async function replaceChecklist(workId: string, items: ChecklistItem[]): Promise<void> {
  await supabase.from("work_checklist").delete().eq("work_id", workId);
  if (items.length === 0) return;
  await supabase.from("work_checklist").insert(
    items.map((it, i) => ({ work_id: workId, label: it.label, done: it.done, position: i }))
  );
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("work_checklist").update({ done }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

/** Load subset work berdasarkan id (dipakai setelah create). */
export async function listWorksByIds(ids: string[]): Promise<WorkItem[]> {
  if (ids.length === 0) return [];
  const { names, teamNameById } = await fetchLookups();
  const { data } = await supabase.from("works").select("*").in("id", ids);
  const rows = (data ?? []) as WorkRow[];

  const { data: checklistData } = await supabase
    .from("work_checklist")
    .select("id, work_id, label, done, position")
    .in("work_id", ids)
    .order("position");
  const checklistByWork = new Map<string, ChecklistItem[]>();
  for (const c of checklistData ?? []) {
    const wid = c.work_id as string;
    if (!checklistByWork.has(wid)) checklistByWork.set(wid, []);
    checklistByWork.get(wid)!.push({ id: c.id, label: c.label, done: c.done });
  }
  const [attachmentMap, activityMap, commentMap] = await Promise.all([
    fetchAttachmentMap("work", names),
    fetchActivityMap("work", names),
    fetchCommentMap("work", names),
  ]);
  return rows.map((row) => {
    const item = rowToWork(row, names, teamNameById, checklistByWork.get(row.id) ?? []);
    item.evidences = attachmentMap.get(row.id) ?? [];
    item.activities = activityMap.get(row.id) ?? [];
    item.comments = commentMap.get(row.id) ?? [];
    return item;
  });
}

/** Tulis satu entri aktivitas. */
export async function logActivity(
  ownerType: "work" | "issue",
  ownerId: string,
  text: string,
  actorId: string | null
): Promise<void> {
  await supabase.from("activities").insert({
    owner_type: ownerType,
    owner_id: ownerId,
    text,
    actor_id: actorId,
  });
}
