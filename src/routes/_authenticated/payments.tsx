import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/lib/tenants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Ledger — DigiCRM AI" },
      { name: "description", content: "Bank accounts, invoices, UTRs and a live ledger of fees, royalties, property payments and partner payouts." },
      { property: "og:title", content: "Payments & Ledger — DigiCRM AI" },
      { property: "og:description", content: "Every fee, royalty and payout lands in one live ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

type Row = Record<string, any>;
const db = supabase as any;
const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const CATS: Record<string, string> = {
  student_fee: "Student fee", franchise_royalty: "Franchise royalty", property_payment: "Property payment",
  partner_commission: "Partner commission", affiliate_payout: "Affiliate payout", client_fee: "Client pack fee",
  service: "Service", expense: "Expense", other: "Other",
};

function PaymentsPage() {
  const { active } = useActiveTenant();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"workspace" | "all">("all");
  const tenantId = scope === "workspace" ? active?.id ?? null : null;

  const ledger = useQuery({
    queryKey: ["fin-ledger", tenantId],
    queryFn: async () => {
      let q = db.from("fin_ledger").select("*").order("entry_date", { ascending: false }).limit(1000);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const invoices = useQuery({
    queryKey: ["fin-invoices", tenantId],
    queryFn: async () => {
      let q = db.from("fin_invoices").select("*").order("created_at", { ascending: false });
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const banks = useQuery({
    queryKey: ["fin-banks", tenantId],
    queryFn: async () => {
      let q = db.from("fin_bank_accounts").select("*").order("created_at");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("fin-ledger-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "fin_ledger" }, () => qc.invalidateQueries({ queryKey: ["fin-ledger"] }))
      .subscribe();
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["fin-ledger"] }), 15000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [qc]);

  const rows = ledger.data ?? [];
  const totals = useMemo(() => {
    const inn = rows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0);
    const out = rows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0);
    const byCat: Record<string, number> = {};
    rows.forEach((r) => { byCat[r.category] = (byCat[r.category] ?? 0) + Number(r.amount) * (r.direction === "in" ? 1 : -1); });
    return { inn, out, byCat };
  }, [rows]);
  const opening = (banks.data ?? []).reduce((s, b) => s + Number(b.opening_balance), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payments & Ledger</h1>
          <p className="text-sm text-muted-foreground">Fee payments, royalties, property payments and payouts post here automatically once marked paid.</p>
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v as any)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything I can see</SelectItem>
            <SelectItem value="workspace">Active workspace: {active?.name ?? "—"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Money in" value={inr(totals.inn)} />
        <Stat label="Money out" value={inr(totals.out)} />
        <Stat label="Net" value={inr(totals.inn - totals.out)} />
        <Stat label="Bank balance (incl. opening)" value={inr(opening + totals.inn - totals.out)} />
      </div>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="banks">Bank accounts</TabsTrigger>
          <TabsTrigger value="summary">By category</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4">
          <ManualEntry tenantId={active?.id ?? null} banks={banks.data ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["fin-ledger"] })} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Entries ({rows.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv("ledger.csv", objectsToCsv(rows.map((r) => ({
                date: r.entry_date, direction: r.direction, category: CATS[r.category] ?? r.category, amount: r.amount, party: r.party, utr: r.utr, method: r.method, memo: r.memo, source: r.source_table,
              })), ["date","direction","category","amount","party","utr","method","memo","source"]))}><Download className="mr-1 h-4 w-4" />CSV</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Party</TableHead><TableHead>UTR</TableHead><TableHead>Memo</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.entry_date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell><Badge variant={r.direction === "in" ? "default" : "secondary"}>{CATS[r.category] ?? r.category}</Badge></TableCell>
                      <TableCell>{r.party ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.utr ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.memo}</TableCell>
                      <TableCell className={"text-right font-medium " + (r.direction === "in" ? "text-primary" : "text-destructive")}>
                        {r.direction === "in" ? "+" : "−"}{inr(Number(r.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No entries yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Invoices tenantId={active?.id ?? null} rows={invoices.data ?? []} banks={banks.data ?? []} onDone={() => { qc.invalidateQueries({ queryKey: ["fin-invoices"] }); qc.invalidateQueries({ queryKey: ["fin-ledger"] }); }} />
        </TabsContent>

        <TabsContent value="banks">
          <Banks tenantId={active?.id ?? null} rows={banks.data ?? []} ledger={rows} onDone={() => qc.invalidateQueries({ queryKey: ["fin-banks"] })} />
        </TabsContent>

        <TabsContent value="summary">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(totals.byCat).map(([k, v]) => (
                  <TableRow key={k}><TableCell>{CATS[k] ?? k}</TableCell><TableCell className="text-right">{inr(v)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold">{value}</div></CardContent></Card>;
}

function ManualEntry({ tenantId, banks, onDone }: { tenantId: string | null; banks: Row[]; onDone: () => void }) {
  const [f, setF] = useState({ direction: "in", category: "service", amount: "", party: "", utr: "", memo: "", bank: "" });
  const save = async () => {
    if (!Number(f.amount)) return toast.error("Enter an amount");
    const { error } = await db.from("fin_ledger").insert({
      tenant_id: tenantId, direction: f.direction, category: f.category, amount: Number(f.amount),
      party: f.party || null, utr: f.utr || null, memo: f.memo || null, method: "bank_transfer", bank_account_id: f.bank || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Entry posted"); setF({ ...f, amount: "", party: "", utr: "", memo: "" }); onDone();
  };
  return (
    <Card><CardHeader><CardTitle className="text-base">Record a manual entry</CardTitle></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-7">
        <Select value={f.direction} onValueChange={(v) => setF({ ...f, direction: v })}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="in">Money in</SelectItem><SelectItem value="out">Money out</SelectItem></SelectContent></Select>
        <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input placeholder="Party" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} />
        <Input placeholder="UTR" value={f.utr} onChange={(e) => setF({ ...f, utr: e.target.value })} />
        <Select value={f.bank} onValueChange={(v) => setF({ ...f, bank: v })}><SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
          <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
        <Button onClick={save}>Post</Button>
      </CardContent>
    </Card>
  );
}

function Invoices({ tenantId, rows, banks, onDone }: { tenantId: string | null; rows: Row[]; banks: Row[]; onDone: () => void }) {
  const [f, setF] = useState({ number: "", party_name: "", amount: "", gst_pct: "18", kind: "receivable", category: "service", due_date: "" });
  const [utr, setUtr] = useState<Record<string, string>>({});
  const create = async () => {
    if (!f.number || !f.party_name || !Number(f.amount)) return toast.error("Number, party and amount are required");
    const { error } = await db.from("fin_invoices").insert({ ...f, tenant_id: tenantId, amount: Number(f.amount), gst_pct: Number(f.gst_pct || 0), due_date: f.due_date || null });
    if (error) return toast.error(error.message);
    toast.success("Invoice created"); setF({ ...f, number: "", party_name: "", amount: "" }); onDone();
  };
  const markPaid = async (r: Row) => {
    const u = utr[r.id];
    if (!u) return toast.error("Enter the UTR first");
    const { error } = await db.from("fin_invoices").update({ status: "paid", utr: u, paid_at: new Date().toISOString(), bank_account_id: banks[0]?.id ?? null }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Marked paid — posted to ledger"); onDone();
  };
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">New invoice</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-8">
          <Input placeholder="Invoice #" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
          <Input placeholder="Party" value={f.party_name} onChange={(e) => setF({ ...f, party_name: e.target.value })} />
          <Input placeholder="Amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Input placeholder="GST %" value={f.gst_pct} onChange={(e) => setF({ ...f, gst_pct: e.target.value })} />
          <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="receivable">We bill</SelectItem><SelectItem value="payable">We pay</SelectItem></SelectContent></Select>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          <Button onClick={create}>Create</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Party</TableHead><TableHead>Type</TableHead><TableHead>Total</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead>UTR</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.number}</TableCell><TableCell>{r.party_name}</TableCell>
                <TableCell>{r.kind === "payable" ? "We pay" : "We bill"}</TableCell>
                <TableCell>{inr(Number(r.amount) * (1 + Number(r.gst_pct) / 100))}</TableCell>
                <TableCell>{r.due_date ?? "—"}</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : "outline"}>{r.status}</Badge></TableCell>
                <TableCell>
                  {r.status === "paid" ? <span className="font-mono text-xs">{r.utr}</span> : (
                    <div className="flex gap-2">
                      <Input className="h-8 w-36" placeholder="UTR" value={utr[r.id] ?? ""} onChange={(e) => setUtr({ ...utr, [r.id]: e.target.value })} />
                      <Button size="sm" onClick={() => markPaid(r)}>Mark paid</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function Banks({ tenantId, rows, ledger, onDone }: { tenantId: string | null; rows: Row[]; ledger: Row[]; onDone: () => void }) {
  const [f, setF] = useState({ name: "", bank_name: "", account_number: "", ifsc: "", upi_id: "", opening_balance: "0" });
  const add = async () => {
    if (!f.name) return toast.error("Give the account a name");
    const { error } = await db.from("fin_bank_accounts").insert({ ...f, tenant_id: tenantId, opening_balance: Number(f.opening_balance || 0), is_default: rows.length === 0 });
    if (error) return toast.error(error.message);
    toast.success("Bank account added"); setF({ name: "", bank_name: "", account_number: "", ifsc: "", upi_id: "", opening_balance: "0" }); onDone();
  };
  const bal = (id: string, open: number) => open + ledger.filter((l) => l.bank_account_id === id).reduce((s, l) => s + Number(l.amount) * (l.direction === "in" ? 1 : -1), 0);
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">Add bank account</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-7">
          <Input placeholder="Label (e.g. HDFC Current)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="Bank" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} />
          <Input placeholder="Account no." value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} />
          <Input placeholder="IFSC" value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value })} />
          <Input placeholder="UPI ID" value={f.upi_id} onChange={(e) => setF({ ...f, upi_id: e.target.value })} />
          <Input placeholder="Opening ₹" value={f.opening_balance} onChange={(e) => setF({ ...f, opening_balance: e.target.value })} />
          <Button onClick={add}>Add</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Bank</TableHead><TableHead>Number</TableHead><TableHead>IFSC</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name} {b.is_default && <Badge variant="outline">Default</Badge>}</TableCell>
                <TableCell>{b.bank_name}</TableCell>
                <TableCell>{b.account_number ? "••••" + String(b.account_number).slice(-4) : "—"}</TableCell>
                <TableCell>{b.ifsc}</TableCell>
                <TableCell className="text-right">{inr(bal(b.id, Number(b.opening_balance)))}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No bank accounts yet. Paid items post to the first account you add.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
