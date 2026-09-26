import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Network, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr, lakh } from "@/lib/dist-data";

export const Route = createFileRoute("/_authenticated/dist-portal")({
  head: () => ({
    meta: [
      { title: "Distributor Portal | DigiDistribution AI" },
      { name: "description", content: "Distributors see their own orders, stock, sales, outstanding and payments." },
      { property: "og:title", content: "Distributor Portal | DigiDistribution AI" },
      { property: "og:description", content: "Your orders, stock, sales, outstanding and collections in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DistPortal,
});

const sb = supabase as any;

function DistPortal() {
  const qc = useQueryClient();
  const [claimed, setClaimed] = useState(false);
  useEffect(() => { sb.rpc("dist_portal_claim").then(() => { setClaimed(true); qc.invalidateQueries({ queryKey: ["dp"] }); }); }, [qc]);

  const { data: me = [], isLoading } = useQuery({ queryKey: ["dp", "me"], enabled: claimed, queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await sb.from("dist_partners").select("*").eq("portal_user_id", u.user?.id);
    if (error) throw error; return data ?? [];
  } });
  const [pid, setPid] = useState("");
  useEffect(() => { if (!pid && me.length) setPid(me[0].id); }, [me, pid]);
  const partner = me.find((p: any) => p.id === pid);

  const q = (key: string, fn: () => any) => useQuery({ queryKey: ["dp", key, pid], enabled: !!pid, queryFn: async () => { const { data, error } = await fn(); if (error) throw error; return data ?? []; } });
  const orders = q("orders", () => sb.from("dist_orders").select("*, dist_order_items(qty, free_qty, price, line_total, dist_products(name, sku))").eq("partner_id", pid).order("created_at", { ascending: false })).data ?? [];
  const cols = q("cols", () => sb.from("dist_collections").select("*").eq("partner_id", pid).order("collected_on", { ascending: false })).data ?? [];
  const stock = q("stock", () => sb.from("dist_partner_stock").select("*, dist_products(name, sku, price, unit)").eq("partner_id", pid)).data ?? [];
  const sales = q("sales", () => sb.from("dist_partner_sales").select("*, dist_products(name, sku)").eq("partner_id", pid).order("sold_on", { ascending: false })).data ?? [];
  const products = q("products", () => sb.from("dist_products").select("id, name, sku, price, unit").eq("owner_id", partner?.owner_id).order("name")).data ?? [];
  const schemes = q("schemes", () => sb.from("dist_schemes").select("name, kind, buy_qty, free_qty, discount_pct, ends_on").eq("owner_id", partner?.owner_id)).data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["dp"] });

  const billed = orders.filter((o: any) => ["Dispatched", "Delivered"].includes(o.status)).reduce((a: number, o: any) => a + Number(o.total), 0);
  const paid = cols.filter((c: any) => c.status !== "Pending").reduce((a: number, c: any) => a + Number(c.amount), 0);
  const outstanding = billed - paid;
  const month = new Date().toISOString().slice(0, 7);
  const salesMonth = sales.filter((s: any) => s.sold_on.startsWith(month)).reduce((a: number, s: any) => a + Number(s.amount), 0);
  const stockValue = stock.reduce((a: number, s: any) => a + s.qty * Number(s.dist_products?.price || 0), 0);

  // order form
  const [cart, setCart] = useState<{ product_id: string; qty: string }[]>([{ product_id: "", qty: "1" }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cartTotal = useMemo(() => cart.reduce((a, c) => a + (Number(products.find((p: any) => p.id === c.product_id)?.price) || 0) * (Number(c.qty) || 0), 0), [cart, products]);
  const placeOrder = async () => {
    const items = cart.filter((c) => c.product_id && Number(c.qty) > 0).map((c) => ({ product_id: c.product_id, qty: Number(c.qty) }));
    if (!items.length) return toast.error("Add at least one product");
    setBusy(true);
    const { error } = await sb.rpc("dist_portal_place_order", { _partner: pid, _items: items, _note: note || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Order sent to head office"); setCart([{ product_id: "", qty: "1" }]); setNote(""); refresh();
  };
  // sale form
  const [sale, setSale] = useState({ product_id: "", qty: "1", amount: "", customer: "" });
  const recordSale = async () => {
    if (!sale.product_id || !(Number(sale.qty) > 0)) return toast.error("Pick a product and quantity");
    const pr = stock.find((s: any) => s.product_id === sale.product_id)?.dist_products;
    const { error } = await sb.from("dist_partner_sales").insert({ partner_id: pid, owner_id: partner.owner_id, product_id: sale.product_id, qty: Number(sale.qty), amount: Number(sale.amount) || Number(sale.qty) * Number(pr?.price || 0), customer: sale.customer || null });
    if (error) return toast.error(error.message);
    toast.success("Sale recorded, stock updated"); setSale({ product_id: "", qty: "1", amount: "", customer: "" }); refresh();
  };
  // payment
  const [pay, setPay] = useState({ amount: "", method: "UPI", reference: "" });
  const reportPay = async () => {
    const { error } = await sb.rpc("dist_portal_report_payment", { _partner: pid, _amount: Number(pay.amount), _method: pay.method, _reference: pay.reference || null });
    if (error) return toast.error(error.message);
    toast.success("Payment reported — head office will confirm it"); setPay({ amount: "", method: "UPI", reference: "" }); refresh();
  };

  if (!claimed || isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!me.length) return (
    <Card className="max-w-lg mx-auto mt-12"><CardContent className="p-8 text-center space-y-2">
      <Network className="h-8 w-8 mx-auto text-muted-foreground" />
      <h2 className="text-lg font-semibold">No distributor account linked</h2>
      <p className="text-sm text-muted-foreground">Ask your brand's head office to add your email as the "portal email" on your distributor profile, then sign in with that same email.</p>
    </CardContent></Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{partner?.name}</h1>
          <p className="text-xs text-muted-foreground">{[partner?.level, partner?.territory || partner?.city, `Credit limit ${lakh(partner?.credit_limit)}`, `${partner?.payment_terms_days}-day terms`].filter(Boolean).join(" · ")}</p></div>
        {me.length > 1 && <Select value={pid} onValueChange={setPid}><SelectTrigger className="w-64 ml-auto"><SelectValue /></SelectTrigger><SelectContent>{me.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>}
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[["Orders", orders.length], ["Stock value", lakh(stockValue)], ["Sales this month", lakh(salesMonth)], ["Outstanding", lakh(outstanding)], ["Paid to date", lakh(paid)]].map(([k, v]) => (
          <Card key={k as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className={`text-2xl font-bold ${k === "Outstanding" && outstanding > Number(partner?.credit_limit || 0) && partner?.credit_limit > 0 ? "text-destructive" : ""}`}>{v as any}</div></CardContent></Card>))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="stock">Stock</TabsTrigger><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="outstanding">Outstanding & payments</TabsTrigger></TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Place a new order</CardTitle>{schemes.length > 0 && <CardDescription>Active schemes: {schemes.map((s: any) => s.name).join(", ")}</CardDescription>}</CardHeader>
            <CardContent className="space-y-2">
              {cart.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={c.product_id} onValueChange={(v) => setCart(cart.map((x, j) => (j === i ? { ...x, product_id: v } : x)))}><SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} · {inr(p.price)}/{p.unit}</SelectItem>)}</SelectContent></Select>
                  <Input className="w-24" type="number" min={1} value={c.qty} onChange={(e) => setCart(cart.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                  <Button size="icon" variant="ghost" onClick={() => setCart(cart.filter((_, j) => j !== i))} disabled={cart.length === 1}><Trash2 className="h-4 w-4" /></Button>
                </div>))}
              <div className="flex gap-2 items-center"><Button size="sm" variant="outline" onClick={() => setCart([...cart, { product_id: "", qty: "1" }])}><Plus className="h-3 w-3 mr-1" />Add line</Button><span className="ml-auto font-semibold">{inr(cartTotal)}</span></div>
              <Input placeholder="Note for head office (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button onClick={placeOrder} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Send order</Button>
            </CardContent></Card>
          <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{orders.map((o: any) => (<TableRow key={o.id}><TableCell className="font-medium">{o.number}</TableCell><TableCell>{o.order_date}</TableCell>
              <TableCell className="text-xs">{o.dist_order_items?.map((i: any) => `${i.dist_products?.name} × ${i.qty}${i.free_qty ? ` (+${i.free_qty} free)` : ""}`).join(", ")}</TableCell>
              <TableCell>{inr(o.total)}</TableCell><TableCell><Badge variant={o.status === "Delivered" ? "default" : "outline"}>{o.status}</Badge></TableCell></TableRow>))}
              {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No orders yet</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="stock"><Card><CardHeader className="pb-2"><CardDescription>Stock goes up automatically when an order is delivered and down when you record a sale.</CardDescription></CardHeader>
          <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">In stock</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
            <TableBody>{stock.map((s: any) => (<TableRow key={s.id}><TableCell>{s.dist_products?.name}</TableCell><TableCell className="text-xs">{s.dist_products?.sku}</TableCell><TableCell className="text-right">{s.qty} {s.dist_products?.unit}</TableCell><TableCell className="text-right">{inr(s.qty * Number(s.dist_products?.price || 0))}</TableCell></TableRow>))}
              {stock.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No stock yet — it appears once an order is delivered</TableCell></TableRow>}</TableBody></Table></CardContent></Card></TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Record a sale</CardTitle></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-5">
              <Select value={sale.product_id} onValueChange={(v) => setSale({ ...sale, product_id: v })}><SelectTrigger className="md:col-span-2"><SelectValue placeholder="Product from your stock" /></SelectTrigger>
                <SelectContent>{stock.filter((s: any) => s.qty > 0).map((s: any) => <SelectItem key={s.product_id} value={s.product_id}>{s.dist_products?.name} ({s.qty} left)</SelectItem>)}</SelectContent></Select>
              <Input type="number" placeholder="Qty" value={sale.qty} onChange={(e) => setSale({ ...sale, qty: e.target.value })} />
              <Input type="number" placeholder="Amount ₹ (optional)" value={sale.amount} onChange={(e) => setSale({ ...sale, amount: e.target.value })} />
              <Input placeholder="Customer / retailer" value={sale.customer} onChange={(e) => setSale({ ...sale, customer: e.target.value })} />
              <Button className="md:col-span-5 w-fit" onClick={recordSale}>Record sale</Button>
            </CardContent></Card>
          <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{sales.map((s: any) => (<TableRow key={s.id}><TableCell>{s.sold_on}</TableCell><TableCell>{s.dist_products?.name}</TableCell><TableCell>{s.qty}</TableCell><TableCell>{s.customer ?? "—"}</TableCell><TableCell className="text-right">{inr(s.amount)}</TableCell></TableRow>))}
              {sales.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No sales recorded</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="outstanding" className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Outstanding {lakh(outstanding)}</CardTitle><CardDescription>Billed (dispatched + delivered) {lakh(billed)} − confirmed payments {lakh(paid)}</CardDescription></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-4 items-end">
              <div className="space-y-1"><Label className="text-xs">Amount paid (₹)</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Method</Label><Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["UPI", "NEFT/RTGS", "Cheque", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">UTR / reference</Label><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
              <Button onClick={reportPay}>Report payment</Button>
            </CardContent></Card>
          <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{cols.map((c: any) => (<TableRow key={c.id}><TableCell>{c.collected_on}</TableCell><TableCell>{c.method}</TableCell><TableCell className="text-xs">{c.reference ?? "—"}</TableCell><TableCell><Badge variant={c.status === "Pending" ? "outline" : "default"}>{c.status === "Pending" ? "Awaiting confirmation" : "Confirmed"}</Badge></TableCell><TableCell className="text-right">{inr(c.amount)}</TableCell></TableRow>))}
              {cols.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
