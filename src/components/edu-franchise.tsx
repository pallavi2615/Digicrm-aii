import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;
const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const ADMITTED = ["Admission", "Batch Allocation", "Active Student"];

/** Head-office franchise view for the Coaching CRM. */
export function EduFranchise({ tid, branches, students, fees, courses, onChange }: { tid: string; branches: any[]; students: any[]; fees: any[]; courses: any[]; onChange: () => void }) {
  const qc = useQueryClient();
  const period = new Date().toISOString().slice(0, 7);
  const { data: royalties = [] } = useQuery({ queryKey: ["edu", "royalties", tid], queryFn: async () => (await sb.from("edu_royalties").select("*, edu_branches(name)").eq("tenant_id", tid).order("period", { ascending: false })).data ?? [] });
  const [edit, setEdit] = useState<Record<string, any>>({});
  const [nb, setNb] = useState({ name: "", city: "", kind: "Franchise", franchisee_name: "", royalty_pct: 10, marketing_fee_pct: 2 });

  const rows = branches.map((b) => {
    const coll = fees.filter((f) => f.edu_students?.branch_id === b.id && (f.paid_at ?? "").slice(0, 7) === period).reduce((a, f) => a + Number(f.paid_amount || 0), 0);
    const leads = students.filter((s) => s.branch_id === b.id);
    return { ...b, coll, leads: leads.length, adm: leads.filter((s) => ADMITTED.includes(s.stage)).length, royalty: (coll * Number(b.royalty_pct)) / 100, mkt: (coll * Number(b.marketing_fee_pct)) / 100 };
  });
  const unassigned = students.filter((s) => !s.branch_id);
  const save = async (id: string) => { const { error } = await sb.from("edu_branches").update(edit[id]).eq("id", id); if (error) return toast.error(error.message); toast.success("Branch saved"); setEdit(({ [id]: _, ...r }) => r); onChange(); };
  const route = async () => {
    let n = 0;
    for (const s of unassigned) {
      const b = branches.find((x) => x.city && s.city && x.city.toLowerCase() === s.city.toLowerCase()) ?? branches.find((x) => x.territory && s.city && x.territory.toLowerCase().includes(s.city.toLowerCase()));
      if (b) { await sb.from("edu_students").update({ branch_id: b.id }).eq("id", s.id); n++; }
    }
    toast.success(`${n} of ${unassigned.length} local lead(s) routed to branches by city/territory`); onChange();
  };
  const statements = async () => {
    const list = rows.filter((r) => r.kind === "Franchise");
    if (!list.length) return toast.error("Mark at least one branch as Franchise first.");
    const { error } = await sb.from("edu_royalties").upsert(list.map((r) => ({ tenant_id: tid, branch_id: r.id, period, collection: r.coll, royalty: r.royalty, marketing_fee: r.mkt })), { onConflict: "branch_id,period" });
    if (error) return toast.error(error.message);
    toast.success(`Royalty statements for ${period} ready`); qc.invalidateQueries({ queryKey: ["edu", "royalties", tid] });
  };
  const tot = rows.reduce((a, r) => ({ coll: a.coll + r.coll, roy: a.roy + (r.kind === "Franchise" ? r.royalty + r.mkt : 0), leads: a.leads + r.leads }), { coll: 0, roy: 0, leads: 0 });

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {[["Branches", branches.length], ["Franchise branches", branches.filter((b) => b.kind === "Franchise").length], ["Network collection (MTD)", inr(tot.coll)], ["Royalty + marketing due (MTD)", inr(tot.roy)]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-semibold">{v}</p></CardContent></Card>))}
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Branch network</CardTitle><CardDescription>Every branch shares the same admission pipeline, course catalogue ({courses.length} courses), WhatsApp templates and AI agents from head office. Royalty is calculated on fees collected this month.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>Type</TableHead><TableHead>Franchisee</TableHead><TableHead>Royalty %</TableHead><TableHead>Mkt %</TableHead><TableHead>Leads</TableHead><TableHead>Admissions</TableHead><TableHead>Collection</TableHead><TableHead>Royalty due</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rows.map((r) => { const e = edit[r.id]; const v = (k: string) => (e?.[k] ?? r[k] ?? ""); const set = (k: string, x: any) => setEdit({ ...edit, [r.id]: { ...(e ?? {}), [k]: x } }); return (
            <TableRow key={r.id}>
              <TableCell>{r.name}<span className="block text-xs text-muted-foreground">{r.city}</span></TableCell>
              <TableCell><Select value={v("kind")} onValueChange={(x) => set("kind", x)}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Company-owned">Company-owned</SelectItem><SelectItem value="Franchise">Franchise</SelectItem></SelectContent></Select></TableCell>
              <TableCell><Input className="h-8 w-32" value={v("franchisee_name")} onChange={(x) => set("franchisee_name", x.target.value)} /></TableCell>
              <TableCell><Input className="h-8 w-16" type="number" value={v("royalty_pct")} onChange={(x) => set("royalty_pct", Number(x.target.value))} /></TableCell>
              <TableCell><Input className="h-8 w-16" type="number" value={v("marketing_fee_pct")} onChange={(x) => set("marketing_fee_pct", Number(x.target.value))} /></TableCell>
              <TableCell>{r.leads}</TableCell><TableCell>{r.adm}</TableCell><TableCell>{inr(r.coll)}</TableCell>
              <TableCell>{r.kind === "Franchise" ? inr(r.royalty + r.mkt) : "—"}</TableCell>
              <TableCell>{e && <Button size="sm" onClick={() => save(r.id)}>Save</Button>}</TableCell>
            </TableRow>); })}</TableBody></Table>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input className="h-8 w-36" placeholder="New branch name" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} />
            <Input className="h-8 w-28" placeholder="City" value={nb.city} onChange={(e) => setNb({ ...nb, city: e.target.value })} />
            <Input className="h-8 w-36" placeholder="Franchisee" value={nb.franchisee_name} onChange={(e) => setNb({ ...nb, franchisee_name: e.target.value })} />
            <Button size="sm" disabled={!nb.name.trim()} onClick={async () => { const { error } = await sb.from("edu_branches").insert({ tenant_id: tid, ...nb }); if (error) toast.error(error.message); else { toast.success("Franchise branch added"); setNb({ ...nb, name: "", city: "", franchisee_name: "" }); onChange(); } }}>Add franchise branch</Button>
          </div></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Local lead routing</CardTitle><CardDescription>{unassigned.length} lead(s) have no branch. Head office routes them to the branch in the same city or territory.</CardDescription></CardHeader>
          <CardContent><Button size="sm" disabled={!unassigned.length} onClick={route}>Route local leads</Button></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><div><CardTitle className="text-sm">Royalty statements</CardTitle><CardDescription>Monthly royalty + marketing fee per franchise.</CardDescription></div><Button size="sm" onClick={statements}>Generate {period}</Button></CardHeader>
          <CardContent className="space-y-1 text-sm">{royalties.map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2"><span className="font-medium">{r.edu_branches?.name}</span><span className="text-xs text-muted-foreground">{r.period} · on {inr(r.collection)}</span><span className="ml-auto">{inr(Number(r.royalty) + Number(r.marketing_fee))}</span>
              <Badge variant={r.status === "Paid" ? "default" : "secondary"}>{r.status}</Badge>
              {r.status !== "Paid" && <Button size="sm" variant="outline" onClick={async () => { const ref = prompt("Payment reference (UTR)") ?? ""; await sb.from("edu_royalties").update({ status: "Paid", paid_on: new Date().toISOString().slice(0, 10), reference: ref }).eq("id", r.id); qc.invalidateQueries({ queryKey: ["edu", "royalties", tid] }); }}>Mark paid</Button>}</div>))}
            {!royalties.length && <p className="text-muted-foreground">No statements yet.</p>}</CardContent></Card>
      </div>
    </div>
  );
}
