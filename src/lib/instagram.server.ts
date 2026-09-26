import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const IG_GRAPH = "https://graph.instagram.com/v21.0";

export function igCreds() {
  const appId = process.env["INSTAGRAM_APP_ID"];
  const secret = process.env["INSTAGRAM_APP_SECRET"];
  if (!appId || !secret) throw new Error("Instagram isn't set up yet — the Meta app ID and secret are missing.");
  return { appId, secret };
}

function key() {
  return createHash("sha256").update("ig-token:" + igCreds().secret).digest();
}
export function encryptToken(t: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(t, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
export function decryptToken(s: string) {
  const b = Buffer.from(s, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function signState(payload: { u: string; p: string; r: string }) {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", igCreds().secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyState(state: string): { u: string; p: string; r: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const exp = createHmac("sha256", igCreds().secret).update(body).digest("base64url");
  if (exp.length !== sig.length || !timingSafeEqual(Buffer.from(exp), Buffer.from(sig))) return null;
  const j = JSON.parse(Buffer.from(body, "base64url").toString());
  if (Date.now() - j.t > 15 * 60 * 1000) return null;
  return j;
}

export async function fetchIgStats(token: string) {
  const me = await fetch(`${IG_GRAPH}/me?fields=user_id,username,followers_count,media_count&access_token=${encodeURIComponent(token)}`);
  if (!me.ok) throw new Error(`Instagram profile request failed (${me.status}): ${await me.text()}`);
  const p = await me.json();
  const media = await fetch(`${IG_GRAPH}/me/media?fields=like_count,comments_count&limit=12&access_token=${encodeURIComponent(token)}`);
  let engagement = 0;
  if (media.ok) {
    const m = (await media.json()).data ?? [];
    const followers = Number(p.followers_count) || 0;
    if (m.length && followers) {
      const avg = m.reduce((a: number, x: any) => a + (x.like_count ?? 0) + (x.comments_count ?? 0), 0) / m.length;
      engagement = Math.round((avg / followers) * 10000) / 100;
    }
  }
  return { igUserId: String(p.user_id ?? p.id), username: p.username as string, followers: Number(p.followers_count) || 0, mediaCount: Number(p.media_count) || 0, engagement };
}

/** Save stats onto the creator's media kit (followers, engagement, Instagram platform row). */
export async function applyStats(admin: any, profileId: string, s: Awaited<ReturnType<typeof fetchIgStats>>) {
  const { data: prof } = await admin.from("creator_profiles").select("platforms").eq("id", profileId).maybeSingle();
  const platforms = Array.isArray(prof?.platforms) ? prof.platforms.filter((x: any) => String(x.platform).toLowerCase() !== "instagram") : [];
  platforms.unshift({ platform: "Instagram", handle: "@" + s.username, followers: s.followers, engagement: s.engagement });
  await admin.from("creator_profiles").update({ followers: s.followers, engagement_rate: s.engagement, platforms }).eq("id", profileId);
  await admin.from("creator_instagram").update({ ig_user_id: s.igUserId, username: s.username, followers: s.followers, engagement_rate: s.engagement, media_count: s.mediaCount, synced_at: new Date().toISOString(), last_error: null }).eq("profile_id", profileId);
}
