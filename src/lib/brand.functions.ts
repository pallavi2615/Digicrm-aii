import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { userId: string; claims: { email?: string } };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function emailOf(ctx: Ctx) {
  return (ctx.claims?.email ?? "").toLowerCase();
}

/** Returns the deal if the caller is its linked brand; links by email on first visit. */
async function brandDeal(ctx: Ctx, dealId: string) {
  const db = await admin();
  const { data: d } = await db.from("creator_deals").select("id,owner_id,brand_email,brand_user_id").eq("id", dealId).maybeSingle();
  if (!d) throw new Error("Campaign not found.");
  const email = emailOf(ctx);
  const ok = d.brand_user_id === ctx.userId || (!!email && (d.brand_email ?? "").toLowerCase() === email);
  if (!ok) throw new Error("You don't have access to this campaign.");
  if (!d.brand_user_id) await db.from("creator_deals").update({ brand_user_id: ctx.userId }).eq("id", d.id);
  return d;
}

export const getBrandAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("brand_accounts").select("*").eq("user_id", context.userId).maybeSingle();
    return { account: data, email: emailOf(context as unknown as Ctx) };
  });

export const saveBrandAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    company: z.string().trim().min(1).max(120),
    contact_name: z.string().trim().max(120).optional().default(""),
    website: z.string().trim().max(200).optional().default(""),
    category: z.string().trim().max(80).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brand_accounts").upsert({
      user_id: context.userId, company: data.company, contact_name: data.contact_name || null,
      website: data.website || null, category: data.category || null, email: emailOf(context as unknown as Ctx),
    });
    if (error) throw new Error("Could not save your brand profile.");
    return { ok: true };
  });

export const getBrandCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const email = emailOf(context as unknown as Ctx);
    let q = db.from("creator_deals")
      .select("id,campaign,stage,value,currency,platform,start_date,end_date,deadline,created_at,creator_profiles(display_name,handle),creator_brands(name),creator_deliverables(status)")
      .order("created_at", { ascending: false }).limit(200);
    q = email ? q.or(`brand_user_id.eq.${context.userId},brand_email.ilike.${email.replace(/[,()*%]/g, "")}`) : q.eq("brand_user_id", context.userId);
    const { data } = await q;
    return (data ?? []).map((d) => {
      const dels = (d.creator_deliverables ?? []) as { status: string }[];
      return {
        ...d, creator_deliverables: undefined,
        total: dels.length,
        pending: dels.filter((x) => x.status === "Submitted").length,
        approved: dels.filter((x) => x.status === "Approved" || x.status === "Published").length,
      };
    });
  });

export const getBrandCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await brandDeal(context as unknown as Ctx, data.id);
    const db = await admin();
    const [deal, dels, inv, com] = await Promise.all([
      db.from("creator_deals").select("id,campaign,objective,stage,value,currency,platform,start_date,end_date,deadline,usage_rights,exclusivity,requirements,creator_profiles(display_name,handle),creator_brands(name)").eq("id", data.id).single(),
      db.from("creator_deliverables").select("id,content_type,platform,quantity,due_date,status,caption,script,draft_url,revision_count,brand_comment,posted_at,reach,views,engagements,clicks,conversions").eq("deal_id", data.id).order("due_date", { nullsFirst: false }),
      db.from("creator_invoices").select("id,number,amount,tax_pct,status,issued_at,due_date,paid_amount,paid_at").eq("deal_id", data.id).neq("status", "Draft").order("issued_at"),
      db.from("creator_deal_comments").select("id,deliverable_id,author_role,author_name,body,created_at").eq("deal_id", data.id).order("created_at"),
    ]);
    return { deal: deal.data, deliverables: dels.data ?? [], invoices: inv.data ?? [], comments: com.data ?? [] };
  });

