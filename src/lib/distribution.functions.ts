import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra";

async function callAI(system: string, user: string, json = false): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not switched on for this workspace yet.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL, reasoning_effort: "low",
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("The workspace has run out of AI credits.");
  if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

/** Compact snapshot of the caller's distribution network (RLS-scoped). */
async function snapshot(supabase: any) {
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const [p, pr, o, c, t] = await Promise.all([
    supabase.from("dist_partners").select("id,name,level,city,state,territory,credit_limit,payment_terms_days,sales_rep,loyalty_points").limit(500),
    supabase.from("dist_products").select("id,sku,name,price,stock,reorder_level,daily_run_rate,expiry_date").limit(300),
    supabase.from("dist_orders").select("partner_id,total,status,order_date,sales_rep").gte("order_date", since).limit(3000),
    supabase.from("dist_collections").select("partner_id,amount,collected_on").limit(3000),
    supabase.from("dist_targets").select("scope,scope_name,target,period_start,period_end,partner_id").limit(200),
  ]);
  const orders = (o.data ?? []).filter((x: any) => x.status !== "Cancelled");
  const partners = (p.data ?? []).map((x: any) => {
    const mine = orders.filter((y: any) => y.partner_id === x.id);
    const billed = mine.filter((y: any) => ["Dispatched", "Delivered"].includes(y.status)).reduce((a: number, y: any) => a + Number(y.total), 0);
    const paid = (c.data ?? []).filter((y: any) => y.partner_id === x.id).reduce((a: number, y: any) => a + Number(y.amount), 0);
    const last = mine.map((y: any) => y.order_date).sort().pop() ?? null;
    return { name: x.name, level: x.level, territory: x.territory ?? x.city, state: x.state, rep: x.sales_rep, outstanding: Math.round(billed - paid), credit_limit: x.credit_limit, last_order: last, orders_60d: mine.length, sales_60d: Math.round(mine.reduce((a: number, y: any) => a + Number(y.total), 0)) };
  });
  const products = (pr.data ?? []).map((x: any) => ({ sku: x.sku, name: x.name, stock: x.stock, reorder: x.reorder_level, days_cover: x.daily_run_rate > 0 ? Math.round(x.stock / x.daily_run_rate) : null, expiry: x.expiry_date }));
  return { today: new Date().toISOString().slice(0, 10), partners, products, targets: t.data ?? [], orders_60d: orders.length, sales_60d: Math.round(orders.reduce((a: number, y: any) => a + Number(y.total), 0)) };
}

const SYS = "You are DigiDistribution AI, an operations analyst for an Indian manufacturer's distribution network (super distributor → distributor → dealer → retailer). Use ₹ with Indian number formatting (lakh/crore). Only use numbers present in the data; never invent figures. Be concise and actionable.";

export const distAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    mode: z.enum(["briefing", "copilot", "parse_order", "visit_summary", "sales_agent"]),
    question: z.string().max(2000).optional(),
    message: z.string().max(3000).optional(),
    notes: z.string().max(4000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.mode === "parse_order") {
      const [p, pr] = await Promise.all([
        sb.from("dist_partners").select("id,name,owner_name,phone,city").limit(800),
        sb.from("dist_products").select("id,sku,name,unit,price").limit(400),
      ]);
      const text = await callAI(
        SYS + " You read WhatsApp order messages (Hindi/Hinglish/English) and map them to the catalogue. Return JSON {\"partner_id\": string|null, \"items\": [{\"product_id\": string, \"qty\": number, \"matched_text\": string}], \"unmatched\": string[], \"reply\": string}. reply is a short Hinglish confirmation to send back.",
        `Retailers: ${JSON.stringify(p.data ?? [])}\nProducts: ${JSON.stringify(pr.data ?? [])}\nMessage: ${data.message ?? ""}`,
        true,
      );
      return { text };
    }
    if (data.mode === "visit_summary") {
      const text = await callAI(SYS, `Summarise this field sales visit in 3 bullet points (discussion, commitments, next action):\n${data.notes ?? ""}`);
      return { text };
    }
    const snap = await snapshot(sb);
    if (data.mode === "briefing") {
      const text = await callAI(SYS, `Write today's "Distribution Intelligence" morning briefing in markdown with sections: Headline numbers, ⚠️ Attention (overdue/credit risk, dormant partners >30 days, stock-out risk under 7 days cover, near-expiry), Targets, AI Recommendations (numbered). Data:\n${JSON.stringify(snap)}`);
      return { text };
    }
    if (data.mode === "sales_agent") {
      const text = await callAI(SYS + " Return JSON {\"contacts\": [{\"name\": string, \"last_order\": string|null, \"potential\": \"High\"|\"Medium\"|\"Low\", \"action\": \"WhatsApp\"|\"Call\"|\"Offer\"|\"Sales visit\"|\"Collection\", \"reason\": string, \"message\": string}]}. Pick up to 15 partners to contact today (dormant, falling orders, overdue). message is a short WhatsApp draft.", JSON.stringify(snap), true);
      return { text };
    }
    const text = await callAI(SYS, `Question: ${data.question ?? ""}\n\nData:\n${JSON.stringify(snap)}`);
    return { text };
  });
