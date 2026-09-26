import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORKSPACE_TEMPLATES, getTemplate } from "./workspace-templates";

async function callAI(system: string, user: string, json = false): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not switched on for this workspace yet.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", reasoning_effort: "low",
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

/** "I'm a 3-location dental clinic" → template + sub-type + location mode. */
export const recommendTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ description: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const catalogue = WORKSPACE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, subtypes: t.subtypes }));
    const text = await callAI(
      "You configure a CRM for a business. Pick the best template from the catalogue. Return json {\"template\": slug, \"subtype\": one of that template's subtypes, \"location_mode\": \"single\"|\"multi\"|\"franchise\", \"locations\": number, \"business_name\": string|null, \"reason\": short sentence}.",
      `Catalogue: ${JSON.stringify(catalogue)}\nBusiness: ${data.description}`,
      true,
    );
    let out: any = {};
    try { out = JSON.parse(text); } catch { /* fall through */ }
    const t = getTemplate(out.template) ?? WORKSPACE_TEMPLATES[0]!;
    return {
      template: t.slug,
      subtype: t.subtypes.includes(out.subtype) ? out.subtype : t.subtypes[0]!,
      location_mode: ["single", "multi", "franchise"].includes(out.location_mode) ? out.location_mode : "single",
      locations: Math.max(1, Math.min(200, Number(out.locations) || 1)),
      business_name: typeof out.business_name === "string" ? out.business_name : null,
      reason: String(out.reason ?? ""),
    };
  });

/** Run a template AI agent on one record, or answer a copilot question over the workspace. */
export const workspaceAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tenantId: z.string().uuid(),
    mode: z.enum(["agent", "copilot", "message"]),
    agentInstruction: z.string().max(3000).optional(),
    recordId: z.string().uuid().optional(),
    text: z.string().max(3000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: ws } = await sb.from("tenant_workspaces").select("template_slug, subtype, template_config").eq("tenant_id", data.tenantId).maybeSingle();
    const { data: tenant } = await sb.from("tenants").select("name").eq("id", data.tenantId).maybeSingle();
    if (!ws) throw new Error("This workspace has no template yet.");
    const t = ((ws as any).template_config as ReturnType<typeof getTemplate>) ?? getTemplate(ws.template_slug);
    const sys = `You are the AI team inside DigiCRM for "${tenant?.name ?? "the business"}", a ${ws.subtype ?? ""} using the ${t?.name ?? "CRM"}. ` +
      `Records are called ${t?.recordLabelPlural ?? "records"}; stages: ${(t?.stages ?? []).join(" → ")}. Use ₹ and Indian formatting. Only use facts from the data; never invent numbers. Be concise.`;

    if (data.mode === "copilot") {
      const { data: recs } = await sb.from("pack_records").select("title,contact_name,stage,value,source,fields,updated_at,created_at")
        .eq("tenant_id", data.tenantId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(400);
      const text = await callAI(sys + " Answer in markdown with a short list of recommended actions.", `Today: ${new Date().toISOString().slice(0, 10)}\nRecords: ${JSON.stringify(recs ?? [])}\nQuestion: ${data.text ?? "Give me today's briefing."}`);
      return { text };
    }
    if (data.mode === "message") {
      const text = await callAI(sys + " A customer sent this message. Extract details and write the reply.", `Message: ${data.text ?? ""}`);
      return { text };
    }
    const { data: rec } = await sb.from("pack_records").select("title,contact_name,contact_phone,stage,value,source,fields,notes,updated_at").eq("id", data.recordId ?? "").maybeSingle();
    if (!rec) throw new Error("Record not found.");
    const text = await callAI(sys + " " + (data.agentInstruction ?? ""), `Record: ${JSON.stringify(rec)}\nToday: ${new Date().toISOString().slice(0, 10)}`);
    return { text };
  });

/** Education AI Setup: answers → tailored template choice, programs, branches, batches, extra form fields. */
export const educationSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    businessType: z.enum(["coaching", "education", "study_abroad", "school", "edtech", "skill_training"]),
    name: z.string().max(120), city: z.string().max(120), branches: z.number().int().min(1).max(50),
    programs: z.string().max(1000), mode: z.string().max(40), feeRange: z.string().max(120), notes: z.string().max(1500),
  }).parse(d))
  .handler(async ({ data }) => {
    const t = getTemplate(data.businessType)!;
    const text = await callAI(
      "You configure an education CRM for an Indian institute. Respond with json only. Use realistic Indian fees in ₹ only when the user gave a fee range; otherwise use 0.",
      `Business type: ${t.name}. Allowed subtypes: ${JSON.stringify(t.subtypes)}. Existing form fields: ${JSON.stringify(t.fields.map((x) => x.key))}.
Answers: ${JSON.stringify(data)}
Return json {"subtype": one allowed subtype, "courses":[{"name":string,"exam":string|null,"fee":number,"mode":"Online"|"Offline"|"Hybrid","duration_months":number}] (max 6, from the programs the user named),
"branches":[{"name":string,"city":string}] (exactly ${data.branches}), "batches":[{"name":string,"course":course name,"timing":string}] (max 6),
"extra_fields":[{"key":snake_case,"label":string,"type":"text"|"number"|"date"|"select","options":string[]|null}] (max 5, only fields not already present that fit this business),
"summary": one sentence}`, true);
    let o: any = {}; try { o = JSON.parse(text); } catch { /* defaults below */ }
    const arr = (x: any) => (Array.isArray(x) ? x : []);
    const have = new Set(t.fields.map((x) => x.key));
    return {
      subtype: t.subtypes.includes(o.subtype) ? o.subtype : t.subtypes[0]!,
      courses: arr(o.courses).slice(0, 6).map((c: any) => ({ name: String(c.name ?? "Program"), exam: c.exam ? String(c.exam) : null, fee: Math.max(0, Number(c.fee) || 0), mode: ["Online", "Offline", "Hybrid"].includes(c.mode) ? c.mode : "Offline", duration_months: Math.max(1, Math.min(60, Number(c.duration_months) || 12)) })),
      branches: arr(o.branches).slice(0, 50).map((b: any) => ({ name: String(b.name ?? "Main branch"), city: String(b.city ?? data.city) })),
      batches: arr(o.batches).slice(0, 6).map((b: any) => ({ name: String(b.name ?? "Batch"), course: String(b.course ?? ""), timing: String(b.timing ?? "") })),
      extraFields: arr(o.extra_fields).filter((f: any) => f?.key && !have.has(f.key)).slice(0, 5).map((f: any) => ({
        key: String(f.key).toLowerCase().replace(/[^a-z0-9_]/g, "_"), label: String(f.label ?? f.key),
        type: ["text", "number", "date", "select"].includes(f.type) ? f.type : "text",
        ...(f.type === "select" && Array.isArray(f.options) ? { options: f.options.map(String).slice(0, 12) } : {}),
      })),
      summary: String(o.summary ?? ""),
    };
  });