export const brandActOnDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    dealId: z.string().uuid(), deliverableId: z.string().uuid(),
    action: z.enum(["approve", "revise"]), comment: z.string().trim().max(2000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const deal = await brandDeal(context as unknown as Ctx, data.dealId);
    const db = await admin();
    const { data: del } = await db.from("creator_deliverables").select("id,revision_count,content_type").eq("id", data.deliverableId).eq("deal_id", deal.id).maybeSingle();
    if (!del) throw new Error("Deliverable not found.");
    if (data.action === "revise" && !data.comment) throw new Error("Tell the creator what to change.");
    const patch = data.action === "approve"
      ? { status: "Approved", brand_comment: data.comment || null }
      : { status: "Revision Required", brand_comment: data.comment, revision_count: del.revision_count + 1 };
    await db.from("creator_deliverables").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", del.id);
    const name = await brandName(context.userId);
    if (data.comment) await db.from("creator_deal_comments").insert({ owner_id: deal.owner_id, deal_id: deal.id, deliverable_id: del.id, author_id: context.userId, author_role: "brand", author_name: name, body: data.comment });
    const verb = data.action === "approve" ? "approved" : "requested changes on";
    await db.from("creator_activities").insert({ owner_id: deal.owner_id, deal_id: deal.id, kind: "approval", body: `${name} ${verb} ${del.content_type}${data.comment ? `: "${data.comment}"` : ""}` });
    await db.from("notifications").insert({ user_id: deal.owner_id, title: `${name} ${verb} ${del.content_type}`, body: data.comment || null, link: `/creator/deal/${deal.id}` });
    return { ok: true };
  });

async function brandName(userId: string) {
  const db = await admin();
  const { data } = await db.from("brand_accounts").select("company,contact_name").eq("user_id", userId).maybeSingle();
  return data?.company ?? "Brand";
}

export const brandComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    dealId: z.string().uuid(), deliverableId: z.string().uuid().nullable().optional(), body: z.string().trim().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const deal = await brandDeal(context as unknown as Ctx, data.dealId);
    const db = await admin();
    const name = await brandName(context.userId);
    await db.from("creator_deal_comments").insert({ owner_id: deal.owner_id, deal_id: deal.id, deliverable_id: data.deliverableId ?? null, author_id: context.userId, author_role: "brand", author_name: name, body: data.body });
    await db.from("notifications").insert({ user_id: deal.owner_id, title: `New comment from ${name}`, body: data.body.slice(0, 200), link: `/creator/deal/${deal.id}` });
    return { ok: true };
  });

/** Creator replies in the shared thread; notifies the linked brand user. */
export const creatorComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    dealId: z.string().uuid(), deliverableId: z.string().uuid().nullable().optional(), body: z.string().trim().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal } = await context.supabase.from("creator_deals").select("id,owner_id,brand_user_id,campaign").eq("id", data.dealId).maybeSingle();
    if (!deal) throw new Error("Deal not found.");
    const { error } = await context.supabase.from("creator_deal_comments").insert({
      owner_id: deal.owner_id, deal_id: deal.id, deliverable_id: data.deliverableId ?? null, author_role: "creator", author_name: "Creator", body: data.body,
    });
    if (error) throw new Error("Could not post your comment.");
    if (deal.brand_user_id) {
      const db = await admin();
      await db.from("notifications").insert({ user_id: deal.brand_user_id, title: `Creator replied on ${deal.campaign}`, body: data.body.slice(0, 200), link: `/brand/campaign/${deal.id}` });
    }
    return { ok: true };
  });

// ---------- Marketplace ----------

export const searchMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(100).optional().default(""),
    category: z.string().trim().max(80).optional().default(""),
    minFollowers: z.number().min(0).max(1e10).optional().default(0),
    minEngagement: z.number().min(0).max(100).optional().default(0),
    sort: z.enum(["followers", "engagement"]).optional().default("followers"),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    let q = db.from("creator_profiles")
      .select("id,handle,display_name,bio,avatar_url,niche,location,categories,platforms,followers,engagement_rate")
      .eq("is_public", true).gte("followers", data.minFollowers).gte("engagement_rate", data.minEngagement)
      .order(data.sort === "engagement" ? "engagement_rate" : "followers", { ascending: false }).limit(60);
    if (data.category) q = q.contains("categories", [data.category]);
    if (data.q) {
      const s = data.q.replace(/[,()*%\\]/g, " ");
      q = q.or(`display_name.ilike.%${s}%,niche.ilike.%${s}%,bio.ilike.%${s}%,location.ilike.%${s}%`);
    }
    const { data: rows } = await q;
    const { data: cats } = await db.from("creator_profiles").select("categories").eq("is_public", true).limit(500);
    const categories = [...new Set((cats ?? []).flatMap((c) => c.categories ?? []))].sort();
    return { creators: rows ?? [], categories };
  });

