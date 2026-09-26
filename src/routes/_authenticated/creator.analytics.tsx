import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDeals, useInvoices, useProfiles } from "@/lib/creator-data";
import { BOOKED_STAGES, inr, lakh } from "@/lib/creator";

export const Route = createFileRoute("/_authenticated/creator/analytics")({
  head: () => ({ meta: [{ title: "Creator Analytics | DigiCRM AI" }, { name: "description", content: "Win rate, revenue by brand and platform, brand scorecards and roster performance." }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const deals = useDeals();
  const invs = useInvoices();
  const profiles = useProfiles();

  const v = useMemo(() => {
    const d = deals.data ?? [];
    const won = d.filter((x) => BOOKED_STAGES.has(x.stage));
    const decided = d.filter((x) => BOOKED_STAGES.has(x.stage) || x.stage === "New Lead" && false);
    const winRate = d.length ? Math.round((won.length / d.length) * 100) : 0;
    const group = (key: (x: (typeof d)[number]) => string) => {
      const m = new Map<string, { name: string; deals: number; won: number; revenue: number }>();
      for (const x of d) { const k = key(x); const r = m.get(k) ?? { name: k, deals: 0, won: 0, revenue: 0 }; r.deals++; if (BOOKED_STAGES.has(x.stage)) { r.won++; r.revenue += Number(x.value); } m.set(k, r); }
      return [...m.values()].sort((a, b) => b.revenue - a.revenue);
    };
    const paidByBrand = new Map<string, { paid: number; late: number; count: number }>();
    for (const i of invs.data ?? []) {
      const k = i.creator_deals?.creator_brands?.name ?? "—";
      const r = paidByBrand.get(k) ?? { paid: 0, late: 0, count: 0 };
      r.count++; r.paid += Number(i.paid_amount);
      if (i.paid_at && i.due_date && i.paid_at > i.due_date) r.late++;
      paidByBrand.set(k, r);
    }
    const brands = group((x) => x.creator_brands?.name ?? "No brand").map((b) => {
      const p = paidByBrand.get(b.name);
      const score = Math.min(100, Math.round(b.won * 15 + b.revenue / 20000 - (p?.late ?? 0) * 10 + (b.deals ? (b.won / b.deals) * 30 : 0)));
      return { ...b, paid: p?.paid ?? 0, late: p?.late ?? 0, score: Math.max(0, score) };
    });
    const cycle = won.filter((x) => x.start_date).map((x) => (new Date(x.start_date!).getTime() - new Date(x.created_at).getTime()) / 864e5).filter((n) => n >= 0);
    return {
      winRate, decided, total: d.length, wonCount: won.length,
      avgDeal: won.length ? won.reduce((n, x) => n + Number(x.value), 0) / won.length : 0,
      cycle: cycle.length ? Math.round(cycle.reduce((a, b) => a + b, 0) / cycle.length) : null,
      platforms: group((x) => x.platform ?? "Unspecified"),
      sources: group((x) => x.source ?? "Manual"),
      creators: group((x) => x.creator_profiles?.display_name ?? "Unassigned"),
      brands,
    };
  }, [deals.data, invs.data]);

  const commission = (name: string) => Number((profiles.data ?? []).find((p) => p.display_name === name)?.agency_commission_pct ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Win rate", `${v.winRate}%`], ["Deals won", `${v.wonCount} / ${v.total}`], ["Avg deal", lakh(v.avgDeal)], ["Avg days to start", v.cycle ?? "—"]].map(([l, n]) => (
          <Card key={l as string}><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="text-lg font-bold">{n}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[["Revenue by platform", v.platforms], ["Revenue by lead source", v.sources]].map(([t, data]) => (
          <Card key={t as string}><CardHeader className="pb-2"><CardTitle className="text-base">{t as string}</CardTitle></CardHeader>
            <CardContent><div className="h-56"><ResponsiveContainer>
              <BarChart data={data as { name: string; revenue: number }[]}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={(n) => `${Math.round(n / 1000)}k`} />
                <Tooltip formatter={(n) => inr(Number(n))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer></div></CardContent></Card>
        ))}
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Brand scorecards</CardTitle></CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Deals</TableHead><TableHead>Won</TableHead><TableHead>Booked</TableHead><TableHead>Paid</TableHead><TableHead>Late payments</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
          <TableBody>{v.brands.map((b) => (
            <TableRow key={b.name}><TableCell className="font-medium">{b.name}</TableCell><TableCell>{b.deals}</TableCell><TableCell>{b.won}</TableCell><TableCell>{inr(b.revenue)}</TableCell><TableCell>{inr(b.paid)}</TableCell><TableCell>{b.late}</TableCell><TableCell className="font-semibold">{b.score}</TableCell></TableRow>
          ))}</TableBody></Table></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Roster performance & agency commission</CardTitle></CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Creator</TableHead><TableHead>Deals</TableHead><TableHead>Won</TableHead><TableHead>Booked</TableHead><TableHead>Agency %</TableHead><TableHead>Agency earns</TableHead></TableRow></TableHeader>
          <TableBody>{v.creators.map((c) => (
            <TableRow key={c.name}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.deals}</TableCell><TableCell>{c.won}</TableCell><TableCell>{inr(c.revenue)}</TableCell><TableCell>{commission(c.name)}%</TableCell><TableCell>{inr(c.revenue * commission(c.name) / 100)}</TableCell></TableRow>
          ))}</TableBody></Table></CardContent></Card>
    </div>
  );
}
