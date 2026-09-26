import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useRe, useReAi, cr } from "@/lib/re-data";
import { Md } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/realestate/analytics")({
  head: () => ({ meta: [{ title: "Analytics360 & Sales Copilot | Real Estate CRM" }, { name: "description", content: "Funnel, source ROI, team scorecards, lost reasons, forecast and AI copilot." }] }),
  component: AnalyticsPage,
});

const BOOKED = ["token_paid", "booking", "agreement", "registration", "closed_won"];
const SUGGEST = ["Which leads should I call first?", "Show me all hot leads.", "Which leads haven't been contacted in 3 days?", "Why are bookings down this month?", "Which projects have the highest unsold inventory?", "Which teams have leads without follow-up?"];

function AnalyticsPage() {
  const ai = useReAi();
  const { data: leads = [] } = useRe("re_clients", "id, source, temperature, status, lost_reason, assigned_team, last_contacted_at, created_at");
  const { data: deals = [] } = useRe("re_deals", "id, client_id, stage, expected_value, final_value, updated_at");
  const { data: visits = [] } = useRe("re_site_visits", "client_id, status");
  const { data: pays = [] } = useRe("re_payment_schedule", "amount, paid_amount, due_date");
  const { data: fus = [] } = useRe("re_followups", "client_id, done, due_at");
  const { data: comms = [] } = useRe("re_commissions", "amount");
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [forecast, setForecast] = useState("");

  const visited = new Set(visits.filter((v: any) => v.status === "Completed").map((v: any) => v.client_id));
  const bookedDeals = deals.filter((d: any) => BOOKED.includes(d.stage));
  const booked = new Set(bookedDeals.map((d: any) => d.client_id));
  const registered = deals.filter((d: any) => ["registration", "closed_won"].includes(d.stage)).length;
  const bookingValue = bookedDeals.reduce((a: number, d: any) => a + Number(d.final_value || d.expected_value || 0), 0);
  const collected = pays.reduce((a: number, p: any) => a + Number(p.paid_amount), 0);
  const outstanding = pays.reduce((a: number, p: any) => a + Number(p.amount) - Number(p.paid_amount), 0);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const today = new Date().toDateString();

  const kpis: [string, string | number][] = [
    ["Total leads", leads.length], ["New today", leads.filter((l: any) => new Date(l.created_at).toDateString() === today).length],
    ["Hot leads", leads.filter((l: any) => l.temperature === "Hot").length], ["Site visits done", visited.size],
    ["Bookings", bookedDeals.length], ["Booking value", cr(bookingValue)], ["Collected", cr(collected)], ["Outstanding", cr(outstanding)],
    ["Brokerage payable", cr(comms.reduce((a: number, c: any) => a + Number(c.amount), 0))],
    ["Lead → visit", pct(visited.size, leads.length)], ["Visit → booking", pct([...booked].filter((c) => visited.has(c)).length, visited.size)],
    ["Booking → registration", pct(registered, bookedDeals.length)], ["Avg deal value", cr(bookedDeals.length ? bookingValue / bookedDeals.length : 0)],
  ];

  const bySource = Object.entries(leads.reduce((m: any, l: any) => { const s = l.source ?? "Unknown"; m[s] ??= { leads: 0, visits: 0, bookings: 0, revenue: 0 }; m[s].leads++; if (visited.has(l.id)) m[s].visits++; const d = bookedDeals.find((x: any) => x.client_id === l.id); if (d) { m[s].bookings++; m[s].revenue += Number(d.final_value || d.expected_value || 0); } return m; }, {})).sort((a: any, b: any) => b[1].revenue - a[1].revenue);
  const byTeam = Object.entries(leads.reduce((m: any, l: any) => { const t = l.assigned_team ?? "Unassigned"; m[t] ??= { leads: 0, contacted: 0, overdue: 0, bookings: 0 }; m[t].leads++; if (l.last_contacted_at) m[t].contacted++; if (fus.some((f: any) => f.client_id === l.id && !f.done && new Date(f.due_at) < new Date())) m[t].overdue++; if (booked.has(l.id)) m[t].bookings++; return m; }, {}));
  const lost = Object.entries(leads.filter((l: any) => l.status === "Lost").reduce((m: any, l: any) => { m[l.lost_reason ?? "Unspecified"] = (m[l.lost_reason ?? "Unspecified"] ?? 0) + 1; return m; }, {})).map(([name, value]) => ({ name, value }));
  const funnel = [{ name: "Leads", value: leads.length }, { name: "Visited", value: visited.size }, { name: "Negotiation", value: deals.filter((d: any) => d.stage === "negotiation").length + bookedDeals.length }, { name: "Booked", value: bookedDeals.length }, { name: "Registered", value: registered }];

  const ask = async (question = q) => { if (!question.trim()) return; const r = await ai.run({ mode: "copilot", question }); if (r) setLog([{ q: question, a: r.text }, ...log]); setQ(""); };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">{kpis.map(([k, v]) => <Card key={k}><CardContent className="p-3"><div className="text-[11px] text-muted-foreground">{k}</div><div className="text-lg font-bold">{v}</div></CardContent></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Lead funnel</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer><BarChart data={funnel}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Lost lead reasons</CardTitle></CardHeader><CardContent className="h-64">{lost.length ? <ResponsiveContainer><BarChart data={lost} layout="vertical"><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" width={110} fontSize={12} /><Tooltip /><Bar dataKey="value" fill="var(--color-destructive)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <div className="text-sm text-muted-foreground">No lost leads recorded</div>}</CardContent></Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Source performance</CardTitle><CardDescription>Add ad spend per source to see CPL/CAC/ROAS — spend is not tracked yet.</CardDescription></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Leads</TableHead><TableHead>Visits</TableHead><TableHead>Bookings</TableHead><TableHead>Revenue</TableHead><TableHead>Lead → booking</TableHead></TableRow></TableHeader>
          <TableBody>{bySource.map(([s, v]: any) => <TableRow key={s}><TableCell>{s}</TableCell><TableCell>{v.leads}</TableCell><TableCell>{v.visits}</TableCell><TableCell>{v.bookings}</TableCell><TableCell>{cr(v.revenue)}</TableCell><TableCell>{pct(v.bookings, v.leads)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Team scorecard</CardTitle></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>Team</TableHead><TableHead>Leads</TableHead><TableHead>Contact rate</TableHead><TableHead>Overdue follow-ups</TableHead><TableHead>Bookings</TableHead><TableHead>Conversion</TableHead></TableRow></TableHeader>
          <TableBody>{byTeam.map(([t, v]: any) => <TableRow key={t}><TableCell>{t}</TableCell><TableCell>{v.leads}</TableCell><TableCell>{pct(v.contacted, v.leads)}</TableCell><TableCell>{v.overdue}</TableCell><TableCell>{v.bookings}</TableCell><TableCell>{pct(v.bookings, v.leads)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">AI sales forecast</CardTitle><CardDescription>An estimate based on your pipeline — not a guarantee.</CardDescription></CardHeader>
          <CardContent className="space-y-2"><Button size="sm" onClick={async () => { const r = await ai.run({ mode: "forecast" }); if (r) setForecast(r.text); }} disabled={ai.loading}>{ai.loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />}Generate forecast</Button>{forecast && <Md text={forecast} />}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Sales & management copilot</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your leads, visits, inventory or collections" />
            <div className="flex flex-wrap gap-1">{SUGGEST.map((s) => <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={ai.loading}>{s}</Button>)}</div>
            <Button size="sm" onClick={() => ask()} disabled={ai.loading}>{ai.loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}Ask</Button>
            {log.map((l, i) => <div key={i} className="border-t pt-2"><div className="font-medium text-sm">{l.q}</div><Md text={l.a} /></div>)}
          </CardContent></Card>
      </div>
    </div>
  );
}