export const sendMarketplaceBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    creatorId: z.string().uuid(),
    campaign: z.string().trim().min(1).max(200),
    budget: z.number().min(0).max(1e10).nullable(),
    platform: z.string().max(60).optional().default(""),
    deadline: z.string().max(10).optional().default(""),
    brief: z.string().trim().max(4000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const email = emailOf(context as unknown as Ctx);
    const { data: acct } = await db.from("brand_accounts").select("*").eq("user_id", context.userId).maybeSingle();
    if (!acct) throw new Error("Set up your brand profile first.");
    const { data: p } = await db.from("creator_profiles").select("id,owner_id,display_name").eq("id", data.creatorId).eq("is_public", true).maybeSingle();
    if (!p) throw new Error("This creator is not available.");
    let brandId: string;
    const { data: existing } = await db.from("creator_brands").select("id").eq("owner_id", p.owner_id).ilike("name", acct.company).maybeSingle();
    if (existing) brandId = existing.id;
    else {
      const { data: b, error } = await db.from("creator_brands").insert({ owner_id: p.owner_id, name: acct.company, website: acct.website, category: acct.category, tags: ["marketplace"] }).select("id").single();
      if (error) throw new Error("Could not send your brief.");
      brandId = b.id;
      await db.from("creator_brand_contacts").insert({ owner_id: p.owner_id, brand_id: brandId, name: acct.contact_name ?? acct.company, email: email || null });
    }
    const { data: deal, error } = await db.from("creator_deals").insert({
      owner_id: p.owner_id, creator_id: p.id, brand_id: brandId, campaign: data.campaign, value: data.budget ?? 0,
      platform: data.platform || null, deadline: /^\d{4}-\d{2}-\d{2}$/.test(data.deadline) ? data.deadline : null,
      requirements: data.brief || null, source: "Marketplace", stage: "New Lead", probability: 10,
      brand_email: email || null, brand_user_id: context.userId, next_action: "Reply to marketplace brief",
      next_action_at: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
    }).select("id").single();
    if (error) throw new Error("Could not send your brief.");
    await db.from("creator_activities").insert({ owner_id: p.owner_id, deal_id: deal.id, kind: "enquiry", body: `Marketplace brief from ${acct.company}` });
    await db.from("notifications").insert({ user_id: p.owner_id, title: `New brief from ${acct.company}`, body: data.campaign, link: `/creator/deal/${deal.id}` });
    return { dealId: deal.id };
  });

export const runFollowupsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("run_creator_followups");
    if (error) throw new Error(error.message);
    const seq = await context.supabase.rpc("run_creator_sequences");
    const d = data as { alerts: number; emails_queued: number };
    return { ...d, alerts: d.alerts + Number((seq.data as { sequence_alerts?: number } | null)?.sequence_alerts ?? 0) };
  });

// ---------- Open campaigns (brands post, creators apply) ----------

export const brandCampaignsMine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: camps } = await context.supabase.from("brand_campaigns").select("*").eq("brand_user_id", context.userId).order("created_at", { ascending: false });
    const ids = (camps ?? []).map((c) => c.id);
    const db = await admin();
    const { data: apps } = ids.length
      ? await db.from("brand_campaign_applications").select("id,campaign_id,pitch,quote,status,deal_id,created_at,creator_profiles(display_name,handle,followers,engagement_rate)").in("campaign_id", ids).order("created_at", { ascending: false })
      : { data: [] };
    return { campaigns: camps ?? [], applications: apps ?? [] };
  });

export const createBrandCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(1).max(200), brief: z.string().trim().max(4000).optional().default(""),
    budget: z.number().min(0).max(1e10).nullable(), platform: z.string().max(60).optional().default(""),
    category: z.string().max(80).optional().default(""), min_followers: z.number().int().min(0).max(1e10).optional().default(0),
    deadline: z.string().max(10).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: acct } = await context.supabase.from("brand_accounts").select("company").eq("user_id", context.userId).maybeSingle();
    if (!acct) throw new Error("Set up your brand profile first.");
    const { error } = await context.supabase.from("brand_campaigns").insert({
      company: acct.company, title: data.title, brief: data.brief || null, budget: data.budget, platform: data.platform || null,
      category: data.category || null, min_followers: data.min_followers, deadline: /^\d{4}-\d{2}-\d{2}$/.test(data.deadline) ? data.deadline : null,
    });
    if (error) throw new Error("Could not post the campaign.");
    return { ok: true };
  });

