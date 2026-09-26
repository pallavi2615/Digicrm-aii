import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Sparkles, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyEduDoc, coachingCopilot } from "@/lib/coaching.functions";
import { Md } from "@/components/dist-ai";
import { waLink } from "@/lib/re-data";

const sb = supabase as any;
export const EDU_DOCS = [
  { key: "aadhaar", label: "Aadhaar", ph: "12-digit number" },
  { key: "pan", label: "PAN (student or parent)", ph: "ABCDE1234F" },
  { key: "marksheet", label: "Last marksheet", ph: "Board, roll no., % (e.g. CBSE 12 · 1234567 · 91%)" },
] as const;
const tone = (s?: string) => (s === "Verified" ? "default" : s === "Failed" || s === "Action needed" ? "destructive" : "secondary") as any;

/** Admission documents. Staff see invite + approve; applicants submit their own. */
export function EduDocs({ student, staff, onChange }: { student: any; staff?: boolean; onChange?: () => void }) {
  const qc = useQueryClient(); const verify = useServerFn(verifyEduDoc);
  const { data: docs = [] } = useQuery({ queryKey: ["edu-docs", student.id], queryFn: async () => (await sb.from("edu_documents").select("*").eq("student_id", student.id)).data ?? [] });
  const [val, setVal] = useState<Record<string, string>>({}); const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState(student.applicant_email ?? "");
  const go = async (key: any, staffApprove = false) => {
    setBusy(key);
    try {
      const existing = docs.find((d: any) => d.doc_type === key);
      const r: any = await verify({ data: { studentId: student.id, docType: key, value: val[key] || existing?.identifier_masked || "staff-approved", staffApprove } });
      r.status === "Verified" ? toast.success("Verified") : r.status === "Failed" ? toast.error(r.error) : toast.message(r.error ?? "Submitted for review");
      qc.invalidateQueries({ queryKey: ["edu-docs", student.id] }); qc.invalidateQueries({ queryKey: ["edu"] }); qc.invalidateQueries({ queryKey: ["edu-me"] }); onChange?.();
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Admission documents <Badge variant={tone(student.doc_status)}>{student.doc_status ?? "Pending"}</Badge></CardTitle>
      <CardDescription>Aadhaar and PAN are checked live with DigiVerification. When all three are verified, the student moves to Admission automatically.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {staff && <div className="flex flex-wrap items-center gap-2"><Input className="max-w-xs" placeholder="Applicant email (for the student portal)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button size="sm" variant="outline" onClick={async () => { const { error } = await sb.from("edu_students").update({ applicant_email: email.trim().toLowerCase() || null }).eq("id", student.id); if (error) toast.error(error.message); else { toast.success("Applicant can now log in at /student-portal with this email"); onChange?.(); } }}>Invite applicant</Button>
          {student.applicant_user_id && <Badge variant="secondary">Applicant linked</Badge>}</div>}
        {EDU_DOCS.map((d) => { const row = docs.find((x: any) => x.doc_type === d.key); return (
          <div key={d.key} className="flex flex-wrap items-center gap-2 rounded border p-2">
            <span className="w-44 text-sm font-medium">{d.label}</span>
            {row && <Badge variant={tone(row.status)}>{row.status}</Badge>}
            {row?.identifier_masked && <span className="text-xs text-muted-foreground">{row.identifier_masked}</span>}
            {row?.status !== "Verified" && <>
              <Input className="h-8 min-w-40 flex-1" placeholder={d.ph} value={val[d.key] ?? ""} onChange={(e) => setVal({ ...val, [d.key]: e.target.value })} />
              <Button size="sm" className="h-8" disabled={busy === d.key || !(val[d.key] ?? "").trim()} onClick={() => go(d.key)}>{busy === d.key ? <Loader2 className="h-3 w-3 animate-spin" /> : d.key === "marksheet" ? "Submit" : "Verify"}</Button>
              {staff && row && ["Submitted", "Manual review"].includes(row.status) && <Button size="sm" variant="outline" className="h-8" disabled={busy === d.key} onClick={() => go(d.key, true)}>Approve</Button>}</>}
            {row?.error && row.status !== "Verified" && <span className="basis-full text-xs text-destructive">{row.error}</span>}
          </div>); })}
      </CardContent></Card>
  );
}

/** Coaching / education sales copilot. */
export function EduCopilot({ tid, students, onApplied }: { tid: string; students: any[]; onApplied?: () => void }) {
  const fn = useServerFn(coachingCopilot);
  const [sid, setSid] = useState("none"); const [q, setQ] = useState(""); const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false); const [turns, setTurns] = useState<{ q: string; res: any }[]>([]);
  const ask = async (question = q) => {
    if (!question.trim()) return; setBusy(true);
    try { const res: any = await fn({ data: { tenantId: tid, studentId: sid === "none" ? null : sid, question, apply, history: turns.flatMap((t) => [{ role: "user" as const, text: t.q }, { role: "assistant" as const, text: String(t.res.answer ?? "").slice(0, 3900) }]).slice(-20) } }); setTurns((t) => [...t, { q: question, res }]); setQ(""); if (res.applied?.length) { toast.success("CRM updated"); onApplied?.(); } }
    catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  const quick = sid === "none" ? ["Which hot leads should counsellors call today?", "Which leads are stuck after the demo class?"] : ["Recommend the best course and batch", "Draft a follow-up after counselling", "Parent said budget is ₹1.2 lakh and wants NEET dropper batch — update CRM"];
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Select value={sid} onValueChange={setSid}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">No specific student (general question)</SelectItem>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</SelectItem>)}</SelectContent></Select>
        <div className="flex items-center gap-2"><Switch id="eapply" checked={apply} onCheckedChange={setApply} /><Label htmlFor="eapply" className="text-xs">Update CRM automatically</Label></div>
      </div>
      <div className="flex flex-wrap gap-1">{quick.map((x) => <Button key={x} size="sm" variant="outline" className="h-auto whitespace-normal py-1 text-left text-xs" disabled={busy} onClick={() => ask(x)}>{x}</Button>)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!busy) ask(); }}><Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) ask(); } }} placeholder="Ask anything, or paste what the student/parent said… (Enter to send, Shift+Enter for new line)" />
        <Button type="submit" aria-label="Send" disabled={busy || !q.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}</Button></form>
      {turns.map((t, i) => (
        <div key={i} className="space-y-2 text-sm">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">{t.q}</div>
          <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm border bg-card p-3">
          {t.res.answer && <Md text={t.res.answer} />}
          {t.res.recommendations?.map((r: any) => <div key={r.course.id} className="rounded bg-muted p-2"><p className="font-medium">{r.course.name} — ₹{Number(r.course.fee).toLocaleString("en-IN")}</p><p className="text-xs">{r.why}</p></div>)}
          {t.res.whatsapp && <div className="rounded border-l-2 border-primary bg-primary/5 p-2"><p>{t.res.whatsapp}</p><Button size="sm" className="mt-2" asChild><a href={waLink(t.res.phone, t.res.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3 w-3" />Open in WhatsApp</a></Button></div>}
          {t.res.applied?.length > 0 && <div className="flex flex-wrap items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" />{t.res.applied.map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}</div>}
        </div></div>))}
      {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Copilot is thinking…</div>}
      <div ref={(el) => el?.scrollIntoView({ block: "nearest" })} />
    </div>
  );
}
