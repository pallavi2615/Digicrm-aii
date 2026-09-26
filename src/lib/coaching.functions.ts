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

export const coachingAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tenantId: z.string().uuid(),
    mode: z.enum(["counsellor", "draft_action", "parent_update", "campaign", "briefing"]),
    id: z.string().uuid().optional(),
    text: z.string().max(4000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const tid = data.tenantId;
    const { data: tenant } = await sb.from("tenants").select("name").eq("id", tid).maybeSingle();
    if (!tenant) throw new Error("Workspace not found or not yours.");
    const sys = `You work for "${tenant.name}", an Indian coaching institute. Warm, clear, short. Reply in Hinglish if the student wrote in Hinglish. Never invent fees, results, ranks, guarantees or courses that are not in the data. Use ₹.`;

    if (data.mode === "counsellor") {
      const { data: courses } = await sb.from("edu_courses").select("id,name,exam,fee,mode,duration_months,description").eq("tenant_id", tid).eq("active", true);
      const out = await callAI(sys + " You are the AI counsellor. Respond with json only.",
        `Conversation so far (student/parent messages):\n${data.text ?? ""}\n\nConfigured courses: ${JSON.stringify(courses ?? [])}\n\nReturn json: {"extracted":{"name":string|null,"phone":string|null,"city":string|null,"class_level":string|null,"exam":string|null,"target_year":number|null,"current_score":number|null,"mode":string|null,"budget":number|null},"missing":[list of still-missing details among class, marks, target exam, city, online/offline, budget, batch timing],"recommended_course_ids":[up to 3 ids from configured courses that fit],"reply":"the next message to the student: ask for missing details OR present the recommended programs and offer to book counselling"}`, true);
      try { return { result: JSON.parse(out) }; } catch { return { result: { reply: out, extracted: {}, missing: [], recommended_course_ids: [] } }; }
    }

    if (data.mode === "draft_action" || data.mode === "parent_update") {
      let student: any; let reason = "";
      if (data.mode === "draft_action") {
        const { data: a } = await sb.from("edu_actions").select("*").eq("id", data.id).eq("tenant_id", tid).maybeSingle();
        if (!a) throw new Error("Action not found.");
        reason = `${a.kind} for ${a.audience}: ${a.reason}`;
        if (a.student_id) ({ data: student } = await sb.from("edu_students").select("*").eq("id", a.student_id).maybeSingle());
        const text = await callAI(sys, `Write one WhatsApp message (max 60 words) addressed to the ${a.audience.toLowerCase()}. Purpose: ${reason}. Student: ${JSON.stringify(student ?? {})}. No placeholders.`);
        await sb.from("edu_actions").update({ message: text.trim() }).eq("id", a.id);
        return { text };
      }
      ({ data: student } = await sb.from("edu_students").select("*").eq("id", data.id).eq("tenant_id", tid).maybeSingle());
      if (!student) throw new Error("Student not found.");
      const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
      const [att, tests, fees] = await Promise.all([
        sb.from("edu_attendance").select("day,present").eq("student_id", student.id).gte("day", since),
        sb.from("edu_tests").select("test_name,subject,test_date,marks,max_marks,rank,remarks").eq("student_id", student.id).order("test_date", { ascending: false }).limit(5),
        sb.from("edu_fees").select("label,amount,paid_amount,due_date,status").eq("student_id", student.id),
      ]);
      const text = await callAI(sys, `Write a weekly WhatsApp update to ${student.parent_name ?? "the parent"} about ${student.name} (max 80 words): attendance %, latest test results, pending fee if any, one encouraging line and one suggestion. Only use this data: ${JSON.stringify({ attendance: att.data, tests: tests.data, fees: fees.data })}`);
      return { text };
    }

    if (data.mode === "campaign") {
      const { data: courses } = await sb.from("edu_courses").select("name,exam,fee,mode").eq("tenant_id", tid);
      const text = await callAI(sys + " You are the marketing agent.", `Campaign brief: ${data.text}\nCourses: ${JSON.stringify(courses ?? [])}\nWrite in markdown: 1) campaign headline and short ad copy, 2) three WhatsApp messages, 3) a 3-step follow-up sequence (day 1/3/5), 4) landing page headline + 3 bullets, 5) a 45-second telecalling script.`);
      return { text };
    }

    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [st, fe, de, te, at] = await Promise.all([
      sb.from("edu_students").select("stage,source,temperature,exam,created_at,admitted_at,last_contacted_at,fee_total,discount").eq("tenant_id", tid).limit(3000),
      sb.from("edu_fees").select("amount,paid_amount,due_date,status,paid_at").eq("tenant_id", tid).limit(5000),
      sb.from("edu_demos").select("status,scheduled_at").eq("tenant_id", tid).gte("scheduled_at", since),
      sb.from("edu_tests").select("student_id,marks,max_marks,test_date").eq("tenant_id", tid).gte("test_date", since.slice(0, 10)),
      sb.from("edu_attendance").select("student_id,present,day").eq("tenant_id", tid).gte("day", since.slice(0, 10)),
    ]);
    const text = await callAI(sys + " You are the management copilot. Only use numbers from the data.", `Today: ${new Date().toISOString().slice(0, 10)}. ${data.text ? "Question: " + data.text : "What happened today and this month?"}\nAnswer in short markdown with: key numbers (leads, admissions, collection, pending fees), "Attention" bullets (uncontacted hot leads, missed demos, overdue fees, at-risk students) and 3-5 suggested actions.\n${JSON.stringify({ students: st.data, fees: fe.data, demos: de.data, tests: te.data, attendance: at.data })}`);
    return { text };
  });

