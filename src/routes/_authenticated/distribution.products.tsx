import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { distDb, inr, useInvalidateDist, useProducts } from "@/lib/dist-data";

export const Route = createFileRoute("/_authenticated/distribution/products")({
  head: () => ({ meta: [{ title: "Products & Stock | DigiDistribution AI" }, { name: "description", content: "Catalogue, stock, reorder levels, days of cover and near-expiry inventory." }] }),
  component: ProductsPage,
});

function status(p: any) {
  const days = p.daily_run_rate > 0 ? p.stock / p.daily_run_rate : Infinity;
  const exp = p.expiry_date ? (new Date(p.expiry_date).getTime() - Date.now()) / 864e5 : Infinity;
  if (p.stock <= 0) return { label: "Out of stock", v: "destructive" as const };
  if (days < 7) return { label: `Stock-out in ${Math.round(days)}d`, v: "destructive" as const };
  if (exp < 60) return { label: `Expires in ${Math.max(0, Math.round(exp))}d`, v: "destructive" as const };
  if (p.stock <= p.reorder_level) return { label: "Reorder", v: "secondary" as const };
  if (days > 90) return { label: "Overstock / slow", v: "outline" as const };
  return { label: "Healthy", v: "default" as const };
}

function ProductsPage() {
  const products = useProducts().data ?? [];
  const inv = useInvalidateDist();
  const [f, setF] = useState({ sku: "", name: "", category: "", unit: "carton", price: "", stock: "", reorder_level: "", daily_run_rate: "", expiry_date: "" });

  const add = async () => {
    if (!f.sku || !f.name) return toast.error("SKU and name are required");
    const { error } = await distDb.from("dist_products").insert({ ...f, price: +f.price || 0, stock: +f.stock || 0, reorder_level: +f.reorder_level || 0, daily_run_rate: +f.daily_run_rate || 0, expiry_date: f.expiry_date || null });
    if (error) return toast.error(error.message);
    setF({ sku: "", name: "", category: "", unit: "carton", price: "", stock: "", reorder_level: "", daily_run_rate: "", expiry_date: "" }); inv();
  };
  const upd = async (id: string, patch: any) => { const { error } = await distDb.from("dist_products").update(patch).eq("id", id); if (error) toast.error(error.message); else inv(); };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-3 grid grid-cols-2 md:grid-cols-10 gap-2 items-end">
        {(["sku", "name", "category", "unit", "price", "stock", "reorder_level", "daily_run_rate"] as const).map((k) => (
          <Input key={k} placeholder={k.replace(/_/g, " ")} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={k === "name" ? "md:col-span-2" : ""} />
        ))}
        <Input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} />
        <Button onClick={add} className="md:col-span-10 md:w-fit"><Plus className="h-4 w-4 mr-1" />Add product</Button>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Stock</TableHead><TableHead>Daily sales</TableHead><TableHead>Days cover</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {products.map((p) => { const s = status(p); return (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell>{p.name}<div className="text-xs text-muted-foreground">{p.category} · per {p.unit}{p.expiry_date ? ` · exp ${p.expiry_date}` : ""}</div></TableCell>
                <TableCell className="text-right">{inr(p.price)}</TableCell>
                <TableCell><Input type="number" className="h-8 w-24" defaultValue={p.stock} onBlur={(e) => +e.target.value !== p.stock && upd(p.id, { stock: +e.target.value })} /></TableCell>
                <TableCell>{p.daily_run_rate}</TableCell>
                <TableCell>{p.daily_run_rate > 0 ? Math.round(p.stock / p.daily_run_rate) : "—"}</TableCell>
                <TableCell><Badge variant={s.v}>{s.label}</Badge></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={async () => { await distDb.from("dist_products").delete().eq("id", p.id); inv(); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ); })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
