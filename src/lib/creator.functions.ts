import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra";

async function callAI(system: string, user: string, json = false): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not switched on for this workspace yet.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "low",
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("The workspace has run out of AI credits.");
  if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

const CREATOR_SYSTEM =
  "You are the AI Brand Deal Manager inside DigiCRM for creators and influencer agencies. You write concise, warm, professional copy. Prices are in INR unless told otherwise. Never invent facts about a brand; use only what is given. Every external message is a draft the creator approves before sending.";

// ---------- Authenticated AI tools ----------

const aiInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("pitch"), channel: z.string().max(40), brand: z.string().max(2000), campaign: z.string().max(2000), creator: z.string().max(3000) }),
  z.object({ mode: z.literal("followup"), kind: z.string().max(60), deal: z.string().max(4000) }),
  z.object({ mode: z.literal("parse"), text: z.string().min(10).max(12000) }),
  z.object({ mode: z.literal("contract"), text: z.string().min(20).max(40000) }),
  z.object({ mode: z.literal("pricing"), inputs: z.record(z.string(), z.union([z.string(), z.number()])) }),
  z.object({ mode: z.literal("prospects"), creator: z.string().max(3000), goal: z.string().max(1000) }),
  z.object({ mode: z.literal("ask"), question: z.string().min(2).max(2000) }),
]);

export type CreatorAiInput = z.infer<typeof aiInput>;

export const creatorAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => aiInput.parse(d))
  .handler(async ({ data, context }) => {
    const log = async (chars: number, out: string) => {
      try {
        await context.supabase.from("ai_usage_log").insert({
          user_id: context.userId, group_slug: "creator-economy", pack_slug: "creator-brand-deals",
          model: MODEL, prompt_chars: chars, response_chars: out.length,
        });
      } catch { /* best effort */ }
    };

    if (data.mode === "pitch") {
      const out = await callAI(CREATOR_SYSTEM,
        `Write a personalised ${data.channel} pitch from the creator to the brand.\nBrand: ${data.brand}\nCampaign idea: ${data.campaign}\nCreator profile: ${data.creator}\nKeep it right-sized for the channel (DMs under 90 words, emails under 180 words with a subject line). End with one clear call to action.`);
      await log(data.brand.length + data.creator.length, out);
      return { text: out };
    }
    if (data.mode === "followup") {
      const out = await callAI(CREATOR_SYSTEM,
        `Draft a "${data.kind}" message for this sponsorship deal. Under 120 words, polite and specific.\nDeal: ${data.deal}`);
      await log(data.deal.length, out);
      return { text: out };
    }
    if (data.mode === "parse") {
      const out = await callAI(CREATOR_SYSTEM + " Reply only with json.",
        `Extract the brand enquiry below into json with keys: brand, contact_name, contact_email, contact_role, campaign, budget (number or null, INR), platform, deliverables (array of {content_type, platform, quantity}), deadline (YYYY-MM-DD or null), usage_rights, location, requirements. Use null when unknown.\n\n${data.text}`, true);
      await log(data.text.length, out);
      return { text: JSON.stringify(parseJson<Record<string, unknown>>(out, {})) };
    }
    if (data.mode === "contract") {
      const out = await callAI(CREATOR_SYSTEM + " Reply only with json.",
        `Analyse this influencer contract and return json with keys: payment_terms, deliverables (array of strings), deadlines (array of strings), usage_rights, exclusivity, revision_limits, cancellation, late_payment, missing (array of important things the contract does not cover), risks (array of strings), tasks (array of short action items for the creator).\n\n${data.text}`, true);
      await log(data.text.length, out);
      return { text: JSON.stringify(parseJson<Record<string, unknown>>(out, {})) };
    }
    if (data.mode === "pricing") {
      const out = await callAI(CREATOR_SYSTEM + " Reply only with json.",
        `Suggest a fair quote range in INR for this creator deal. Return json {low:number, high:number, recommended:number, rationale:string (max 80 words), addons:array of {name, price}}.\nInputs: ${JSON.stringify(data.inputs)}`, true);
      await log(200, out);
      return { text: JSON.stringify(parseJson<Record<string, unknown>>(out, {})) };
    }

    if (data.mode === "prospects") {
      const out = await callAI(CREATOR_SYSTEM + " Reply only with json.",
        `Suggest 8 real, well-known brands (India first, then global) that would be a strong sponsorship fit for this creator. Only suggest brands you are confident exist; do not invent contact details. Return json {brands: array of {name, category, website (official homepage or null), why (max 30 words), pitch_angle (max 25 words), est_budget_inr (number or null)}}.\nCreator: ${data.creator}\nGoal: ${data.goal}`, true);
      await log(data.creator.length + data.goal.length, out);
      return { text: JSON.stringify(parseJson<Record<string, unknown>>(out, { brands: [] })) };
    }
    // ask / command centre — grounded on the caller's own records (RLS applies)
    const [deals, invoices, deliverables, brands] = await Promise.all([
      context.supabase.from("creator_deals").select("campaign,stage,value,probability,next_action,next_action_at,deadline,end_date,updated_at,creator_brands(name)").limit(200),
      context.supabase.from("creator_invoices").select("number,amount,status,due_date,paid_amount,paid_at").limit(200),
      context.supabase.from("creator_deliverables").select("content_type,platform,due_date,status").limit(300),
      context.supabase.from("creator_brands").select("name,category").limit(200),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const ctx = JSON.stringify({ today, deals: deals.data, invoices: invoices.data, deliverables: deliverables.data, brands: brands.data });
    const out = await callAI(CREATOR_SYSTEM + " Answer only from the records provided. Use short bullet points and ₹ amounts in lakh where helpful.",
      `My CRM records: ${ctx.slice(0, 60000)}\n\nQuestion: ${data.question}`);
    await log(data.question.length, out);
    return { text: out };
  });

// ---------- Public: media kit + Hire Me ----------

export const getMediaKit = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("creator_profiles")
      .select("id,handle,display_name,bio,avatar_url,niche,location,platforms,audience,categories,past_brands,testimonials")
      .eq("handle", data.handle.toLowerCase())
      .eq("is_public", true)
      .maybeSingle();
    if (!p) return { profile: null, rates: [] };
    const { data: rates } = await supabaseAdmin
      .from("creator_rate_cards").select("item,platform,kind,price").eq("creator_id", p.id).order("price");
    return { profile: p, rates: rates ?? [] };
  });

