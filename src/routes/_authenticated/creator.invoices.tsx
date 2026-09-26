import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDeals, useInvoices, useProfiles } from "@/lib/creator-data";
import { BOOKED_STAGES, INVOICE_STATUSES, invoiceTotal, isOverdue, lakh, inr } from "@/lib/creator";
import { Pick } from "@/components/creator-deal-dialog";

export const Route = createFileRoute("/_authenticated/creator/invoices")({
  head: () => ({ meta: [{ title: "Invoices & Revenue | DigiCRM AI" }, { name: "description", content: "Booked, earned, paid and outstanding sponsorship revenue with agency commission." }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const invoices = useInvoices();
  const deals = useDeals();
  const profiles = useProfiles();
  const [status, setStatus] = useState("All");

  const v = useMemo(() => {
    const inv = invoices.data ?? [];
    const d = deals.data ?? [];
    const booked = d.filter((x) => BOOKED_STAGES.has(x.stage));
    const months = Array.from({ length: 12 }, (_, i) => {
      const dt = new Date(); dt.setMonth(dt.getMonth() - (11 - i));
      return { key: dt.toISOString().slice(0, 7), label: dt.toLocaleString("en", { month: "short" }), paid: 0, booked: 0 };
    });
    for (const i of inv) if (i.paid_at) { const m = months.find((x) => x.key === i.paid_at!.slice(0, 7)); if (m) m.paid += Number(i.paid_amount); }
    for (const x of booked) { const m = months.find((y) => y.key === (x.start_date ?? x.created_at).slice(0, 7)); if (m) m.booked += Number(x.value); }
    const byCreator = new Map<string, { revenue: number; commission: number }>();
    for (const x of booked) {
      const k = x.creator_profiles?.display_name ?? "Unassigned";
      const c = byCreator.get(k) ?? { revenue: 0, commission: 0 };
      c.revenue += Number(x.value); c.commission += Number(x.value) * Number(x.commission_pct) / 100;
      byCreator.set(k, c);
    }
    return {
      booked: booked.reduce((n, x) => n + Number(x.value), 0),
      earned: d.filter((x) => ["Published", "Invoice Sent", "Payment Pending", "Paid"].includes(x.stage)).reduce((n, x) => n + Number(x.value), 0),
      paid: inv.reduce((n, i) => n + Number(i.paid_amount), 0),
      outstanding: inv.filter((i) => i.status !== "Paid").reduce((n, i) => n + invoiceTotal(i) - Number(i.paid_amount), 0),
      overdue: inv.filter(isOverdue).reduce((n, i) => n + invoiceTotal(i) - Number(i.paid_amount), 0),
      forecast: d.filter((x) => !BOOKED_STAGES.has(x.stage) && x.stage !== "Paid").reduce((n, x) => n + Number(x.value) * x.probability / 100, 0),
      avgDeal: booked.length ? booked.reduce((n, x) => n + Number(x.value), 0) / booked.length : 0,
      months, byCreator: [...byCreator].map(([name, c]) => ({ name, ...c })),
    };
  }, [invoices.data, deals.data]);

  const rows = (invoices.data ?? []).filter((i) => status === "All" || (status === "Overdue" ? isOverdue(i) : i.status === status));
  const isAgency = (profiles.data ?? []).length > 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[["Booked", v.booked], ["Earned", v.earned], ["Paid", v.paid], ["Outstanding", v.outstanding], ["Overdue", v.overdue], ["Forecast", v.forecast], ["Avg deal", v.avgDeal]].map(([l, n]) => (
          <Card key={l as string}><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="text-lg font-bold">{lakh(n as number)}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-base">Booked vs paid, last 12 months</CardTitle></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer>
            <BarChart data={v.months}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} tickFormatter={(n) => `${Math.round(n / 1000)}k`} />
              <Tooltip formatter={(n) => inr(Number(n))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="booked" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} /><Bar dataKey="paid" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">{isAgency ? "Roster revenue & commission" : "Revenue by creator"}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {v.byCreator.map((c) => (
              <div key={c.name} className="flex justify-between text-sm border rounded p-2"><span>{c.name}</span><span className="text-right">{lakh(c.revenue)}<br /><span className="text-xs text-muted-foreground">commission {lakh(c.commission)}</span></span></div>
            ))}
            {v.byCreator.length === 0 && <p className="text-sm text-muted-foreground">No booked deals yet.</p>}
          </CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-base">Invoices</CardTitle>
          <div className="w-44"><Pick label="" value={status} onChange={setStatus} options={["All", ...INVOICE_STATUSES]} /></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Brand</TableHead><TableHead>Campaign</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No invoices. Generate one from a deal.</TableCell></TableRow>}
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><Link to="/creator/deal/$id" params={{ id: i.deal_id }} className="font-medium hover:underline">{i.number}</Link></TableCell>
                  <TableCell>{i.creator_deals?.creator_brands?.name ?? "—"}</TableCell>
                  <TableCell>{i.creator_deals?.campaign}</TableCell>
                  <TableCell>{inr(invoiceTotal(i))}</TableCell>
                  <TableCell>{inr(Number(i.paid_amount))}</TableCell>
                  <TableCell className={isOverdue(i) ? "text-destructive" : ""}>{i.due_date}</TableCell>
                  <TableCell><Badge variant={i.status === "Paid" ? "default" : isOverdue(i) ? "destructive" : "outline"}>{isOverdue(i) ? "Overdue" : i.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
