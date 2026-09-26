import { createFileRoute } from "@tanstack/react-router";
import { TowerBuilder } from "@/components/re-tower-builder";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRe, useReInvalidate, reDb, reRun, INVENTORY, INV_TONE, cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/projects")({
  head: () => ({ meta: [{ title: "Projects & Inventory | Real Estate CRM" }, { name: "description", content: "Projects, towers and unit-level inventory with live status." }] }),
  component: ProjectsPage,
});

const emptyP: any = { name: "", developer: "", city: "", location: "", rera_number: "", project_type: "Residential", total_units: "", towers: "", floors: "", amenities: "", possession_date: "", price_min: "", price_max: "", payment_plans: "", brochure_url: "" };
const emptyU: any = { title: "", project_id: "", tower: "", floor_no: "", unit_no: "", property_type: "Apartment", bhk: "", carpet_area: "", super_area: "", facing: "", parking: "1", furnishing: "Unfurnished", construction_status: "Under construction", possession_date: "", price: "", city: "", location: "", rera_number: "", inventory_status: "Available", listing_type: "Sale" };

function ProjectsPage() {
  const { user } = useAuth();
  const inv = useReInvalidate();
  const { data: projects = [] } = useRe("re_projects", "*", "name", true);
  const { data: units = [] } = useRe("re_properties", "*", "created_at", true);
  const [pOpen, setPOpen] = useState(false);
  const [uOpen, setUOpen] = useState(false);
  const [p, setP] = useState<any>(emptyP);
  const [u, setU] = useState<any>(emptyU);
  const [filter, setFilter] = useState("all");

  const num = (v: any) => (v === "" || v == null ? null : Number(v));
  const saveP = async () => {
    if (!p.name.trim()) return toast.error("Project name is required");
    const row = { ...p, total_units: num(p.total_units), towers: num(p.towers), floors: num(p.floors), price_min: num(p.price_min), price_max: num(p.price_max), possession_date: p.possession_date || null };
    delete row.id; delete row.created_at;
    const ok = p.id ? await reRun(reDb.from("re_projects").update(row).eq("id", p.id), "Project saved") : await reRun(reDb.from("re_projects").insert({ ...row, owner_id: user?.id }), "Project added");
    if (ok) { setPOpen(false); inv(); }
  };
  const saveU = async () => {
    const proj = projects.find((x: any) => x.id === u.project_id);
    const title = u.title || [proj?.name, u.tower, u.unit_no && `Unit ${u.unit_no}`].filter(Boolean).join(" · ");
    if (!title) return toast.error("Give the unit a name or pick a project");
    const row: any = { ...u, title, project_id: u.project_id || null, floor_no: num(u.floor_no), bhk: num(u.bhk), bedrooms: num(u.bhk), carpet_area: num(u.carpet_area), super_area: num(u.super_area), area_sqft: num(u.super_area), parking: num(u.parking), price: num(u.price), possession_date: u.possession_date || null,
      city: u.city || proj?.city || null, location: u.location || proj?.location || null, rera_number: u.rera_number || proj?.rera_number || null,
      status: u.inventory_status === "Sold" ? "sold" : u.inventory_status === "Available" ? "available" : "hold" };
    ["id", "created_at", "updated_at", "images", "re_projects"].forEach((k) => delete row[k]);
    const ok = u.id ? await reRun(reDb.from("re_properties").update(row).eq("id", u.id), "Unit saved") : await reRun(reDb.from("re_properties").insert({ ...row, owner_id: user?.id }), "Unit added");
    if (ok) { setUOpen(false); inv(); }
  };
  const setStatus = async (id: string, s: string) => { if (await reRun(reDb.from("re_properties").update({ inventory_status: s, status: s === "Sold" ? "sold" : s === "Available" ? "available" : "hold" }).eq("id", id))) inv(); };

  const F = (o: any, set: any, k: string, label: string, type = "text") => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label><Input type={type} value={o[k] ?? ""} onChange={(e) => set({ ...o, [k]: e.target.value })} /></div>
  );
  const groups = [...projects.map((x: any) => ({ id: x.id, name: x.name, proj: x })), { id: null, name: "Standalone units", proj: null }];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1">
          {["all", ...INVENTORY].map((s) => <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s === "all" ? "All" : s} {s !== "all" && `(${units.filter((x: any) => x.inventory_status === s).length})`}</Button>)}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => { setP(emptyP); setPOpen(true); }}><Building2 className="h-4 w-4 mr-1" />New project</Button>
          <Button onClick={() => { setU(emptyU); setUOpen(true); }}><Plus className="h-4 w-4 mr-1" />New unit</Button>
        </div>
      </div>

      {projects.length === 0 && <Card><CardContent className="p-4 text-sm"><b>Start here:</b> 1) click <b>New project</b> and add your first project, 2) use <b>Add a tower</b> below to create all its units, 3) add leads in Lead360 or the Sales App.</CardContent></Card>}
      <TowerBuilder projects={projects} userId={user?.id} onDone={inv} />

      {groups.map((g) => {
        const list = units.filter((x: any) => (x.project_id ?? null) === g.id && (filter === "all" || x.inventory_status === filter));
        if (!g.proj && list.length === 0) return null;
        const all = units.filter((x: any) => (x.project_id ?? null) === g.id);
        const sold = all.filter((x: any) => ["Sold", "Booked"].includes(x.inventory_status));
        return (
          <Card key={g.id ?? "none"}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start gap-2">
                <div>
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  {g.proj && <CardDescription>{[g.proj.developer, g.proj.location || g.proj.city, g.proj.rera_number && `RERA ${g.proj.rera_number}`, g.proj.possession_date && `Possession ${g.proj.possession_date}`].filter(Boolean).join(" · ")}</CardDescription>}
                </div>
                <div className="ml-auto flex gap-3 text-xs">
                  <span>Units <b>{all.length}</b></span>
                  <span>Available <b>{all.filter((x: any) => x.inventory_status === "Available").length}</b></span>
                  <span>Sold/Booked <b>{sold.length}</b></span>
                  <span>Booked value <b>{cr(sold.reduce((a: number, x: any) => a + Number(x.price || 0), 0))}</b></span>
                  {g.proj && <Button size="sm" variant="ghost" className="h-6" onClick={() => { setP({ ...emptyP, ...Object.fromEntries(Object.entries(g.proj).map(([k, v]) => [k, v ?? ""])) }); setPOpen(true); }}>Edit</Button>}
                </div>
              </div>
              {g.proj?.amenities && <div className="text-xs text-muted-foreground">Amenities: {g.proj.amenities}</div>}
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((x: any) => (
                  <div key={x.id} className={`border rounded-md p-2 text-xs space-y-1 ${INV_TONE[x.inventory_status] ?? ""}`}>
                    <div className="font-semibold text-foreground truncate cursor-pointer" onClick={() => { setU({ ...emptyU, ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v ?? ""])) }); setUOpen(true); }}>{x.tower ? `${x.tower}-${x.unit_no ?? ""}` : x.title}</div>
                    <div className="text-foreground/80">{[x.bhk && `${x.bhk} BHK`, x.super_area && `${x.super_area} sqft`, x.facing].filter(Boolean).join(" · ")}</div>
                    <div className="font-medium text-foreground">{cr(x.price)}</div>
                    <Select value={x.inventory_status} onValueChange={(v) => setStatus(x.id, v)}><SelectTrigger className="h-7 text-xs bg-background"><SelectValue /></SelectTrigger><SelectContent>{INVENTORY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                  </div>
                ))}
                {list.length === 0 && <div className="text-sm text-muted-foreground">No units in this view</div>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{p.id ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {F(p, setP, "name", "Project name *")}{F(p, setP, "developer", "Developer")}{F(p, setP, "rera_number", "RERA number")}
            {F(p, setP, "city", "City")}{F(p, setP, "location", "Location")}{F(p, setP, "project_type", "Type")}
            {F(p, setP, "total_units", "Total units", "number")}{F(p, setP, "towers", "Towers", "number")}{F(p, setP, "floors", "Floors", "number")}
            {F(p, setP, "price_min", "Price from (₹)", "number")}{F(p, setP, "price_max", "Price to (₹)", "number")}{F(p, setP, "possession_date", "Possession", "date")}
            {F(p, setP, "brochure_url", "Brochure link")}
          </div>
          <div className="space-y-1"><Label className="text-xs">Amenities</Label><Textarea rows={2} value={p.amenities} onChange={(e) => setP({ ...p, amenities: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Payment plans</Label><Textarea rows={2} value={p.payment_plans} onChange={(e) => setP({ ...p, payment_plans: e.target.value })} /></div>
          <DialogFooter><Button onClick={saveP}>Save project</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uOpen} onOpenChange={setUOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{u.id ? "Edit unit" : "New unit"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Project</Label>
              <Select value={u.project_id || "none"} onValueChange={(v) => setU({ ...u, project_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Standalone</SelectItem>{projects.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></div>
            {F(u, setU, "title", "Display name (optional)")}{F(u, setU, "tower", "Tower / Block")}
            {F(u, setU, "floor_no", "Floor", "number")}{F(u, setU, "unit_no", "Unit no.")}{F(u, setU, "property_type", "Property type")}
            {F(u, setU, "bhk", "BHK", "number")}{F(u, setU, "carpet_area", "Carpet area", "number")}{F(u, setU, "super_area", "Super area", "number")}
            {F(u, setU, "facing", "Facing")}{F(u, setU, "parking", "Parking", "number")}{F(u, setU, "furnishing", "Furnishing")}
            {F(u, setU, "construction_status", "Construction status")}{F(u, setU, "possession_date", "Possession", "date")}{F(u, setU, "price", "Price (₹)", "number")}
            {F(u, setU, "city", "City")}{F(u, setU, "location", "Location")}
            <div className="space-y-1"><Label className="text-xs">Status</Label>
              <Select value={u.inventory_status} onValueChange={(v) => setU({ ...u, inventory_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INVENTORY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Listing</Label>
              <Select value={u.listing_type} onValueChange={(v) => setU({ ...u, listing_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Sale", "Resale", "Rent"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={saveU}>Save unit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">Status colours: <Badge variant="outline" className={INV_TONE.Available}>Available</Badge> <Badge variant="outline" className={INV_TONE.Hold}>Hold</Badge> <Badge variant="outline" className={INV_TONE["Token Received"]}>Token</Badge> <Badge variant="outline" className={INV_TONE.Booked}>Booked</Badge> <Badge variant="outline" className={INV_TONE.Sold}>Sold</Badge></p>
    </div>
  );
}
