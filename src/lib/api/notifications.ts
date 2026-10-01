import { supabase } from "@/lib/supabase";
import type { AppNotification, NotificationType } from "@/types";

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  from_id: string | null;
  for_user: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function rowToNotification(r: NotificationRow, fromName?: string): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message ?? "",
    from: fromName ?? "",
    timestamp: new Date(r.created_at).getTime(),
    read: r.read,
    link: r.link ?? "",
    // Simpan uuid target (bukan nama) agar cocok dengan user.id.
    forUser: r.for_user ?? undefined,
  };
}

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, from_id, for_user, link, read, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  // Resolve nama pengirim.
  const fromIds = Array.from(
    new Set((data ?? []).map((r) => r.from_id).filter((v): v is string => Boolean(v)))
  );
  const nameById = new Map<string, string>();
  if (fromIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", fromIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.name);
  }
  return (data ?? []).map((r) =>
    rowToNotification(r as NotificationRow, r.from_id ? nameById.get(r.from_id) : undefined)
  );
}

export async function pushNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  fromId: string | null;
  forUserId: string | null;
  link: string;
}): Promise<AppNotification> {
  // Insert-only (tanpa .select()/RETURNING) agar tidak kena cek policy SELECT
  // pada row baru — penerima membaca notif lewat listNotifications + realtime.
  const { error } = await supabase.from("notifications").insert({
    type: input.type,
    title: input.title,
    message: input.message,
    from_id: input.fromId,
    for_user: input.forUserId,
    link: input.link,
  });
  if (error) throw new Error(error.message);
  return {
    id: `pending-${Date.now()}`,
    type: input.type,
    title: input.title,
    message: input.message,
    from: "",
    timestamp: Date.now(),
    read: false,
    link: input.link,
    forUser: input.forUserId ?? undefined,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("read", false);
}

export async function removeNotification(id: string): Promise<void> {
  await supabase.from("notifications").delete().eq("id", id);
}

export async function clearNotifications(): Promise<void> {
  await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

/* ── Helper label waktu relatif ─────────────────────────────────── */

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  return `${months} bulan lalu`;
}

export function notificationsForUser(
  list: AppNotification[],
  userId?: string
): AppNotification[] {
  if (!userId) return list;
  return list.filter((n) => !n.forUser || n.forUser === userId);
}

export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  assignment: "Task baru ditugaskan",
  mention: "Anda disebut",
  progress: "Task sedang dikerjakan",
  overdue: "Task melewati tenggat",
  comment: "Komentar baru",
  handover: "Issue diserahkan ke tim",
};

/**
 * Ekstrak nama user yang di-mention dari konten (HTML rich text maupun plain text)
 * lalu kirim notifikasi mention ke masing-masing — kecuali penulis sendiri.
 */
export async function notifyMentions(input: {
  content: string;
  users: { id: string; name: string }[];
  fromId: string | null;
  fromName?: string;
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  const mentioned = new Set<string>();
  // 1. Dari HTML rich text: <span class="rt-mention" data-user="Nama">
  for (const m of input.content.matchAll(
    /<span[^>]*class="[^"]*rt-mention[^"]*"[^>]*data-user="([^"]+)"[^>]*>/gi
  )) {
    if (m[1]) mentioned.add(m[1]);
  }
  // 2. Dari plain text: @Nama (cocokkan nama terpanjang dulu agar "Budi S" menang atas "Budi")
  // Case-insensitive agar "@administrator" tetap cocok dengan "Administrator".
  const names = [...input.users.map((u) => u.name)].sort((a, b) => b.length - a.length);
  if (names.length > 0) {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@(${names.map(esc).join("|")})(?![\\w])`, "gi");
    for (const m of input.content.matchAll(re)) mentioned.add(m[1]);
  }
  const lowerName = (s: string) => s.toLowerCase();
  console.log("[notifyMentions] content:", input.content, "| users:", input.users.length, "| from:", input.fromName);
  for (const name of mentioned) {
    if (input.fromName && lowerName(name) === lowerName(input.fromName)) continue;
    const target =
      input.users.find((u) => u.name === name) ??
      input.users.find((u) => lowerName(u.name) === lowerName(name));
    console.log("[notifyMentions] mention:", name, "-> target:", target?.id ?? "TIDAK KETEMU");
    if (!target || target.id === input.fromId) continue;
    await pushNotification({
      type: "mention",
      title: input.title,
      message: input.message,
      fromId: input.fromId,
      forUserId: target.id,
      link: input.link,
    });
  }
}
