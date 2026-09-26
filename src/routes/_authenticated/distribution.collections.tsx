import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { distDb, inr, lakh, outstandingMap, useCollections, useInvalidateDist, useOrders, usePartners } from "@/lib/dist-data";
import { CreatorSendButtons } from "@/components/creator-send-buttons";

export const Route = createFileRoute("/_authenticated/distribution/collections")({
  head: () => ({ meta: [{ title: "Credit & Collections | DigiDistribution AI" }, { name: "description", content: "Credit limits, outstanding, overdue days, risk and collection recording." }] }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const partners = usePartners().data ?? [];
  const orders = useOrders().data ?? [];
  const cols = useCollections().data ?? [];
  const inv = useInvalidateDist();
  const [f, setF] = useState({ partner_id: "", amount: "", method: "UPI", reference: "", collected_by: "" });
  const om = useMemo(() => outstandingMap(orders, cols), [orders, cols]);

  const rows = partners.map((p) => {
    const r = om[p.id] ?? { billed: 0, paid: 0, oldestUnpaid: null };
    const out = Math.max(0, r.billed - r.paid);
    const days = out > 0 && r.oldestUnpaid ? Math.floor((Date.now() - new Date(r.oldestUnpaid).getTime()) / 864e5) : 0;
    const overdue = days > p.payment_terms_days;
    const util = p.credit_limit ? out / p.credit_limit : 0;
    const risk = overdue && (util > 0.8 || days > p.payment_terms_days + 30) ? "High" : overdue || util > 0.8 ? "Medium" : "Low";
    return { p, out, days, overdue, util, risk };
  }).filter((r) => r.out > 0 || r.p.credit_limit > 0).sort((a, b) => b.out - a.out);

  const today = new Date().toISOString().slice(0, 10);
  const collectedToday = cols.filter((c) => c.collected_on === today).reduce((a, c) => a + Number(c.amount), 0);
  const totalOut = rows.reduce((a, r) => a + r.out, 0);
  const overdueAmt = rows.filter((r) => r.overdue).reduce((a, r) => a + r.out, 0);

  const record = async () => {
    if (!f.partner_id || !+f.amount) return toast.error("Partner and amount required");
    const { error } = await distDb.from("dist_collections").insert({ ...f, amount: +f.amount });
    if (error) return toast.error(error.message);
    toast.success("Collection recorded"); setF({ ...f, amount: "", reference: "" }); inv();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Total outstanding", lakh(totalOut)], ["Overdue", lakh(overdueAmt)], ["Collected today", lakh(collectedToday)], ["High-risk accounts", String(rows.filter((r) => r.risk === "High").length)]].map(([l, v]) => (
          <Card key={l}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Record a collection</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-6 gap-2">
          <Select value={f.partner_id} onValueChange={(v) => setF({ ...f, partner_id: v })}><SelectTrigger className="md:col-span-2"><SelectValue placeholder="Partner" /></SelectTrigger>
            <SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          <Input type="number" placeholder="Amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["UPI", "Cash", "Cheque", "NEFT/RTGS"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Reference / UTR" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          <Button onClick={record}>Record</Button>
        </CardContent></Card>
      <PendingPayments />
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Priority collection list</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Partner</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Credit used</TableHead><TableHead>Days</TableHead><TableHead>Risk</TableHead><TableHead>Reminder</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const text = `Namaste ${r.p.owner_name || r.p.name}, aapka ${inr(r.out)} outstanding hai (${r.days} din). Kripya jaldi payment kar dein. Dhanyavaad.`;
                return (
                  <TableRow key={r.p.id}>
                    <TableCell>{r.p.name}<div className="text-xs text-muted-foreground">{r.p.level} · {r.p.payment_terms_days}-day terms</div></TableCell>
                    <TableCell className="text-right font-medium">{inr(r.out)}</TableCell>
                    <TableCell>{r.p.credit_limit ? `${Math.round(r.util * 100)}% of ${lakh(r.p.credit_limit)}` : "—"}</TableCell>
                    <TableCell className={r.overdue ? "text-destructive" : ""}>{r.days}</TableCell>
                    <TableCell><Badge variant={r.risk === "High" ? "destructive" : r.risk === "Medium" ? "secondary" : "outline"}>{r.risk}</Badge></TableCell>
                    <TableCell>{r.out > 0 && <CreatorSendButtons text={text} phone={r.p.phone} email={r.p.email} subject="Payment reminder" />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
    </div>
  );
}

function PendingPayments() {
  const cols = useCollections().data ?? [];
  const inv = useInvalidateDist();
  const pending = cols.filter((c: any) => c.status === "Pending");
  if (!pending.length) return null;
  const decide = async (c: any, ok: boolean) => {
    const { error } = ok ? await distDb.from("dist_collections").update({ status: "Confirmed", collected_by: "Confirmed by HQ" }).eq("id", c.id) : await distDb.from("dist_collections").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(ok ? "Payment confirmed" : "Payment rejected"); inv();
  };
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base">Payments reported by distributors ({pending.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2">{pending.map((c: any) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 border rounded-md p-2 text-sm">
          <span className="font-medium">{c.dist_partners?.name}</span><span>{lakh(Number(c.amount))}</span><span className="text-xs text-muted-foreground">{c.method} · {c.reference ?? "no ref"} · {c.collected_on}</span>
          <div className="ml-auto flex gap-1"><Button size="sm" onClick={() => decide(c, true)}>Confirm</Button><Button size="sm" variant="outline" onClick={() => decide(c, false)}>Reject</Button></div>
        </div>))}</CardContent></Card>
  );
}
