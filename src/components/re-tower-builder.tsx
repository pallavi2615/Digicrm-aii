import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { reDb } from "@/lib/re-data";

/** Generate a whole tower of units in one go: floors × units per floor. */
export function TowerBuilder({ projects, userId, onDone }: { projects: any[]; userId?: string; onDone: () => void }) {
  const [f, setF] = useState<any>({ project_id: "", tower: "Tower A", floors: "12", per_floor: "4", bhk: "2,2,3,3", super_area: "1150,1150,1650,1650", rate: "6500", facing: "East,North,East,West" });
  const [busy, setBusy] = useState(false);
  const list = (s: string) => s.split(",").map((x) => x.trim());
  const go = async () => {
    const proj = projects.find((p) => p.id === f.project_id);
    if (!proj) return toast.error("Create and pick a project first");
    const floors = Math.min(80, Number(f.floors) || 0), per = Math.min(20, Number(f.per_floor) || 0);
    if (!floors || !per) return toast.error("Enter floors and units per floor");
    const bhk = list(f.bhk), area = list(f.super_area), face = list(f.facing), rate = Number(f.rate) || 0;
    const rows = [];
    for (let fl = 1; fl <= floors; fl++) for (let u = 1; u <= per; u++) {
      const i = u - 1; const b = Number(bhk[i] ?? bhk[0]) || null; const a = Number(area[i] ?? area[0]) || null;
      const unit = `${fl}${String(u).padStart(2, "0")}`;
      rows.push({ owner_id: userId, project_id: proj.id, title: `${proj.name} · ${f.tower} · Unit ${unit}`, tower: f.tower, floor_no: fl, unit_no: unit, bhk: b, bedrooms: b, super_area: a, area_sqft: a,
        price: a && rate ? Math.round(a * rate * (1 + (fl > floors / 2 ? 0.02 : 0))) : null, facing: face[i] ?? face[0] ?? null, city: proj.city, location: proj.location, rera_number: proj.rera_number,
        property_type: "apartment", listing_type: "sale", inventory_status: "Available", status: "available", construction_status: "Under construction", possession_date: proj.possession_date });
    }
    setBusy(true);
    const { error } = await reDb.from("re_properties").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} units created in ${f.tower}`); onDone();
  };
  const F = (k: string, l: string) => <div className="space-y-1"><Label className="text-xs">{l}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" />Add a tower</CardTitle><CardDescription>Creates every unit (floor × position) with BHK, area, facing and price (area × rate, +2% on upper floors). Edit any unit afterwards.</CardDescription></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-4">
        <div className="space-y-1"><Label className="text-xs">Project</Label><Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}><SelectTrigger><SelectValue placeholder="Pick project" /></SelectTrigger><SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        {F("tower", "Tower name")}{F("floors", "Floors")}{F("per_floor", "Units per floor")}
        {F("bhk", "BHK by position (comma)")}{F("super_area", "Super area sq ft by position")}{F("facing", "Facing by position")}{F("rate", "Base rate ₹/sq ft")}
        <div className="md:col-span-4"><Button onClick={go} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Create {(Number(f.floors) || 0) * (Number(f.per_floor) || 0)} units</Button></div>
      </CardContent></Card>
  );
}
