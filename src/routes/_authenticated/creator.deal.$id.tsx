import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Copy, Loader2, Plus, Sparkles, Trash2, FileSignature, Receipt, Link2 } from "lucide-react";
import { CreatorSendButtons } from "@/components/creator-send-buttons";
import { useBrandContact } from "@/lib/creator-data";
import { useInvalidateCreator, useCreatorAi, parseAiJson } from "@/lib/creator-data";
import { CONTENT_TYPES, DEAL_STAGES, DELIVERABLE_STATUSES, DELIVERABLE_TONE, INVOICE_STATUSES, PLATFORMS, STAGE_PROBABILITY, inr, invoiceTotal, todayISO } from "@/lib/creator";
import { Pick } from "@/components/creator-deal-dialog";
import { roi } from "@/lib/creator-roi";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { creatorComment } from "@/lib/brand.functions";

export const Route = createFileRoute("/_authenticated/creator/deal/$id")({
  head: () => ({ meta: [{ title: "Deal Workspace | DigiCRM AI" }, { name: "description", content: "Deal details, deliverables, contract, invoices and brand timeline." }] }),
  component: DealWorkspace,
});

function useDeal(id: string) {
  return useQuery({
    queryKey: ["creator", "deal", id],
    queryFn: async () => {
      const [deal, dels, invs, cons, acts] = await Promise.all([
        supabase.from("creator_deals").select("*, creator_brands(id,name), creator_profiles(display_name)").eq("id", id).maybeSingle(),
        supabase.from("creator_deliverables").select("*").eq("deal_id", id).order("due_date", { nullsFirst: false }),
        supabase.from("creator_invoices").select("*").eq("deal_id", id).order("created_at"),
        supabase.from("creator_contracts").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
        supabase.from("creator_activities").select("*").eq("deal_id", id).order("created_at", { ascending: false }).limit(100),
      ]);
      if (deal.error) throw deal.error;
      return { deal: deal.data, dels: dels.data ?? [], invs: invs.data ?? [], cons: cons.data ?? [], acts: acts.data ?? [] };
    },
  });
}

function DealWorkspace() {
  const { id } = Route.useParams();
  const { data, isLoading } = useDeal(id);
  const invalidate = useInvalidateCreator();

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!data?.deal) return <p className="text-sm text-muted-foreground">Deal not found or you don't have access.</p>;
  const d = data.deal;
  const net = Number(d.value) * (1 - Number(d.commission_pct) / 100);
  const approvalUrl = typeof window !== "undefined" ? `${window.location.origin}/approve/${d.approval_token}` : "";

  const log = (kind: string, body: string) => supabase.from("creator_activities").insert({ deal_id: id, brand_id: d.brand_id, kind, body });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/creator/deals"><ArrowLeft className="h-4 w-4 mr-1" />Pipeline</Link></Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{d.campaign}</h2>
          <p className="text-sm text-muted-foreground">{d.creator_brands?.name ?? "No brand"}{d.creator_profiles ? ` · ${d.creator_profiles.display_name}` : ""} · {d.source}</p>
        </div>
        <Badge>{d.stage}</Badge>
        <Badge variant="outline">{inr(Number(d.value))} · net {inr(net)}</Badge>
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(approvalUrl); toast.success("Brand approval link copied"); }}>
          <Link2 className="h-4 w-4 mr-1" />Brand approval link
        </Button>
        <Button size="sm" variant="outline" asChild><Link to="/creator/document/$kind/$id" params={{ kind: "proposal", id: d.id }}>Proposal PDF</Link></Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">Deal info</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables ({data.dels.length})</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({data.invs.length})</TabsTrigger>
          <TabsTrigger value="followup">AI follow-up</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="brand">Brand portal</TabsTrigger>
          <TabsTrigger value="performance">Performance & ROI</TabsTrigger>
        </TabsList>
        <TabsContent value="info"><InfoTab deal={d} onSaved={() => { invalidate(); }} log={log} /></TabsContent>
        <TabsContent value="deliverables"><DeliverablesTab dealId={id} rows={data.dels} onChange={invalidate} /></TabsContent>
        <TabsContent value="contract"><ContractTab dealId={id} rows={data.cons} onChange={invalidate} log={log} /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab deal={d} rows={data.invs} onChange={invalidate} log={log} /></TabsContent>
        <TabsContent value="followup"><FollowUpTab deal={d} dels={data.dels} log={log} /></TabsContent>
        <TabsContent value="timeline"><TimelineTab rows={data.acts} dealId={id} brandId={d.brand_id} onChange={invalidate} /></TabsContent>
        <TabsContent value="performance"><PerformanceTab deal={d} dels={data.dels} onChange={invalidate} /></TabsContent>
        <TabsContent value="brand"><BrandPortalTab dealId={id} brandEmail={d.brand_email} linked={!!d.brand_user_id} dels={data.dels} onChange={invalidate} /></TabsContent>
      </Tabs>
    </div>
  );
}

