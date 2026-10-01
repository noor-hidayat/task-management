import { supabase } from "@/lib/supabase";

export interface SiteOption {
  id: string;
  name: string;
}

async function listOptions(table: "plants" | "locations"): Promise<SiteOption[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SiteOption[];
}

/** Daftar plant aktif dari tabel master (dikelola lewat database). */
export function listPlants(): Promise<SiteOption[]> {
  return listOptions("plants");
}

/** Daftar location aktif dari tabel master (dikelola lewat database). */
export function listLocations(): Promise<SiteOption[]> {
  return listOptions("locations");
}
