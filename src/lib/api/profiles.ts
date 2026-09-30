import { supabase } from "@/lib/supabase";
import type { User } from "@/types";
import { profileToUser } from "./auth";

/** Daftar semua profil (RLS menentukan visibilitas). */
export async function listProfiles(): Promise<User[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, initials, role, team_id, shift")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => profileToUser(r as never));
}

/** Cek apakah username sudah dipakai. */
export async function isUsernameTaken(username: string, exceptId?: string): Promise<boolean> {
  const q = username.trim().toLowerCase();
  if (!q) return false;
  let query = supabase.from("profiles").select("id").ilike("username", q);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

/** username default dari nama: "Operator A" -> "operator_a" */
export function defaultUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}
