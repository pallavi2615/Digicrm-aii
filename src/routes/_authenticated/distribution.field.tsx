import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { WEEKDAYS, distDb, useBeats, useInvalidateDist, usePartners, useVisits } from "@/lib/dist-data";
import { useDistAi } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/distribution/field")({
  head: () => ({ meta: [{ title: "Field Sales & Beats | DigiDistribution AI" }, { name: "description", content: "Today's plan, GPS check-in visits with photos, AI visit summaries and weekly beat plans." }] }),
  component: FieldPage,
});

function FieldPage() {
  const { user } = useAuth();
  const partners = usePartners().data ?? [];
  const visits = useVisits().data ?? [];
  const beats = useBeats().data ?? [];
  const inv = useInvalidateDist();
  const ai = useDistAi();
  const reps = [...new Set(partners.map((p) => p.sales_rep).filter(Boolean))] as string[];
  const [rep, setRep] = useState<string>("");
  const [v, setV] = useState({ partner_id: "", notes: "", outcome: "Order taken", next_visit: "" });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [b, setB] = useState({ sales_rep: "", weekday: "1", area: "" });

  const wd = ((new Date().getDay() + 6) % 7) + 1;
  const todays = beats.filter((x) => x.weekday === wd && (!rep || x.sales_rep === rep));
  const planIds = new Set(todays.flatMap((x) => x.partner_ids));
  const planned = partners.filter((p) => planIds.has(p.id));
  const visitedToday = new Set(visits.filter((x) => x.checked_in_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).map((x) => x.partner_id));

  const checkIn = () => {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    navigator.geolocation.getCurrentPosition((p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Location captured"); }, () => toast.error("Allow location access to check in"));
  };

  const save = async () => {
    if (!v.partner_id) return toast.error("Pick the outlet");
    const name = rep || partners.find((p) => p.id === v.partner_id)?.sales_rep || user?.email || "Rep";
    let photo_path: string | null = null;
    if (photo && user) {
      photo_path = `${user.id}/${Date.now()}-${photo.name.replace(/[^\w.]/g, "_")}`;
      const { error } = await supabase.storage.from("dist-visits").upload(photo_path, photo, { contentType: photo.type });
      if (error) return toast.error(error.message);
    }
    const summary = v.notes.trim().length > 30 ? await ai.run({ mode: "visit_summary", notes: v.notes }) : null;
    const { error } = await distDb.from("dist_visits").insert({ partner_id: v.partner_id, sales_rep: name, lat: geo?.lat ?? null, lng: geo?.lng ?? null, photo_path, notes: v.notes, ai_summary: summary, outcome: v.outcome, next_visit: v.next_visit || null });
    if (error) return toast.error(error.message);
    toast.success("Visit logged"); setV({ partner_id: "", notes: "", outcome: "Order taken", next_visit: "" }); setGeo(null); setPhoto(null); inv();
  };

  const viewPhoto = async (path: string) => {
    const { data } = await supabase.storage.from("dist-visits").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Salesperson</span>
        <Select value={rep || "all"} onValueChange={(x) => setRep(x === "all" ? "" : x)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Everyone</SelectItem>{reps.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Today's plan — {WEEKDAYS[wd - 1]}</CardTitle><CardDescription>{todays.map((x) => `${x.sales_rep}: ${x.area}`).join(" · ") || "No beat planned today"}</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {planned.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>{p.name} <span className="text-xs text-muted-foreground">{p.city}</span></span>
                {visitedToday.has(p.id) ? <Badge>Visited</Badge> : <Button size="sm" variant="outline" onClick={() => setV({ ...v, partner_id: p.id })}>Visit</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Log a visit</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Select value={v.partner_id} onValueChange={(x) => setV({ ...v, partner_id: x })}><SelectTrigger><SelectValue placeholder="Outlet" /></SelectTrigger>
              <SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={checkIn}><MapPin className="h-4 w-4 mr-1" />{geo ? `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` : "Check in (GPS)"}</Button>
              <label className="inline-flex items-center gap-1 text-sm border rounded px-3 py-1.5 cursor-pointer"><Camera className="h-4 w-4" />{photo ? photo.name.slice(0, 18) : "Shelf photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
            </div>
            <Textarea rows={3} placeholder="Discussion, stock seen, competitor activity, commitments…" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
            <div className="flex gap-2">
              <Select value={v.outcome} onValueChange={(x) => setV({ ...v, outcome: x })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Order taken", "Payment collected", "No order", "Complaint", "New outlet"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
              <Input type="date" value={v.next_visit} onChange={(e) => setV({ ...v, next_visit: e.target.value })} />
            </div>
            <Button onClick={save} disabled={ai.loading} className="w-full">{ai.loading ? "Summarising…" : "Save visit"}</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Weekly beat plan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="Salesperson" value={b.sales_rep} onChange={(e) => setB({ ...b, sales_rep: e.target.value })} list="reps" />
              <datalist id="reps">{reps.map((r) => <option key={r} value={r} />)}</datalist>
              <Select value={b.weekday} onValueChange={(x) => setB({ ...b, weekday: x })}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Area / city" value={b.area} onChange={(e) => setB({ ...b, area: e.target.value })} />
              <Button onClick={async () => {
                if (!b.sales_rep || !b.area) return toast.error("Salesperson and area needed");
                const ids = partners.filter((p) => [p.city, p.territory].some((x) => x && x.toLowerCase().includes(b.area.toLowerCase()))).map((p) => p.id);
                const { error } = await distDb.from("dist_beats").insert({ sales_rep: b.sales_rep, weekday: +b.weekday, area: b.area, partner_ids: ids });
                if (error) return toast.error(error.message);
                toast.success(`Beat added with ${ids.length} outlets`); inv();
              }}><Plus className="h-4 w-4" /></Button>
            </div>
            {beats.map((x) => (
              <div key={x.id} className="flex justify-between rounded border p-2 text-sm">
                <span><b>{WEEKDAYS[x.weekday - 1]}</b> · {x.sales_rep} → {x.area} <span className="text-xs text-muted-foreground">({x.partner_ids.length} outlets)</span></span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => { await distDb.from("dist_beats").delete().eq("id", x.id); inv(); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent visits</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-auto">
            {visits.filter((x) => !rep || x.sales_rep === rep).slice(0, 40).map((x) => (
              <div key={x.id} className="rounded border p-2 text-sm">
                <div className="flex justify-between"><b>{x.dist_partners?.name}</b><span className="text-xs text-muted-foreground">{new Date(x.checked_in_at).toLocaleString("en-IN")}</span></div>
                <div className="text-xs text-muted-foreground">{x.sales_rep} · {x.outcome}{x.lat ? ` · 📍 ${Number(x.lat).toFixed(3)}, ${Number(x.lng).toFixed(3)}` : ""}{x.next_visit ? ` · next ${x.next_visit}` : ""}</div>
                {x.ai_summary ? <div className="mt-1 whitespace-pre-wrap text-xs">{x.ai_summary}</div> : x.notes && <div className="mt-1 text-xs">{x.notes}</div>}
                {x.photo_path && <Button size="sm" variant="link" className="h-auto p-0" onClick={() => viewPhoto(x.photo_path)}>View photo</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
