import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Faz 1.6 (S3): every user table hangs off profiles → auth.users with
// ON DELETE CASCADE, so deleting the auth user removes all database rows in one
// step. What CASCADE can't reach are the files in Storage, so those go first:
// every object the user uploaded (owner), in both buckets, found through the
// service-role-only RPC storage_objects_of_user.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// New-style secret key when available, legacy service role otherwise.
function adminKey() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (keys?.default) return keys.default as string;
  } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const REMOVE_BATCH = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, adminKey());

    // 1) Who is asking (the user's own JWT)
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json(401, { error: "Unauthorized" });
    const userId = user.id;

    // 2) Storage files first (CASCADE doesn't delete files)
    const { data: objects, error: listErr } = await admin.rpc("storage_objects_of_user", { p_user_id: userId });
    if (listErr) {
      console.error("storage list failed:", listErr.message);
      return json(500, { error: "Storage cleanup failed" });
    }
    const byBucket = new Map<string, string[]>();
    for (const o of (objects ?? []) as Array<{ bucket_id: string; name: string }>) {
      if (!byBucket.has(o.bucket_id)) byBucket.set(o.bucket_id, []);
      byBucket.get(o.bucket_id)!.push(o.name);
    }
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += REMOVE_BATCH) {
        const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + REMOVE_BATCH));
        if (error) {
          console.error("storage remove failed:", bucket, error.message);
          return json(500, { error: "Storage cleanup failed" });
        }
      }
    }

    // 3) Auth user → CASCADE removes profile, decks, cards, progress, favorites,
    //    sessions, reports, blocks, stats, activity in one transaction.
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      console.error("auth delete failed:", authDeleteErr.message);
      return json(500, { error: "Account deletion failed" });
    }

    return json(200, { success: true });
  } catch (e) {
    console.error("delete-account error:", (e as Error).message);
    return json(500, { error: "Account deletion failed" });
  }
});
