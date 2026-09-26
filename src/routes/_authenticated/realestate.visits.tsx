import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MapPin, LogOut, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRe, useReInvalidate, reDb, reRun, useReAi, VISIT_STATUS, waLink } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/visits")({
  head: () => ({ meta: [{ title: "VisitFlow Site Visits | Real Estate CRM" }, { name: "description", content: "Schedule site visits, check in with GPS, capture feedback and AI summaries." }] }),
  component: VisitsPage,
});

const empty = { client_id: "", property_id: "", scheduled_at: "", agent_name: "", meeting_point: "" };
const fbEmpty = { interest: "3", price: "", location: "", amenities: "", objection: "", competition: "", notes: "", next_action: "" };

function VisitsPage() {
  const { user } = useAuth();
  const inv = useReInvalidate();
  const ai = useReAi();
  const { data: visits = [] } = useRe("re_site_visits", "*, re_clients(full_name, phone, whatsapp), re_properties(title, location, city)", "scheduled_at", true);
  const { data: leads = [] } = useRe("re_clients", "id, full_name", "full_name", true);
  const { data: units = [] } = useRe("re_properties", "id, title, project_id", "title", true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>(empty);
  const [fbFor, setFbFor] = useState<any>(null);
  const [fb, setFb] = useState<any>(fbEmpty);

  const create = async () => {
    if (!f.client_id || !f.scheduled_at) return toast.error("Choose the customer and time");
    const unit = units.find((u: any) => u.id === f.property_id);
    if (await reRun(reDb.from("re_site_visits").insert({ ...f, property_id: f.property_id || null, project_id: unit?.project_id ?? null, scheduled_at: new Date(f.scheduled_at).toISOString(), owner_id: user?.id }), "Site visit scheduled")) {
      await reDb.from("re_deals").update({ stage: "site_visit_scheduled" }).eq("client_id", f.client_id).in("stage", ["inquiry", "contacted", "qualified", "property_shared"]);
      setOpen(false); setF(empty); inv();
    }
  };
  const setStatus = async (v: any, status: string) => { if (await reRun(reDb.from("re_site_visits").update({ status }).eq("id", v.id))) inv(); };
  const checkIn = (v: any) => {
    const save = async (lat?: number, lng?: number) => { if (await reRun(reDb.from("re_site_visits").update({ status: "Arrived", checkin_at: new Date().toISOString(), checkin_method: lat ? "GPS" : "Manual", lat: lat ?? null, lng: lng ?? null }).eq("id", v.id), lat ? "Checked in with GPS" : "Checked in")) inv(); };
    if (!navigator.geolocation) return save();
    navigator.geolocation.getCurrentPosition((p) => save(p.coords.latitude, p.coords.longitude), () => save(), { timeout: 8000 });
  };
  const remind = (v: any) => {
    const when = new Date(v.scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    window.open(waLink(v.re_clients?.whatsapp || v.re_clients?.phone, `Hi ${v.re_clients?.full_name?.split(" ")[0] ?? ""}, reminder for your site visit to ${v.re_properties?.title ?? "the property"} on ${when}.${v.meeting_point ? " Meeting point: " + v.meeting_point + "." : ""} Reply YES to confirm.`), "_blank");
  };
  const saveFb = async (summarise: boolean) => {
    if (!fbFor) return;
    const text = `Interest ${fb.interest}/5. Price: ${fb.price}. Location: ${fb.location}. Amenities: ${fb.amenities}. Objection: ${fb.objection}. Competition: ${fb.competition}. Notes: ${fb.notes}`;
    let summary = fbFor.ai_summary;
    if (summarise) { const r = await ai.run({ mode: "visit_summary", text }); if (r) summary = r.text; }
    if (await reRun(reDb.from("re_site_visits").update({ status: "Completed", checkout_at: fbFor.checkout_at ?? new Date().toISOString(), interest: Number(fb.interest), feedback: fb, notes: fb.notes || null, next_action: fb.next_action || null, ai_summary: summary ?? null }).eq("id", fbFor.id), "Feedback saved")) {
      await reDb.from("re_deals").update({ stage: Number(fb.interest) >= 4 ? "interested" : "site_visit_done" }).eq("client_id", fbFor.client_id).in("stage", ["site_visit_scheduled", "inquiry", "qualified", "contacted", "property_shared"]);
      setFbFor(null); inv();
    }
  };

  const today = new Date().toDateString();
  const upcoming = visits.filter((v: any) => new Date(v.scheduled_at) >= new Date(new Date().setHours(0, 0, 0)) && !["Completed", "Cancelled", "No Show"].includes(v.status));
  const done = visits.filter((v: any) => v.status === "Completed");

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[["Today", visits.filter((v: any) => new Date(v.scheduled_at).toDateString() === today).length], ["Upcoming", upcoming.length], ["Completed", done.length], ["No-shows", visits.filter((v: any) => v.status === "No Show").length]].map(([k, v]) => (
          <Card key={k as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-bold">{v as number}</div></CardContent></Card>))}
      </div>
      <div className="flex"><Button className="ml-auto" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Schedule visit</Button></div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">All visits</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {visits.length === 0 && <div className="text-sm text-muted-foreground">No site visits yet</div>}
          {[...visits].reverse().map((v: any) => (
            <div key={v.id} className="border rounded-md p-3 flex flex-wrap gap-3 items-start">
              <div className="min-w-[180px]"><div className="font-medium">{v.re_clients?.full_name}</div><div className="text-xs text-muted-foreground">{v.re_properties?.title ?? "—"}</div></div>
              <div className="text-xs"><div>{new Date(v.scheduled_at).toLocaleString("en-IN")}</div><div className="text-muted-foreground">{[v.agent_name, v.meeting_point].filter(Boolean).join(" · ")}</div>
                {v.checkin_at && <div className="text-muted-foreground">In {new Date(v.checkin_at).toLocaleTimeString()} ({v.checkin_method}){v.checkout_at ? ` · Out ${new Date(v.checkout_at).toLocaleTimeString()}` : ""}</div>}</div>
              <Select value={v.status} onValueChange={(s) => setStatus(v, s)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{VISIT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant="ghost" onClick={() => remind(v)}><MessageCircle className="h-3 w-3 mr-1" />Remind</Button>
                {!v.checkin_at && <Button size="sm" variant="outline" onClick={() => checkIn(v)}><MapPin className="h-3 w-3 mr-1" />Check in</Button>}
                {v.checkin_at && !v.checkout_at && <Button size="sm" variant="outline" onClick={async () => { await reRun(reDb.from("re_site_visits").update({ checkout_at: new Date().toISOString() }).eq("id", v.id), "Checked out"); inv(); }}><LogOut className="h-3 w-3 mr-1" />Check out</Button>}
                <Button size="sm" onClick={() => { setFbFor(v); setFb({ ...fbEmpty, ...(v.feedback ?? {}) }); }}>Feedback</Button>
              </div>
              {v.ai_summary && <div className="w-full text-xs bg-muted/40 rounded p-2"><Sparkles className="h-3 w-3 inline mr-1" />{v.ai_summary}</div>}
              {v.interest && <Badge variant="outline">Interest {v.interest}/5</Badge>}
            </div>
          ))}
        </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Schedule site visit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}><SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger><SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}</SelectContent></Select>
            <Select value={f.property_id} onValueChange={(v) => setF({ ...f, property_id: v })}><SelectTrigger><SelectValue placeholder="Property / unit" /></SelectTrigger><SelectContent>{units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}</SelectContent></Select>
            <div className="space-y-1"><Label className="text-xs">Date & time</Label><Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} /></div>
            <Input placeholder="Salesperson" value={f.agent_name} onChange={(e) => setF({ ...f, agent_name: e.target.value })} />
            <Input placeholder="Meeting point" value={f.meeting_point} onChange={(e) => setF({ ...f, meeting_point: e.target.value })} />
          </div>
          <DialogFooter><Button onClick={create}>Schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fbFor} onOpenChange={(o) => !o && setFbFor(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Visit feedback · {fbFor?.re_clients?.full_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Overall interest (1–5)</Label><Select value={fb.interest} onValueChange={(v) => setFb({ ...fb, interest: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["1", "2", "3", "4", "5"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            {[["price", "Price feedback"], ["location", "Location feedback"], ["amenities", "Amenities / size / floor"], ["objection", "Main objection"], ["competition", "Competing projects"], ["next_action", "Next action"]].map(([k, l]) => (
              <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input value={fb[k]} onChange={(e) => setFb({ ...fb, [k]: e.target.value })} /></div>))}
          </div>
          <Textarea rows={2} placeholder="Other notes" value={fb.notes} onChange={(e) => setFb({ ...fb, notes: e.target.value })} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => saveFb(false)}>Save</Button>
            <Button onClick={() => saveFb(true)} disabled={ai.loading}>{ai.loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}Save with AI summary</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