type DealRow = NonNullable<NonNullable<ReturnType<typeof useDeal>["data"]>["deal"]>;
type Logger = (kind: string, body: string) => PromiseLike<unknown>;

function InfoTab({ deal, onSaved, log }: { deal: DealRow; onSaved: () => void; log: Logger }) {
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    const o: Record<string, string> = {};
    for (const k of ["campaign", "objective", "agency", "campaign_manager", "value", "platform", "deal_type", "stage", "probability", "next_action", "next_action_at", "deadline", "start_date", "end_date", "payment_terms", "gst_pct", "commission_pct", "usage_rights", "exclusivity", "requirements", "notes"] as const)
      o[k] = deal[k] == null ? "" : String(deal[k]);
    setF(o);
  }, [deal]);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    const num = (k: string) => Number(f[k]) || 0;
    const nul = (k: string) => f[k] || null;
    const { error } = await supabase.from("creator_deals").update({
      campaign: f.campaign, objective: nul("objective"), agency: nul("agency"), campaign_manager: nul("campaign_manager"),
      value: num("value"), platform: nul("platform"), deal_type: nul("deal_type"), stage: f.stage, probability: num("probability"),
      next_action: nul("next_action"), next_action_at: nul("next_action_at"), deadline: nul("deadline"),
      start_date: nul("start_date"), end_date: nul("end_date"), payment_terms: nul("payment_terms"),
      gst_pct: num("gst_pct"), commission_pct: num("commission_pct"), usage_rights: nul("usage_rights"),
      exclusivity: nul("exclusivity"), requirements: nul("requirements"), notes: nul("notes"), updated_at: new Date().toISOString(),
    }).eq("id", deal.id);
    if (error) return toast.error(error.message);
    if (f.stage !== deal.stage) await log("stage", `Moved from ${deal.stage} to ${f.stage}`);
    toast.success("Saved");
    onSaved();
  };
  const T = ({ k, label, type = "text" }: { k: string; label: string; type?: string }) => (
    <div><Label>{label}</Label><Input type={type} value={f[k] ?? ""} onChange={(e) => set(k)(e.target.value)} /></div>
  );
  const value = Number(f.value) || 0;
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2">{T({ k: "campaign", label: "Campaign" })}</div>
        {T({ k: "objective", label: "Objective" })}
        {T({ k: "campaign_manager", label: "Campaign manager" })}
        {T({ k: "agency", label: "Agency" })}
        {T({ k: "value", label: "Deal value (₹)", type: "number" })}
        <Pick label="Platform" value={f.platform ?? ""} onChange={set("platform")} options={PLATFORMS} />
        <Pick label="Stage" value={f.stage ?? ""} onChange={(v) => { set("stage")(v); set("probability")(String(STAGE_PROBABILITY[v] ?? f.probability)); }} options={[...DEAL_STAGES]} />
        {T({ k: "probability", label: "Probability %", type: "number" })}
        {T({ k: "next_action", label: "Next action" })}
        {T({ k: "next_action_at", label: "Next action date", type: "date" })}
        {T({ k: "deadline", label: "Deadline", type: "date" })}
        {T({ k: "start_date", label: "Start date", type: "date" })}
        {T({ k: "end_date", label: "End date", type: "date" })}
        {T({ k: "payment_terms", label: "Payment terms" })}
        {T({ k: "gst_pct", label: "GST %", type: "number" })}
        {T({ k: "commission_pct", label: "Agency commission %", type: "number" })}
        {T({ k: "usage_rights", label: "Usage rights" })}
        {T({ k: "exclusivity", label: "Exclusivity" })}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Requirements / brief</Label><Textarea rows={3} value={f.requirements ?? ""} onChange={(e) => set("requirements")(e.target.value)} /></div>
        <div><Label>Notes</Label><Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>GST: <b>{inr(value * (Number(f.gst_pct) || 0) / 100)}</b></span>
        <span>Commission: <b>{inr(value * (Number(f.commission_pct) || 0) / 100)}</b></span>
        <span>Net revenue: <b>{inr(value * (1 - (Number(f.commission_pct) || 0) / 100))}</b></span>
        <Button className="ml-auto" onClick={save}>Save deal</Button>
      </div>
    </CardContent></Card>
  );
}

