import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ownProfile(supabase: any, profileId: string) {
  // RLS: only the creator (or their team / admins) can read this profile
  const { data } = await supabase.from("creator_profiles").select("id, owner_id").eq("id", profileId).maybeSingle();
  if (!data) throw new Error("Creator not found");
  return data as { id: string; owner_id: string };
}

export const startInstagramConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { igCreds, signState } = await import("./instagram.server");
    await ownProfile(context.supabase, data.profileId);
    const { appId } = igCreds();
    const req = getRequest();
    const url = new URL(req.url);
    const fwd = url.hostname === "localhost" ? req.headers.get("x-forwarded-host") : null;
    const origin = fwd ? `https://${fwd}` : url.origin;
    const redirect = `${origin}/api/public/instagram/callback`;
    const state = signState({ u: context.userId, p: data.profileId, r: redirect });
    const auth = new URL("https://www.instagram.com/oauth/authorize");
    auth.searchParams.set("client_id", appId);
    auth.searchParams.set("redirect_uri", redirect);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", "instagram_business_basic");
    auth.searchParams.set("state", state);
    return { url: auth.toString(), redirect };
  });

export const getInstagramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileIds: string[] }) => z.object({ profileIds: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.profileIds.length) return { configured: !!process.env["INSTAGRAM_APP_ID"], rows: [] };
    const { data: visible } = await context.supabase.from("creator_profiles").select("id").in("id", data.profileIds);
    const ids = (visible ?? []).map((r: any) => r.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = ids.length
      ? await supabaseAdmin.from("creator_instagram").select("profile_id, username, followers, engagement_rate, media_count, synced_at, last_error").in("profile_id", ids)
      : { data: [] };
    return { configured: !!(process.env["INSTAGRAM_APP_ID"] && process.env["INSTAGRAM_APP_SECRET"]), rows: rows ?? [] };
  });

export const syncInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ownProfile(context.supabase, data.profileId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptToken, fetchIgStats, applyStats, IG_GRAPH } = await import("./instagram.server");
    const { data: row } = await supabaseAdmin.from("creator_instagram").select("*").eq("profile_id", data.profileId).maybeSingle();
    if (!row?.access_token_ciphertext) throw new Error("Connect Instagram first.");
    let token = decryptToken(row.access_token_ciphertext);
    try {
      // refresh long-lived token when it's within 10 days of expiry
      if (row.token_expires_at && new Date(row.token_expires_at).getTime() - Date.now() < 10 * 864e5) {
        const r = await fetch(`${IG_GRAPH.replace("/v21.0", "")}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
        if (r.ok) {
          const j = await r.json();
          token = j.access_token;
          const { encryptToken } = await import("./instagram.server");
          await supabaseAdmin.from("creator_instagram").update({ access_token_ciphertext: encryptToken(token), token_expires_at: new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString() }).eq("profile_id", data.profileId);
        }
      }
      const stats = await fetchIgStats(token);
      await applyStats(supabaseAdmin, data.profileId, stats);
      return stats;
    } catch (e: any) {
      await supabaseAdmin.from("creator_instagram").update({ last_error: String(e.message).slice(0, 300) }).eq("profile_id", data.profileId);
      throw e;
    }
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ownProfile(context.supabase, data.profileId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("creator_instagram").delete().eq("profile_id", data.profileId);
    return { ok: true };
  });
