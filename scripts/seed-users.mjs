#!/usr/bin/env node
/**
 * Seed user demo ke Supabase Auth + profile.
 *
 * Pemakaian:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/seed-users.mjs
 *
 * Catatan:
 * - Membuat user via Admin API dengan email sintetis <username>@tm.local.
 * - Trigger `handle_new_user` otomatis membuat baris di `profiles`.
 * - Setelah user dibuat, script meng-update team_id & leader tim.
 * - Idempotent: user yang sudah ada dilewati.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOMAIN = "tm.local";
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "admin123";

/** username, name, role, teamKey */
const USERS = [
  ["operator_a", "Operator A", "Member", "prod_a"],
  ["admin", "Administrator", "admin", "it"],
  ["supervisor_a", "Supervisor A", "Team Leader", "prod_a"],
  ["operator_b", "Operator B", "Member", "prod_a"],
  ["operator_c", "Operator C", "Member", "prod_a"],
  ["operator_1", "Operator 1", "Member", "prod_a"],
  ["operator_2", "Operator 2", "Member", "prod_a"],
  ["nurhidayat", "Nurhidayat", "Team Leader", "it"],
  ["it_support_1", "IT Support 1", "Member", "it"],
  ["it_support_2", "IT Support 2", "Member", "it"],
  ["warehouse_lead", "Warehouse Lead", "Team Leader", "warehouse"],
  ["warehouse_staff_1", "Warehouse Staff 1", "Member", "warehouse"],
  ["warehouse_staff_2", "Warehouse Staff 2", "Member", "warehouse"],
  ["finance_lead", "Finance Lead", "Team Leader", "finance"],
  ["finance_staff_1", "Finance Staff 1", "Member", "finance"],
];

const TEAM_IDS = {
  prod_a: "aaaaaaaa-0000-0000-0000-000000000001",
  maint: "aaaaaaaa-0000-0000-0000-000000000002",
  qc: "aaaaaaaa-0000-0000-0000-000000000003",
  it: "aaaaaaaa-0000-0000-0000-000000000004",
  warehouse: "aaaaaaaa-0000-0000-0000-000000000005",
  finance: "aaaaaaaa-0000-0000-0000-000000000006",
};

const TEAM_LEADERS = {
  prod_a: "supervisor_a",
  maint: "supervisor_a",
  qc: "supervisor_a",
  it: "nurhidayat",
  warehouse: "warehouse_lead",
  finance: "finance_lead",
};

function initials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

async function main() {
  const idByUsername = new Map();

  // 1) Buat user auth.
  for (const [username, name, role, teamKey] of USERS) {
    const email = `${username}@${DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name,
        username,
        role,
        initials: initials(name),
        team_id: TEAM_IDS[teamKey],
      },
    });
    if (error) {
      if (/already|exists|registered/i.test(error.message)) {
        // Ambil id yang sudah ada.
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users.find((u) => u.email === email);
        if (found) {
          idByUsername.set(username, found.id);
          console.log(`skip (ada): ${username}`);
          continue;
        }
      }
      console.error(`gagal buat ${username}:`, error.message);
      continue;
    }
    idByUsername.set(username, data.user.id);
    console.log(`created: ${username} -> ${data.user.id}`);
  }

  // 2) Set team_id di profile (memastikan konsisten).
  for (const [username, name, role, teamKey] of USERS) {
    const id = idByUsername.get(username);
    if (!id) continue;
    await admin
      .from("profiles")
      .update({ role, team_id: TEAM_IDS[teamKey], name, initials: initials(name) })
      .eq("id", id);
  }

  // 3) Set leader tim.
  for (const [teamKey, username] of Object.entries(TEAM_LEADERS)) {
    const id = idByUsername.get(username);
    if (!id) continue;
    await admin.from("teams").update({ leader_id: id }).eq("id", TEAM_IDS[teamKey]);
  }

  console.log("\nSeed user selesai. Password default:", DEFAULT_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