export const setBrandCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["Open", "Closed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brand_campaigns").update({ status: data.status }).eq("id", data.id).eq("brand_user_id", context.userId);
    if (error) throw new Error("Could not update the campaign.");
    return { ok: true };
  });

export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), decision: z.enum(["Shortlisted", "Accepted", "Declined"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: app } = await db.from("brand_campaign_applications").select("id,owner_id,deal_id,campaign_id,brand_campaigns(brand_user_id,title)").eq("id", data.id).maybeSingle();
    const camp = app?.brand_campaigns as { brand_user_id: string; title: string } | null;
    if (!app || camp?.brand_user_id !== context.userId) throw new Error("Application not found.");
    await db.from("brand_campaign_applications").update({ status: data.decision }).eq("id", app.id);
    if (app.deal_id) {
      if (data.decision === "Accepted") await db.from("creator_deals").update({ stage: "Negotiation", probability: 50, updated_at: new Date().toISOString() }).eq("id", app.deal_id);
      if (data.decision === "Declined") await db.from("creator_deals").update({ stage: "Lost", probability: 0, updated_at: new Date().toISOString() }).eq("id", app.deal_id);
      await db.from("creator_activities").insert({ owner_id: app.owner_id, deal_id: app.deal_id, kind: "marketplace", body: `Brand ${data.decision.toLowerCase()} your application` });
    }
    await db.from("notifications").insert({ user_id: app.owner_id, title: `Application ${data.decision.toLowerCase()}: ${camp.title}`, link: app.deal_id ? `/creator/deal/${app.deal_id}` : "/creator/campaigns" });
    return { ok: true };
  });

export const openCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [c, a] = await Promise.all([
      context.supabase.from("brand_campaigns").select("id,company,title,brief,budget,platform,category,min_followers,deadline,created_at").eq("status", "Open").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("brand_campaign_applications").select("campaign_id,creator_id,status"),
    ]);
    return { campaigns: c.data ?? [], applied: a.data ?? [] };
  });

export const applyToCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    campaignId: z.string().uuid(), creatorId: z.string().uuid(), pitch: z.string().trim().min(1).max(3000), quote: z.number().min(0).max(1e10).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("creator_profiles").select("id,owner_id,display_name").eq("id", data.creatorId).maybeSingle();
    if (!p) throw new Error("Creator not found.");
    const { data: camp } = await context.supabase.from("brand_campaigns").select("*").eq("id", data.campaignId).eq("status", "Open").maybeSingle();
    if (!camp) throw new Error("This campaign is closed.");
    const db = await admin();
    const { data: acct } = await db.from("brand_accounts").select("email,website,category").eq("user_id", camp.brand_user_id).maybeSingle();
    let brandId: string;
    const { data: ex } = await db.from("creator_brands").select("id").eq("owner_id", p.owner_id).ilike("name", camp.company).maybeSingle();
    if (ex) brandId = ex.id;
    else {
      const { data: b, error } = await db.from("creator_brands").insert({ owner_id: p.owner_id, name: camp.company, website: acct?.website, category: acct?.category, tags: ["marketplace"] }).select("id").single();
      if (error) throw new Error("Could not apply.");
      brandId = b.id;
    }
    const { data: deal, error } = await db.from("creator_deals").insert({
      owner_id: p.owner_id, creator_id: p.id, brand_id: brandId, campaign: camp.title, value: data.quote ?? camp.budget ?? 0,
      platform: camp.platform, deadline: camp.deadline, requirements: camp.brief, source: "Marketplace", stage: "Proposal Sent", probability: 30,
      brand_email: acct?.email ?? null, brand_user_id: camp.brand_user_id, notes: data.pitch,
    }).select("id").single();
    if (error) throw new Error("Could not apply.");
    const { error: aerr } = await db.from("brand_campaign_applications").insert({ campaign_id: camp.id, owner_id: p.owner_id, creator_id: p.id, pitch: data.pitch, quote: data.quote, deal_id: deal.id });
    if (aerr) { await db.from("creator_deals").delete().eq("id", deal.id); throw new Error(aerr.message.includes("duplicate") ? "This creator already applied." : "Could not apply."); }
    await db.from("notifications").insert({ user_id: camp.brand_user_id, title: `New application: ${camp.title}`, body: `${p.display_name} applied`, link: "/brand/campaigns" });
    return { dealId: deal.id };
  });
