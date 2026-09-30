import { supabase } from "@/lib/supabase";

export interface Role {
  name: string;
}

/** Role bawaan kalau tabel roles belum dimigrasi. */
export const FALLBACK_ROLES: Role[] = [
  { name: "admin" },
  { name: "Team Leader" },
  { name: "Foreman" },
  { name: "Member" },
];

/** true kalau role punya hak setara leader (Team Leader / Foreman / admin). */
export function isLeaderRole(role?: string): boolean {
  return role === "admin" || role === "Team Leader" || role === "Foreman";
}

/** Daftar role dari database (tabel public.roles). */
export async function listRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("name")
    .order("name");
  if (error || !data) return FALLBACK_ROLES;
  return (data as Role[]).length > 0 ? (data as Role[]) : FALLBACK_ROLES;
}
