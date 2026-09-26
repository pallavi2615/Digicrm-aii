import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Sparkles, Building2, Handshake, AlarmClock, Receipt, TrendingUp, RefreshCw, CheckCircle2, CalendarClock } from "lucide-react";
import { useBrands, useDeals, useDeliverables, useInvoices, useCreatorAi } from "@/lib/creator-data";
import { BOOKED_STAGES, NEGOTIATION_STAGES, invoiceTotal, isOverdue, lakh, todayISO } from "@/lib/creator";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/")({
  head: () => ({ meta: [{ title: "Creator Dashboard | DigiCRM AI" }, { name: "description", content: "Sponsorship revenue, deals, deliverables, invoices and renewals at a glance." }] }),
  component: CreatorDashboard,
});

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card><CardContent className="p-4 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </div>
      <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-4 w-4" /></div>
    </CardContent></Card>
  );
}

function CreatorDashboard() {
  const deals = useDeals();
  const brands = useBrands();
  const invoices = useInvoices();
  const dels = useDeliverables();
  const ai = useCreatorAi();
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const v = useMemo(() => {
    const d = deals.data ?? [];
    const inv = invoices.data ?? [];
    const dl = dels.data ?? [];
    const today = todayISO();
    const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const monthStart = today.slice(0, 8) + "01";
    const active = d.filter((x) => !["Paid", "New Lead"].includes(x.stage));
    const paidInv = inv.filter((i) => i.status === "Paid");
    const byPlatform = new Map<string, number>();
    const byBrand = new Map<string, number>();
    for (const x of d.filter((x) => BOOKED_STAGES.has(x.stage))) {
      byPlatform.set(x.platform ?? "Other", (byPlatform.get(x.platform ?? "Other") ?? 0) + Number(x.value));
      const b = x.creator_brands?.name ?? "Unknown";
      byBrand.set(b, (byBrand.get(b) ?? 0) + Number(x.value));
    }
    return {
      totalBrands: (brands.data ?? []).length,
      activeBrands: new Set(active.map((x) => x.brand_id).filter(Boolean)).size,
      newEnquiries: d.filter((x) => x.stage === "New Lead").length,
      negotiating: d.filter((x) => NEGOTIATION_STAGES.has(x.stage)).length,
      confirmed: d.filter((x) => BOOKED_STAGES.has(x.stage)).length,
      activeValue: active.reduce((n, x) => n + Number(x.value), 0),
      upcoming: dl.filter((x) => x.status !== "Published" && x.due_date && x.due_date >= today && x.due_date <= in7).length,
      pendingApprovals: dl.filter((x) => x.status === "Submitted").length,
      pendingInvoices: inv.filter((i) => ["Draft", "Sent", "Viewed", "Partially Paid"].includes(i.status)).length,
      overdue: inv.filter(isOverdue),
      paidMonth: paidInv.filter((i) => (i.paid_at ?? "") >= monthStart).reduce((n, i) => n + Number(i.paid_amount || invoiceTotal(i)), 0),
      paidYear: paidInv.filter((i) => (i.paid_at ?? "") >= yearStart).reduce((n, i) => n + Number(i.paid_amount || invoiceTotal(i)), 0),
      expected: d.filter((x) => x.stage !== "Paid").reduce((n, x) => n + Number(x.value) * (x.probability / 100), 0),
      renewals: d.filter((x) => x.stage === "Renewal" || (x.end_date && x.end_date >= today && x.end_date <= in30)),
      followUps: d.filter((x) => x.next_action_at && x.next_action_at <= today && x.stage !== "Paid"),
      platform: [...byPlatform].map(([name, value]) => ({ name, value })),
      brand: [...byBrand].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    };
  }, [deals.data, brands.data, invoices.data, dels.data]);

  const runSummary = async () => {
    setBusy(true);
    try {
      setSummary(await ai({ mode: "ask", question: "Give me a 3-sentence executive summary: active deals and value, overdue payments, deliverables due this week, renewals due, then the top 3 things I should do today." }));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (deals.isLoading) return <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm flex-1 whitespace-pre-wrap">
            {summary || `You have ${v.confirmed + v.negotiating} live deals worth ${lakh(v.activeValue)}. ${v.overdue.length} payments are overdue, ${v.upcoming} deliverables are due this week, and ${v.renewals.length} brands are due for renewal.`}
          </p>
          <Button size="sm" variant="outline" onClick={runSummary} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}AI summary
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Brands" value={String(v.totalBrands)} hint={`${v.activeBrands} active relationships`} icon={Building2} />
        <Kpi label="New enquiries" value={String(v.newEnquiries)} icon={Handshake} />
        <Kpi label="In negotiation" value={String(v.negotiating)} icon={TrendingUp} />
        <Kpi label="Confirmed deals" value={String(v.confirmed)} icon={CheckCircle2} />
        <Kpi label="Deliverables this week" value={String(v.upcoming)} hint={`${v.pendingApprovals} awaiting brand approval`} icon={CalendarClock} />
        <Kpi label="Pending invoices" value={String(v.pendingInvoices)} hint={`${v.overdue.length} overdue`} icon={Receipt} />
        <Kpi label="Paid this month" value={lakh(v.paidMonth)} icon={Receipt} />
        <Kpi label="Paid this year" value={lakh(v.paidYear)} icon={Receipt} />
        <Kpi label="Expected revenue" value={lakh(v.expected)} hint="weighted by probability" icon={TrendingUp} />
        <Kpi label="Renewals due" value={String(v.renewals.length)} icon={RefreshCw} />
        <Kpi label="Follow-ups due" value={String(v.followUps.length)} icon={AlarmClock} />
        <Kpi label="Overdue" value={lakh(v.overdue.reduce((n, i) => n + invoiceTotal(i) - Number(i.paid_amount), 0))} icon={AlarmClock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Revenue by platform</CardTitle><CardDescription>Booked deals</CardDescription></CardHeader>
          <CardContent><div className="h-60"><ResponsiveContainer>
            <BarChart data={v.platform}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={(n) => `${Math.round(n / 1000)}k`} />
              <Tooltip formatter={(n) => lakh(Number(n))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="value" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Revenue by brand</CardTitle><CardDescription>Top 8 booked</CardDescription></CardHeader>
          <CardContent><div className="h-60"><ResponsiveContainer>
            <BarChart data={v.brand} layout="vertical"><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" fontSize={11} tickFormatter={(n) => `${Math.round(n / 1000)}k`} /><YAxis type="category" dataKey="name" width={100} fontSize={11} />
              <Tooltip formatter={(n) => lakh(Number(n))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="value" fill="var(--color-chart-3)" radius={[0, 6, 6, 0]} /></BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <ListCard title="Follow-ups due today" empty="Nothing due. Nice." items={v.followUps.map((d) => ({ id: d.id, title: d.campaign, sub: `${d.creator_brands?.name ?? ""} · ${d.next_action ?? "Follow up"}`, badge: d.stage }))} />
        <ListCard title="Renewal opportunities" empty="No campaigns ending in the next 30 days." items={v.renewals.map((d) => ({ id: d.id, title: d.campaign, sub: `${d.creator_brands?.name ?? ""} · ends ${d.end_date ?? "—"}`, badge: lakh(Number(d.value)) }))} />
      </div>
    </div>
  );
}

function ListCard({ title, items, empty }: { title: string; empty: string; items: { id: string; title: string; sub: string; badge: string }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {items.slice(0, 8).map((i) => (
          <Link key={i.id} to="/creator/deal/$id" params={{ id: i.id }} className="flex items-center justify-between rounded-md border p-2.5 text-sm hover:bg-muted/50">
            <div className="min-w-0"><p className="font-medium truncate">{i.title}</p><p className="text-xs text-muted-foreground truncate">{i.sub}</p></div>
            <Badge variant="outline">{i.badge}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
