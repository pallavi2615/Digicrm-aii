import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payout-accounts")({
  head: () => ({
    meta: [
      { title: "Payout Accounts | DigiCRM AI" },
      { name: "description", content: "Partner payout accounts with live balances and every transfer's UTR." },
      { property: "og:title", content: "Payout Accounts | DigiCRM AI" },
      { property: "og:description", content: "Create payout accounts, send money and watch balances update live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayoutAccounts,
});

const sb = supabase as any;
const inr = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN");
const empty = { holder_name: "", bank_name: "", account_number: "", ifsc: "", upi_id: "" };

function PayoutAccounts() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState(empty);
  const [send, setSend] = useState<Record<string, { amount: string; utr: string }>>({});
  useRealtimeTable("payout_accounts", [["payout-accounts"]]);
  useRealtimeTable("payout_transfers", [["payout-transfers"], ["payout-accounts"]]);

  const { data: accounts = [] } = useQuery({ queryKey: ["payout-accounts"], queryFn: async () => (await sb.from("payout_accounts").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: transfers = [] } = useQuery({ queryKey: ["payout-transfers"], queryFn: async () => (await sb.from("payout_transfers").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["payout-accounts"] }); qc.invalidateQueries({ queryKey: ["payout-transfers"] }); };

  const create = async () => {
    if (!form.holder_name.trim()) return toast.error("Enter the account holder name");
    const { data: aff } = await sb.from("affiliates").select("id").eq("user_id", user?.id).maybeSingle();
    const { error } = await sb.from("payout_accounts").insert({ ...form, user_id: user?.id, affiliate_id: aff?.id ?? null, is_demo: true });
    if (error) return toast.error(error.message);
    toast.success("Payout account created"); setForm(empty); refresh();
  };
  const sendMoney = async (id: string) => {
    const s = send[id]; const amt = Number(s?.amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    const { error } = await sb.from("payout_transfers").insert({ account_id: id, amount: amt, utr: s?.utr || null, note: "Manual transfer" });
    if (error) return toast.error(error.message);
    toast.success(`${inr(amt)} sent`); setSend({ ...send, [id]: { amount: "", utr: "" } }); refresh();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Card><CardHeader><CardTitle>Add a payout account</CardTitle>
        <CardDescription>Demo accounts are manual: money is recorded here with a UTR after you transfer it from your bank. Balances update live.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {(["holder_name", "bank_name", "account_number", "ifsc", "upi_id"] as const).map((k) => (
            <Input key={k} placeholder={k.replace("_", " ")} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />))}
          <Button onClick={create}>Create account</Button>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>{isAdmin ? "All payout accounts" : "My payout accounts"}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!accounts.length && <p className="text-sm text-muted-foreground">No payout accounts yet.</p>}
          {accounts.map((a: any) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded border p-3">
              <div className="min-w-48"><div className="font-medium">{a.holder_name} {a.is_demo && <Badge variant="secondary">Demo · manual</Badge>}</div>
                <div className="text-xs text-muted-foreground">{a.bank_name || "—"} · {a.account_number ? "••" + String(a.account_number).slice(-4) : a.upi_id || "—"} {a.ifsc}</div></div>
              <div className="text-lg font-semibold" data-testid="balance">{inr(a.balance)}</div>
              {isAdmin && <div className="ml-auto flex gap-2">
                <Input className="h-8 w-28" type="number" placeholder="Amount" value={send[a.id]?.amount ?? ""} onChange={(e) => setSend({ ...send, [a.id]: { ...send[a.id], amount: e.target.value } })} />
                <Input className="h-8 w-32" placeholder="UTR" value={send[a.id]?.utr ?? ""} onChange={(e) => setSend({ ...send, [a.id]: { ...send[a.id], utr: e.target.value } })} />
                <Button size="sm" onClick={() => sendMoney(a.id)}>Send money</Button></div>}
            </div>))}
        </CardContent></Card>

      <Card><CardHeader><CardTitle>Transfers</CardTitle><CardDescription>Marking a partner payout as paid also sends it here automatically.</CardDescription></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {!transfers.length && <p className="text-muted-foreground">No transfers yet.</p>}
          {transfers.map((t: any) => { const a = accounts.find((x: any) => x.id === t.account_id); return (
            <div key={t.id} className="flex justify-between border-b py-1"><span>{a?.holder_name ?? "Account"} · {t.note}</span><span>{inr(t.amount)} · UTR {t.utr || "—"} · {new Date(t.created_at).toLocaleString("en-IN")}</span></div>); })}
        </CardContent></Card>
    </div>
  );
}
