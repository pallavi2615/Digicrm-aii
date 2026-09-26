import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyBookingDoc } from "@/lib/re-copilot.functions";
import { cr } from "@/lib/re-data";

const sb = supabase as any;
const DOCS = [
  { key: "pan", label: "PAN", ph: "ABCDE1234F" },
  { key: "aadhaar", label: "Aadhaar", ph: "12-digit number" },
  { key: "bank", label: "Bank account", ph: "Account number" },
] as const;
const tone = (s?: string) => (s === "Verified" ? "default" : s === "Failed" ? "destructive" : "secondary") as any;

/** Booking documents verified via DigiVerification. Used by staff (deals page) and buyers (portal). */
export function BookingDocs({ deal, staff, onChange }: { deal: any; staff?: boolean; onChange?: () => void }) {
  const qc = useQueryClient();
  const verify = useServerFn(verifyBookingDoc);
  const { data: docs = [] } = useQuery({ queryKey: ["re-docs", deal.id], queryFn: async () => (await sb.from("re_booking_docs").select("*").eq("deal_id", deal.id)).data ?? [] });
  const [val, setVal] = useState<Record<string, string>>({}); const [ifsc, setIfsc] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState(deal.buyer_email ?? "");
  const run = async (key: "pan" | "aadhaar" | "bank") => {
    setBusy(key);
    try {
      const r: any = await verify({ data: { dealId: deal.id, docType: key, value: val[key] ?? "", ifsc: key === "bank" ? ifsc : undefined } });
      r.status === "Verified" ? toast.success(`${key.toUpperCase()} verified`) : toast.error(r.error ?? r.status);
      qc.invalidateQueries({ queryKey: ["re-docs", deal.id] }); onChange?.();
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Booking documents <Badge variant={tone(deal.doc_status)}>{deal.doc_status ?? "Pending"}</Badge></CardTitle>
      <CardDescription>Checked live with DigiVerification. When PAN, Aadhaar and bank are all verified, the booking moves to Registration automatically.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {staff && <div className="flex flex-wrap items-center gap-2"><Input className="max-w-xs" placeholder="Buyer email (for the buyer portal)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button size="sm" variant="outline" onClick={async () => { const { error } = await sb.from("re_deals").update({ buyer_email: email.trim().toLowerCase() || null }).eq("id", deal.id); if (error) toast.error(error.message); else { toast.success("Buyer can now log in at /buyer with this email"); onChange?.(); } }}>Invite buyer</Button>
          {deal.buyer_user_id && <Badge variant="secondary">Buyer linked</Badge>}</div>}
        {DOCS.map((d) => { const row = docs.find((x: any) => x.doc_type === d.key); return (
          <div key={d.key} className="flex flex-wrap items-center gap-2 rounded border p-2">
            <span className="w-24 text-sm font-medium">{d.label}</span>
            {row && <Badge variant={tone(row.status)}>{row.status}</Badge>}
            {row?.identifier_masked && <span className="text-xs text-muted-foreground">{row.identifier_masked}</span>}
            {row?.status !== "Verified" && <>
              <Input className="h-8 w-40" placeholder={d.ph} value={val[d.key] ?? ""} onChange={(e) => setVal({ ...val, [d.key]: e.target.value })} />
              {d.key === "bank" && <Input className="h-8 w-32" placeholder="IFSC" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />}
              <Button size="sm" className="h-8" disabled={busy === d.key || !(val[d.key] ?? "").trim()} onClick={() => run(d.key)}>{busy === d.key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}</Button></>}
            {row?.error && row.status !== "Verified" && <span className="basis-full text-xs text-destructive">{row.error}</span>}
          </div>); })}
      </CardContent></Card>
  );
}

/** Staff list of buyer-reported payments waiting for confirmation. */
export function ReportedPayments({ pays, onChange }: { pays: any[]; onChange?: () => void }) {
  const list = pays.filter((p: any) => p.reported_at && Number(p.paid_amount) < Number(p.amount));
  if (!list.length) return null;
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base">Buyer-reported payments</CardTitle><CardDescription>Confirm once the money shows in your bank.</CardDescription></CardHeader>
      <CardContent className="space-y-2">{list.map((p: any) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm"><span className="font-medium">{p.milestone}</span><span>{cr(p.reported_amount)} of {cr(p.amount)}</span><span className="text-xs text-muted-foreground">Ref {p.reported_reference || "—"} · {new Date(p.reported_at).toLocaleDateString("en-IN")}</span>
          <Button size="sm" className="ml-auto" onClick={async () => { const { error } = await sb.from("re_payment_schedule").update({ paid_amount: Number(p.paid_amount) + Number(p.reported_amount), paid_on: new Date().toISOString().slice(0, 10), reference: p.reported_reference, reported_at: null, reported_amount: null }).eq("id", p.id); if (error) toast.error(error.message); else { toast.success("Payment confirmed"); onChange?.(); } }}>Confirm</Button></div>))}
      </CardContent></Card>
  );
}
