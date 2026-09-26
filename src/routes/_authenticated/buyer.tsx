import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BookingDocs } from "@/components/re-booking-docs";
import { cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/buyer")({
  head: () => ({
    meta: [
      { title: "My Home Booking — payments & documents | DigiCRM AI" },
      { name: "description", content: "Track your property booking, payment schedule and verified documents." },
      { property: "og:title", content: "My Home Booking | DigiCRM AI" },
      { property: "og:description", content: "Your booking, payments and document verification in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyerPortal,
});

const sb = supabase as any;
const STEPS = ["booking", "registration", "closed_won"];

function BuyerPortal() {
  const qc = useQueryClient();
  const [claimed, setClaimed] = useState(false);
  useEffect(() => { sb.rpc("re_buyer_claim").then(() => { setClaimed(true); qc.invalidateQueries({ queryKey: ["buyer"] }); }); }, [qc]);
  const { data: deals = [], isLoading } = useQuery({ queryKey: ["buyer", "deals"], enabled: claimed, queryFn: async () => { const { data: u } = await sb.auth.getUser(); return (await sb.from("re_deals").select("*, re_properties(title, tower, unit_no, location, city)").eq("buyer_user_id", u.user?.id)).data ?? []; } });
  const { data: pays = [] } = useQuery({ queryKey: ["buyer", "pays"], enabled: deals.length > 0, queryFn: async () => (await sb.from("re_payment_schedule").select("*").in("deal_id", deals.map((d: any) => d.id)).order("due_date")).data ?? [] });
  const refresh = () => qc.invalidateQueries({ queryKey: ["buyer"] });

  if (!claimed || isLoading) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!deals.length) return <div className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground"><Home className="mx-auto mb-2 h-8 w-8" />No booking is linked to your email yet. Ask your sales executive to add your email to the booking.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">My home booking</h1>
      {deals.map((d: any) => {
        const dp = pays.filter((p: any) => p.deal_id === d.id);
        const paid = dp.reduce((a: number, p: any) => a + Number(p.paid_amount), 0), total = dp.reduce((a: number, p: any) => a + Number(p.amount), 0);
        return (
          <div key={d.id} className="space-y-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">{d.re_properties?.title}{d.re_properties?.unit_no ? ` · ${d.re_properties.tower ?? ""} ${d.re_properties.unit_no}` : ""}</CardTitle>
              <CardDescription>{[d.re_properties?.location, d.re_properties?.city].filter(Boolean).join(", ")} · Booking value {cr(d.final_value ?? d.expected_value)}</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">{["Booked", "Documents verified", "Registration", "Handover"].map((s, i) => {
                const done = i === 0 || (i === 1 && d.doc_status === "Verified") || (i === 2 && STEPS.indexOf(d.stage) >= 1) || (i === 3 && d.stage === "closed_won");
                return <Badge key={s} variant={done ? "default" : "outline"}>{i + 1}. {s}</Badge>;
              })}</CardContent></Card>
            <BookingDocs deal={d} onChange={refresh} />
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Payments</CardTitle><CardDescription>Paid {cr(paid)} of {cr(total)}. After paying by bank transfer or cheque, report it here — our team confirms it.</CardDescription></CardHeader>
              <CardContent><Table><TableHeader><TableRow><TableHead>Milestone</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
                {dp.map((p: any) => <PayRow key={p.id} p={p} onDone={refresh} />)}
              </TableBody></Table></CardContent></Card>
          </div>);
      })}
    </div>
  );
}

function PayRow({ p, onDone }: { p: any; onDone: () => void }) {
  const [amt, setAmt] = useState(String(Number(p.amount) - Number(p.paid_amount))); const [ref, setRef] = useState(""); const [open, setOpen] = useState(false);
  const paid = Number(p.paid_amount) >= Number(p.amount);
  return (<TableRow><TableCell>{p.milestone}</TableCell><TableCell>{p.due_date}</TableCell><TableCell>{cr(p.amount)}</TableCell>
    <TableCell>{paid ? <Badge>Paid</Badge> : p.reported_at ? <Badge variant="secondary">Reported — awaiting confirmation</Badge> : <Badge variant={p.due_date < new Date().toISOString().slice(0, 10) ? "destructive" : "outline"}>Due</Badge>}</TableCell>
    <TableCell>{!paid && !p.reported_at && (open ? <div className="flex gap-1"><Input className="h-8 w-28" value={amt} onChange={(e) => setAmt(e.target.value)} /><Input className="h-8 w-32" placeholder="UTR / cheque no." value={ref} onChange={(e) => setRef(e.target.value)} />
      <Button size="sm" className="h-8" onClick={async () => { const { error } = await sb.rpc("re_buyer_report_payment", { _id: p.id, _amount: Number(amt), _ref: ref }); if (error) toast.error(error.message); else { toast.success("Reported — we'll confirm shortly"); onDone(); } }}>Send</Button></div>
      : <Button size="sm" variant="outline" onClick={() => setOpen(true)}>I've paid</Button>)}</TableCell></TableRow>);
}
