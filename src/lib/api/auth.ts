import { supabase } from "@/lib/supabase";
import type { User } from "@/types";
import { AUTH_EMAIL_DOMAIN, usernameToEmail } from "./mappers";

interface ProfileRow {
  id: string;
  name: string;
  username: string;
  initials: string | null;
  role: User["role"];
  team_id: string | null;
  shift: string | null;
}

/** Profile row → tipe User app. */
export function profileToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    initials: row.initials ?? undefined,
    role: row.role,
    teamId: row.team_id ?? undefined,
    shift: row.shift ?? undefined,
  };
}

/** Ambil profile milik user yang sedang login. */
export async function fetchMyProfile(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, initials, role, team_id, shift")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return profileToUser(data as ProfileRow);
}

/**
 * Login dengan username + password.
 * Username dipetakan ke email sintetis `<username>@tm.local`.
 */
export async function signInWithUsername(
  username: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { user: null, error: "Username atau password salah" };
  }
  const profile = await fetchMyProfile();
  return { user: profile, error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Buat user baru (khusus admin). Karena butuh akses Admin API (service role),
 * pembuatan user harus lewat Edge Function `admin-users`. Fungsi ini
 * memanggilnya; metadata dipakai trigger handle_new_user.
 */
export async function createUserAsAdmin(input: {
  name: string;
  username: string;
  password: string;
  role: User["role"];
  teamId?: string;
}): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", ...input, email: `${input.username}@${AUTH_EMAIL_DOMAIN}` },
  });
  if (error) return { user: null, error: error.message };
  if (data?.error) return { user: null, error: data.error as string };
  return { user: profileToUser(data.profile as ProfileRow), error: null };
}

/** Update user lain (khusus admin), termasuk reset password. */
export async function updateUserAsAdmin(
  id: string,
  patch: Partial<Pick<User, "name" | "username" | "role" | "teamId" | "initials" | "shift">> & {
    password?: string;
  }
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: {
      action: "update",
      id,
      name: patch.name,
      username: patch.username,
      role: patch.role,
      teamId: patch.teamId,
      initials: patch.initials,
      shift: patch.shift,
      password: patch.password,
      email: patch.username ? `${patch.username}@${AUTH_EMAIL_DOMAIN}` : undefined,
    },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };
  return { error: null };
}

export async function deleteUserAsAdmin(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete", id },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };
  return { error: null };
}

/** Update profil user yang sedang login. */
export async function updateMyProfile(
  patch: Partial<Pick<User, "name" | "username" | "initials" | "shift">> & {
    password?: string;
  }
): Promise<{ user: User | null; error: string | null }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { user: null, error: "Tidak ada sesi" };

  if (patch.password) {
    const { error } = await supabase.auth.updateUser({ password: patch.password });
    if (error) return { user: null, error: error.message };
  }
  if (patch.username) {
    const { error } = await supabase.auth.updateUser({
      email: `${patch.username}@${AUTH_EMAIL_DOMAIN}`,
    });
    if (error) return { user: null, error: error.message };
  }

  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.username !== undefined) dbPatch.username = patch.username;
  if (patch.initials !== undefined) dbPatch.initials = patch.initials;
  if (patch.shift !== undefined) dbPatch.shift = patch.shift;

  if (Object.keys(dbPatch).length > 0) {
    const { error } = await supabase.from("profiles").update(dbPatch).eq("id", authUser.id);
    if (error) return { user: null, error: error.message };
  }

  const profile = await fetchMyProfile();
  return { user: profile, error: null };
}
