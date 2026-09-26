import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CalendarClock, Clock, BellRing } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cashflow")({
  head: () => ({
    meta: [
      { title: "Cash Flow Tracker — DigiCRM AI" },
      { name: "description", content: "Pending fees, upcoming payments and overdue royalties across every template, with alerts and follow-ups." },
      { property: "og:title", content: "Cash Flow Tracker — DigiCRM AI" },
      { property: "og:description", content: "Track every rupee due without opening each template." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CashFlowPage,
});

const db = supabase as any;
const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const today = () => new Date().toISOString().slice(0, 10);
const days = (d?: string | null) => (d ? Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 864e5) : 999);

type Item = { key: string; kind: "fee" | "property" | "royalty" | "creator" | "invoice"; source: string; id: string; party: string; label: string; due: string | null; balance: number; raw: any };
const KIND_LABEL: Record<Item["kind"], string> = { fee: "Student fee", property: "Property payment", royalty: "Franchise royalty", creator: "Creator invoice", invoice: "Invoice" };

async function loadAll(): Promise<Item[]> {
  const [fees, prop, roy, cre, inv] = await Promise.all([
    db.from("edu_fees").select("id,label,amount,paid_amount,due_date,status,reported_amount,reported_reference,edu_students(name)").limit(2000),
    db.from("re_payment_schedule").select("id,milestone,amount,paid_amount,due_date").limit(2000),
    db.from("edu_royalties").select("id,period,royalty,marketing_fee,status,created_at,edu_branches(name)").limit(2000),
    db.from("creator_invoices").select("id,number,amount,tax_pct,paid_amount,due_date,status").limit(2000),
    db.from("fin_invoices").select("id,number,party_name,amount,gst_pct,due_date,status,kind").limit(2000),
  ]);
  const out: Item[] = [];
  (fees.data ?? []).forEach((r: any) => { const b = Number(r.amount) - Number(r.paid_amount || 0); if (b > 0 && String(r.status).toLowerCase() !== "paid") out.push({ key: "f" + r.id, kind: "fee", source: "edu_fees", id: r.id, party: r.edu_students?.name ?? "Student", label: r.label, due: r.due_date, balance: b, raw: r }); });
  (prop.data ?? []).forEach((r: any) => { const b = Number(r.amount) - Number(r.paid_amount || 0); if (b > 0) out.push({ key: "p" + r.id, kind: "property", source: "re_payment_schedule", id: r.id, party: "Buyer", label: r.milestone, due: r.due_date, balance: b, raw: r }); });
  (roy.data ?? []).forEach((r: any) => { if (String(r.status).toLowerCase() === "paid") return; const due = r.period && /^\d{4}-\d{2}$/.test(r.period) ? new Date(new Date(r.period + "-01").getFullYear(), new Date(r.period + "-01").getMonth() + 1, 10).toISOString().slice(0, 10) : String(r.created_at).slice(0, 10); out.push({ key: "r" + r.id, kind: "royalty", source: "edu_royalties", id: r.id, party: r.edu_branches?.name ?? "Branch", label: `Royalty ${r.period ?? ""}`, due, balance: Number(r.royalty) + Number(r.marketing_fee || 0), raw: r }); });
  (cre.data ?? []).forEach((r: any) => { const total = Number(r.amount) * (1 + Number(r.tax_pct || 0) / 100); const b = total - Number(r.paid_amount || 0); if (b > 0 && String(r.status).toLowerCase() !== "paid") out.push({ key: "c" + r.id, kind: "creator", source: "creator_invoices", id: r.id, party: "Brand", label: r.number, due: r.due_date, balance: b, raw: { ...r, total } }); });
  (inv.data ?? []).forEach((r: any) => { if (r.kind !== "receivable" || ["paid", "cancelled"].includes(String(r.status).toLowerCase())) return; out.push({ key: "i" + r.id, kind: "invoice", source: "fin_invoices", id: r.id, party: r.party_name, label: r.number, due: r.due_date, balance: Number(r.amount) * (1 + Number(r.gst_pct || 0) / 100), raw: r }); });
  return out.sort((a, b) => days(a.due) - days(b.due));
}

function CashFlowPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cashflow"], queryFn: loadAll });
  const [pay, setPay] = useState<Item | null>(null);
  const [fu, setFu] = useState<Item | null>(null);

  useEffect(() => {
    const ch = supabase.channel("cashflow-live");
    ["edu_fees", "re_payment_schedule", "edu_royalties", "creator_invoices", "fin_invoices"].forEach((t) =>
      ch.on("postgres_changes" as any, { event: "*", schema: "public", table: t }, () => qc.invalidateQueries({ queryKey: ["cashflow"] })));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data ?? [];
  const groups = useMemo(() => ({
    pendingFees: items.filter((i) => i.kind === "fee"),
    upcoming: items.filter((i) => i.kind !== "royalty" && days(i.due) >= 0 && days(i.due) <= 30),
    overdueRoyalties: items.filter((i) => i.kind === "royalty" && days(i.due) < 0),
    overdue: items.filter((i) => days(i.due) < 0),
  }), [items]);
  const sum = (a: Item[]) => a.reduce((s, i) => s + i.balance, 0);

  const alerts = [
    groups.overdueRoyalties.length && { tone: "destructive", text: `${groups.overdueRoyalties.length} franchise royalties overdue — ${inr(sum(groups.overdueRoyalties))}` },
    items.filter((i) => i.raw?.reported_amount).length && { tone: "warn", text: `${items.filter((i) => i.raw?.reported_amount).length} student-reported payments waiting for your approval` },
    groups.pendingFees.filter((i) => days(i.due) < 0).length && { tone: "destructive", text: `${groups.pendingFees.filter((i) => days(i.due) < 0).length} student fees overdue` },
    items.filter((i) => days(i.due) >= 0 && days(i.due) <= 3).length && { tone: "warn", text: `${items.filter((i) => days(i.due) >= 0 && days(i.due) <= 3).length} payments due in the next 3 days` },
  ].filter(Boolean) as { tone: string; text: string }[];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Cash Flow Tracker</h1>
        <p className="text-sm text-muted-foreground">Everything owed to you across education, franchise, real estate and creator deals. Updates live.</p>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.text} className={"flex items-center gap-2 rounded-md border px-3 py-2 text-sm " + (a.tone === "destructive" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/10")}>
              <BellRing className="h-4 w-4" />{a.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Clock} label="Pending fees" value={inr(sum(groups.pendingFees))} sub={`${groups.pendingFees.length} open`} />
        <Stat icon={CalendarClock} label="Due in 30 days" value={inr(sum(groups.upcoming))} sub={`${groups.upcoming.length} payments`} />
        <Stat icon={AlertTriangle} label="Overdue royalties" value={inr(sum(groups.overdueRoyalties))} sub={`${groups.overdueRoyalties.length} branches`} />
        <Stat icon={AlertTriangle} label="All overdue" value={inr(sum(groups.overdue))} sub={`${groups.overdue.length} items`} />
      </div>

      <Section title="Pending fees" rows={groups.pendingFees} onPay={setPay} onFollow={setFu} />
      <Section title="Upcoming payments (next 30 days)" rows={groups.upcoming} onPay={setPay} onFollow={setFu} />
      <Section title="Overdue royalties" rows={groups.overdueRoyalties} onPay={setPay} onFollow={setFu} />
      <Section title="All other overdue" rows={groups.overdue.filter((i) => i.kind !== "royalty" && i.kind !== "fee")} onPay={setPay} onFollow={setFu} />

      <PayDialog item={pay} onClose={() => setPay(null)} onDone={() => qc.invalidateQueries({ queryKey: ["cashflow"] })} />
      <FollowDialog item={fu} onClose={() => setFu(null)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: any) {
  return <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="text-2xl font-semibold">{value}</div><div className="text-xs text-muted-foreground">{sub}</div></CardContent></Card>;
}

function Section({ title, rows, onPay, onFollow }: { title: string; rows: Item[]; onPay: (i: Item) => void; onFollow: (i: Item) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title} ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead>Item</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Balance</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((i) => { const d = days(i.due); return (
              <TableRow key={i.key}>
                <TableCell><Badge variant="outline">{KIND_LABEL[i.kind]}</Badge></TableCell>
                <TableCell>{i.party}</TableCell>
                <TableCell>{i.label}</TableCell>
                <TableCell className={d < 0 ? "text-destructive font-medium" : ""}>{i.due ?? "—"}{i.due && <span className="ml-1 text-xs text-muted-foreground">({d < 0 ? `${-d}d late` : d === 0 ? "today" : `in ${d}d`})</span>}</TableCell>
                <TableCell className="text-right font-medium">{inr(i.balance)}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  {i.kind === "fee" && i.raw.reported_amount ? (
                    <Button size="sm" onClick={async () => { const { error } = await db.rpc("edu_approve_fee_payment", { _fee: i.id }); if (error) toast.error(error.message); else toast.success(`Approved ${inr(Number(i.raw.reported_amount))} · UTR ${i.raw.reported_reference} — posted to ledger`); }}>Approve {inr(Number(i.raw.reported_amount))}</Button>
                  ) : <Button size="sm" onClick={() => onPay(i)}>Record payment</Button>}
                  <Button size="sm" variant="outline" onClick={() => onFollow(i)}>Follow up</Button>
                </TableCell>
              </TableRow>); })}
            {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nothing here.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayDialog({ item, onClose, onDone }: { item: Item | null; onClose: () => void; onDone: () => void }) {
  const [amt, setAmt] = useState(""); const [utr, setUtr] = useState("");
  useEffect(() => { if (item) { setAmt(String(Math.round(item.balance))); setUtr(""); } }, [item]);
  const save = async () => {
    if (!item) return; const a = Number(amt); if (!a) return toast.error("Enter an amount"); if (!utr) return toast.error("Enter the UTR / reference");
    const r = item.raw; const d = today(); let res: any;
    if (item.kind === "fee") res = await db.from("edu_fees").update({ paid_amount: Number(r.paid_amount || 0) + a, method: `Manual · ${utr}`, paid_at: new Date().toISOString() }).eq("id", item.id);
    else if (item.kind === "property") res = await db.from("re_payment_schedule").update({ paid_amount: Number(r.paid_amount || 0) + a, paid_on: d, reference: utr }).eq("id", item.id);
    else if (item.kind === "royalty") res = await db.from("edu_royalties").update({ status: "Paid", paid_on: d, reference: utr }).eq("id", item.id);
    else if (item.kind === "creator") { const paid = Number(r.paid_amount || 0) + a; res = await db.from("creator_invoices").update({ paid_amount: paid, paid_at: d, status: paid >= r.total - 1 ? "Paid" : r.status, notes: `UTR ${utr}` }).eq("id", item.id); }
    else res = await db.from("fin_invoices").update({ status: "paid", utr, paid_at: new Date().toISOString() }).eq("id", item.id);
    if (res.error) return toast.error(res.error.message);
    toast.success("Payment recorded — posted to the ledger"); onDone(); onClose();
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record manual payment</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{item && `${KIND_LABEL[item.kind]} · ${item.party} · ${item.label}`}</p>
        <Input placeholder="Amount ₹" value={amt} onChange={(e) => setAmt(e.target.value)} disabled={item?.kind === "royalty" || item?.kind === "invoice"} />
        <Input placeholder="UTR / reference" value={utr} onChange={(e) => setUtr(e.target.value)} />
        <DialogFooter><Button onClick={save}>Save payment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [date, setDate] = useState(""); const [note, setNote] = useState("");
  useEffect(() => { if (item) { setDate(new Date(Date.now() + 864e5).toISOString().slice(0, 10)); setNote(""); } }, [item]);
  const save = async () => {
    if (!item || !date) return;
    const { data: u } = await supabase.auth.getUser();
    const due = new Date(date + "T10:00:00").toISOString();
    const { error } = await db.from("tasks").insert({
      title: `Follow up: ${KIND_LABEL[item.kind]} ${inr(item.balance)} — ${item.party}`,
      description: `${item.label}${item.due ? ` (due ${item.due})` : ""}. ${note}`.trim(),
      status: "todo", priority: days(item.due) < 0 ? "high" : "medium", due_date: due, reminder_at: due, created_by: u.user?.id, assigned_to: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`Follow-up scheduled for ${date} — see Tasks`); onClose();
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule follow-up</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{item && `${item.party} · ${item.label} · ${inr(item.balance)}`}</p>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <DialogFooter><Button onClick={save}>Schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
