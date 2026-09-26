import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, MessageCircle, Plus, Sparkles, Loader2, Wand2, CalendarPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRe, useReInvalidate, reDb, reRun, useReAi, SOURCES, LOST_REASONS, FOLLOWUP_KINDS, TEMP_TONE, cr, waLink, pickRule, duplicatesOf } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/leads")({
  head: () => ({ meta: [{ title: "Lead360 | Real Estate CRM" }, { name: "description", content: "Capture, score, assign and follow up real estate leads." }] }),
  component: LeadsPage,
});

const empty: any = { full_name: "", phone: "", alt_phone: "", whatsapp: "", email: "", source: "Website", intent: "Buy", segment: "Residential", preferred_city: "", preferred_location: "", bhk: "", budget_min: "", budget_max: "", size_min: "", possession_pref: "", purpose: "Self-use", timeline_days: "", loan_required: false, down_payment: "", occupation: "", requirement: "", channel_partner_id: "", referred_by: "" };

function LeadsPage() {
  const { user } = useAuth();
  const inv = useReInvalidate();
  const ai = useReAi();
  const { data: leads = [] } = useRe("re_clients");
  const { data: rules = [] } = useRe("re_assignment_rules", "*", "priority", true);
  const { data: fus = [] } = useRe("re_followups", "*, re_clients(full_name, phone)", "due_at", true);
  const { data: partners = [] } = useRe("re_channel_partners", "id,name", "name", true);
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState("all");
  const [src, setSrc] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [fu, setFu] = useState({ kind: "Call", due_at: "", notes: "" });
  const [lost, setLost] = useState("");

  const filtered = useMemo(() => leads.filter((l: any) =>
    (temp === "all" || l.temperature === temp) && (src === "all" || l.source === src) &&
    (!q || [l.full_name, l.phone, l.email, l.preferred_city, l.preferred_location].join(" ").toLowerCase().includes(q.toLowerCase()))
  ).sort((a: any, b: any) => (b.ai_score ?? -1) - (a.ai_score ?? -1)), [leads, q, temp, src]);

  const dueToday = fus.filter((f: any) => !f.done && new Date(f.due_at) <= new Date(new Date().setHours(23, 59, 59)));
  const formDupes = form.phone || form.email ? duplicatesOf({ ...form, id: form.id ?? "new" }, leads) : [];

  const extract = async () => {
    if (!msg.trim()) return;
    const r = await ai.run({ mode: "extract", text: msg });
    if (!r) return;
    try {
      const j = JSON.parse(r.text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      setForm((f: any) => ({ ...f,
        intent: j.intent ?? f.intent, segment: j.segment ?? f.segment, preferred_city: j.city ?? f.preferred_city,
        preferred_location: j.location ?? f.preferred_location, bhk: j.bhk ?? f.bhk, budget_min: j.budget_min ?? f.budget_min,
        budget_max: j.budget_max ?? f.budget_max, size_min: j.size_min ?? f.size_min, possession_pref: j.possession ?? f.possession_pref,
        purpose: j.purpose ?? f.purpose, timeline_days: j.timeline_days ?? f.timeline_days, loan_required: j.loan_required ?? f.loan_required,
        requirement: [msg, j.objections?.length ? `Objections: ${j.objections.join(", ")}` : "", j.notes].filter(Boolean).join("\n"),
      }));
      toast.success("Requirement filled from the message");
    } catch { toast.error("Could not read the AI answer"); }
  };

  const save = async () => {
    if (!form.full_name.trim()) return toast.error("Name is required");
    const num = (v: any) => (v === "" || v == null ? null : Number(v));
    const rule = pickRule(rules, form);
    const row: any = { ...form, bhk: num(form.bhk), budget_min: num(form.budget_min), budget_max: num(form.budget_max), size_min: num(form.size_min), timeline_days: num(form.timeline_days), down_payment: num(form.down_payment), channel_partner_id: form.channel_partner_id || null,
      assigned_team: form.assigned_team || rule?.team || null, agent_id: form.agent_id || rule?.agent_id || null };
    if (!row.temperature) row.temperature = row.timeline_days && row.timeline_days <= 30 && row.budget_max ? "Hot" : row.timeline_days && row.timeline_days <= 90 ? "Warm" : "Cold";
    delete row.id; delete row.created_at; delete row.updated_at;
    const ok = form.id
      ? await reRun(reDb.from("re_clients").update(row).eq("id", form.id), "Lead updated")
      : await reRun(reDb.from("re_clients").insert({ ...row, owner_id: user?.id }), rule ? `Lead added and routed to ${rule.team}` : "Lead added");
    if (ok) { setOpen(false); setForm(empty); setMsg(""); inv(); }
  };

  const score = async (l: any) => { const r = await ai.run({ mode: "score_lead", clientId: l.id }); if (r) { toast.success(`Score ${r.score}/100 · ${r.temperature}`); inv(); } };
  const wa = async (l: any) => { const r = await ai.run({ mode: "whatsapp", clientId: l.id }); if (r) { window.open(waLink(l.whatsapp || l.phone, r.text), "_blank"); await reDb.from("re_clients").update({ last_contacted_at: new Date().toISOString() }).eq("id", l.id); inv(); } };
  const addFu = async () => {
    if (!sel || !fu.due_at) return toast.error("Pick a date and time");
    if (await reRun(reDb.from("re_followups").insert({ client_id: sel.id, kind: fu.kind, due_at: new Date(fu.due_at).toISOString(), notes: fu.notes || null, owner_id: user?.id }), "Follow-up scheduled")) { setFu({ kind: "Call", due_at: "", notes: "" }); inv(); }
  };
  const markLost = async () => {
    if (!sel || !lost) return;
    if (await reRun(reDb.from("re_clients").update({ status: "Lost", lost_reason: lost, temperature: "Cold" }).eq("id", sel.id), "Marked lost")) { setSel({ ...sel, status: "Lost", lost_reason: lost }); inv(); }
  };

  const F = (k: string, label: string, type = "text") => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label><Input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
  );
  const S = (k: string, label: string, opts: string[]) => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Select value={form[k] || ""} onValueChange={(v) => setForm({ ...form, [k]: v })}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[["Total leads", leads.length], ["Hot", leads.filter((l: any) => l.temperature === "Hot").length], ["New today", leads.filter((l: any) => new Date(l.created_at).toDateString() === new Date().toDateString()).length], ["Uncontacted", leads.filter((l: any) => !l.last_contacted_at && l.status !== "Lost").length], ["Follow-ups due today", dueToday.length]].map(([k, v]) => (
          <Card key={k as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-bold">{v as number}</div></CardContent></Card>
        ))}
      </div>

      {dueToday.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Smart follow-ups due today (highest score first)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dueToday.map((f: any) => ({ ...f, score: leads.find((l: any) => l.id === f.client_id)?.ai_score ?? 0 })).sort((a: any, b: any) => b.score - a.score).map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 border rounded-md px-2 py-1 text-sm">
                <Badge variant="outline">{f.kind}</Badge>{f.re_clients?.full_name}<span className="text-xs text-muted-foreground">{new Date(f.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => { await reRun(reDb.from("re_followups").update({ done: true }).eq("id", f.id), "Done"); inv(); }}><Check className="h-3 w-3" /></Button>
              </div>
            ))}
          </CardContent></Card>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search name, phone, location…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={temp} onValueChange={setTemp}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All temps</SelectItem>{["Hot", "Warm", "Cold"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={src} onValueChange={setSrc}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{SOURCES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Button className="ml-auto" onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />New lead</Button>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Requirement</TableHead><TableHead>Budget</TableHead><TableHead>Source</TableHead><TableHead>Score</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((l: any) => {
              const d = duplicatesOf(l, leads);
              return (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setSel(l)}>
                  <TableCell><div className="font-medium flex items-center gap-1">{l.full_name}{d.length > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}</div><div className="text-xs text-muted-foreground">{l.phone}</div>{l.status === "Lost" && <Badge variant="outline" className="text-[10px]">Lost · {l.lost_reason}</Badge>}</TableCell>
                  <TableCell className="text-xs">{[l.intent, l.bhk && `${l.bhk} BHK`, l.preferred_location || l.preferred_city, l.purpose].filter(Boolean).join(" · ")}</TableCell>
                  <TableCell className="text-xs">{l.budget_max ? `${cr(l.budget_min)}–${cr(l.budget_max)}` : "—"}</TableCell>
                  <TableCell className="text-xs">{l.source ?? "—"}</TableCell>
                  <TableCell><div className="flex items-center gap-1">{l.temperature && <Badge variant="outline" className={TEMP_TONE[l.temperature]}>{l.temperature}</Badge>}{l.ai_score != null && <span className="text-xs font-semibold">{l.ai_score}</span>}</div></TableCell>
                  <TableCell className="text-xs">{l.assigned_team ?? "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" disabled={ai.loading} onClick={() => score(l)}><Sparkles className="h-3 w-3 mr-1" />Score</Button>
                    <Button size="sm" variant="ghost" disabled={ai.loading} onClick={() => wa(l)}><MessageCircle className="h-3 w-3 mr-1" />WhatsApp</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setForm({ ...empty, ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v ?? ""])) }); setOpen(true); }}>Edit</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No leads yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit lead" : "New lead"}</DialogTitle></DialogHeader>
          {!form.id && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <Label className="text-xs">Paste a WhatsApp message or call note — AI fills the requirement</Label>
              <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="I want something near school, 3 BHK, under ₹1.5 crore, park-facing, Greater Noida West" />
              <Button size="sm" variant="outline" onClick={extract} disabled={ai.loading}>{ai.loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}Fill with AI</Button>
            </div>
          )}
          {formDupes.length > 0 && (
            <div className="text-sm border border-warning/40 bg-warning/10 rounded-md p-2 flex gap-2"><AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <div>Possible duplicate: {formDupes.map((d: any) => `${d.full_name} (${d.assigned_team ?? "unassigned"}, created ${new Date(d.created_at).toLocaleDateString()})`).join("; ")}</div></div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {F("full_name", "Name *")}{F("phone", "Mobile")}{F("alt_phone", "Alternate mobile")}{F("whatsapp", "WhatsApp")}{F("email", "Email", "email")}{F("occupation", "Occupation")}
            {S("source", "Lead source", SOURCES)}{S("intent", "Buy / Rent / Sell", ["Buy", "Rent", "Sell"])}{S("segment", "Residential / Commercial", ["Residential", "Commercial"])}
            {F("preferred_city", "City")}{F("preferred_location", "Preferred location")}{F("bhk", "BHK", "number")}
            {F("budget_min", "Budget min (₹)", "number")}{F("budget_max", "Budget max (₹)", "number")}{F("size_min", "Min size (sq ft)", "number")}
            {F("down_payment", "Down payment (₹)", "number")}{F("possession_pref", "Possession (e.g. Ready / 2027)")}{S("purpose", "Purpose", ["Self-use", "Investment"])}
            {F("timeline_days", "Buying within (days)", "number")}
            <div className="space-y-1"><Label className="text-xs">Channel partner</Label>
              <Select value={form.channel_partner_id || "none"} onValueChange={(v) => setForm({ ...form, channel_partner_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            {F("referred_by", "Referred by (customer)")}
            <div className="flex items-center gap-2 pt-5"><Switch checked={!!form.loan_required} onCheckedChange={(v) => setForm({ ...form, loan_required: v })} /><Label className="text-xs">Needs home loan</Label></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Notes / requirement</Label><Textarea rows={3} value={form.requirement ?? ""} onChange={(e) => setForm({ ...form, requirement: e.target.value })} /></div>
          <DialogFooter><Button onClick={save}>Save lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {sel && <>
            <DialogHeader><DialogTitle>{sel.full_name} · Lead 360</DialogTitle></DialogHeader>
            <div className="text-sm grid grid-cols-2 gap-2">
              <div>📞 {sel.phone ?? "—"}</div><div>✉️ {sel.email ?? "—"}</div>
              <div>Requirement: {[sel.bhk && `${sel.bhk} BHK`, sel.preferred_location || sel.preferred_city].filter(Boolean).join(", ") || "—"}</div>
              <div>Budget: {sel.budget_max ? `${cr(sel.budget_min)}–${cr(sel.budget_max)}` : "—"}</div>
              <div>Team: {sel.assigned_team ?? "—"}</div><div>Loan: {sel.loan_required ? "Yes" : "No"}</div>
            </div>
            {sel.ai_score != null && <div className="text-sm border rounded-md p-2 bg-muted/30"><b>AI score {sel.ai_score}/100</b> — {sel.ai_score_reason}</div>}
            <div className="space-y-2">
              <div className="font-medium text-sm">Follow-ups</div>
              {fus.filter((f: any) => f.client_id === sel.id).map((f: any) => (
                <div key={f.id} className="text-xs flex gap-2 items-center"><Badge variant="outline">{f.kind}</Badge>{new Date(f.due_at).toLocaleString()}{f.done ? <Badge variant="secondary">Done</Badge> : null}<span className="text-muted-foreground">{f.notes}</span></div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <Select value={fu.kind} onValueChange={(v) => setFu({ ...fu, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FOLLOWUP_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
                <Input type="datetime-local" value={fu.due_at} onChange={(e) => setFu({ ...fu, due_at: e.target.value })} />
                <Button size="sm" onClick={addFu}><CalendarPlus className="h-3 w-3 mr-1" />Schedule</Button>
              </div>
              <Input placeholder="Note (optional)" value={fu.notes} onChange={(e) => setFu({ ...fu, notes: e.target.value })} />
            </div>
            <div className="space-y-2 border-t pt-3">
              <div className="font-medium text-sm">Mark as lost</div>
              <div className="flex gap-2">
                <Select value={lost} onValueChange={setLost}><SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger><SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                <Button variant="outline" onClick={markLost} disabled={!lost}>Mark lost</Button>
              </div>
              {sel.status === "Lost" && <Button size="sm" variant="secondary" onClick={() => window.open(waLink(sel.whatsapp || sel.phone, `Hi ${sel.full_name.split(" ")[0]}, we have new properties that match your original budget${sel.preferred_location ? ` around ${sel.preferred_location}` : ""}. Would you like to see them?`), "_blank")}><MessageCircle className="h-3 w-3 mr-1" />Send win-back message</Button>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
