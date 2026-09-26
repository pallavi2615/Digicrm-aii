import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCollections, useOrders, usePartners, useProducts, useTargets, outstandingMap, lakh, inr } from "@/lib/dist-data";
import { AiButton, Md, parseJson, useDistAi } from "@/components/dist-ai";
import { CreatorSendButtons } from "@/components/creator-send-buttons";

export const Route = createFileRoute("/_authenticated/distribution/")({
  head: () => ({ meta: [{ title: "HQ Dashboard | DigiDistribution AI" }, { name: "description", content: "Network revenue, targets, collections, stock risk and the daily AI briefing." }] }),
  component: Hq,
});

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</CardContent></Card>;
}

function Hq() {
  const partners = usePartners().data ?? [];
  const orders = useOrders().data ?? [];
  const products = useProducts().data ?? [];
  const cols = useCollections().data ?? [];
  const targets = useTargets().data ?? [];
  const ai = useDistAi();
  const agent = useDistAi();
  const [brief, setBrief] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);

  const s = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const live = orders.filter((o) => o.status !== "Cancelled");
    const mtd = live.filter((o) => o.order_date.startsWith(month)).reduce((a, o) => a + Number(o.total), 0);
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const yday = live.filter((o) => o.order_date === yest).reduce((a, o) => a + Number(o.total), 0);
    const companyTarget = targets.filter((t) => t.scope === "Company" && t.period_start <= today && t.period_end >= today).reduce((a, t) => a + Number(t.target), 0);
    const day = new Date().getDate(); const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const forecast = day ? (mtd / day) * dim : 0;
    const om = outstandingMap(orders, cols);
    const outstanding = Object.values(om).reduce((a, r) => a + Math.max(0, r.billed - r.paid), 0);
    const overdue = partners.filter((p) => { const r = om[p.id]; return r && r.billed - r.paid > 0 && r.oldestUnpaid && (Date.now() - new Date(r.oldestUnpaid).getTime()) / 864e5 > p.payment_terms_days; });
    const lastOrder: Record<string, string> = {};
    live.forEach((o) => { if (o.partner_id && (!lastOrder[o.partner_id] || o.order_date > lastOrder[o.partner_id])) lastOrder[o.partner_id] = o.order_date; });
    const dormant = partners.filter((p) => p.onboarding_stage === "Active" && (!lastOrder[p.id] || (Date.now() - new Date(lastOrder[p.id]).getTime()) / 864e5 > 30));
    const stockRisk = products.filter((p) => p.daily_run_rate > 0 && p.stock / p.daily_run_rate < 7);
    const byTerritory: Record<string, number> = {};
    live.filter((o) => o.order_date.startsWith(month)).forEach((o) => { const p = partners.find((x) => x.id === o.partner_id); const k = p?.territory || p?.city || "Unassigned"; byTerritory[k] = (byTerritory[k] ?? 0) + Number(o.total); });
    const top = Object.entries(
      live.reduce((m: Record<string, number>, o) => { const n = o.dist_partners?.name ?? "—"; m[n] = (m[n] ?? 0) + Number(o.total); return m; }, {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { mtd, yday, companyTarget, forecast, outstanding, overdue, dormant, stockRisk, byTerritory: Object.entries(byTerritory).map(([name, v]) => ({ name, v })), top };
  }, [orders, partners, products, cols, targets]);

  const counts = ["Super Distributor", "Distributor", "Dealer", "Retailer"].map((l) => `${partners.filter((p) => p.level === l).length} ${l}s`).join(" · ");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{counts}</p>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Revenue yesterday" value={lakh(s.yday)} />
        <Kpi label="MTD revenue" value={lakh(s.mtd)} />
        <Kpi label="Company target" value={s.companyTarget ? lakh(s.companyTarget) : "—"} sub={s.companyTarget ? `${Math.round((s.mtd / s.companyTarget) * 100)}% achieved` : "Set on Schemes & Targets"} />
        <Kpi label="Month-end forecast" value={lakh(s.forecast)} sub="at current run rate" />
        <Kpi label="Outstanding" value={lakh(s.outstanding)} sub={`${s.overdue.length} partners overdue`} />
        <Kpi label="Dormant outlets" value={String(s.dormant.length)} sub="no order in 30 days" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between"><div><CardTitle className="text-base">Daily AI briefing</CardTitle><CardDescription>Distribution Intelligence from your live data</CardDescription></div>
            <AiButton loading={ai.loading} onClick={async () => setBrief(await ai.run({ mode: "briefing" }))}>Generate</AiButton></CardHeader>
          <CardContent>{brief ? <Md text={brief} /> : <p className="text-sm text-muted-foreground">Click Generate for today's headline numbers, risks and recommended actions.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">MTD revenue by territory</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={s.byTerritory}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => lakh(v)} /><Tooltip formatter={(v: any) => inr(v)} /><Bar dataKey="v" fill="var(--primary)" /></BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between"><div><CardTitle className="text-base">AI Sales Agent — who to contact today</CardTitle><CardDescription>Dormant, slowing and overdue partners with a ready WhatsApp draft. Nothing is sent without you.</CardDescription></div>
          <AiButton loading={agent.loading} onClick={async () => setContacts(parseJson(await agent.run({ mode: "sales_agent" }), { contacts: [] as any[] }).contacts)}>Build list</AiButton></CardHeader>
        <CardContent>
          {contacts.length ? (
            <Table><TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Last order</TableHead><TableHead>Potential</TableHead><TableHead>Action</TableHead><TableHead>Draft</TableHead></TableRow></TableHeader>
              <TableBody>{contacts.map((c, i) => {
                const p = partners.find((x) => x.name === c.name);
                return (
                  <TableRow key={i}><TableCell className="font-medium">{c.name}<div className="text-xs text-muted-foreground">{c.reason}</div></TableCell>
                    <TableCell>{c.last_order ?? "Never"}</TableCell><TableCell><Badge variant={c.potential === "High" ? "default" : "secondary"}>{c.potential}</Badge></TableCell><TableCell>{c.action}</TableCell>
                    <TableCell className="max-w-sm"><div className="text-xs mb-1">{c.message}</div><CreatorSendButtons text={c.message} phone={p?.phone} email={p?.email} subject="Order reminder" /></TableCell></TableRow>
                );
              })}</TableBody></Table>
          ) : <p className="text-sm text-muted-foreground">Click Build list to get today's priority contacts.</p>}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Top partners (60 days)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">{s.top.map(([n, v]) => <div key={n} className="flex justify-between"><span>{n}</span><span className="font-medium">{lakh(v)}</span></div>)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Stock-out risk (&lt; 7 days)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">{s.stockRisk.length ? s.stockRisk.map((p) => <div key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-destructive">{Math.round(p.stock / p.daily_run_rate)} days</span></div>) : <span className="text-muted-foreground">No risk</span>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Overdue partners</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">{s.overdue.length ? s.overdue.map((p) => <div key={p.id}>{p.name} <span className="text-xs text-muted-foreground">({p.level})</span></div>) : <span className="text-muted-foreground">None</span>}</CardContent></Card>
      </div>
    </div>
  );
}
