import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, MessageCircle, Sparkles, Star, UtensilsCrossed, Plus, Wand2, Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/lib/tenants";
import { restAi } from "@/lib/restaurant.functions";
import { Md } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/restaurant")({
  head: () => ({
    meta: [
      { title: "Restaurant OS — outlets, reservations, orders, loyalty | DigiCRM AI" },
      { name: "description", content: "Outlet metrics, reservations, orders, loyalty, reviews and AI follow-ups for restaurants." },
      { property: "og:title", content: "Restaurant OS | DigiCRM AI" },
      { property: "og:description", content: "Run every outlet, table and guest relationship from one AI-powered CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RestaurantOS,
});

const sb = supabase as any;
const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const RES_STATUS = ["Booked", "Confirmed", "Waitlist", "Seated", "Completed", "No-show", "Cancelled"];
const CHANNELS = ["Dine-in", "Takeaway", "Delivery", "Zomato", "Swiggy", "Catering", "Corporate"];
const wa = (phone: string | null | undefined, text: string) => `https://wa.me/${(phone ?? "").replace(/\D/g, "").slice(-10) ? "91" + (phone ?? "").replace(/\D/g, "").slice(-10) : ""}?text=${encodeURIComponent(text)}`;
const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

function RestaurantOS() {
  const { active, loading } = useActiveTenant();
  const tid = active?.id;
  const qc = useQueryClient();
  const ai = useServerFn(restAi);
  const [busy, setBusy] = useState<string | null>(null);
  const [outletFilter, setOutletFilter] = useState("all");

  const t = (table: string, select = "*", order = "created_at") => useQuery({
    queryKey: ["rest", table, tid], enabled: !!tid,
    queryFn: async () => { const { data, error } = await sb.from(table).select(select).eq("tenant_id", tid).order(order, { ascending: false }).limit(3000); if (error) throw error; return data ?? []; },
  }).data ?? [];
  const outlets = t("rest_outlets", "*", "name");
  const guests = t("rest_guests");
  const resv = t("rest_reservations", "*, rest_outlets(name)", "reserved_for");
  const orders = t("rest_orders", "*, rest_outlets(name), rest_guests(name)", "ordered_at");
  const reviews = t("rest_reviews", "*, rest_outlets(name)");
  const actions = t("rest_actions", "*, rest_guests(name, phone, loyalty_points)", "priority");
  const loyalty = t("rest_loyalty", "*, rest_guests(name)");
  const refresh = () => qc.invalidateQueries({ queryKey: ["rest"] });
  const run = async (p: PromiseLike<{ error: any }>, ok?: string) => { const { error } = await p; if (error) { toast.error(error.message); return false; } if (ok) toast.success(ok); refresh(); return true; };

  const inOutlet = (x: any) => outletFilter === "all" || x.outlet_id === outletFilter;
  const today = dayKey(new Date());
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const doneOrders = orders.filter((o: any) => o.status === "Completed" && inOutlet(o));

  const outletStats = useMemo(() => outlets.map((o: any) => {
    const os = orders.filter((x: any) => x.outlet_id === o.id && x.status === "Completed");
    const month = os.filter((x: any) => x.ordered_at >= monthStart);
    const rev = month.reduce((a: number, x: any) => a + Number(x.amount), 0);
    const todayRev = os.filter((x: any) => dayKey(x.ordered_at) === today).reduce((a: number, x: any) => a + Number(x.amount), 0);
    const covers = month.reduce((a: number, x: any) => a + (Number(x.covers) || 0), 0);
    const days = Math.max(1, new Date().getDate());
    const rs = resv.filter((x: any) => x.outlet_id === o.id && x.reserved_for >= monthStart);
    const noShow = rs.filter((x: any) => x.status === "No-show").length;
    const rv = reviews.filter((x: any) => x.outlet_id === o.id);
    return { ...o, rev, todayRev, orders: month.length, avgBill: month.length ? rev / month.length : 0, covers,
      turns: o.seats ? covers / (o.seats * days) : 0, targetPct: o.monthly_target ? (rev / o.monthly_target) * 100 : null,
      noShowPct: rs.length ? (noShow / rs.length) * 100 : 0, rating: rv.length ? rv.reduce((a: number, x: any) => a + x.rating, 0) / rv.length : null };
  }), [outlets, orders, resv, reviews, monthStart, today]);

  // ---------- AI follow-up rules ----------
  const generate = async () => {
    setBusy("gen");
    const soon = (d: string | null, n: number) => { if (!d) return false; const x = new Date(d); const now = new Date(); const next = new Date(now.getFullYear(), x.getMonth(), x.getDate()); if (next < new Date(now.toDateString())) next.setFullYear(now.getFullYear() + 1); return (next.getTime() - now.getTime()) / 864e5 <= n; };
    const open = new Set(actions.filter((a: any) => a.status === "Open").map((a: any) => `${a.guest_id}:${a.kind}`));
    const rows: any[] = [];
    const add = (g: any, kind: string, reason: string, priority: number) => { if (!open.has(`${g.id}:${kind}`)) { rows.push({ tenant_id: tid, guest_id: g.id, kind, reason, priority }); open.add(`${g.id}:${kind}`); } };
    for (const g of guests as any[]) {
      if (soon(g.birthday, 7)) add(g, "Birthday offer", `Birthday on ${g.birthday?.slice(5)}`, 1);
      if (soon(g.anniversary, 7)) add(g, "Anniversary offer", `Anniversary on ${g.anniversary?.slice(5)}`, 1);
      const idle = g.last_visit_at ? (Date.now() - new Date(g.last_visit_at).getTime()) / 864e5 : null;
      if (idle != null && idle > 30 && g.visits >= 2) add(g, "Win-back", `${Math.round(idle)} days since last visit · ${g.visits} visits · ${inr(g.total_spend)} lifetime`, g.tier === "Platinum" || g.tier === "Gold" ? 1 : 2);
      if (g.loyalty_points >= 500) add(g, "Redeem points", `${g.loyalty_points} points waiting to be used`, 3);
    }
    for (const r of reviews as any[]) if (r.rating <= 3 && !r.reply && r.guest_id) add({ id: r.guest_id }, "Service recovery", `${r.rating}★ review on ${r.platform}: "${(r.comment ?? "").slice(0, 80)}"`, 1);
    for (const r of resv as any[]) if (r.status === "No-show" && r.guest_id && (Date.now() - new Date(r.reserved_for).getTime()) / 864e5 < 7) add({ id: r.guest_id }, "No-show rebook", `Missed a table for ${r.party_size} on ${dayKey(r.reserved_for)}`, 2);
    if (rows.length) await run(sb.from("rest_actions").insert(rows), `${rows.length} follow-up actions created`);
    else toast.info("No new follow-ups needed right now");
    setBusy(null);
  };
  const draft = async (a: any) => { setBusy(a.id); try { await ai({ data: { tenantId: tid!, mode: "draft_action", id: a.id } }); refresh(); } catch (e: any) { toast.error(e.message); } setBusy(null); };

  // ---------- Sample data ----------
  const seed = async () => {
    setBusy("seed");
    try {
      const { data: os, error } = await sb.from("rest_outlets").insert([
        { tenant_id: tid, name: "Koramangala", city: "Bengaluru", seats: 60, monthly_target: 1800000, manager: "Ravi" },
        { tenant_id: tid, name: "Indiranagar", city: "Bengaluru", seats: 45, monthly_target: 1300000, manager: "Nisha" },
      ]).select("id");
      if (error) throw error;
      const names = ["Aarav Sharma", "Priya Nair", "Rohan Gupta", "Sneha Iyer", "Vikram Singh", "Ananya Das", "Karan Mehta", "Isha Reddy"];
      const now = new Date();
      const { data: gs, error: ge } = await sb.from("rest_guests").insert(names.map((n, i) => ({ tenant_id: tid, name: n, phone: `98${String(45000000 + i * 1111).padStart(8, "0")}`, birthday: new Date(1990 + i, now.getMonth(), Math.min(28, now.getDate() + i)).toISOString().slice(0, 10), favourite_dishes: ["Paneer tikka", "Butter chicken", "Masala dosa", "Biryani"][i % 4], home_outlet_id: os[i % 2].id }))).select("id");
      if (ge) throw ge;
      const ord: any[] = [];
      for (let d = 0; d < 40; d++) for (let k = 0; k < 3; k++) {
        const gi = (d * 3 + k) % gs.length;
        if (gi >= 6 && d < 35) continue; // last two guests become win-back candidates
        ord.push({ tenant_id: tid, outlet_id: os[(d + k) % 2].id, guest_id: gs[gi].id, channel: CHANNELS[(d + k) % 5], amount: 600 + ((d * 37 + k * 91) % 2400), covers: 1 + ((d + k) % 5), items: "Thali, Lassi", ordered_at: new Date(now.getTime() - d * 864e5 - k * 3600e3).toISOString() });
      }
      await sb.from("rest_orders").insert(ord);
      await sb.from("rest_reservations").insert([0, 1, 2, 3, 4].map((i) => ({ tenant_id: tid, outlet_id: os[i % 2].id, guest_id: gs[i].id, guest_name: names[i], phone: null, party_size: 2 + i, reserved_for: new Date(now.getTime() + (i - 2) * 864e5 + 20 * 3600e3 - now.getHours() * 3600e3).toISOString(), status: i < 2 ? (i === 0 ? "No-show" : "Completed") : "Booked", table_no: `T${i + 3}` })));
      await sb.from("rest_reviews").insert([
        { tenant_id: tid, outlet_id: os[0].id, guest_id: gs[1].id, reviewer: names[1], rating: 5, comment: "Loved the paneer tikka and quick service!" },
        { tenant_id: tid, outlet_id: os[1].id, guest_id: gs[2].id, reviewer: names[2], rating: 2, platform: "Zomato", comment: "Food was cold and we waited 40 minutes." },
        { tenant_id: tid, outlet_id: os[0].id, reviewer: "Walk-in guest", rating: 4, comment: "Great ambience, a bit pricey." },
      ]);
      toast.success("Sample outlets, guests, orders, reservations and reviews added"); refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="inline h-5 w-5 animate-spin" /></div>;
  if (!tid) return <Card className="max-w-lg mx-auto mt-12"><CardContent className="p-8 text-center space-y-3"><p>Create a workspace first.</p><Button asChild><Link to="/workspace/setup">Set up a restaurant workspace</Link></Button></CardContent></Card>;

  const monthRev = doneOrders.filter((o: any) => o.ordered_at >= monthStart).reduce((a: number, o: any) => a + Number(o.amount), 0);
  const todayRes = resv.filter((r: any) => dayKey(r.reserved_for) === today && inOutlet(r));
  const byChannel = CHANNELS.map((c) => ({ name: c, value: doneOrders.filter((o: any) => o.channel === c && o.ordered_at >= monthStart).reduce((a: number, o: any) => a + Number(o.amount), 0) })).filter((x) => x.value > 0);
  const avgRating = reviews.length ? reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length : 0;
  const openActions = actions.filter((a: any) => a.status === "Open");

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground"><UtensilsCrossed className="h-4 w-4" /></div>
        <div><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Restaurant OS · {active?.name}</h1><p className="text-xs text-muted-foreground">Outlets · Reservations · Orders · Loyalty · Reviews · AI follow-ups</p></div>
        <div className="ml-auto flex gap-2">
          <Select value={outletFilter} onValueChange={setOutletFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All outlets</SelectItem>{outlets.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
          {outlets.length === 0 && <Button variant="outline" onClick={seed} disabled={busy === "seed"}>{busy === "seed" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Add sample data</Button>}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        {[["Revenue this month", inr(monthRev)], ["Orders this month", doneOrders.filter((o: any) => o.ordered_at >= monthStart).length], ["Reservations today", todayRes.length], ["Guests", guests.length], ["Avg rating", avgRating ? avgRating.toFixed(1) + "★" : "—"], ["Open follow-ups", openActions.length]].map(([k, v]) => (
          <Card key={k as string}><CardContent className="p-3"><div className="text-[11px] text-muted-foreground">{k}</div><div className="text-xl font-bold">{v as any}</div></CardContent></Card>))}
      </div>

      <Tabs defaultValue="outlets">
        <TabsList className="flex flex-wrap h-auto">{[["outlets", "Outlet metrics"], ["reservations", "Reservations"], ["orders", "Orders"], ["loyalty", "Guests & loyalty"], ["reviews", "Reviews"], ["ai", "AI follow-ups"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList>

        <TabsContent value="outlets" className="space-y-4">
          <Card><CardContent className="p-0 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead>Today</TableHead><TableHead>Month</TableHead><TableHead>Target</TableHead><TableHead>Orders</TableHead><TableHead>Avg bill</TableHead><TableHead>Covers</TableHead><TableHead>Table turns/day</TableHead><TableHead>No-show</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
            <TableBody>{outletStats.map((o: any) => (
              <TableRow key={o.id}><TableCell><div className="font-medium">{o.name}</div><div className="text-xs text-muted-foreground">{o.city} · {o.seats} seats</div></TableCell>
                <TableCell>{inr(o.todayRev)}</TableCell><TableCell>{inr(o.rev)}</TableCell>
                <TableCell>{o.targetPct == null ? "—" : <Badge variant={o.targetPct >= 100 ? "default" : "outline"}>{o.targetPct.toFixed(0)}%</Badge>}</TableCell>
                <TableCell>{o.orders}</TableCell><TableCell>{inr(o.avgBill)}</TableCell><TableCell>{o.covers}</TableCell><TableCell>{o.turns.toFixed(2)}</TableCell>
                <TableCell>{o.noShowPct.toFixed(0)}%</TableCell><TableCell>{o.rating ? o.rating.toFixed(1) + "★" : "—"}</TableCell></TableRow>))}
              {outlets.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">No outlets yet — add one below or load sample data</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Revenue by channel (this month)</CardTitle></CardHeader><CardContent className="h-60"><ResponsiveContainer><BarChart data={byChannel}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => inr(v)} /><Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
            <OutletForm tid={tid} run={run} />
          </div>
        </TabsContent>

        <TabsContent value="reservations"><Reservations tid={tid} resv={resv.filter(inOutlet)} outlets={outlets} guests={guests} run={run} /></TabsContent>
        <TabsContent value="orders"><Orders tid={tid} orders={orders.filter(inOutlet)} outlets={outlets} guests={guests} run={run} /></TabsContent>
        <TabsContent value="loyalty"><Loyalty tid={tid} guests={guests} loyalty={loyalty} run={run} /></TabsContent>
        <TabsContent value="reviews"><Reviews tid={tid} reviews={reviews.filter(inOutlet)} outlets={outlets} run={run} ai={ai} /></TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">AI follow-up actions</CardTitle>
            <CardDescription>Finds birthdays and anniversaries in the next 7 days, regulars who haven't visited in 30+ days, unhappy reviews, recent no-shows and guests with unused points. AI then writes each message; you send it from your own WhatsApp.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2"><Button onClick={generate} disabled={busy === "gen"}>{busy === "gen" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}Find today's follow-ups</Button><Briefing tid={tid} ai={ai} /></div>
              {openActions.map((a: any) => (
                <div key={a.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant={a.priority === 1 ? "destructive" : "outline"}>P{a.priority}</Badge><span className="font-medium">{a.kind}</span><span>· {a.rest_guests?.name}</span><span className="text-xs text-muted-foreground">{a.reason}</span></div>
                  {a.message && <div className="text-sm bg-muted/40 rounded p-2">{a.message}</div>}
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => draft(a)} disabled={busy === a.id}>{busy === a.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}{a.message ? "Rewrite" : "Write with AI"}</Button>
                    <Button size="sm" disabled={!a.message} onClick={() => { window.open(wa(a.rest_guests?.phone, a.message), "_blank"); run(sb.from("rest_actions").update({ status: "Sent" }).eq("id", a.id)); }}><MessageCircle className="h-3 w-3 mr-1" />Open in WhatsApp</Button>
                    <Button size="sm" variant="ghost" onClick={() => run(sb.from("rest_actions").update({ status: "Dismissed" }).eq("id", a.id))}>Dismiss</Button>
                  </div>
                </div>))}
              {openActions.length === 0 && <p className="text-sm text-muted-foreground">No open follow-ups.</p>}
              {actions.some((a: any) => a.status === "Sent") && <p className="text-xs text-muted-foreground">{actions.filter((a: any) => a.status === "Sent").length} sent so far.</p>}
            </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Run = (p: PromiseLike<{ error: any }>, ok?: string) => Promise<boolean>;

function OutletForm({ tid, run }: { tid: string; run: Run }) {
  const [f, setF] = useState({ name: "", city: "", seats: "40", monthly_target: "", manager: "" });
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base">Add outlet</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {(["name", "city", "seats", "monthly_target", "manager"] as const).map((k) => <Input key={k} placeholder={{ name: "Outlet name", city: "City", seats: "Seats", monthly_target: "Monthly target ₹", manager: "Manager" }[k]} type={k === "seats" || k === "monthly_target" ? "number" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
        <Button onClick={async () => { if (!f.name) return toast.error("Outlet name is required"); if (await run(sb.from("rest_outlets").insert({ tenant_id: tid, name: f.name, city: f.city || null, seats: Number(f.seats) || 0, monthly_target: Number(f.monthly_target) || 0, manager: f.manager || null }), "Outlet added")) setF({ name: "", city: "", seats: "40", monthly_target: "", manager: "" }); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </CardContent></Card>
  );
}

function GuestPicker({ guests, value, onChange }: { guests: any[]; value: string; onChange: (v: string) => void }) {
  return <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}><SelectTrigger><SelectValue placeholder="Guest" /></SelectTrigger><SelectContent><SelectItem value="none">Walk-in / new guest</SelectItem>{guests.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>;
}

function Reservations({ tid, resv, outlets, guests, run }: { tid: string; resv: any[]; outlets: any[]; guests: any[]; run: Run }) {
  const [f, setF] = useState({ outlet_id: "", guest_id: "", guest_name: "", phone: "", party_size: "2", reserved_for: "", table_no: "", occasion: "" });
  const save = async () => {
    const g = guests.find((x) => x.id === f.guest_id);
    const name = f.guest_name || g?.name;
    if (!name || !f.reserved_for) return toast.error("Guest name and time are required");
    if (await run(sb.from("rest_reservations").insert({ tenant_id: tid, outlet_id: f.outlet_id || null, guest_id: f.guest_id || null, guest_name: name, phone: f.phone || g?.phone || null, party_size: Number(f.party_size) || 2, reserved_for: new Date(f.reserved_for).toISOString(), table_no: f.table_no || null, occasion: f.occasion || null }), "Table booked"))
      setF({ ...f, guest_id: "", guest_name: "", phone: "", table_no: "", occasion: "" });
  };
  const upcoming = [...resv].sort((a, b) => a.reserved_for.localeCompare(b.reserved_for));
  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">New reservation</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Select value={f.outlet_id} onValueChange={(v) => setF({ ...f, outlet_id: v })}><SelectTrigger><SelectValue placeholder="Outlet" /></SelectTrigger><SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
          <GuestPicker guests={guests} value={f.guest_id} onChange={(v) => setF({ ...f, guest_id: v })} />
          {!f.guest_id && <Input placeholder="Guest name" value={f.guest_name} onChange={(e) => setF({ ...f, guest_name: e.target.value })} />}
          {!f.guest_id && <Input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}
          <Input type="number" placeholder="Party size" value={f.party_size} onChange={(e) => setF({ ...f, party_size: e.target.value })} />
          <Input type="datetime-local" value={f.reserved_for} onChange={(e) => setF({ ...f, reserved_for: e.target.value })} />
          <Input placeholder="Table" value={f.table_no} onChange={(e) => setF({ ...f, table_no: e.target.value })} />
          <Input placeholder="Occasion" value={f.occasion} onChange={(e) => setF({ ...f, occasion: e.target.value })} />
          <Button onClick={save}>Book table</Button>
        </CardContent></Card>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Guest</TableHead><TableHead>Party</TableHead><TableHead>Outlet / table</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{upcoming.map((r) => (
          <TableRow key={r.id}><TableCell className="text-xs">{new Date(r.reserved_for).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
            <TableCell>{r.guest_name}{r.occasion && <div className="text-xs text-muted-foreground">{r.occasion}</div>}</TableCell><TableCell>{r.party_size}</TableCell><TableCell className="text-xs">{r.rest_outlets?.name ?? "—"} {r.table_no && `· ${r.table_no}`}</TableCell>
            <TableCell><Select value={r.status} onValueChange={(v) => run(sb.from("rest_reservations").update({ status: v }).eq("id", r.id))}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{RES_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></TableCell>
            <TableCell><Button size="sm" variant="ghost" onClick={() => window.open(wa(r.phone ?? guests.find((g) => g.id === r.guest_id)?.phone, `Hi ${r.guest_name.split(" ")[0]}! Your table for ${r.party_size} is confirmed for ${new Date(r.reserved_for).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${r.rest_outlets?.name ? " at our " + r.rest_outlets.name + " outlet" : ""}. See you soon! 🍽️`), "_blank")}><MessageCircle className="h-3 w-3 mr-1" />Confirm</Button></TableCell></TableRow>))}
          {upcoming.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No reservations</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>
  );
}

function Orders({ tid, orders, outlets, guests, run }: { tid: string; orders: any[]; outlets: any[]; guests: any[]; run: Run }) {
  const [f, setF] = useState({ outlet_id: "", guest_id: "", channel: "Dine-in", items: "", amount: "", covers: "2" });
  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Record order</CardTitle><CardDescription>Completed orders update the guest's visits and spend and earn 1 loyalty point per ₹100.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Select value={f.outlet_id} onValueChange={(v) => setF({ ...f, outlet_id: v })}><SelectTrigger><SelectValue placeholder="Outlet" /></SelectTrigger><SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
          <GuestPicker guests={guests} value={f.guest_id} onChange={(v) => setF({ ...f, guest_id: v })} />
          <Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Input type="number" placeholder="Bill amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Input className="md:col-span-2" placeholder="Items" value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} />
          <Input type="number" placeholder="Covers" value={f.covers} onChange={(e) => setF({ ...f, covers: e.target.value })} />
          <Button onClick={async () => { if (!(Number(f.amount) > 0)) return toast.error("Enter the bill amount"); if (await run(sb.from("rest_orders").insert({ tenant_id: tid, outlet_id: f.outlet_id || null, guest_id: f.guest_id || null, channel: f.channel, items: f.items || null, amount: Number(f.amount), covers: Number(f.covers) || null }), "Order recorded")) setF({ ...f, guest_id: "", items: "", amount: "" }); }}>Save order</Button>
        </CardContent></Card>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Outlet</TableHead><TableHead>Guest</TableHead><TableHead>Channel</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{orders.slice(0, 200).map((o) => (
          <TableRow key={o.id}><TableCell className="text-xs">{new Date(o.ordered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell><TableCell>{o.rest_outlets?.name ?? "—"}</TableCell><TableCell>{o.rest_guests?.name ?? "Walk-in"}</TableCell>
            <TableCell><Badge variant="outline">{o.channel}</Badge></TableCell><TableCell className="text-xs">{o.items}</TableCell><TableCell className="text-right">{inr(o.amount)}</TableCell>
            <TableCell><Select value={o.status} onValueChange={(v) => run(sb.from("rest_orders").update({ status: v }).eq("id", o.id))}><SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger><SelectContent>{["Open", "Completed", "Cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></TableCell></TableRow>))}
          {orders.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No orders yet</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>
  );
}

function Loyalty({ tid, guests, loyalty, run }: { tid: string; guests: any[]; loyalty: any[]; run: Run }) {
  const [g, setG] = useState({ name: "", phone: "", birthday: "", anniversary: "", favourite_dishes: "" });
  const redeem = async (guest: any) => {
    const n = Number(window.prompt(`Points to redeem for ${guest.name} (has ${guest.loyalty_points})`) || 0);
    if (!(n > 0)) return;
    if (n > guest.loyalty_points) return toast.error("Not enough points");
    await run(sb.from("rest_loyalty").insert({ tenant_id: tid, guest_id: guest.id, points: -n, reason: "Redeemed" }), `${n} points redeemed`);
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-3">{["Platinum", "Gold", "Silver"].map((t) => <Card key={t}><CardContent className="p-3"><div className="text-xs text-muted-foreground">{t} guests</div><div className="text-xl font-bold">{guests.filter((x) => x.tier === t).length}</div></CardContent></Card>)}</div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Add guest</CardTitle><CardDescription>Tiers: Gold at 800 points, Platinum at 2,000.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-6">
          <Input placeholder="Name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /><Input placeholder="Phone" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} />
          <div><Label className="text-[10px]">Birthday</Label><Input type="date" value={g.birthday} onChange={(e) => setG({ ...g, birthday: e.target.value })} /></div>
          <div><Label className="text-[10px]">Anniversary</Label><Input type="date" value={g.anniversary} onChange={(e) => setG({ ...g, anniversary: e.target.value })} /></div>
          <Input placeholder="Favourite dishes" value={g.favourite_dishes} onChange={(e) => setG({ ...g, favourite_dishes: e.target.value })} />
          <Button onClick={async () => { if (!g.name) return toast.error("Name is required"); if (await run(sb.from("rest_guests").insert({ tenant_id: tid, name: g.name, phone: g.phone || null, birthday: g.birthday || null, anniversary: g.anniversary || null, favourite_dishes: g.favourite_dishes || null }), "Guest added")) setG({ name: "", phone: "", birthday: "", anniversary: "", favourite_dishes: "" }); }}>Add</Button>
        </CardContent></Card>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Tier</TableHead><TableHead>Points</TableHead><TableHead>Visits</TableHead><TableHead>Lifetime spend</TableHead><TableHead>Last visit</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{[...guests].sort((a, b) => b.total_spend - a.total_spend).map((x) => (
          <TableRow key={x.id}><TableCell><div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{x.phone} {x.favourite_dishes && `· ❤ ${x.favourite_dishes}`}</div></TableCell>
            <TableCell><Badge variant={x.tier === "Silver" ? "outline" : "default"}>{x.tier}</Badge></TableCell><TableCell>{x.loyalty_points}</TableCell><TableCell>{x.visits}</TableCell><TableCell>{inr(x.total_spend)}</TableCell>
            <TableCell className="text-xs">{x.last_visit_at ? new Date(x.last_visit_at).toLocaleDateString("en-IN") : "—"}</TableCell>
            <TableCell><Button size="sm" variant="ghost" disabled={!x.loyalty_points} onClick={() => redeem(x)}><Gift className="h-3 w-3 mr-1" />Redeem</Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      {loyalty.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recent points activity</CardTitle></CardHeader><CardContent className="text-xs space-y-1">{loyalty.slice(0, 15).map((l: any) => <div key={l.id} className="flex gap-2"><span className={l.points < 0 ? "text-destructive" : "text-success"}>{l.points > 0 ? "+" : ""}{l.points}</span><span>{l.rest_guests?.name}</span><span className="text-muted-foreground">{l.reason}</span></div>)}</CardContent></Card>}
    </div>
  );
}

function Reviews({ tid, reviews, outlets, run, ai }: { tid: string; reviews: any[]; outlets: any[]; run: Run; ai: any }) {
  const [f, setF] = useState({ outlet_id: "", reviewer: "", platform: "Google", rating: "5", comment: "" });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const suggest = async (r: any) => { setBusy(r.id); try { const out = await ai({ data: { tenantId: tid, mode: "review_reply", id: r.id } }); setDrafts({ ...drafts, [r.id]: out.text.trim() }); } catch (e: any) { toast.error(e.message); } setBusy(null); };
  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Log a review</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-6">
          <Select value={f.outlet_id} onValueChange={(v) => setF({ ...f, outlet_id: v })}><SelectTrigger><SelectValue placeholder="Outlet" /></SelectTrigger><SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Reviewer" value={f.reviewer} onChange={(e) => setF({ ...f, reviewer: e.target.value })} />
          <Select value={f.platform} onValueChange={(v) => setF({ ...f, platform: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Google", "Zomato", "Swiggy", "TripAdvisor", "In-store"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          <Select value={f.rating} onValueChange={(v) => setF({ ...f, rating: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["5", "4", "3", "2", "1"].map((p) => <SelectItem key={p} value={p}>{p}★</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Comment" value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} />
          <Button onClick={async () => { if (await run(sb.from("rest_reviews").insert({ tenant_id: tid, outlet_id: f.outlet_id || null, reviewer: f.reviewer || null, platform: f.platform, rating: Number(f.rating), comment: f.comment || null }), "Review saved")) setF({ ...f, reviewer: "", comment: "" }); }}>Save</Button>
        </CardContent></Card>
      {reviews.map((r) => (
        <Card key={r.id}><CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted"}`} />)}</span><span className="font-medium">{r.reviewer ?? "Guest"}</span><Badge variant="outline">{r.platform}</Badge><span className="text-xs text-muted-foreground">{r.rest_outlets?.name} · {new Date(r.created_at).toLocaleDateString("en-IN")}</span>{r.rating <= 3 && !r.reply && <Badge variant="destructive">Needs reply</Badge>}</div>
          {r.comment && <p className="text-sm">{r.comment}</p>}
          {r.reply ? <div className="text-sm bg-muted/40 rounded p-2"><b>Our reply:</b> {r.reply}</div> : (
            <div className="space-y-2">
              <Textarea rows={2} placeholder="Write a reply…" value={drafts[r.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })} />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => suggest(r)} disabled={busy === r.id}>{busy === r.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}Suggest reply</Button>
                <Button size="sm" disabled={!drafts[r.id]} onClick={() => run(sb.from("rest_reviews").update({ reply: drafts[r.id], replied_at: new Date().toISOString() }).eq("id", r.id), "Reply saved — post it on " + r.platform)}>Save reply</Button>
              </div>
            </div>)}
        </CardContent></Card>))}
    </div>
  );
}

function Briefing({ tid, ai }: { tid: string; ai: any }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <>
      <Button variant="outline" disabled={loading} onClick={async () => { setLoading(true); try { const r = await ai({ data: { tenantId: tid, mode: "briefing" } }); setText(r.text); } catch (e: any) { toast.error(e.message); } setLoading(false); }}>{loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}AI daily briefing</Button>
      {text && <div className="basis-full w-full border rounded-md p-3 mt-2"><Md text={text} /></div>}
    </>
  );
}
