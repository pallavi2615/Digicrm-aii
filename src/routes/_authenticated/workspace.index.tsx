import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, MessageCircle, Plus, Sparkles, Wand2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveTenant } from "@/lib/tenants";
import { getTemplate, fillTemplate, type KpiDef, type Workflow, type WaTemplate, type ReportDef, type WorkspaceTemplate } from "@/lib/workspace-templates";
import { workspaceAi } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/workspace/")({
  head: () => ({
    meta: [
      { title: "Industry Workspace | DigiCRM AI" },
      { name: "description", content: "Your plug-and-play industry CRM: dashboard, pipeline, workflows, WhatsApp journeys, AI agents, reports and locations." },
      { property: "og:title", content: "Industry Workspace | DigiCRM AI" },
      { property: "og:description", content: "Dashboard, pipeline, automations, WhatsApp, AI agents and reports for your industry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspacePage,
});

type Rec = {
  id: string; title: string; contact_name: string | null; contact_phone: string | null; stage: string; value: number | null;
  source: string | null; fields: Record<string, any> | null; created_at: string; updated_at: string; won: boolean | null;
};
type Ws = {
  tenant_id: string; template_slug: string; subtype: string | null; location_mode: string; workflows: Workflow[];
  whatsapp_templates: WaTemplate[]; reports: ReportDef[]; dashboard: KpiDef[]; modules: string[]; roles: string[]; integrations: string[];
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const DAY = 864e5;
const waLink = (phone: string | null, text: string) => `https://wa.me/${(phone ?? "").replace(/\D/g, "").replace(/^(?=\d{10}$)/, "91")}?text=${encodeURIComponent(text)}`;

function WorkspacePage() {
  const { active, loading } = useActiveTenant();
  const tid = active?.id;
  const ws = useQuery({
    queryKey: ["tenant-workspace", tid], enabled: !!tid,
    queryFn: async () => (await supabase.from("tenant_workspaces").select("*").eq("tenant_id", tid!).maybeSingle()).data as Ws | null,
  });
  const tpl = ((ws.data as any)?.template_config as WorkspaceTemplate | null) ?? getTemplate(ws.data?.template_slug);
  const recs = useQuery({
    queryKey: ["ws-records", tid, tpl?.slug], enabled: !!tid && !!tpl,
    queryFn: async () => {
      const { data, error } = await supabase.from("pack_records").select("id,title,contact_name,contact_phone,stage,value,source,fields,created_at,updated_at,won")
        .eq("tenant_id", tid!).eq("pack_slug", `tpl-${tpl!.slug}`).is("deleted_at", null).order("updated_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

  if (loading || ws.isLoading) return <div className="p-10 text-center"><Loader2 className="inline h-5 w-5 animate-spin" /></div>;
  if (!ws.data || !tpl) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card><CardHeader><CardTitle>Set up your industry workspace</CardTitle>
          <CardDescription>{active ? `“${active.name}” has no industry template yet.` : "You don't have a workspace yet."} Pick your industry and DigiCRM configures itself.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link to="/workspace/setup"><Wand2 className="mr-2 h-4 w-4" />Open the AI template engine</Link></Button></CardContent></Card>
      </div>
    );
  }
  const rows = recs.data ?? [];
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{active?.name}</h1>
          <p className="text-sm text-muted-foreground">{tpl.positioning} · {ws.data.subtype} · {ws.data.location_mode === "single" ? "Single location" : ws.data.location_mode === "multi" ? "Multi-location" : "Franchise"}</p>
        </div>
        <div className="flex gap-2">
          <AddRecord tpl={tpl} tenantId={tid!} />
          <Button variant="outline" asChild><Link to="/workspace/setup">Switch industry</Link></Button>
        </div>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {["overview", "pipeline", "automations", "whatsapp", "agents", "reports", "locations", "setup"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === "agents" ? "AI agents" : t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview"><Overview tpl={tpl} ws={ws.data} rows={rows} tenantId={tid!} /></TabsContent>
        <TabsContent value="pipeline"><Pipeline tpl={tpl} rows={rows} /></TabsContent>
        <TabsContent value="automations"><Automations ws={ws.data} rows={rows} business={active?.name ?? ""} /></TabsContent>
        <TabsContent value="whatsapp"><WhatsApp ws={ws.data} rows={rows} business={active?.name ?? ""} /></TabsContent>
        <TabsContent value="agents"><Agents tpl={tpl} rows={rows} tenantId={tid!} /></TabsContent>
        <TabsContent value="reports"><Reports ws={ws.data} rows={rows} /></TabsContent>
        <TabsContent value="locations"><Locations tenantId={tid!} mode={ws.data.location_mode} rows={rows} /></TabsContent>
        <TabsContent value="setup"><SetupTab ws={ws.data} /></TabsContent>
      </Tabs>
    </div>
  );
}

function metric(k: KpiDef["metric"], rows: Rec[], tpl: WorkspaceTemplate): string {
  const won = rows.filter((r) => tpl.wonStages.includes(r.stage));
  const wonValue = won.reduce((a, r) => a + Number(r.value ?? 0), 0);
  if (k === "count") return String(rows.length);
  if (k === "new_7d") return String(rows.filter((r) => Date.now() - +new Date(r.created_at) < 7 * DAY).length);
  if (k === "open") return String(rows.length - won.length);
  if (k === "won") return String(won.length);
  if (k === "won_value") return inr(wonValue);
  if (k === "avg_value") return won.length ? inr(wonValue / won.length) : "—";
  if (k === "conversion") return rows.length ? `${Math.round((won.length / rows.length) * 100)}%` : "—";
  if (k === "stale") return String(rows.filter((r) => Date.now() - +new Date(r.updated_at) > 14 * DAY).length);
  if (k.startsWith("stage:")) return String(rows.filter((r) => r.stage === k.slice(6)).length);
  if (k.startsWith("source:")) return String(rows.filter((r) => r.source === k.slice(7)).length);
  if (k.startsWith("sum:")) { const key = k.slice(4); return rows.reduce((a, r) => a + Number(r.fields?.[key] ?? 0), 0).toLocaleString("en-IN"); }
  return "—";
}

function Overview({ tpl, ws, rows, tenantId }: { tpl: WorkspaceTemplate; ws: Ws; rows: Rec[]; tenantId: string }) {
  const run = useServerFn(workspaceAi);
  const brief = useMutation({ mutationFn: () => run({ data: { tenantId, mode: "copilot", text: "Give me today's briefing: what needs attention and the top 5 actions." } }), onError: (e: Error) => toast.error(e.message) });
  const byStage = tpl.stages.map((s) => ({ name: s, count: rows.filter((r) => r.stage === s).length }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {(ws.dashboard?.length ? ws.dashboard : tpl.dashboard).map((k) => (
          <Card key={k.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-2xl font-bold">{metric(k.metric, rows, tpl)}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{tpl.recordLabelPlural} by stage</CardTitle></CardHeader>
          <CardContent className="h-64"><ResponsiveContainer><BarChart data={byStage}><XAxis dataKey="name" fontSize={10} /><YAxis allowDecimals={false} fontSize={10} /><Tooltip /><Bar dataKey="count" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm">AI daily briefing</CardTitle>
          <Button size="sm" variant="outline" disabled={brief.isPending} onClick={() => brief.mutate()}>{brief.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Generate</Button></CardHeader>
          <CardContent className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm">{brief.data?.text ?? <span className="text-muted-foreground">Ask the AI copilot what needs attention today.</span>}</CardContent></Card>
      </div>
    </div>
  );
}

function Pipeline({ tpl, rows }: { tpl: WorkspaceTemplate; rows: Rec[] }) {
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("pack_records").update({ stage, won: tpl.wonStages.includes(stage) ? true : null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws-records"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {tpl.stages.map((s) => {
        const col = rows.filter((r) => r.stage === s);
        return (
          <div key={s} className="w-64 shrink-0 rounded-lg border bg-muted/30 p-2"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("id"); if (id) move.mutate({ id, stage: s }); }}>
            <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold">{s}</p><Badge variant="secondary">{col.length}</Badge></div>
            <div className="space-y-2">
              {col.map((r) => (
                <div key={r.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", r.id)} className="cursor-grab rounded-md border bg-card p-2 text-xs">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-muted-foreground">{r.source ?? "—"}{r.value ? ` · ${inr(Number(r.value))}` : ""}</p>
                  {r.fields?.location && <p className="text-muted-foreground">{r.fields.location}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function dueFor(w: Workflow, rows: Rec[]): Rec[] {
  const now = Date.now();
  if (w.trigger === "inactive") return rows.filter((r) => now - +new Date(r.updated_at) > (w.days ?? 7) * DAY);
  if (w.trigger === "in_stage") return rows.filter((r) => r.stage === w.stage);
  if (w.trigger === "new_record") return rows.filter((r) => now - +new Date(r.created_at) < DAY);
  if (w.trigger === "date_soon" && w.field) {
    return rows.filter((r) => {
      const v = r.fields?.[w.field!]; if (!v) return false;
      const d = +new Date(String(v));
      if ((w.days ?? 0) < 0) return now - d > Math.abs(w.days!) * DAY; // e.g. last check-in older than N days
      // recurring dates (birthday/anniversary) compare month-day
      const dt = new Date(d); const next = new Date(new Date().getFullYear(), dt.getMonth(), dt.getDate());
      const isAnnual = /birth|anniv/.test(w.field!);
      const diff = ((isAnnual ? +next : d) - now) / DAY;
      return diff >= -1 && diff <= (w.days ?? 7);
    });
  }
  return [];
}

function useSaveWs(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Ws>) => {
      const { error } = await supabase.from("tenant_workspaces").update({ ...patch, updated_at: new Date().toISOString() } as never).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-workspace"] }); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function Automations({ ws, rows, business }: { ws: Ws; rows: Rec[]; business: string }) {
  const save = useSaveWs(ws.tenant_id);
  const [open, setOpen] = useState<string | null>(null);
  const tpls = Object.fromEntries(ws.whatsapp_templates.map((t) => [t.key, t]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Each rule checks your records and lists who should get a message today. Tap WhatsApp to send from your own phone.</p>
      {ws.workflows.map((w, i) => {
        const due = w.enabled ? dueFor(w, rows) : [];
        return (
          <Card key={w.key}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.action}</p></div>
                <div className="flex items-center gap-3">
                  <Badge variant={due.length ? "default" : "outline"}>{due.length} due</Badge>
                  <Switch checked={w.enabled} onCheckedChange={(v) => save.mutate({ workflows: ws.workflows.map((x, j) => (j === i ? { ...x, enabled: v } : x)) })} />
                  <Button size="sm" variant="ghost" disabled={!due.length} onClick={() => setOpen(open === w.key ? null : w.key)}>{open === w.key ? "Hide" : "Show"}</Button>
                </div>
              </div>
              {open === w.key && (
                <div className="divide-y rounded-md border">
                  {due.slice(0, 50).map((r) => {
                    const msg = fillTemplate(tpls[w.template]?.body ?? "", r, business);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                        <span className="truncate">{r.title} · {r.stage}</span>
                        <Button size="sm" variant="outline" asChild><a href={waLink(r.contact_phone, msg)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3 w-3" />WhatsApp</a></Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function WhatsApp({ ws, rows, business }: { ws: Ws; rows: Rec[]; business: string }) {
  const save = useSaveWs(ws.tenant_id);
  const [draft, setDraft] = useState(ws.whatsapp_templates);
  const [recId, setRecId] = useState<string>("");
  const rec = rows.find((r) => r.id === recId) ?? rows[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Preview for</Label>
        <Select value={rec?.id ?? ""} onValueChange={setRecId}><SelectTrigger className="w-64"><SelectValue placeholder="Pick a record" /></SelectTrigger>
          <SelectContent>{rows.slice(0, 200).map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select>
        <Button size="sm" onClick={() => save.mutate({ whatsapp_templates: draft })}>Save templates</Button>
      </div>
      <p className="text-xs text-muted-foreground">Placeholders: {"{name}"}, {"{business}"} and any field key, e.g. {"{appointment_at}"}.</p>
      {draft.map((t, i) => {
        const msg = rec ? fillTemplate(t.body, rec, business) : t.body;
        return (
          <Card key={t.key}><CardContent className="grid gap-3 p-4 md:grid-cols-2">
            <div className="space-y-1"><Input value={t.name} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Textarea rows={3} value={t.body} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} /></div>
            <div className="space-y-2"><div className="rounded-lg bg-muted p-3 text-sm">{msg}</div>
              {rec && <Button size="sm" variant="outline" asChild><a href={waLink(rec.contact_phone, msg)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3 w-3" />Send to {rec.title}</a></Button>}</div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}

function Agents({ tpl, rows, tenantId }: { tpl: WorkspaceTemplate; rows: Rec[]; tenantId: string }) {
  const run = useServerFn(workspaceAi);
  const [agentKey, setAgentKey] = useState(tpl.agents[0]?.key ?? "");
  const [recId, setRecId] = useState("");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const agent = tpl.agents.find((a) => a.key === agentKey);
  const m = useMutation({ mutationFn: (d: { tenantId: string; mode: "agent" | "copilot" | "message"; recordId?: string; agentInstruction?: string; text?: string }) => run({ data: d }), onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Run an agent on a record</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Select value={agentKey} onValueChange={setAgentKey}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tpl.agents.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}</SelectContent></Select>
          <p className="text-xs text-muted-foreground">{agent?.description}</p>
          <Select value={recId} onValueChange={setRecId}><SelectTrigger><SelectValue placeholder={`Pick a ${tpl.recordLabel.toLowerCase()}`} /></SelectTrigger><SelectContent>{rows.slice(0, 200).map((r) => <SelectItem key={r.id} value={r.id}>{r.title} · {r.stage}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" disabled={!recId || m.isPending} onClick={() => m.mutate({ tenantId, mode: "agent", recordId: recId, agentInstruction: agent?.instruction })}><Sparkles className="mr-1 h-3 w-3" />Run</Button>
        </CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Reply to a customer message</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Mujhe 8 logon ke liye Saturday ko table chahiye." />
          <Button size="sm" disabled={!msg.trim() || m.isPending} onClick={() => m.mutate({ tenantId, mode: "message", text: msg })}><Sparkles className="mr-1 h-3 w-3" />Draft reply</Button>
        </CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Ask the AI copilot</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which leads haven't been followed up? Why did sales fall this month?" />
            <Button disabled={!q.trim() || m.isPending} onClick={() => m.mutate({ tenantId, mode: "copilot", text: q })}>Ask</Button></div>
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {m.data && <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{m.data.text}</div>}
        </CardContent></Card>
    </div>
  );
}

function groupBy(rows: Rec[], by: ReportDef["by"]) {
  const key = (r: Rec) =>
    by === "stage" ? r.stage : by === "source" ? r.source ?? "Unknown" : by === "location" ? r.fields?.location ?? "Main" :
    by === "month" ? r.created_at.slice(0, 7) : String(r.fields?.[by.slice(6)] ?? "—");
  const m = new Map<string, { name: string; count: number; value: number }>();
  for (const r of rows) { const k = key(r); const e = m.get(k) ?? { name: k, count: 0, value: 0 }; e.count++; e.value += Number(r.value ?? 0); m.set(k, e); }
  return [...m.values()].sort((a, b) => (by === "month" ? a.name.localeCompare(b.name) : b.value - a.value));
}

function Reports({ ws, rows }: { ws: Ws; rows: Rec[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ws.reports.map((rep) => {
        const data = groupBy(rows, rep.by);
        return (
          <Card key={rep.key}><CardHeader className="pb-2"><CardTitle className="text-sm">{rep.name}</CardTitle></CardHeader>
            <CardContent className="h-56">{data.length ? (
              <ResponsiveContainer><BarChart data={data}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number, n) => (n === "value" ? inr(v) : v)} /><Bar dataKey="value" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No data yet.</p>}</CardContent></Card>
        );
      })}
    </div>
  );
}

function Locations({ tenantId, mode, rows }: { tenantId: string; mode: string; rows: Rec[] }) {
  const qc = useQueryClient();
  const locs = useQuery({ queryKey: ["tenant-locations", tenantId], queryFn: async () => (await supabase.from("tenant_locations").select("*").eq("tenant_id", tenantId).order("created_at")).data ?? [] });
  const [name, setName] = useState(""); const [city, setCity] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenant_locations").insert({ tenant_id: tenantId, name, city, kind: mode === "franchise" ? "Franchise" : "Location", royalty_pct: mode === "franchise" ? 6 : 0 } as never);
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setCity(""); qc.invalidateQueries({ queryKey: ["tenant-locations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => { const { error } = await supabase.from("tenant_locations").update(patch as never).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-locations"] }),
  });
  const stats = useMemo(() => groupBy(rows, "location"), [rows]);
  return (
    <div className="space-y-4">
      {mode === "single" && <p className="text-sm text-muted-foreground">You're on single-location mode. Add locations below or switch to multi-location / franchise from “Switch industry”.</p>}
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b">{["Location", "Type", "City", "Records", "Revenue", "Royalty %", "Royalty due", "Marketing fee"].map((h) => <th key={h} className="p-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{(locs.data ?? []).map((l: any) => {
            const s = stats.find((x) => x.name === l.name); const rev = s?.value ?? 0;
            return (
              <tr key={l.id} className="border-b">
                <td className="p-2 font-medium"><Building2 className="mr-1 inline h-3 w-3" />{l.name}</td><td className="p-2">{l.kind}</td><td className="p-2">{l.city ?? "—"}</td>
                <td className="p-2">{s?.count ?? 0}</td><td className="p-2">{inr(rev)}</td>
                <td className="p-2"><Input className="h-7 w-16" type="number" defaultValue={l.royalty_pct} onBlur={(e) => upd.mutate({ id: l.id, patch: { royalty_pct: Number(e.target.value) } })} /></td>
                <td className="p-2">{inr((rev * Number(l.royalty_pct)) / 100)}</td><td className="p-2">{inr((rev * Number(l.marketing_fee_pct)) / 100)}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {!locs.data?.length && <p className="p-4 text-sm text-muted-foreground">No locations yet.</p>}
      </CardContent></Card>
      <div className="flex flex-wrap gap-2"><Input className="w-48" placeholder="Location name" value={name} onChange={(e) => setName(e.target.value)} /><Input className="w-40" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="mr-1 h-4 w-4" />Add location</Button></div>
      <p className="text-xs text-muted-foreground">Revenue per location comes from each record's “location” field.</p>
    </div>
  );
}

function SetupTab({ ws }: { ws: Ws }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[["Modules", ws.modules], ["Roles", ws.roles], ["Integrations", ws.integrations]].map(([t, items]) => (
        <Card key={t as string}><CardHeader className="pb-2"><CardTitle className="text-sm">{t as string}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">{(items as string[]).map((i) => <Badge key={i} variant="secondary">{i}</Badge>)}</CardContent></Card>
      ))}
      <Card className="md:col-span-3"><CardContent className="p-4 text-sm text-muted-foreground">Stages, fields and AI agent prompts can be edited any time in <Link to="/settings-pack" className="text-primary underline">Pack Settings</Link>.</CardContent></Card>
    </div>
  );
}

function AddRecord({ tpl, tenantId }: { tpl: WorkspaceTemplate; tenantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const locs = useQuery({ queryKey: ["tenant-locations", tenantId], queryFn: async () => (await supabase.from("tenant_locations").select("name").eq("tenant_id", tenantId)).data ?? [] });
  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser(); const uid = auth.user?.id!;
      const fields: Record<string, unknown> = {};
      for (const fd of tpl.fields) if (form[fd.key]) fields[fd.key] = fd.type === "number" ? Number(form[fd.key]) : form[fd.key];
      if (form.location) fields.location = form.location;
      const stage = form.stage || tpl.stages[0]!;
      const { error } = await supabase.from("pack_records").insert({
        tenant_id: tenantId, group_slug: tpl.group, pack_slug: `tpl-${tpl.slug}`, title: form.name, contact_name: form.name, contact_phone: form.phone || null,
        stage, value: form.value ? Number(form.value) : null, source: form.source || null, fields, owner_id: uid, created_by: uid, currency: "INR",
        won: tpl.wonStages.includes(stage) ? true : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({}); qc.invalidateQueries({ queryKey: ["ws-records"] }); toast.success(`${tpl.recordLabel} added`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add {tpl.recordLabel.toLowerCase()}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New {tpl.recordLabel.toLowerCase()}</DialogTitle></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            <Input placeholder="Mobile" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            <Input placeholder={tpl.valueLabel} type="number" value={form.value ?? ""} onChange={(e) => set("value", e.target.value)} />
            <Select value={form.source ?? ""} onValueChange={(v) => set("source", v)}><SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger><SelectContent>{tpl.sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={form.stage ?? tpl.stages[0]} onValueChange={(v) => set("stage", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tpl.stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            {!!locs.data?.length && <Select value={form.location ?? ""} onValueChange={(v) => set("location", v)}><SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger><SelectContent>{locs.data.map((l: any) => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select>}
            {tpl.fields.map((fd) => fd.type === "select" ? (
              <Select key={fd.key} value={form[fd.key] ?? ""} onValueChange={(v) => set(fd.key, v)}><SelectTrigger><SelectValue placeholder={fd.label} /></SelectTrigger><SelectContent>{fd.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
            ) : (
              <div key={fd.key} className="space-y-0.5"><Label className="text-xs text-muted-foreground">{fd.label}</Label>
                <Input type={fd.type === "number" ? "number" : fd.type === "date" ? "date" : "text"} value={form[fd.key] ?? ""} onChange={(e) => set(fd.key, e.target.value)} /></div>
            ))}
          </div>
          <Button disabled={!form.name?.trim() || save.isPending} onClick={() => save.mutate()}>Save</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
