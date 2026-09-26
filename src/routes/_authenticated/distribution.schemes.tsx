import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LEVELS, distDb, inr, lakh, useInvalidateDist, useOrders, usePartners, useProducts, useSchemes, useTargets } from "@/lib/dist-data";

export const Route = createFileRoute("/_authenticated/distribution/schemes")({
  head: () => ({ meta: [{ title: "Schemes, Targets & Incentives | DigiDistribution AI" }, { name: "description", content: "Quantity and value schemes, targets at every level, run-rate projections and incentive payouts." }] }),
  component: SchemesPage,
});

const SCOPES = ["Company", "Region", "Territory", "Distributor", "Dealer", "Salesperson", "Retailer"];

function SchemesPage() {
  const schemes = useSchemes().data ?? [];
  const products = useProducts().data ?? [];
  const targets = useTargets().data ?? [];
  const orders = useOrders().data ?? [];
  const partners = usePartners().data ?? [];
  const inv = useInvalidateDist();
  const [s, setS] = useState({ name: "", kind: "Quantity", applies_to: "All", product_id: "", buy_qty: "10", free_qty: "1", min_value: "", discount_pct: "", ends_on: "" });
  const [t, setT] = useState({ scope: "Salesperson", scope_name: "", target: "", incentive_type: "Flat ₹", incentive_value: "" });

  const addScheme = async () => {
    if (!s.name) return toast.error("Name the scheme");
    const { error } = await distDb.from("dist_schemes").insert({ name: s.name, kind: s.kind, applies_to: s.applies_to, product_id: s.product_id || null, buy_qty: +s.buy_qty || null, free_qty: +s.free_qty || null, min_value: +s.min_value || null, discount_pct: +s.discount_pct || null, ends_on: s.ends_on || null });
    if (error) return toast.error(error.message);
    setS({ ...s, name: "" }); inv();
  };
  const addTarget = async () => {
    if (!t.scope_name || !+t.target) return toast.error("Who and how much?");
    const p = partners.find((x) => x.name === t.scope_name);
    const { error } = await distDb.from("dist_targets").insert({ scope: t.scope, scope_name: t.scope_name, target: +t.target, partner_id: p?.id ?? null, incentive_type: t.incentive_type, incentive_value: +t.incentive_value || null });
    if (error) return toast.error(error.message);
    setT({ ...t, scope_name: "", target: "" }); inv();
  };

  const achieved = useMemo(() => (tg: any) => {
    const inPeriod = orders.filter((o) => o.status !== "Cancelled" && o.order_date >= tg.period_start && o.order_date <= tg.period_end);
    const ids = new Set<string>();
    if (tg.partner_id) { ids.add(tg.partner_id); partners.forEach((p) => { if (p.parent_id === tg.partner_id) ids.add(p.id); }); }
    const rel = tg.scope === "Company" ? inPeriod
      : tg.scope === "Salesperson" ? inPeriod.filter((o) => (o.sales_rep ?? "").toLowerCase() === tg.scope_name.toLowerCase())
      : tg.partner_id ? inPeriod.filter((o) => ids.has(o.partner_id))
      : inPeriod.filter((o) => { const p = partners.find((x) => x.id === o.partner_id); return [p?.territory, p?.state, p?.city].some((v) => v && v.toLowerCase() === tg.scope_name.toLowerCase()); });
    return rel.reduce((a, o) => a + Number(o.total), 0);
  }, [orders, partners]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Schemes</CardTitle><CardDescription>Applied automatically when orders are created.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Scheme name (e.g. Buy 10 get 1)" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className="col-span-2" />
            <Select value={s.kind} onValueChange={(v) => setS({ ...s, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Quantity">Quantity (buy X get Y)</SelectItem><SelectItem value="Value">Value (₹ slab → % off)</SelectItem></SelectContent></Select>
            <Select value={s.applies_to} onValueChange={(v) => setS({ ...s, applies_to: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All levels</SelectItem>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
            {s.kind === "Quantity" ? (<>
              <Select value={s.product_id} onValueChange={(v) => setS({ ...s, product_id: v })}><SelectTrigger className="col-span-2"><SelectValue placeholder="Product" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              <Input type="number" placeholder="Buy qty" value={s.buy_qty} onChange={(e) => setS({ ...s, buy_qty: e.target.value })} />
              <Input type="number" placeholder="Free qty" value={s.free_qty} onChange={(e) => setS({ ...s, free_qty: e.target.value })} />
            </>) : (<>
              <Input type="number" placeholder="Min order ₹" value={s.min_value} onChange={(e) => setS({ ...s, min_value: e.target.value })} />
              <Input type="number" placeholder="Discount %" value={s.discount_pct} onChange={(e) => setS({ ...s, discount_pct: e.target.value })} />
            </>)}
            <Input type="date" value={s.ends_on} onChange={(e) => setS({ ...s, ends_on: e.target.value })} />
            <Button onClick={addScheme}><Plus className="h-4 w-4 mr-1" />Add scheme</Button>
          </div>
          {schemes.map((x) => (
            <div key={x.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">
                {x.kind === "Quantity" ? `${x.dist_products?.name ?? "Any"}: buy ${x.buy_qty} get ${x.free_qty} free` : `Orders ≥ ${inr(x.min_value)} get ${x.discount_pct}% off`} · {x.applies_to}{x.ends_on ? ` · till ${x.ends_on}` : ""}</div></div>
              <div className="flex items-center gap-2"><Switch checked={x.active} onCheckedChange={async (v) => { await distDb.from("dist_schemes").update({ active: v }).eq("id", x.id); inv(); }} />
                <Button size="icon" variant="ghost" onClick={async () => { await distDb.from("dist_schemes").delete().eq("id", x.id); inv(); }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Targets & incentives (this month)</CardTitle><CardDescription>Projection uses the current daily run rate. Incentive is earned at 100%.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={t.scope} onValueChange={(v) => setT({ ...t, scope: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SCOPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Input placeholder={t.scope === "Salesperson" ? "Salesperson name" : t.scope === "Company" ? "Company" : "Name (partner / territory)"} value={t.scope_name} onChange={(e) => setT({ ...t, scope_name: e.target.value })} list="dist-names" />
            <datalist id="dist-names">{partners.map((p) => <option key={p.id} value={p.name} />)}{[...new Set(partners.map((p) => p.sales_rep).filter(Boolean))].map((r) => <option key={r} value={r} />)}</datalist>
            <Input type="number" placeholder="Target ₹" value={t.target} onChange={(e) => setT({ ...t, target: e.target.value })} />
            <div className="flex gap-2">
              <Select value={t.incentive_type} onValueChange={(v) => setT({ ...t, incentive_type: v })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Flat ₹">Flat ₹</SelectItem><SelectItem value="% of sales">% of sales</SelectItem></SelectContent></Select>
              <Input type="number" placeholder="Incentive" value={t.incentive_value} onChange={(e) => setT({ ...t, incentive_value: e.target.value })} />
            </div>
            <Button onClick={addTarget} className="col-span-2"><Plus className="h-4 w-4 mr-1" />Add target</Button>
          </div>
          {targets.map((tg) => {
            const a = achieved(tg); const pct = tg.target ? Math.round((a / tg.target) * 100) : 0;
            const today = new Date(); const start = new Date(tg.period_start); const end = new Date(tg.period_end);
            const elapsed = Math.max(1, Math.min((today.getTime() - start.getTime()) / 864e5 + 1, (end.getTime() - start.getTime()) / 864e5 + 1));
            const total = (end.getTime() - start.getTime()) / 864e5 + 1;
            const proj = (a / elapsed) * total;
            const incentive = pct >= 100 && tg.incentive_value ? (tg.incentive_type === "% of sales" ? (a * tg.incentive_value) / 100 : tg.incentive_value) : 0;
            return (
              <div key={tg.id} className="rounded border p-2 text-sm space-y-1">
                <div className="flex justify-between"><span className="font-medium">{tg.scope}: {tg.scope_name}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => { await distDb.from("dist_targets").delete().eq("id", tg.id); inv(); }}><Trash2 className="h-3 w-3" /></Button></div>
                <Progress value={Math.min(100, pct)} />
                <div className="text-xs text-muted-foreground">{lakh(a)} of {lakh(tg.target)} ({pct}%) · projected {lakh(proj)}{proj < tg.target ? ` — short by ${lakh(tg.target - proj)}` : " — on track"}
                  {tg.incentive_value ? ` · incentive ${tg.incentive_type === "% of sales" ? `${tg.incentive_value}%` : inr(tg.incentive_value)}${incentive ? ` → earned ${inr(incentive)}` : ""}` : ""}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
