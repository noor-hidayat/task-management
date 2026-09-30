// Edge Function: admin-users
// Operasi user oleh admin (create/update/delete) memakai service role.
// Wajib: pemanggil harus admin (dicek dari profile via JWT).
//
// Body JSON:
//   { action: "create", name, username, password, role, teamId?, email }
//   { action: "update", id, name?, username?, role?, teamId?, initials?, shift?, password?, email? }
//   { action: "delete", id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cek pemanggil.
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return errorResponse("Unauthorized", 401);

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    if (callerProfile?.role !== "admin") return errorResponse("Hanya admin", 403);

    const admin = createClient(url, serviceKey);
    const body = await req.json();
    const action = body.action as string;

    if (action === "create") {
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          name: body.name,
          username: body.username,
          role: body.role ?? "Member",
          team_id: body.teamId ?? null,
          initials: body.initials ?? null,
          shift: body.shift ?? null,
        },
      });
      if (error) return errorResponse(error.message, 400);
      // Trigger handle_new_user sudah membuat profile; ambil untuk respons.
      const { data: profile } = await admin
        .from("profiles")
        .select("id, name, username, initials, role, team_id, shift")
        .eq("id", data.user!.id)
        .maybeSingle();
      return json({ profile });
    }

    if (action === "update") {
      if (body.password) {
        const { error } = await admin.auth.admin.updateUserById(body.id, {
          password: body.password,
          ...(body.email ? { email: body.email, email_confirm: true } : {}),
        });
        if (error) return errorResponse(error.message, 400);
      } else if (body.email) {
        const { error } = await admin.auth.admin.updateUserById(body.id, {
          email: body.email,
          email_confirm: true,
        });
        if (error) return errorResponse(error.message, 400);
      }

      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.username !== undefined) patch.username = body.username;
      if (body.role !== undefined) patch.role = body.role;
      if (body.teamId !== undefined) patch.team_id = body.teamId;
      if (body.initials !== undefined) patch.initials = body.initials;
      if (body.shift !== undefined) patch.shift = body.shift;

      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from("profiles").update(patch).eq("id", body.id);
        if (error) return errorResponse(error.message, 400);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      if (body.id === caller.id) return errorResponse("Tidak bisa menghapus diri sendiri", 400);
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) return errorResponse(error.message, 400);
      return json({ ok: true });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});
