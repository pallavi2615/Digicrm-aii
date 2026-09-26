import { createFileRoute } from "@tanstack/react-router";

function page(ok: boolean, msg: string) {
  const safe = msg.replace(/[<>&"]/g, "");
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:40px;text-align:center"><h2>${ok ? "Instagram connected" : "Instagram connection failed"}</h2><p>${safe}</p><p>You can close this window.</p><script>try{window.opener&&window.opener.postMessage({type:"instagramConnect",ok:${ok}},"*")}catch(e){};setTimeout(function(){window.close()},1500)</script></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("error")) return page(false, url.searchParams.get("error_description") ?? "Permission was not granted.");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return page(false, "Missing code.");
        const ig = await import("@/lib/instagram.server");
        let st;
        try { st = ig.verifyState(state); } catch { st = null; }
        if (!st) return page(false, "This link expired. Please try connecting again.");
        try {
          const { appId, secret } = ig.igCreds();
          const form = new URLSearchParams({ client_id: appId, client_secret: secret, grant_type: "authorization_code", redirect_uri: st.r, code: code.replace(/#_$/, "") });
          const t1 = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
          if (!t1.ok) return page(false, `Instagram rejected the sign-in (${t1.status}).`);
          const short = (await t1.json()).access_token as string;
          const t2 = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(short)}`);
          const long = t2.ok ? await t2.json() : { access_token: short, expires_in: 3600 };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: prof } = await supabaseAdmin.from("creator_profiles").select("id, owner_id").eq("id", st.p).maybeSingle();
          if (!prof) return page(false, "Creator not found.");
          // only the owner or an active team member may link
          if (prof.owner_id !== st.u) {
            const { data: m } = await supabaseAdmin.from("creator_team_members").select("id").eq("owner_id", prof.owner_id).eq("member_user_id", st.u).eq("status", "Active").maybeSingle();
            if (!m) return page(false, "You can't connect Instagram for this creator.");
          }
          await supabaseAdmin.from("creator_instagram").upsert({
            profile_id: prof.id, owner_id: prof.owner_id,
            access_token_ciphertext: ig.encryptToken(long.access_token),
            token_expires_at: new Date(Date.now() + (long.expires_in ?? 5184000) * 1000).toISOString(),
          });
          const stats = await ig.fetchIgStats(long.access_token);
          await ig.applyStats(supabaseAdmin, prof.id, stats);
          return page(true, `@${stats.username}: ${stats.followers.toLocaleString("en-IN")} followers, ${stats.engagement}% engagement.`);
        } catch (e: any) {
          console.error("instagram callback", e);
          return page(false, "Something went wrong while reading your Instagram stats.");
        }
      },
    },
  },
});