type Del = { id: string; content_type: string; platform: string | null; quantity: number; due_date: string | null; status: string; caption: string | null; draft_url: string | null; revision_count: number; brand_comment: string | null };

function DeliverablesTab({ dealId, rows, onChange }: { dealId: string; rows: Del[]; onChange: () => void }) {
  const [n, setN] = useState({ content_type: "Reel", platform: "Instagram", quantity: "1", due_date: "" });
  const add = async () => {
    const { error } = await supabase.from("creator_deliverables").insert({ deal_id: dealId, content_type: n.content_type, platform: n.platform, quantity: Number(n.quantity) || 1, due_date: n.due_date || null });
    if (error) return toast.error(error.message);
    onChange();
  };
  const patch = async (id: string, p: Record<string, unknown>) => {
    const { error } = await supabase.from("creator_deliverables").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36"><Pick label="Deliverable" value={n.content_type} onChange={(v) => setN({ ...n, content_type: v })} options={CONTENT_TYPES} /></div>
        <div className="w-36"><Pick label="Platform" value={n.platform} onChange={(v) => setN({ ...n, platform: v })} options={PLATFORMS} /></div>
        <div className="w-20"><Label>Qty</Label><Input type="number" value={n.quantity} onChange={(e) => setN({ ...n, quantity: e.target.value })} /></div>
        <div><Label>Due</Label><Input type="date" value={n.due_date} onChange={(e) => setN({ ...n, due_date: e.target.value })} /></div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Deliverable</TableHead><TableHead>Platform</TableHead><TableHead>Qty</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead>Draft link</TableHead><TableHead>Brand feedback</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm">No deliverables yet.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.content_type}</TableCell>
              <TableCell>{r.platform}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell className={r.due_date && r.due_date < todayISO() && r.status !== "Published" ? "text-destructive" : ""}>{r.due_date ?? "—"}</TableCell>
              <TableCell>
                <select className={`rounded px-2 py-1 text-xs border-0 ${DELIVERABLE_TONE[r.status] ?? ""}`} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value, ...(e.target.value === "Published" ? { posted_at: todayISO() } : {}) })}>
                  {DELIVERABLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {r.revision_count > 0 && <span className="ml-1 text-[10px] text-muted-foreground">rev {r.revision_count}</span>}
              </TableCell>
              <TableCell><Input className="h-8 w-40" defaultValue={r.draft_url ?? ""} placeholder="https://" onBlur={(e) => e.target.value !== (r.draft_url ?? "") && patch(r.id, { draft_url: e.target.value || null })} /></TableCell>
              <TableCell className="text-xs max-w-48">{r.brand_comment ?? "—"}</TableCell>
              <TableCell><Button size="icon" variant="ghost" onClick={async () => { await supabase.from("creator_deliverables").delete().eq("id", r.id); onChange(); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Set a deliverable to "Submitted" and share the brand approval link — the brand can approve or request a revision there.</p>
    </CardContent></Card>
  );
}

type Contract = { id: string; title: string; body: string | null; status: string; analysis: unknown; expires_at: string | null };
type Analysis = { payment_terms?: string; deliverables?: string[]; deadlines?: string[]; usage_rights?: string; exclusivity?: string; revision_limits?: string; cancellation?: string; late_payment?: string; missing?: string[]; risks?: string[]; tasks?: string[] };

function ContractTab({ dealId, rows, onChange, log }: { dealId: string; rows: Contract[]; onChange: () => void; log: Logger }) {
  const ai = useCreatorAi();
  const [title, setTitle] = useState("Influencer agreement");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const analyse = async () => {
    if (body.trim().length < 20) return toast.error("Paste the contract text first");
    setBusy(true);
    try {
      const analysis = parseAiJson<Analysis>(await ai({ mode: "contract", text: body }));
      const { error } = await supabase.from("creator_contracts").insert({ deal_id: dealId, title, body, analysis: analysis as never, status: "Under review" });
      if (error) throw error;
      await log("contract", `Contract "${title}" analysed by AI`);
      setBody("");
      onChange();
      toast.success("Contract analysed");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const createTasks = async (c: Contract) => {
    const tasks = (c.analysis as Analysis)?.tasks ?? [];
    if (!tasks.length) return;
    const { error } = await supabase.from("tasks").insert(tasks.map((t) => ({ title: t, description: `From contract: ${c.title}`, industry_group: "creator-economy" })) as never);
    if (error) return toast.error(error.message);
    toast.success(`${tasks.length} tasks created`);
  };
  const setStatus = async (c: Contract, status: string) => {
    await supabase.from("creator_contracts").update({ status, ...(status === "Signed" ? { signed_at: todayISO() } : {}) }).eq("id", c.id);
    await log("contract", `Contract "${c.title}" marked ${status}`);
    onChange();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4" />AI contract analyzer</CardTitle>
          <CardDescription>Paste the contract. AI pulls out payment terms, deadlines, usage rights, exclusivity and missing clauses.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste contract text…" />
          <Button onClick={analyse} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}Analyse & save</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No contracts yet.</p>}
        {rows.map((c) => {
          const a = (c.analysis ?? {}) as Analysis;
          return (
            <Card key={c.id}><CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><b className="flex-1">{c.title}</b><Badge variant="outline">{c.status}</Badge></div>
              <div className="flex gap-1 flex-wrap">{["Sent", "Signed", "Expired"].map((s) => <Button key={s} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStatus(c, s)}>Mark {s}</Button>)}</div>
              {a.payment_terms && <p><b>Payment:</b> {a.payment_terms}</p>}
              {a.usage_rights && <p><b>Usage rights:</b> {a.usage_rights}</p>}
              {a.exclusivity && <p><b>Exclusivity:</b> {a.exclusivity}</p>}
              {a.revision_limits && <p><b>Revisions:</b> {a.revision_limits}</p>}
              {a.cancellation && <p><b>Cancellation:</b> {a.cancellation}</p>}
              {a.late_payment && <p><b>Late payment:</b> {a.late_payment}</p>}
              {!!a.deadlines?.length && <p><b>Deadlines:</b> {a.deadlines.join("; ")}</p>}
              {!!a.missing?.length && <div><b className="text-destructive">Missing:</b><ul className="list-disc ml-5">{a.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
              {!!a.risks?.length && <div><b>Risks:</b><ul className="list-disc ml-5">{a.risks.map((m) => <li key={m}>{m}</li>)}</ul></div>}
              {!!a.tasks?.length && <Button size="sm" variant="secondary" onClick={() => createTasks(c)}>Create {a.tasks.length} CRM tasks</Button>}
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}

type Inv = { id: string; number: string; amount: number; tax_pct: number; status: string; issued_at: string | null; due_date: string | null; paid_amount: number; paid_at: string | null };

function InvoicesTab({ deal, rows, onChange, log }: { deal: DealRow; rows: Inv[]; onChange: () => void; log: Logger }) {
  const create = async () => {
    const number = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
    const due = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const { error } = await supabase.from("creator_invoices").insert({ deal_id: deal.id, number, amount: Number(deal.value), tax_pct: Number(deal.gst_pct), due_date: due });
    if (error) return toast.error(error.message);
    await log("invoice", `Invoice ${number} generated for ${inr(Number(deal.value))}`);
    onChange();
  };
  const patch = async (r: Inv, status: string) => {
    const paid = status === "Paid" ? { paid_amount: invoiceTotal(r), paid_at: todayISO() } : {};
    const { error } = await supabase.from("creator_invoices").update({ status, ...paid, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await log("invoice", `Invoice ${r.number} marked ${status}`);
    if (status === "Paid" && deal.stage !== "Paid") await supabase.from("creator_deals").update({ stage: "Paid", probability: 100 }).eq("id", deal.id);
    onChange();
  };
  const printInvoice = (r: Inv) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const tax = Number(r.amount) * Number(r.tax_pct) / 100;
    w.document.write(`<html><head><title>${r.number}</title><style>body{font-family:system-ui;padding:40px;max-width:720px;margin:auto}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}table{width:100%;border-collapse:collapse}</style></head><body>
      <h1>Invoice ${r.number}</h1><p>Issued ${r.issued_at ?? ""} · Due ${r.due_date ?? ""}</p>
      <p><b>Bill to:</b> ${deal.creator_brands?.name ?? ""}</p><p><b>Campaign:</b> ${deal.campaign}</p>
      <table><tr><th>Description</th><th>Amount</th></tr><tr><td>${deal.campaign} — sponsorship deliverables</td><td>${inr(Number(r.amount))}</td></tr>
      <tr><td>GST ${r.tax_pct}%</td><td>${inr(tax)}</td></tr><tr><th>Total</th><th>${inr(Number(r.amount) + tax)}</th></tr></table>
      <p>Payment terms: ${deal.payment_terms ?? "Net 30"}</p><script>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <Button onClick={create}><Receipt className="h-4 w-4 mr-1" />Generate invoice from deal</Button>
      <Table>
        <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Total</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium"><Link to="/creator/document/$kind/$id" params={{ kind: "invoice", id: r.id }} className="hover:underline">{r.number}</Link></TableCell>
              <TableCell>{inr(invoiceTotal(r))}</TableCell>
              <TableCell>{r.due_date}</TableCell>
              <TableCell><select className="rounded border bg-background px-2 py-1 text-xs" value={r.status} onChange={(e) => patch(r, e.target.value)}>{INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => printInvoice(r)}>Print / PDF</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function FollowUpTab({ deal, dels, log }: { deal: DealRow; dels: Del[]; log: Logger }) {
  const ai = useCreatorAi();
  const [kind, setKind] = useState("First follow-up");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const contact = useBrandContact(deal.brand_id);
  const run = async () => {
    setBusy(true);
    try {
      const ctx = `Brand ${deal.creator_brands?.name ?? ""}; campaign ${deal.campaign}; stage ${deal.stage}; value ${inr(Number(deal.value))}; deadline ${deal.deadline ?? "n/a"}; next action ${deal.next_action ?? "n/a"}; deliverables ${dels.map((d) => `${d.quantity} ${d.content_type} (${d.status})`).join(", ") || "none"}.`;
      setText(await ai({ mode: "followup", kind, deal: ctx }));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56"><Pick label="Message type" value={kind} onChange={setKind} options={["First follow-up", "Negotiation follow-up", "Contract follow-up", "Payment reminder", "Approval reminder", "Renewal message"]} /></div>
        <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}Draft</Button>
      </div>
      <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your draft appears here. Edit, then copy and send." />
      {contact.data && <p className="text-xs text-muted-foreground">To: {contact.data.name}{contact.data.email ? ` · ${contact.data.email}` : ""}{contact.data.whatsapp || contact.data.phone ? ` · ${contact.data.whatsapp || contact.data.phone}` : ""}</p>}
      <CreatorSendButtons text={text} email={contact.data?.email} phone={contact.data?.whatsapp || contact.data?.phone} linkedin={contact.data?.linkedin}
        subject={`${deal.campaign} — ${kind}`}
        onSent={async (ch) => { await log(ch === "Email" ? "email" : "message", `${kind} sent by ${ch}:\n${text}`); }} />
      <Copy className="hidden" />
    </CardContent></Card>
  );
}

type Act = { id: string; kind: string; body: string; created_at: string };

function TimelineTab({ rows, dealId, brandId, onChange }: { rows: Act[]; dealId: string; brandId: string | null; onChange: () => void }) {
  const [kind, setKind] = useState("note");
  const [body, setBody] = useState("");
  const add = async () => {
    if (!body.trim()) return;
    await supabase.from("creator_activities").insert({ deal_id: dealId, brand_id: brandId, kind, body });
    setBody("");
    onChange();
  };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-36"><Pick label="Type" value={kind} onChange={setKind} options={["note", "email", "call", "dm", "whatsapp", "meeting"]} /></div>
        <Input className="flex-1 min-w-48" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened?" />
        <Button onClick={add}>Log</Button>
      </div>
      <ol className="border-l ml-2 space-y-3">
        {rows.map((a) => (
          <li key={a.id} className="ml-4">
            <div className="text-xs text-muted-foreground"><Badge variant="outline" className="mr-2 text-[10px]">{a.kind}</Badge>{new Date(a.created_at).toLocaleString()}</div>
            <p className="text-sm whitespace-pre-wrap">{a.body}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="ml-4 text-sm text-muted-foreground">No activity yet.</li>}
      </ol>
    </CardContent></Card>
  );
}

function BrandPortalTab({ dealId, brandEmail, linked, dels, onChange }: { dealId: string; brandEmail: string | null; linked: boolean; dels: Del[]; onChange: () => void }) {
  const [email, setEmail] = useState(brandEmail ?? "");
  const [msg, setMsg] = useState("");
  const [target, setTarget] = useState<string>("general");
  const post = useServerFn(creatorComment);
  const comments = useQuery({
    queryKey: ["creator", "comments", dealId],
    queryFn: async () => (await supabase.from("creator_deal_comments").select("*").eq("deal_id", dealId).order("created_at")).data ?? [],
  });
  const saveEmail = async () => {
    const v = email.trim().toLowerCase();
    if (v && !/^\S+@\S+\.\S+$/.test(v)) return toast.error("Enter a valid email");
    const { error } = await supabase.from("creator_deals").update({ brand_email: v || null }).eq("id", dealId);
    if (error) return toast.error(error.message);
    toast.success(v ? "Brand invited — they'll see this campaign after signing in with that email" : "Brand access removed");
    onChange();
  };
  const send = async () => {
    try { await post({ data: { dealId, deliverableId: target === "general" ? null : target, body: msg } }); setMsg(""); comments.refetch(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const label = (id: string | null) => (id ? dels.find((x) => x.id === id)?.content_type ?? "Deliverable" : "General");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Invite the brand</CardTitle>
          <CardDescription>The brand signs in at {typeof window !== "undefined" ? window.location.origin : ""}/brand with this email to see the campaign, approve content and comment.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="brand@company.com" /><Button onClick={saveEmail}>Save</Button></div>
          <Badge variant={linked ? "default" : "outline"}>{linked ? "Brand has joined the portal" : "Not joined yet"}</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Conversation with the brand</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="max-h-80 overflow-y-auto space-y-2">
            {(comments.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {(comments.data ?? []).map((c) => (
              <div key={c.id} className={`rounded-md p-2 text-sm ${c.author_role === "brand" ? "bg-muted mr-8" : "bg-primary/10 ml-8"}`}>
                <p className="text-xs text-muted-foreground">{c.author_name ?? c.author_role} · {label(c.deliverable_id)} · {new Date(c.created_at).toLocaleString()}</p>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
          <select className="w-full border rounded-md h-9 px-2 bg-background text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="general">General</option>
            {dels.map((x) => <option key={x.id} value={x.id}>{x.content_type}</option>)}
          </select>
          <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Reply to the brand…" />
          <Button size="sm" disabled={!msg.trim()} onClick={send}>Send</Button>
        </CardContent>
      </Card>
    </div>
  );
}

const METRICS = [["reach", "Reach"], ["views", "Views"], ["engagements", "Engagements"], ["clicks", "Clicks"], ["conversions", "Conversions"], ["revenue_generated", "Brand revenue ₹"]] as const;


function PerformanceTab({ deal, dels, onChange }: { deal: DealRow; dels: Del[]; onChange: () => void }) {
  const [edit, setEdit] = useState<Record<string, Record<string, string>>>({});
  const val = (d: Del, k: string) => edit[d.id]?.[k] ?? String((d as unknown as Record<string, number>)[k] ?? 0);
  const save = async (d: Del) => {
    const p: Record<string, number> = {};
    for (const [k] of METRICS) p[k] = Math.max(0, Number(val(d, k)) || 0);
    const { error } = await supabase.from("creator_deliverables").update({ ...p, updated_at: new Date().toISOString() }).eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Results saved"); onChange();
  };
  const sum = (k: string) => dels.reduce((s, d) => s + Number((d as unknown as Record<string, number>)[k] ?? 0), 0);
  const t = { reach: sum("reach"), views: sum("views"), engagements: sum("engagements"), clicks: sum("clicks"), conversions: sum("conversions"), revenue: sum("revenue_generated") };
  const m = roi(Number(deal.value), t);
  const kpis: [string, string][] = [["Reach", t.reach.toLocaleString()], ["Views", t.views.toLocaleString()], ["Engagement rate", `${m.er.toFixed(2)}%`], ["CTR", `${m.ctr.toFixed(2)}%`],
    ["CPM", inr(Math.round(m.cpm))], ["CPC", inr(Math.round(m.cpc))], ["CPE", inr(Math.round(m.cpe * 100) / 100)], ["Conversions", t.conversions.toLocaleString()], ["Conversion rate", `${m.cvr.toFixed(2)}%`], ["Brand ROAS", `${m.roas.toFixed(2)}×`]];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">Enter results per deliverable after it goes live. Costs are based on the deal fee of {inr(Number(deal.value))}. The brand sees these results in their portal.</p>
        <Button size="sm" variant="outline" asChild><Link to="/creator/document/$kind/$id" params={{ kind: "report", id: deal.id }}>Campaign report PDF</Link></Button>
      </div>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
        {kpis.map(([l, v]) => <Card key={l}><CardContent className="p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-bold">{v}</p></CardContent></Card>)}
      </div>
      <Card><CardContent className="p-0 overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Deliverable</TableHead>{METRICS.map(([, l]) => <TableHead key={l}>{l}</TableHead>)}<TableHead /></TableRow></TableHeader>
        <TableBody>{dels.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="whitespace-nowrap">{d.content_type} · {d.platform}</TableCell>
            {METRICS.map(([k]) => <TableCell key={k}><Input className="w-24 h-8" type="number" min={0} value={val(d, k)} onChange={(e) => setEdit((p) => ({ ...p, [d.id]: { ...p[d.id], [k]: e.target.value } }))} /></TableCell>)}
            <TableCell><Button size="sm" onClick={() => save(d)}>Save</Button></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></CardContent></Card>
    </div>
  );
}
