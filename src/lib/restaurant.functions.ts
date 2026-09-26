import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra";

async function callAI(system: string, user: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not switched on for this workspace yet.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, reasoning_effort: "low", messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("The workspace has run out of AI credits.");
  if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

export const restAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tenantId: z.string().uuid(),
    mode: z.enum(["draft_action", "review_reply", "briefing"]),
    id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: tenant } = await sb.from("tenants").select("name").eq("id", data.tenantId).maybeSingle();
    if (!tenant) throw new Error("Workspace not found or not yours.");
    const sys = `You write for "${tenant.name}", an Indian restaurant. Warm, short, human. Hinglish is fine when natural. Never invent discounts, prices or facts that are not given. Use ₹.`;

    if (data.mode === "draft_action") {
      const { data: a } = await sb.from("rest_actions").select("*, rest_guests(name, tier, loyalty_points, visits, total_spend, last_visit_at, favourite_dishes, birthday, anniversary)").eq("id", data.id).eq("tenant_id", data.tenantId).maybeSingle();
      if (!a) throw new Error("Action not found.");
      const text = await callAI(sys, `Write one WhatsApp message (max 55 words) for this follow-up. Action: ${a.kind}. Why: ${a.reason}. Guest: ${JSON.stringify(a.rest_guests)}. Mention their loyalty points if relevant. No placeholders.`);
      await sb.from("rest_actions").update({ message: text.trim(), source: "AI" }).eq("id", a.id);
      return { text };
    }
    if (data.mode === "review_reply") {
      const { data: r } = await sb.from("rest_reviews").select("*").eq("id", data.id).eq("tenant_id", data.tenantId).maybeSingle();
      if (!r) throw new Error("Review not found.");
      const text = await callAI(sys, `Write a public reply (max 60 words) to this ${r.rating}-star ${r.platform} review by ${r.reviewer ?? "a guest"}: "${r.comment ?? ""}". Thank them; if 3 stars or less, apologise specifically and invite them to contact the manager. No offers unless the review asks.`);
      return { text };
    }
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [o, r, v, rv, g] = await Promise.all([
      sb.from("rest_outlets").select("id,name,seats,monthly_target").eq("tenant_id", data.tenantId),
      sb.from("rest_orders").select("outlet_id,channel,amount,covers,ordered_at,status").eq("tenant_id", data.tenantId).gte("ordered_at", since).limit(3000),
      sb.from("rest_reservations").select("outlet_id,status,party_size,reserved_for").eq("tenant_id", data.tenantId).gte("reserved_for", since).limit(2000),
      sb.from("rest_reviews").select("outlet_id,rating,comment,reply,created_at").eq("tenant_id", data.tenantId).gte("created_at", since).limit(500),
      sb.from("rest_guests").select("tier,visits,last_visit_at,loyalty_points").eq("tenant_id", data.tenantId).limit(2000),
    ]);
    const text = await callAI(sys + " You are the restaurant's operations analyst. Only use numbers in the data.", `Today: ${new Date().toISOString().slice(0, 10)}. Give a short markdown briefing: outlet performance vs target, channel mix, reservations & no-shows, review sentiment, loyalty health, and the 5 most valuable follow-up actions for today.\n${JSON.stringify({ outlets: o.data, orders: r.data, reservations: v.data, reviews: rv.data, guests: g.data })}`);
    return { text };
  });
