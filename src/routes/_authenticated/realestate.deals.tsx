import { createFileRoute } from "@tanstack/react-router";
import { BookingDocs, ReportedPayments } from "@/components/re-booking-docs";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check, X, Plus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRe, useReInvalidate, reDb, reRun, LOAN_STATUS, inr, cr, waLink } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/deals")({
  head: () => ({ meta: [{ title: "DealFlow & Collections | Real Estate CRM" }, { name: "description", content: "Cost sheets, negotiation approvals, bookings, payment schedules, loans and commissions." }] }),
  component: DealsPage,
});

const costBlank = { base_rate: "", area: "", plc: "0", parking: "0", club: "0", maintenance: "0", gst_pct: "5", stamp_pct: "7", reg_pct: "1", other: "0", discount: "0" };

function DealsPage() {
  const { user, isManager, isAdmin } = useAuth();
  const inv = useReInvalidate();
  const { data: deals = [] } = useRe("re_deals", "*, re_clients(full_name, phone, whatsapp, channel_partner_id), re_properties(title, price, super_area, area_sqft)", "updated_at");
  const { data: negs = [] } = useRe("re_negotiations", "*");
  const { data: pays = [] } = useRe("re_payment_schedule", "*", "due_date", true);
  const { data: loans = [] } = useRe("re_loans", "*");
  const { data: comms = [] } = useRe("re_commissions", "*, re_channel_partners(name)");
  const { data: partners = [] } = useRe("re_channel_partners", "*", "name", true);
  const [dealId, setDealId] = useState("");
  const [cost, setCost] = useState<any>(costBlank);
  const [neg, setNeg] = useState({ customer_offer: "", seller_quote: "", final_price: "", note: "" });
  const [pay, setPay] = useState({ milestone: "", amount: "", due_date: "" });
  const [loan, setLoan] = useState({ bank: "", amount: "", officer: "" });
  const [cp, setCp] = useState("");

  const deal = deals.find((d: any) => d.id === dealId);
  const listPrice = Number(deal?.re_properties?.price || deal?.expected_value || 0);
  const pendingApprovals = negs.filter((n: any) => n.status === "Pending");
  const today = new Date().toISOString().slice(0, 10);
  const overdue = pays.filter((p: any) => Number(p.paid_amount) < Number(p.amount) && p.due_date < today);

  const cs = useMemo(() => {
    const n = (k: string) => Number(cost[k]) || 0;
    const base = n("base_rate") * n("area");
    const sub = base + n("plc") + n("parking") + n("club") + n("maintenance") + n("other") - n("discount");
    const gst = (base + n("plc") + n("parking") - n("discount")) * n("gst_pct") / 100;
    const stamp = sub * n("stamp_pct") / 100, reg = sub * n("reg_pct") / 100;
    return { base, sub, gst, stamp, reg, total: sub + gst + stamp + reg };
  }, [cost]);

  const pick = (id: string) => {
    setDealId(id);
    const d = deals.find((x: any) => x.id === id);
    const area = Number(d?.re_properties?.super_area || d?.re_properties?.area_sqft || 0);
    const price = Number(d?.re_properties?.price || d?.expected_value || 0);
    setCost({ ...costBlank, area: area ? String(area) : "", base_rate: area && price ? String(Math.round(price / area)) : "" });
    setNeg({ customer_offer: "", seller_quote: price ? String(price) : "", final_price: "", note: "" });
    setCp(d?.channel_partner_id ?? d?.re_clients?.channel_partner_id ?? "");
  };

  const copySheet = () => {
    const t = `Cost sheet – ${deal?.re_properties?.title ?? ""}\nBase: ${inr(cs.base)}\nPLC: ${inr(+cost.plc)}\nParking: ${inr(+cost.parking)}\nClub: ${inr(+cost.club)}\nMaintenance: ${inr(+cost.maintenance)}\nOther: ${inr(+cost.other)}\nDiscount: -${inr(+cost.discount)}\nGST (${cost.gst_pct}%): ${inr(cs.gst)}\nStamp duty (${cost.stamp_pct}%): ${inr(cs.stamp)}\nRegistration (${cost.reg_pct}%): ${inr(cs.reg)}\nTOTAL: ${inr(cs.total)}`;
    navigator.clipboard.writeText(t); toast.success("Cost sheet copied");
    return t;
  };
  const addNeg = async () => {
    if (!deal || !neg.final_price) return toast.error("Enter the negotiated price");
    const lp = listPrice || Number(neg.seller_quote);
    if (!lp) return toast.error("This deal has no list price");
    if (await reRun(reDb.from("re_negotiations").insert({ deal_id: deal.id, list_price: lp, customer_offer: Number(neg.customer_offer) || null, seller_quote: Number(neg.seller_quote) || null, final_price: Number(neg.final_price), note: neg.note || null, owner_id: user?.id }), "Offer recorded")) {
      await reDb.from("re_deals").update({ stage: "negotiation" }).eq("id", deal.id).in("stage", ["inquiry", "qualified", "site_visit_scheduled", "site_visit_done", "interested", "contacted", "property_shared"]);
      setNeg({ ...neg, customer_offer: "", final_price: "", note: "" }); inv();
    }
  };
  const decide = async (n: any, status: string) => {
    if (await reRun(reDb.from("re_negotiations").update({ status }).eq("id", n.id), `Discount ${status.toLowerCase()}`)) {
      if (status === "Approved") await reDb.from("re_deals").update({ final_value: n.final_price }).eq("id", n.deal_id);
      inv();
    }
  };
  const book = async () => {
    if (!deal) return;
    const approved = negs.filter((n: any) => n.deal_id === deal.id && n.status === "Approved").sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];
    const value = Number(approved?.final_price || deal.final_value || listPrice);
    if (negs.some((n: any) => n.deal_id === deal.id && n.status === "Pending")) return toast.error("A discount is still waiting for approval");
    const ok = await reRun(reDb.from("re_deals").update({ stage: "booking", final_value: value, booking_date: today, channel_partner_id: cp || null }).eq("id", deal.id), "Booked");
    if (!ok) return;
    if (deal.property_id) await reDb.from("re_properties").update({ inventory_status: "Booked", status: "hold" }).eq("id", deal.property_id);
    if (!pays.some((p: any) => p.deal_id === deal.id)) {
      const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
      await reDb.from("re_payment_schedule").insert([
        { deal_id: deal.id, milestone: "Booking (10%)", amount: Math.round(value * 0.1), due_date: d(0), owner_id: user?.id },
        { deal_id: deal.id, milestone: "Agreement (20%)", amount: Math.round(value * 0.2), due_date: d(30), owner_id: user?.id },
        { deal_id: deal.id, milestone: "Construction-linked (60%)", amount: Math.round(value * 0.6), due_date: d(180), owner_id: user?.id },
        { deal_id: deal.id, milestone: "Possession (10%)", amount: value - Math.round(value * 0.1) - Math.round(value * 0.2) - Math.round(value * 0.6), due_date: d(365), owner_id: user?.id },
      ]);
    }
    const partner = partners.find((p: any) => p.id === cp);
    if (partner && !comms.some((c: any) => c.deal_id === deal.id)) await reDb.from("re_commissions").insert({ deal_id: deal.id, partner_id: partner.id, booking_value: value, pct: partner.commission_pct, owner_id: user?.id });
    inv();
  };
  const addPay = async () => {
    if (!deal || !pay.milestone || !pay.amount || !pay.due_date) return toast.error("Fill milestone, amount and due date");
    if (await reRun(reDb.from("re_payment_schedule").insert({ deal_id: deal.id, milestone: pay.milestone, amount: Number(pay.amount), due_date: pay.due_date, owner_id: user?.id }), "Milestone added")) { setPay({ milestone: "", amount: "", due_date: "" }); inv(); }
  };
  const markPaid = async (p: any) => {
    const ref = window.prompt("Payment reference (UTR / cheque no.)") ?? "";
    if (await reRun(reDb.from("re_payment_schedule").update({ paid_amount: p.amount, paid_on: today, reference: ref || null }).eq("id", p.id), "Payment recorded")) inv();
  };
  const addLoan = async () => {
    if (!deal || !loan.bank) return toast.error("Enter the bank");
    if (await reRun(reDb.from("re_loans").insert({ deal_id: deal.id, client_id: deal.client_id, bank: loan.bank, amount: Number(loan.amount) || null, officer: loan.officer || null, owner_id: user?.id }), "Loan added")) { setLoan({ bank: "", amount: "", officer: "" }); inv(); }
  };

  const dealPays = pays.filter((p: any) => p.deal_id === dealId);
  const canApprove = (n: any) => (n.approval_level === "director" ? isAdmin : isManager || isAdmin);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[["Discounts awaiting approval", pendingApprovals.length], ["Overdue instalments", overdue.length], ["Outstanding", cr(pays.reduce((a: number, p: any) => a + Number(p.amount) - Number(p.paid_amount), 0))], ["Collected", cr(pays.reduce((a: number, p: any) => a + Number(p.paid_amount), 0))]].map(([k, v]) => (
          <Card key={k as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-bold">{v as any}</div></CardContent></Card>))}
      </div>

      {pendingApprovals.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Discount approvals</CardTitle><CardDescription>Over 5% needs a sales manager. Over 8% needs a director (admin). You can't approve your own request.</CardDescription></CardHeader>
          <CardContent className="space-y-2">{pendingApprovals.map((n: any) => { const d = deals.find((x: any) => x.id === n.deal_id); return (
            <div key={n.id} className="flex flex-wrap items-center gap-3 border rounded-md p-2 text-sm">
              <div className="font-medium">{d?.re_clients?.full_name} · {d?.re_properties?.title}</div>
              <div>List {cr(n.list_price)} → Final {cr(n.final_price)} <Badge variant="outline">{n.discount_pct}% off</Badge></div>
              <Badge>{n.approval_level === "director" ? "Director" : "Sales manager"}</Badge>
              <div className="ml-auto flex gap-1">{canApprove(n) ? <><Button size="sm" onClick={() => decide(n, "Approved")}><Check className="h-3 w-3 mr-1" />Approve</Button><Button size="sm" variant="outline" onClick={() => decide(n, "Rejected")}><X className="h-3 w-3 mr-1" />Reject</Button></> : <span className="text-xs text-muted-foreground">Waiting for {n.approval_level}</span>}</div>
            </div>); })}</CardContent></Card>
      )}

      <Card><CardContent className="p-4 flex flex-wrap gap-2 items-center">
        <Label>Deal</Label>
        <Select value={dealId} onValueChange={pick}><SelectTrigger className="w-96"><SelectValue placeholder="Choose a deal to work on" /></SelectTrigger>
          <SelectContent>{deals.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.re_clients?.full_name ?? "—"} · {d.re_properties?.title ?? "—"} ({d.stage})</SelectItem>)}</SelectContent></Select>
        {deal && <Badge variant="outline">List {cr(listPrice)}</Badge>}{deal?.final_value && <Badge>Final {cr(deal.final_value)}</Badge>}
      </CardContent></Card>

      {deal && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BookingDocs deal={deal} staff onChange={inv} />
          <ReportedPayments pays={dealPays} onChange={inv} />
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Cost sheet</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">{[["base_rate", "Rate / sq ft"], ["area", "Area sq ft"], ["plc", "PLC"], ["parking", "Parking"], ["club", "Club"], ["maintenance", "Maintenance"], ["other", "Other"], ["discount", "Discount"], ["gst_pct", "GST %"], ["stamp_pct", "Stamp duty %"], ["reg_pct", "Registration %"]].map(([k, l]) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" value={cost[k]} onChange={(e) => setCost({ ...cost, [k]: e.target.value })} /></div>))}</div>
              <div className="text-sm space-y-0.5 border-t pt-2">
                <div className="flex justify-between"><span>Base price</span><span>{inr(cs.base)}</span></div>
                <div className="flex justify-between"><span>Sub-total</span><span>{inr(cs.sub)}</span></div>
                <div className="flex justify-between"><span>GST</span><span>{inr(cs.gst)}</span></div>
                <div className="flex justify-between"><span>Stamp duty + registration</span><span>{inr(cs.stamp + cs.reg)}</span></div>
                <div className="flex justify-between font-bold"><span>All-inclusive</span><span>{inr(cs.total)}</span></div>
              </div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={copySheet}><Copy className="h-3 w-3 mr-1" />Copy</Button>
                <Button size="sm" variant="outline" onClick={() => window.open(waLink(deal.re_clients?.whatsapp || deal.re_clients?.phone, copySheet()), "_blank")}><MessageCircle className="h-3 w-3 mr-1" />Send on WhatsApp</Button></div>
            </CardContent></Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Negotiation & booking</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">Customer offer</Label><Input type="number" value={neg.customer_offer} onChange={(e) => setNeg({ ...neg, customer_offer: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Seller quote</Label><Input type="number" value={neg.seller_quote} onChange={(e) => setNeg({ ...neg, seller_quote: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Final negotiated</Label><Input type="number" value={neg.final_price} onChange={(e) => setNeg({ ...neg, final_price: e.target.value })} /></div>
              </div>
              {neg.final_price && listPrice > 0 && <div className="text-xs text-muted-foreground">Discount {(((listPrice - Number(neg.final_price)) / listPrice) * 100).toFixed(2)}% · margin impact {cr(listPrice - Number(neg.final_price))}</div>}
              <Input placeholder="Note" value={neg.note} onChange={(e) => setNeg({ ...neg, note: e.target.value })} />
              <Button size="sm" onClick={addNeg}>Record offer</Button>
              <div className="space-y-1">{negs.filter((n: any) => n.deal_id === deal.id).map((n: any) => (
                <div key={n.id} className="text-xs flex gap-2 items-center"><span>{new Date(n.created_at).toLocaleDateString()}</span><span>Offer {cr(n.customer_offer)} · Quote {cr(n.seller_quote)} · Final {cr(n.final_price)}</span><Badge variant="outline">{n.discount_pct}%</Badge><Badge variant={n.status === "Approved" ? "default" : "outline"}>{n.status}</Badge></div>))}</div>
              <div className="border-t pt-3 space-y-2">
                <div className="space-y-1"><Label className="text-xs">Channel partner (for commission)</Label>
                  <Select value={cp || "none"} onValueChange={(v) => setCp(v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Direct (no partner)</SelectItem>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.commission_pct}%</SelectItem>)}</SelectContent></Select></div>
                <Button onClick={book} disabled={["booking", "agreement", "registration", "closed_won"].includes(deal.stage)}>Confirm booking</Button>
                <p className="text-xs text-muted-foreground">Booking marks the unit Booked, creates a 10/20/60/10 payment schedule and the partner's commission.</p>
              </div>
            </CardContent></Card>

          <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-base">Payment schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Table><TableHeader><TableRow><TableHead>Milestone</TableHead><TableHead>Amount</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{dealPays.map((p: any) => { const paid = Number(p.paid_amount) >= Number(p.amount); const late = !paid && p.due_date < today; return (
                  <TableRow key={p.id}><TableCell>{p.milestone}</TableCell><TableCell>{inr(p.amount)}</TableCell><TableCell>{p.due_date}</TableCell>
                    <TableCell>{paid ? <Badge>Paid {p.paid_on}</Badge> : late ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="outline">Upcoming</Badge>}</TableCell>
                    <TableCell className="text-right">{!paid && <><Button size="sm" variant="ghost" onClick={() => window.open(waLink(deal.re_clients?.whatsapp || deal.re_clients?.phone, `Hi ${deal.re_clients?.full_name?.split(" ")[0] ?? ""}, a gentle reminder: ${p.milestone} of ${inr(p.amount)} is due on ${p.due_date} for ${deal.re_properties?.title ?? "your unit"}.`), "_blank")}>Remind</Button><Button size="sm" variant="outline" onClick={() => markPaid(p)}>Mark paid</Button></>}</TableCell></TableRow>); })}
                  {dealPays.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No schedule yet — confirm booking or add a milestone</TableCell></TableRow>}</TableBody></Table>
              <div className="flex flex-wrap gap-2"><Input className="w-48" placeholder="Milestone" value={pay.milestone} onChange={(e) => setPay({ ...pay, milestone: e.target.value })} /><Input className="w-36" type="number" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /><Input className="w-40" type="date" value={pay.due_date} onChange={(e) => setPay({ ...pay, due_date: e.target.value })} /><Button size="sm" onClick={addPay}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
            </CardContent></Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Home loan</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loans.filter((l: any) => l.deal_id === deal.id).map((l: any) => (
                <div key={l.id} className="flex items-center gap-2 text-sm"><span className="font-medium">{l.bank}</span><span>{cr(l.amount)}</span><span className="text-xs text-muted-foreground">{l.officer}</span>
                  <Select value={l.status} onValueChange={async (v) => { await reRun(reDb.from("re_loans").update({ status: v }).eq("id", l.id)); inv(); }}><SelectTrigger className="w-32 h-7 ml-auto"><SelectValue /></SelectTrigger><SelectContent>{LOAN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>))}
              <div className="grid grid-cols-3 gap-2"><Input placeholder="Bank / NBFC" value={loan.bank} onChange={(e) => setLoan({ ...loan, bank: e.target.value })} /><Input type="number" placeholder="Amount" value={loan.amount} onChange={(e) => setLoan({ ...loan, amount: e.target.value })} /><Input placeholder="Loan officer" value={loan.officer} onChange={(e) => setLoan({ ...loan, officer: e.target.value })} /></div>
              <Button size="sm" onClick={addLoan}>Add loan</Button>
            </CardContent></Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Stage</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1">{["agreement", "registration", "closed_won"].map((s) => (
              <Button key={s} size="sm" variant={deal.stage === s ? "default" : "outline"} onClick={async () => { if (await reRun(reDb.from("re_deals").update({ stage: s, ...(s === "closed_won" ? { closed_at: new Date().toISOString() } : {}) }).eq("id", deal.id), "Stage updated")) { if (s !== "agreement" && deal.property_id) await reDb.from("re_properties").update({ inventory_status: "Sold", status: "sold" }).eq("id", deal.property_id); inv(); } }}>{s.replace("_", " ")}</Button>))}
            </CardContent></Card>
        </div>
      )}
    </div>
  );
}
