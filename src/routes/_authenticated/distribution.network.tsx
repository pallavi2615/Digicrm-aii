import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { LEVELS, ONBOARDING, distDb, lakh, outstandingMap, useCollections, useInvalidateDist, useOrders, usePartners } from "@/lib/dist-data";

export const Route = createFileRoute("/_authenticated/distribution/network")({
  head: () => ({ meta: [{ title: "Network | DigiDistribution AI" }, { name: "description", content: "Super distributors, distributors, dealers and retailers with onboarding, credit and territory." }] }),
  component: NetworkPage,
});

const EMPTY = { name: "", level: "Retailer", parent_id: "", owner_name: "", phone: "", email: "", gstin: "", pan: "", city: "", state: "", territory: "", category: "", credit_limit: "0", payment_terms_days: "30", onboarding_stage: "Lead", sales_rep: "", portal_email: "" };

function NetworkPage() {
  const partners = usePartners().data ?? [];
  const orders = useOrders().data ?? [];
  const cols = useCollections().data ?? [];
  const inv = useInvalidateDist();
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const om = useMemo(() => outstandingMap(orders, cols), [orders, cols]);
  const list = partners.filter((p) => (level === "all" || p.level === level) && (!q || `${p.name} ${p.city} ${p.territory} ${p.owner_name}`.toLowerCase().includes(q.toLowerCase())));

  const save = async () => {
    if (!edit.name.trim()) return toast.error("Name is required");
    const row = { ...edit, parent_id: edit.parent_id || null, credit_limit: Number(edit.credit_limit) || 0, payment_terms_days: Number(edit.payment_terms_days) || 0 };
    delete row.id; delete row.created_at; delete row.updated_at; delete row.owner_id; delete row.loyalty_points; delete row.portal_user_id; row.portal_email = (row.portal_email || "").trim().toLowerCase() || null;
    const { error } = edit.id ? await distDb.from("dist_partners").update(row).eq("id", edit.id) : await distDb.from("dist_partners").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEdit(null); inv();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search name, city, territory…" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={level} onValueChange={setLevel}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All levels</SelectItem>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
        <div className="flex-1" />
        <Button onClick={() => setEdit({ ...EMPTY })}><Plus className="h-4 w-4 mr-1" />Add partner</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {ONBOARDING.map((st) => <Card key={st}><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">{st}</div><div className="text-lg font-bold">{partners.filter((p) => p.onboarding_stage === st).length}</div></CardContent></Card>)}
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Level</TableHead><TableHead>Parent</TableHead><TableHead>Territory</TableHead><TableHead>Stage</TableHead><TableHead className="text-right">Credit used</TableHead><TableHead>Rep</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {list.map((p) => {
              const r = om[p.id]; const out = r ? Math.max(0, r.billed - r.paid) : 0;
              const pct = p.credit_limit ? Math.round((out / p.credit_limit) * 100) : 0;
              return (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.owner_name} {p.phone}</div></TableCell>
                  <TableCell><Badge variant="outline">{p.level}</Badge></TableCell>
                  <TableCell className="text-sm">{partners.find((x) => x.id === p.parent_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.territory || p.city}{p.state ? `, ${p.state}` : ""}</TableCell>
                  <TableCell>
                    <Select value={p.onboarding_stage} onValueChange={async (v) => { await distDb.from("dist_partners").update({ onboarding_stage: v }).eq("id", p.id); inv(); }}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{ONBOARDING.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right text-sm"><span className={pct > 90 ? "text-destructive font-medium" : ""}>{lakh(out)}</span><div className="text-xs text-muted-foreground">of {lakh(p.credit_limit)}</div></TableCell>
                  <TableCell className="text-sm">{p.sales_rep ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setEdit({ ...p, parent_id: p.parent_id ?? "", credit_limit: String(p.credit_limit), payment_terms_days: String(p.payment_terms_days) })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (!confirm(`Delete ${p.name}?`)) return; await distDb.from("dist_partners").delete().eq("id", p.id); inv(); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!list.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No partners yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit partner" : "Add partner"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><Label>Business name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>Level</Label><Select value={edit.level} onValueChange={(v) => setEdit({ ...edit, level: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Reports to</Label><Select value={edit.parent_id || "none"} onValueChange={(v) => setEdit({ ...edit, parent_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Brand HQ</SelectItem>{partners.filter((x) => x.id !== edit.id && x.level !== "Retailer").map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></div>
              {(["owner_name", "phone", "email", "gstin", "pan", "city", "state", "territory", "category", "sales_rep", "portal_email"] as const).map((k) => (
                <div key={k}><Label className="capitalize">{k.replace("_", " ")}</Label><Input value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
              ))}
              <div><Label>Credit limit (₹)</Label><Input type="number" value={edit.credit_limit} onChange={(e) => setEdit({ ...edit, credit_limit: e.target.value })} /></div>
              <div><Label>Payment terms (days)</Label><Input type="number" value={edit.payment_terms_days} onChange={(e) => setEdit({ ...edit, payment_terms_days: e.target.value })} /></div>
              <div><Label>Onboarding stage</Label><Select value={edit.onboarding_stage} onValueChange={(v) => setEdit({ ...edit, onboarding_stage: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ONBOARDING.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" asChild><Link to="/digiverify"><ShieldCheck className="h-4 w-4 mr-1" />Verify GST / PAN in DigiVerify</Link></Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