/** Applicant or staff verifies an admission document. Aadhaar/PAN go to DigiVerification; marksheet is staff-reviewed. */
export const verifyEduDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    studentId: z.string().uuid(), docType: z.enum(["aadhaar", "pan", "marksheet"]),
    value: z.string().min(2).max(60), staffApprove: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: st } = await sb.from("edu_students").select("id,tenant_id,applicant_user_id").eq("id", data.studentId).maybeSingle();
    if (!st) throw new Error("Application not found.");
    const isStaff = st.applicant_user_id !== context.userId;
    const v = data.value.replace(/\s/g, "").toUpperCase();
    const masked = data.docType === "marksheet" ? data.value.slice(0, 60) : v.length > 4 ? "•".repeat(v.length - 4) + v.slice(-4) : v;
    let status = "Failed", error: string | null = null, provider = "digiverification", result: any = {};
    if (data.docType === "marksheet") {
      provider = "staff";
      if (data.staffApprove && isStaff) { status = "Verified"; } else { status = "Submitted"; error = null; }
    } else {
      const ok = data.docType === "pan" ? /^[A-Z]{5}\d{4}[A-Z]$/.test(v) : /^\d{12}$/.test(v);
      if (!ok) { error = `That doesn't look like a valid ${data.docType.toUpperCase()} number`; provider = "format-check"; }
      else {
        const live = await import("./digiverify.server");
        if (!live.liveConfigured()) { status = "Manual review"; error = "Live verification isn't configured — staff will check manually."; provider = "manual"; }
        else {
          const r = data.docType === "pan" ? await live.livePan(v) : await live.liveAadhaar(v);
          result = r.data ?? {};
          if (r.unavailable) { status = "Manual review"; error = r.message ?? "Verification service is unreachable"; }
          else { status = r.ok ? "Verified" : "Failed"; error = r.ok ? null : (r.message ?? "Could not be verified"); }
        }
      }
    }
    if (data.staffApprove && isStaff && status === "Manual review") { status = "Verified"; error = null; provider = "staff"; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    let verification_id: string | null = null;
    if (data.docType !== "marksheet") {
      const { data: vrow } = await admin.from("verifications").insert({ kind: data.docType, identifier_masked: masked, status: status === "Verified" ? "verified" : status === "Failed" ? "failed" : "manual_review", provider, result, error, record_id: st.id, requested_by: context.userId }).select("id").maybeSingle();
      verification_id = vrow?.id ?? null;
    }
    const { error: e } = await admin.from("edu_documents").upsert({
      tenant_id: st.tenant_id, student_id: st.id, doc_type: data.docType, identifier_masked: masked, status, provider, result, error,
      verification_id, submitted_by: context.userId, verified_at: status === "Verified" ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,doc_type" });
    if (e) throw new Error(e.message);
    return { status, error };
  });

/** Coaching Sales Copilot: answer, recommend courses/batches, draft WhatsApp, optionally update the student record. */
export const coachingCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().uuid(), studentId: z.string().uuid().nullable(), question: z.string().min(2).max(3000), apply: z.boolean(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(20).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: tenant } = await sb.from("tenants").select("name").eq("id", data.tenantId).maybeSingle();
    if (!tenant) throw new Error("Workspace not found or not yours.");
    const [{ data: courses }, { data: batches }] = await Promise.all([
      sb.from("edu_courses").select("id,name,exam,fee,mode,duration_months").eq("tenant_id", data.tenantId).eq("active", true),
      sb.from("edu_batches").select("id,name,course_id,timing,capacity").eq("tenant_id", data.tenantId),
    ]);
    let student: any = null;
    if (data.studentId) ({ data: student } = await sb.from("edu_students").select("*").eq("id", data.studentId).eq("tenant_id", data.tenantId).maybeSingle());
    const leads = student ? null : (await sb.from("edu_students").select("name,stage,temperature,lead_score,exam,last_contacted_at,created_at").eq("tenant_id", data.tenantId).order("created_at", { ascending: false }).limit(200)).data;
    const out = await callAI(`You are the AI sales copilot for "${tenant.name}", an Indian coaching institute. Only recommend course ids from the list. Never invent fees. Use ₹. Respond with json only.`,
      `Conversation so far: ${JSON.stringify((data.history ?? []).slice(-10))}\nQuestion: ${data.question}\nStudent: ${JSON.stringify(student)}\nRecent leads: ${JSON.stringify(leads)}\nCourses: ${JSON.stringify(courses ?? [])}\nBatches: ${JSON.stringify(batches ?? [])}
Return json {"answer": markdown, "recommendations":[{"course_id":id,"why":string}] (max 3), "whatsapp": string|null (only if a student is selected), "updates": {"temperature":"Hot"|"Warm"|"Cold"|null,"stage":string|null,"exam":string|null,"class_level":string|null,"budget":number|null,"city":string|null,"notes_append":string|null,"follow_up":string|null}}`, true);
    let o: any = {}; try { o = JSON.parse(out); } catch { o = { answer: out }; }
    const recs = (Array.isArray(o.recommendations) ? o.recommendations : []).map((r: any) => ({ course: (courses ?? []).find((c: any) => c.id === r.course_id), why: String(r.why ?? "") })).filter((r: any) => r.course).slice(0, 3);
    const applied: string[] = [];
    if (data.apply && student && o.updates) {
      const u = o.updates; const patch: any = {};
      const STAGES = ["New Lead", "Contacted", "Qualified", "Counselling", "Demo / Trial Class", "Interested", "Application", "Fee Negotiation", "Admission", "Batch Allocation", "Active Student", "Lost"];
      if (["Hot", "Warm", "Cold"].includes(u.temperature)) { patch.temperature = u.temperature; applied.push(`Temperature: ${u.temperature}`); }
      if (STAGES.includes(u.stage) && u.stage !== student.stage) { patch.stage = u.stage; applied.push(`Stage: ${u.stage}`); }
      for (const k of ["exam", "class_level", "city"]) if (typeof u[k] === "string" && u[k]) { patch[k] = u[k]; applied.push(`${k.replace("_", " ")}: ${u[k]}`); }
      if (Number(u.budget) > 0) { patch.budget = Number(u.budget); applied.push(`Budget: ₹${Number(u.budget).toLocaleString("en-IN")}`); }
      if (u.notes_append) { patch.notes = [student.notes, u.notes_append].filter(Boolean).join("\n"); applied.push("Notes added"); }
      patch.last_contacted_at = new Date().toISOString();
      if (Object.keys(patch).length) await sb.from("edu_students").update(patch).eq("id", student.id);
      if (u.follow_up) { await sb.from("edu_actions").insert({ tenant_id: data.tenantId, student_id: student.id, kind: "Follow-up", audience: "Student", reason: String(u.follow_up).slice(0, 300), agent: "Sales Copilot", message: o.whatsapp ?? null }); applied.push("Follow-up created"); }
    }
    return { answer: String(o.answer ?? ""), recommendations: recs, whatsapp: student ? (o.whatsapp ?? null) : null, phone: student?.parent_phone || student?.phone || null, applied };
  });
