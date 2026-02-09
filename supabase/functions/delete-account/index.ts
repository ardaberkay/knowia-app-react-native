import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Kullanıcıyı JWT ile doğrula (anon client + Authorization header)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // 2) Admin client (service role) ile uygulama verilerini sil
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Önce user_id FK’leri olan tablolar (sırayı kendi FK’lerine göre ayarla)
    const deletes: Array<Promise<any>> = [
      admin.from("user_card_progress").delete().eq("user_id", userId),
      admin.from("favorite_cards").delete().eq("user_id", userId),
      admin.from("favorite_decks").delete().eq("user_id", userId),
    ];

    // Kullanıcının deck’leri varsa önce child tabloları temizle
    const { data: decks, error: decksErr } = await admin
      .from("decks")
      .select("id")
      .eq("user_id", userId);

    if (decksErr) {
      return new Response(JSON.stringify({ error: decksErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (decks?.length) {
      for (const deck of decks) {
        deletes.push(admin.from("cards").delete().eq("deck_id", deck.id));
        deletes.push(admin.from("chapters").delete().eq("deck_id", deck.id));
        deletes.push(admin.from("decks_stats").delete().eq("deck_id", deck.id));
        // deck’e bağlı başka tabloların varsa burada sil
      }
      deletes.push(admin.from("decks").delete().eq("user_id", userId));
    }

    // profiles kaydını sil (auth.users silmeden önce)
    deletes.push(admin.from("profiles").delete().eq("id", userId));

    const results = await Promise.all(deletes);
    const firstError = results.find((r: any) => r?.error)?.error;
    if (firstError) {
      return new Response(JSON.stringify({ error: firstError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) En son auth.users kaydını sil
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      return new Response(JSON.stringify({ error: authDeleteErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});