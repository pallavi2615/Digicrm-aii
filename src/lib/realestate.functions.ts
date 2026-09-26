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

const SYS = "You are DigiCRM Real Estate AI for an Indian real estate developer/broker. Use ₹ with lakh/crore. Only use facts present in the data; never invent numbers, units or projects. Be concise and practical. Forecasts are estimates, never guarantees.";

async function snapshot(supabase: any) {
  const [c, d, v, f, p, n, pay] = await Promise.all([
    supabase.from("re_clients").select("id,full_name,source,temperature,ai_score,status,lost_reason,budget_min,budget_max,preferred_city,preferred_location,bhk,timeline_days,assigned_team,last_contacted_at,created_at").limit(500),
    supabase.from("re_deals").select("id,stage,expected_value,final_value,client_id,property_id,next_action_at,updated_at").limit(500),
    supabase.from("re_site_visits").select("client_id,status,scheduled_at,interest,agent_name").limit(500),
    supabase.from("re_followups").select("client_id,kind,due_at,done").eq("done", false).limit(500),
    supabase.from("re_properties").select("id,title,project_id,city,location,price,bhk,super_area,facing,inventory_status,construction_status").limit(500),
    supabase.from("re_negotiations").select("deal_id,discount_pct,status").limit(300),
    supabase.from("re_payment_schedule").select("deal_id,milestone,amount,due_date,paid_amount").limit(500),
  ]);
  return { today: new Date().toISOString().slice(0, 10), leads: c.data ?? [], deals: d.data ?? [], visits: v.data ?? [], open_followups: f.data ?? [], inventory: p.data ?? [], negotiations: n.data ?? [], payments: pay.data ?? [] };
}

export const reAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    mode: z.enum(["score_lead", "extract", "recommend", "visit_summary", "copilot", "whatsapp", "call_summary", "forecast"]),
    clientId: z.string().uuid().optional(),
    text: z.string().max(6000).optional(),
    question: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.mode === "score_lead" || data.mode === "whatsapp") {
      if (!data.clientId) throw new Error("Pick a lead first.");
      const [{ data: lead }, { data: visits }, { data: fu }, { data: deals }] = await Promise.all([
        sb.from("re_clients").select("*").eq("id", data.clientId).maybeSingle(),
        sb.from("re_site_visits").select("status,scheduled_at,interest,ai_summary").eq("client_id", data.clientId),
        sb.from("re_followups").select("kind,due_at,done,notes").eq("client_id", data.clientId),
        sb.from("re_deals").select("stage,expected_value").eq("client_id", data.clientId),
      ]);
      if (!lead) throw new Error("Lead not found or not yours.");
      const ctx = JSON.stringify({ lead: { ...lead, kyc_documents: undefined }, visits, followups: fu, deals, today: new Date().toISOString() });
      if (data.mode === "whatsapp") {
        return { text: await callAI(SYS, `Draft a short, warm WhatsApp follow-up (Hinglish ok if the lead seems Hindi-speaking) for this lead. Max 70 words. No placeholders.\n${ctx}`) };
      }
      const out = await callAI(SYS + " Reply as JSON only.", `Score this real estate lead 0-100 for purchase intent. Consider budget fit, timeline, engagement, site visits, responsiveness. Return {"score": number, "temperature": "Hot"|"Warm"|"Cold", "reason": "one or two lines", "next_action": "short"}.\n${ctx}`, true);
      let j: any = {};
      try { j = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch { /* keep empty */ }
      const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
      const temperature = ["Hot", "Warm", "Cold"].includes(j.temperature) ? j.temperature : score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";
      const reason = [j.reason, j.next_action ? `Next: ${j.next_action}` : ""].filter(Boolean).join(" · ").slice(0, 500);
      const { error } = await sb.from("re_clients").update({ ai_score: score, temperature, ai_score_reason: reason }).eq("id", data.clientId);
      if (error) throw new Error(error.message);
      return { text: reason, score, temperature };
    }
    if (data.mode === "extract") {
      const out = await callAI(SYS + " Reply as JSON only.", `Extract the property requirement from this customer message or call note. Return {"intent":"Buy|Rent|Sell"|null,"segment":"Residential|Commercial"|null,"city":string|null,"location":string|null,"bhk":number|null,"budget_min":number|null,"budget_max":number|null,"size_min":number|null,"possession":string|null,"purpose":"Self-use|Investment"|null,"timeline_days":number|null,"loan_required":boolean|null,"objections":string[],"notes":string}. Budgets in rupees.\nMessage: ${data.text ?? ""}`, true);
      return { text: out };
    }
    if (data.mode === "recommend") {
      return { text: await callAI(SYS, `The customer said: "${data.text ?? ""}". From ONLY these matched units, recommend the best 3 and explain in 1-2 lines each why they fit (budget, location, size, facing, possession). Units:\n${data.question ?? "[]"}`) };
    }
    if (data.mode === "visit_summary" || data.mode === "call_summary") {
      return { text: await callAI(SYS, `Summarise this ${data.mode === "visit_summary" ? "site visit feedback" : "sales call note/transcript"} in 2-3 sentences: what the customer liked, objections, budget/requirement, interest level and the recommended next action with timing.\n${data.text ?? ""}`) };
    }
    const snap = await snapshot(sb);
    if (data.mode === "forecast") {
      return { text: await callAI(SYS, `Using the pipeline below, give a short sales forecast for the next 30/60/90 days: current pipeline value, stage-weighted pipeline, expected closings, and the 3 biggest risks. State clearly it is an estimate.\n${JSON.stringify(snap)}`) };
    }
    return { text: await callAI(SYS, `Question: ${data.question ?? ""}\nLive CRM data (JSON):\n${JSON.stringify(snap)}`) };
  });
