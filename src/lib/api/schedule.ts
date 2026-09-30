import { supabase } from "@/lib/supabase";
import type { ScheduleRow, ShiftDef } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];

export async function listShifts(): Promise<ShiftDef[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select("id, name, code, start, \"end\"")
    .order("start");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    start: (s.start as string).slice(0, 5),
    end: (s.end as string).slice(0, 5),
  }));
}

export async function listSchedule(): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from("schedules")
    .select("user_id, day_of_week, shift_code")
    .order("day_of_week");
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.name);
  }

  const byUser = new Map<string, ScheduleRow>();
  for (const r of data ?? []) {
    const uid = r.user_id as string;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        user: nameById.get(uid) ?? "—",
        userId: uid,
        days: {},
      });
    }
    byUser.get(uid)!.days[r.day_of_week as Day] = (r.shift_code as string) ?? "OFF";
  }
  return Array.from(byUser.values());
}

export async function saveScheduleDay(
  userId: string,
  day: Day,
  shiftCode: string
): Promise<void> {
  const { error } = await supabase
    .from("schedules")
    .upsert({ user_id: userId, day_of_week: day, shift_code: shiftCode }, {
      onConflict: "user_id,day_of_week",
    });
  if (error) throw new Error(error.message);
}

export { DAYS };
