import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvoices, useProfiles } from "@/lib/creator-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, lakh } from "@/lib/creator";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/income")({
  head: () => ({ meta: [{ title: "Income Streams | DigiCRM AI" }, { name: "description", content: "Track sponsorship, affiliate, UGC, platform, consulting and event income in one place." }] }),
  component: IncomePage,
});

const STREAMS = ["Affiliate", "UGC", "YouTube AdSense", "Instagram bonus", "TikTok fund", "Consulting", "Events", "Courses / products", "Other"];

function IncomePage() {
  const qc = useQueryClient();
  const profiles = useProfiles();
  const invs = useInvoices();
  const rows = useQuery({ queryKey: ["creator", "income"], queryFn: async () => (await supabase.from("creator_income").select("*").order("received_on", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ stream: STREAMS[0], amount: "", received_on: new Date().toISOString().slice(0, 10), creator_id: "", note: "" });

  const summary = useMemo(() => {
    const m = new Map<string, number>();
    const sponsorship = (invs.data ?? []).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    if (sponsorship) m.set("Sponsorships (paid invoices)", sponsorship);
    for (const r of rows.data ?? []) m.set(r.stream, (m.get(r.stream) ?? 0) + Number(r.amount));
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const ym = new Date().toISOString().slice(0, 7);
    const month = (rows.data ?? []).filter((r) => r.received_on.startsWith(ym)).reduce((s, r) => s + Number(r.amount), 0)
      + (invs.data ?? []).filter((i) => i.paid_at?.startsWith(ym)).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    return { list: [...m.entries()].sort((a, b) => b[1] - a[1]), total, month };
  }, [rows.data, invs.data]);

  const add = async () => {
    const amount = Number(f.amount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    const { error } = await supabase.from("creator_income").insert({ stream: f.stream, amount, received_on: f.received_on, creator_id: f.creator_id || null, note: f.note || null });
    if (error) return toast.error(error.message);
    setF({ ...f, amount: "", note: "" }); qc.invalidateQueries({ queryKey: ["creator", "income"] }); toast.success("Income added");
  };
  const del = async (id: string) => { await supabase.from("creator_income").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["creator", "income"] }); };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total income</p><p className="text-xl font-bold">{lakh(summary.total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">This month</p><p className="text-xl font-bold">{lakh(summary.month)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Income streams</p><p className="text-xl font-bold">{summary.list.length}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Revenue by stream</CardTitle><CardDescription>Sponsorship income comes from your paid invoices automatically.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {summary.list.length === 0 && <p className="text-sm text-muted-foreground">No income yet.</p>}
            {summary.list.map(([k, v]) => (
              <div key={k} className="space-y-1">
                <div className="flex text-sm"><span className="flex-1">{k}</span><b>{inr(v)}</b></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${summary.total ? (v / summary.total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Add other income</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div><Label>Stream</Label><select className="w-full border rounded-md h-9 px-2 bg-background text-sm" value={f.stream} onChange={(e) => setF({ ...f, stream: e.target.value })}>{STREAMS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><Label>Amount (₹)</Label><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label>Received on</Label><Input type="date" value={f.received_on} onChange={(e) => setF({ ...f, received_on: e.target.value })} /></div>
            <div><Label>Creator</Label><select className="w-full border rounded-md h-9 px-2 bg-background text-sm" value={f.creator_id} onChange={(e) => setF({ ...f, creator_id: e.target.value })}><option value="">—</option>{(profiles.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
            <div className="col-span-2"><Label>Note</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
            <Button className="col-span-2" onClick={add}>Add income</Button>
          </CardContent>
        </Card>
      </div>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Stream</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{(rows.data ?? []).map((r) => (
          <TableRow key={r.id}><TableCell>{r.received_on}</TableCell><TableCell>{r.stream}</TableCell><TableCell className="text-muted-foreground">{r.note}</TableCell>
            <TableCell className="text-right">{inr(Number(r.amount))}</TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>
        ))}</TableBody>
      </Table></CardContent></Card>
    </div>
  );
}
