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
    body: JSON.stringify({ model: MODEL, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("The workspace has run out of AI credits.");
  if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "{}";
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** AI Sales Copilot: answers, recommends units, drafts WhatsApp, and writes CRM updates. */
export const reCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    clientId: z.string().uuid().nullable(),
    question: z.string().min(1).max(2000),
    apply: z.boolean(),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(20).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let lead: any = null, visits: any[] = [], fu: any[] = [], deals: any[] = [];
    if (data.clientId) {
      const r = await Promise.all([
        sb.from("re_clients").select("id,full_name,phone,source,temperature,ai_score,status,budget_min,budget_max,preferred_city,preferred_location,bhk,size_min,possession_pref,purpose,timeline_days,loan_required,requirement,last_contacted_at").eq("id", data.clientId).maybeSingle(),
        sb.from("re_site_visits").select("status,scheduled_at,interest,feedback,ai_summary").eq("client_id", data.clientId).limit(20),
        sb.from("re_followups").select("kind,due_at,done,notes").eq("client_id", data.clientId).limit(20),
        sb.from("re_deals").select("stage,expected_value,doc_status").eq("client_id", data.clientId).limit(10),
      ]);
      lead = r[0].data; visits = r[1].data ?? []; fu = r[2].data ?? []; deals = r[3].data ?? [];
      if (!lead) throw new Error("Lead not found or not yours.");
    }
    let invQ = sb.from("re_properties").select("id,title,project_id,tower,floor_no,unit_no,city,location,price,bhk,super_area,carpet_area,facing,possession_date,construction_status,inventory_status").in("inventory_status", ["Available", "Hold"]).limit(80);
    if (lead?.budget_max) invQ = invQ.lte("price", Number(lead.budget_max) * 1.15);
    const { data: inventory } = await invQ;

    const out = await callAI(
      "You are the AI Sales Copilot for an Indian real estate sales team. Use ₹ with lakh/crore. Use ONLY facts in the data; never invent units, prices, offers or legal claims. Reply as json only.",
      `Conversation so far: ${JSON.stringify((data.history ?? []).slice(-10))}\nSalesperson question: ${data.question}
Lead: ${JSON.stringify(lead)}
Visits: ${JSON.stringify(visits)}  Follow-ups: ${JSON.stringify(fu)}  Deals: ${JSON.stringify(deals)}
Available inventory: ${JSON.stringify(inventory ?? [])}
Today: ${new Date().toISOString().slice(0, 10)}
Return json: {"answer": "short helpful answer (markdown ok)", "recommendations": [{"property_id": id from inventory, "why": "one line"}] (max 3, [] if not relevant), "whatsapp": "a ready WhatsApp follow-up to the lead, max 70 words, Hinglish ok, no placeholders, or empty string if no lead", "crm_updates": {"temperature": "Hot"|"Warm"|"Cold"|null, "budget_min": number|null, "budget_max": number|null, "bhk": number|null, "preferred_location": string|null, "requirement_note": string|null, "next_followup": {"kind": "Call"|"WhatsApp"|"Site visit"|"Meeting"|"Price negotiation"|"Document collection", "due_in_days": number, "notes": string}|null}} — only fill crm_updates from what the question or data clearly states.`,
    );
    let j: any = {};
    try { j = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch { j = { answer: out }; }
    const ids = new Set((inventory ?? []).map((p: any) => p.id));
    const recommendations = (Array.isArray(j.recommendations) ? j.recommendations : []).filter((r: any) => ids.has(r.property_id)).slice(0, 3)
      .map((r: any) => ({ ...r, unit: (inventory ?? []).find((p: any) => p.id === r.property_id) }));

    const applied: string[] = [];
    const u = j.crm_updates ?? {};
    if (data.apply && lead) {
      const patch: any = { last_contacted_at: new Date().toISOString() };
      if (["Hot", "Warm", "Cold"].includes(u.temperature)) { patch.temperature = u.temperature; applied.push(`Temperature → ${u.temperature}`); }
      if (num(u.budget_min)) { patch.budget_min = u.budget_min; applied.push("Budget min"); }
      if (num(u.budget_max)) { patch.budget_max = u.budget_max; applied.push("Budget max"); }
      if (num(u.bhk)) { patch.bhk = u.bhk; applied.push(`${u.bhk} BHK`); }
      if (typeof u.preferred_location === "string" && u.preferred_location.trim()) { patch.preferred_location = u.preferred_location.slice(0, 120); applied.push(`Location → ${patch.preferred_location}`); }
      if (typeof u.requirement_note === "string" && u.requirement_note.trim()) { patch.requirement = [lead.requirement, `[AI ${new Date().toISOString().slice(0, 10)}] ${u.requirement_note}`].filter(Boolean).join("\n").slice(-4000); applied.push("Requirement note"); }
      const { error } = await sb.from("re_clients").update(patch).eq("id", lead.id);
      if (error) throw new Error(error.message);
      const nf = u.next_followup;
      if (nf && typeof nf.kind === "string") {
        const due = new Date(Date.now() + Math.max(0, Math.min(60, Number(nf.due_in_days) || 1)) * 864e5).toISOString();
        const { error: e2 } = await sb.from("re_followups").insert({ owner_id: context.userId, client_id: lead.id, kind: nf.kind, due_at: due, notes: String(nf.notes ?? "").slice(0, 500) });
        if (!e2) applied.push(`Follow-up: ${nf.kind} on ${due.slice(0, 10)}`);
      }
    }
    return { answer: String(j.answer ?? ""), recommendations, whatsapp: String(j.whatsapp ?? ""), crm_updates: u, applied, phone: lead?.phone ?? null };
  });

/** Verify a booking document through DigiVerification and write the result (server-only write). */
export const verifyBookingDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    dealId: z.string().uuid(),
    docType: z.enum(["pan", "aadhaar", "bank"]),
    value: z.string().min(4).max(40),
    ifsc: z.string().max(15).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Caller must be able to see the deal under RLS (buyer, owner, agent or manager).
    const { data: deal } = await (context.supabase as any).from("re_deals").select("id").eq("id", data.dealId).maybeSingle();
    if (!deal) throw new Error("Booking not found.");
    const v = data.value.replace(/\s/g, "").toUpperCase();
    const masked = v.length > 4 ? "•".repeat(v.length - 4) + v.slice(-4) : v;
    let status = "Failed", error: string | null = null, provider = "digiverification", result: any = {};

    const format = data.docType === "pan" ? /^[A-Z]{5}\d{4}[A-Z]$/.test(v) : data.docType === "aadhaar" ? /^\d{12}$/.test(v) : /^\d{9,18}$/.test(v) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test((data.ifsc ?? "").toUpperCase());
    if (!format) {
      error = data.docType === "bank" ? "Check the account number and IFSC" : `That doesn't look like a valid ${data.docType.toUpperCase()} number`;
      provider = "format-check";
    } else {
      const live = await import("./digiverify.server");
      if (!live.liveConfigured()) { status = "Manual review"; error = "Live verification isn't configured — staff will check manually."; provider = "manual"; }
      else {
        const r = data.docType === "pan" ? await live.livePan(v) : data.docType === "aadhaar" ? await live.liveAadhaar(v) : await live.liveBank(v, data.ifsc!.toUpperCase());
        result = r.data ?? {};
        if (r.unavailable) { status = "Manual review"; error = r.message ?? "Verification service is unreachable"; }
        else { status = r.ok ? "Verified" : "Failed"; error = r.ok ? null : (r.message ?? "Could not be verified"); }
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const kind = data.docType === "bank" ? "bank_account" : data.docType;
    const { data: vrow } = await admin.from("verifications").insert({ kind, identifier_masked: masked, status: status === "Verified" ? "verified" : status === "Failed" ? "failed" : "manual_review", provider, result, error, record_id: data.dealId, requested_by: context.userId }).select("id").maybeSingle();
    const { error: dbErr } = await admin.from("re_booking_docs").upsert({
      deal_id: data.dealId, doc_type: data.docType, identifier_masked: masked, status, provider, result, error,
      verification_id: vrow?.id ?? null, submitted_by: context.userId, verified_at: status === "Verified" ? new Date().toISOString() : null,
    }, { onConflict: "deal_id,doc_type" });
    if (dbErr) throw new Error(dbErr.message);
    return { status, error, masked };
  });