const briefSchema = z.object({
  handle: z.string().min(1).max(60),
  brand: z.string().trim().min(1).max(120),
  contact_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  campaign: z.string().trim().min(1).max(200),
  budget: z.number().min(0).max(1e10).nullable(),
  platform: z.string().max(60).optional().default(""),
  brief: z.string().trim().max(4000).optional().default(""),
  website: z.string().max(0).optional().default(""), // honeypot
});

export const submitBrief = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => briefSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("creator_profiles").select("id,owner_id").eq("handle", data.handle.toLowerCase()).eq("is_public", true).maybeSingle();
    if (!p) throw new Error("This media kit is not available.");
    let brandId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("creator_brands").select("id").eq("owner_id", p.owner_id).ilike("name", data.brand).maybeSingle();
    if (existing) brandId = existing.id;
    else {
      const { data: b, error } = await supabaseAdmin.from("creator_brands")
        .insert({ owner_id: p.owner_id, name: data.brand, tags: ["media-kit"] }).select("id").single();
      if (error) throw new Error("Could not send your brief.");
      brandId = b.id;
    }
    await supabaseAdmin.from("creator_brand_contacts").insert({
      owner_id: p.owner_id, brand_id: brandId, name: data.contact_name, email: data.email, phone: data.phone || null,
    });
    const { data: deal, error } = await supabaseAdmin.from("creator_deals").insert({
      owner_id: p.owner_id, creator_id: p.id, brand_id: brandId, campaign: data.campaign,
      value: data.budget ?? 0, platform: data.platform || null, source: "Media Kit",
      requirements: data.brief || null, stage: "New Lead", next_action: "Reply to brief",
      next_action_at: new Date().toISOString().slice(0, 10),
    }).select("id").single();
    if (error) throw new Error("Could not send your brief.");
    await supabaseAdmin.from("creator_activities").insert({
      owner_id: p.owner_id, deal_id: deal.id, brand_id: brandId, kind: "enquiry",
      body: `Brief received from ${data.contact_name} (${data.email}) via media kit.`,
    });
    return { ok: true };
  });

// ---------- Public: brand approval portal ----------

export const getApproval = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deal } = await supabaseAdmin
      .from("creator_deals")
      .select("id,campaign,objective,start_date,end_date,creator_brands(name),creator_profiles(display_name,handle)")
      .eq("approval_token", data.token).maybeSingle();
    if (!deal) return { deal: null, deliverables: [] };
    const { data: dels } = await supabaseAdmin
      .from("creator_deliverables")
      .select("id,content_type,platform,quantity,due_date,status,caption,script,draft_url,revision_count,brand_comment,posted_at")
      .eq("deal_id", deal.id).order("due_date", { nullsFirst: false });
    const { id: _id, ...safe } = deal;
    return { deal: safe, deliverables: dels ?? [] };
  });

export const actOnApproval = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().uuid(),
      deliverableId: z.string().uuid(),
      action: z.enum(["approve", "revise"]),
      comment: z.string().trim().max(2000).optional().default(""),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deal } = await supabaseAdmin
      .from("creator_deals").select("id,owner_id").eq("approval_token", data.token).maybeSingle();
    if (!deal) throw new Error("This approval link is no longer valid.");
    const { data: del } = await supabaseAdmin
      .from("creator_deliverables").select("id,revision_count,content_type").eq("id", data.deliverableId).eq("deal_id", deal.id).maybeSingle();
    if (!del) throw new Error("Deliverable not found.");
    const patch = data.action === "approve"
      ? { status: "Approved", brand_comment: data.comment || null }
      : { status: "Revision Required", brand_comment: data.comment || "Revision requested", revision_count: del.revision_count + 1 };
    await supabaseAdmin.from("creator_deliverables").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", del.id);
    await supabaseAdmin.from("creator_activities").insert({
      owner_id: deal.owner_id, deal_id: deal.id, kind: "approval",
      body: `Brand ${data.action === "approve" ? "approved" : "requested a revision on"} ${del.content_type}${data.comment ? `: "${data.comment}"` : ""}`,
    });
    return { ok: true };
  });
