import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRe, useReInvalidate, reDb, reRun, inr, cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/partners")({
  head: () => ({ meta: [{ title: "ChannelHub Partners & Routing | Real Estate CRM" }, { name: "description", content: "Channel partners, commissions with TDS, and lead assignment rules." }] }),
  component: PartnersPage,
});

function PartnersPage() {
  const { user, isManager, isAdmin } = useAuth();
  const inv = useReInvalidate();
  const { data: partners = [] } = useRe("re_channel_partners", "*", "name", true);
  const { data: comms = [] } = useRe("re_commissions", "*, re_channel_partners(name), re_deals(re_clients(full_name), re_properties(title))");
  const { data: leads = [] } = useRe("re_clients", "id, channel_partner_id");
  const { data: deals = [] } = useRe("re_deals", "id, channel_partner_id, stage, final_value");
  const { data: rules = [] } = useRe("re_assignment_rules", "*", "priority", true);
  const [p, setP] = useState({ name: "", company: "", phone: "", email: "", city: "", rera_number: "", specialization: "", commission_pct: "2" });
  const [r, setR] = useState({ name: "", city: "", segment: "Residential", budget_min: "", budget_max: "", team: "", priority: "10" });
  const mgr = isManager || isAdmin;

  const addP = async () => {
    if (!p.name) return toast.error("Partner name is required");
    if (await reRun(reDb.from("re_channel_partners").insert({ ...p, commission_pct: Number(p.commission_pct) || 0, owner_id: user?.id }), "Partner added")) { setP({ name: "", company: "", phone: "", email: "", city: "", rera_number: "", specialization: "", commission_pct: "2" }); inv(); }
  };
  const addR = async () => {
    if (!r.name || !r.team) return toast.error("Rule name and team are required");
    if (await reRun(reDb.from("re_assignment_rules").insert({ ...r, city: r.city || null, budget_min: Number(r.budget_min) || null, budget_max: Number(r.budget_max) || null, priority: Number(r.priority) || 10, owner_id: user?.id }), "Rule added")) { setR({ name: "", city: "", segment: "Residential", budget_min: "", budget_max: "", team: "", priority: "10" }); inv(); }
  };
  const setComm = async (c: any, status: string) => {
    const patch: any = { status };
    if (status === "Paid") { patch.paid_on = new Date().toISOString().slice(0, 10); patch.reference = window.prompt("Payment reference (UTR)") || null; }
    if (await reRun(reDb.from("re_commissions").update(patch).eq("id", c.id), `Commission ${status.toLowerCase()}`)) inv();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Channel partners</CardTitle><CardDescription>Partner-sourced leads are tagged on the lead form; commission is created on booking.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Table><TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>RERA</TableHead><TableHead>Leads</TableHead><TableHead>Bookings</TableHead><TableHead>Revenue</TableHead><TableHead>Commission %</TableHead><TableHead>Earned / Paid</TableHead></TableRow></TableHeader>
            <TableBody>{partners.map((x: any) => { const pc = comms.filter((c: any) => c.partner_id === x.id); const bk = deals.filter((d: any) => d.channel_partner_id === x.id); return (
              <TableRow key={x.id}><TableCell><div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{[x.company, x.city, x.specialization].filter(Boolean).join(" · ")}</div></TableCell>
                <TableCell className="text-xs">{x.rera_number ?? "—"}</TableCell><TableCell>{leads.filter((l: any) => l.channel_partner_id === x.id).length}</TableCell><TableCell>{bk.length}</TableCell>
                <TableCell>{cr(bk.reduce((a: number, d: any) => a + Number(d.final_value || 0), 0))}</TableCell><TableCell>{x.commission_pct}%</TableCell>
                <TableCell className="text-xs">{inr(pc.reduce((a: number, c: any) => a + Number(c.amount), 0))} / {inr(pc.filter((c: any) => c.status === "Paid").reduce((a: number, c: any) => a + Number(c.amount), 0))}</TableCell></TableRow>); })}</TableBody></Table>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(["name", "company", "phone", "email", "city", "rera_number", "specialization", "commission_pct"] as const).map((k) => <Input key={k} placeholder={k.replace("_", " ")} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />)}
          </div>
          <Button size="sm" onClick={addP}><Plus className="h-3 w-3 mr-1" />Add partner</Button>
        </CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Commissions</CardTitle><CardDescription>Booking value × commission %, less TDS. Only managers can approve or mark paid.</CardDescription></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Deal</TableHead><TableHead>Booking value</TableHead><TableHead>Commission</TableHead><TableHead>TDS</TableHead><TableHead>Net payable</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{comms.map((c: any) => (
              <TableRow key={c.id}><TableCell>{c.re_channel_partners?.name}</TableCell><TableCell className="text-xs">{c.re_deals?.re_clients?.full_name} · {c.re_deals?.re_properties?.title}</TableCell>
                <TableCell>{cr(c.booking_value)}</TableCell><TableCell>{inr(c.amount)} <span className="text-xs text-muted-foreground">({c.pct}%)</span></TableCell><TableCell>{inr(c.amount * c.tds_pct / 100)}</TableCell><TableCell className="font-medium">{inr(c.amount * (1 - c.tds_pct / 100))}</TableCell>
                <TableCell><Badge variant={c.status === "Paid" ? "default" : "outline"}>{c.status}</Badge>{c.reference && <div className="text-[10px] text-muted-foreground">{c.reference}</div>}</TableCell>
                <TableCell className="text-right">{mgr && c.status === "Pending approval" && <Button size="sm" variant="outline" onClick={() => setComm(c, "Approved")}>Approve</Button>}{mgr && c.status === "Approved" && <Button size="sm" onClick={() => setComm(c, "Paid")}>Mark paid</Button>}</TableCell></TableRow>))}
              {comms.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No commissions yet — they appear when a partner deal is booked</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Lead assignment rules</CardTitle><CardDescription>New leads go to the first matching rule (lowest priority number first). Example: Greater Noida + ₹1–2 Cr + Residential → Greater Noida Residential Team.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {rules.map((x: any) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2 border rounded-md p-2 text-sm">
              <Badge variant="outline">#{x.priority}</Badge><span className="font-medium">{x.name}</span>
              <span className="text-xs text-muted-foreground">{[x.city, x.segment, (x.budget_min || x.budget_max) && `${cr(x.budget_min ?? 0)}–${x.budget_max ? cr(x.budget_max) : "∞"}`].filter(Boolean).join(" · ")}</span>
              <span>→ {x.team}</span>
              <div className="ml-auto flex items-center gap-2"><Switch checked={x.active} onCheckedChange={async (v) => { await reRun(reDb.from("re_assignment_rules").update({ active: v }).eq("id", x.id)); inv(); }} />
                <Button size="icon" variant="ghost" onClick={async () => { await reRun(reDb.from("re_assignment_rules").delete().eq("id", x.id), "Rule removed"); inv(); }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>))}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            {(["name", "city", "segment", "budget_min", "budget_max", "team", "priority"] as const).map((k) => <Input key={k} placeholder={k.replace("_", " ")} value={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.value })} />)}
          </div>
          <Button size="sm" onClick={addR}><Plus className="h-3 w-3 mr-1" />Add rule</Button>
        </CardContent></Card>
    </div>
  );
}
