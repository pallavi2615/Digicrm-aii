import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { distDb, useInvalidateDist, useLoyalty, usePartners } from "@/lib/dist-data";

export const Route = createFileRoute("/_authenticated/distribution/loyalty")({
  head: () => ({ meta: [{ title: "Retailer Loyalty | DigiDistribution AI" }, { name: "description", content: "Points on every delivered order, rewards and redemptions for retailers." }] }),
  component: LoyaltyPage,
});

const REWARDS = [{ name: "₹500 cashback", pts: 500 }, { name: "Free case", pts: 1200 }, { name: "Smartphone", pts: 15000 }, { name: "Goa trip", pts: 50000 }];

function LoyaltyPage() {
  const partners = usePartners().data ?? [];
  const log = useLoyalty().data ?? [];
  const inv = useInvalidateDist();
  const [pid, setPid] = useState("");
  const [pts, setPts] = useState("");
  const [reason, setReason] = useState("");
  const board = [...partners].filter((p) => p.loyalty_points > 0).sort((a, b) => b.loyalty_points - a.loyalty_points);

  const add = async (points: number, why: string, partner = pid) => {
    if (!partner || !points) return toast.error("Pick a partner and points");
    const p = partners.find((x) => x.id === partner);
    if (points < 0 && (p?.loyalty_points ?? 0) < -points) return toast.error("Not enough points");
    const { error } = await distDb.from("dist_loyalty").insert({ partner_id: partner, points, reason: why });
    if (error) return toast.error(error.message);
    toast.success(points < 0 ? "Reward redeemed" : "Points added"); setPts(""); setReason(""); inv();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Leaderboard</CardTitle><CardDescription>1 point per ₹100 is added automatically when an order is marked Delivered.</CardDescription></CardHeader>
        <CardContent className="space-y-1">
          {board.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <span>#{i + 1} {p.name} <span className="text-xs text-muted-foreground">{p.level}</span></span>
              <div className="flex items-center gap-2"><b>{p.loyalty_points.toLocaleString("en-IN")} pts</b>
                <Select onValueChange={(r) => { const rw = REWARDS.find((x) => x.name === r)!; add(-rw.pts, `Redeemed: ${rw.name}`, p.id); }}>
                  <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Redeem" /></SelectTrigger>
                  <SelectContent>{REWARDS.map((r) => <SelectItem key={r.name} value={r.name} disabled={p.loyalty_points < r.pts}>{r.name} ({r.pts})</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          ))}
          {!board.length && <p className="text-sm text-muted-foreground">No points yet.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Manual points & history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Select value={pid} onValueChange={setPid}><SelectTrigger><SelectValue placeholder="Partner" /></SelectTrigger><SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            <Input type="number" className="w-24" placeholder="Pts" value={pts} onChange={(e) => setPts(e.target.value)} />
          </div>
          <div className="flex gap-2"><Input placeholder="Reason (e.g. festive bonus)" value={reason} onChange={(e) => setReason(e.target.value)} /><Button onClick={() => add(Math.round(+pts), reason || "Manual")}>Add</Button></div>
          <div className="space-y-1 max-h-96 overflow-auto pt-2">
            {log.slice(0, 60).map((l) => (
              <div key={l.id} className="flex justify-between text-sm border-b py-1"><span>{l.dist_partners?.name} · <span className="text-muted-foreground">{l.reason}</span></span><span className={l.points < 0 ? "text-destructive" : "text-primary"}>{l.points > 0 ? "+" : ""}{l.points}</span></div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
