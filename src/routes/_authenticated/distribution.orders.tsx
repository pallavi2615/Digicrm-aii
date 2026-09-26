import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ORDER_STATUS, distDb, inr, priceCart, useInvalidateDist, useOrders, usePartners, useProducts, useSchemes } from "@/lib/dist-data";
import { AiButton, parseJson, useDistAi } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/distribution/orders")({
  head: () => ({ meta: [{ title: "Orders | DigiDistribution AI" }, { name: "description", content: "Create orders manually or from WhatsApp messages with schemes applied automatically." }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const orders = useOrders().data ?? [];
  const partners = usePartners().data ?? [];
  const products = useProducts().data ?? [];
  const schemes = useSchemes().data ?? [];
  const inv = useInvalidateDist();
  const ai = useDistAi();
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [lines, setLines] = useState<{ product_id: string; qty: number }[]>([]);
  const [source, setSource] = useState("Manual");
  const [filter, setFilter] = useState("all");
  const partner = partners.find((p) => p.id === partnerId);
  const cart = priceCart(lines, products, schemes, partner?.level);

  const parse = async () => {
    if (!msg.trim()) return;
    const r = parseJson(await ai.run({ mode: "parse_order", message: msg }), { partner_id: null as string | null, items: [] as any[], unmatched: [] as string[], reply: "" });
    if (r.partner_id) setPartnerId(r.partner_id);
    setLines(r.items.filter((i) => products.some((p) => p.id === i.product_id)).map((i) => ({ product_id: i.product_id, qty: Math.max(1, Math.round(Number(i.qty) || 1)) })));
    setReply(r.reply); setSource("WhatsApp");
    if (r.unmatched?.length) toast.warning(`Couldn't match: ${r.unmatched.join(", ")}`);
  };

  const create = async () => {
    if (!partnerId) return toast.error("Pick the retailer / partner");
    if (!cart.lines.length) return toast.error("Add at least one product");
    const { data: o, error } = await distDb.from("dist_orders").insert({
      partner_id: partnerId, source, raw_message: source === "WhatsApp" ? msg : null,
      subtotal: cart.subtotal, discount: cart.discount, total: cart.total, sales_rep: partner?.sales_rep ?? null,
    }).select("id, number").single();
    if (error) return toast.error(error.message);
    const { error: e2 } = await distDb.from("dist_order_items").insert(cart.lines.map((l) => ({ order_id: o.id, product_id: l.product_id, qty: l.qty, free_qty: l.free_qty, price: l.price, scheme: l.scheme, line_total: l.line_total })));
    if (e2) return toast.error(e2.message);
    toast.success(`Order ${o.number} created — ${inr(cart.total)}`);
    setLines([]); setMsg(""); setReply(""); setPartnerId(""); setSource("Manual"); inv();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await distDb.from("dist_orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    inv();
  };

  const shown = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">AI Order Agent — WhatsApp message</CardTitle>
            <CardDescription>Paste a retailer's message, e.g. "Bhaiya 10 carton XYZ aur 5 carton ABC bhej do".</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Paste WhatsApp order…" />
            <AiButton loading={ai.loading} onClick={parse}>Read order</AiButton>
            {reply && <div className="rounded border bg-muted/40 p-2 text-sm"><div className="text-xs text-muted-foreground mb-1">Suggested reply</div>{reply}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">New order</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><Label>Partner</Label><Select value={partnerId} onValueChange={setPartnerId}><SelectTrigger><SelectValue placeholder="Pick retailer / dealer" /></SelectTrigger>
              <SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.level}</SelectItem>)}</SelectContent></Select></div>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Select value={l.product_id} onValueChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, product_id: v } : x)))}><SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({inr(p.price)}/{p.unit})</SelectItem>)}</SelectContent></Select>
                <Input type="number" className="w-24" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
                <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setLines([...lines, { product_id: products[0]?.id ?? "", qty: 1 }])}><Plus className="h-4 w-4 mr-1" />Add line</Button>
            {cart.lines.length > 0 && (
              <div className="rounded border p-2 text-sm space-y-1">
                {cart.lines.map((l, i) => <div key={i} className="flex justify-between"><span>{l.name} × {l.qty}{l.free_qty ? ` + ${l.free_qty} free (${l.scheme})` : ""}</span><span>{inr(l.line_total)}</span></div>)}
                {cart.discount > 0 && <div className="flex justify-between text-primary"><span>{cart.valueSchemes.join(", ")}</span><span>−{inr(cart.discount)}</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{inr(cart.total)}</span></div>
              </div>
            )}
            <Button onClick={create} className="w-full">Create order</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-base">Orders</CardTitle>
          <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Partner</TableHead><TableHead>Items</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.number}<div className="text-muted-foreground">{o.order_date}</div></TableCell>
                  <TableCell>{o.dist_partners?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{(o.dist_order_items ?? []).map((i: any) => `${i.dist_products?.name ?? "?"} ×${i.qty}${i.free_qty ? `+${i.free_qty}` : ""}`).join(", ")}</TableCell>
                  <TableCell><Badge variant="outline">{o.source}</Badge></TableCell>
                  <TableCell className="text-right">{inr(o.total)}</TableCell>
                  <TableCell>
                    <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                  </TableCell>
                </TableRow>
              ))}
              {!shown.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No orders.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
