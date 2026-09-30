/**
 * Konversi antar bentuk data:
 * - Row Supabase (snake_case, kolom foreign key berupa id) 
 * - Tipe aplikasi (camelCase, dipakai UI)
 *
 * UI tetap memakai nama orang (string) untuk createdBy/assignedTo/actor,
 * sedangkan DB menyimpan uuid. Modul API mengisi map id→nama saat mapping.
 */

/** Domain sintetis untuk memetakan username → email Supabase Auth. */
export const AUTH_EMAIL_DOMAIN = "tm.local";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string | undefined | null): string {
  if (!email) return "";
  return email.split("@")[0] ?? "";
}

/** null → undefined helper. */
export function nz<T>(v: T | null | undefined): T | undefined {
  return v ?? undefined;
}

/** Peta id→nama, untuk resolve FK ke string nama di UI. */
export type NameMap = Map<string, string>;

export function makeNameMap(
  rows: { id: string; name: string }[] | null | undefined
): NameMap {
  return new Map((rows ?? []).map((r) => [r.id, r.name]));
}

export function nameOf(map: NameMap, id: string | null | undefined, fallback = ""): string {
  if (!id) return fallback;
  return map.get(id) ?? fallback;
}

export function formatBytes(bytes: number | string | null | undefined): string {
  const n = Number(bytes ?? 0);
  if (!n || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
