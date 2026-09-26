import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Bell, MapPin, Search, Sparkles, Phone, MessageCircle, Plus, RefreshCw, WifiOff, Wifi, Check, Navigation } from "lucide-react";
import { toast } from "sonner";
import { useOfflineCrm, uuid } from "@/lib/offline-sync";
import { ReCopilot } from "@/components/re-copilot";
import { cr, waLink, SOURCES, FOLLOWUP_KINDS } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/m")({
  head: () => ({
    meta: [
      { title: "DigiCRM Sales App — leads, calls, visits on the go" },
      { name: "description", content: "Mobile app for salespeople: leads, calls, WhatsApp, follow-ups, site visits and property search, working offline." },
      { property: "og:title", content: "DigiCRM Sales App" },
      { property: "og:description", content: "Leads, calls, WhatsApp, follow-ups, site visits and property search — even offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesApp,
});

type Tab = "leads" | "follow" | "visits" | "search" | "ai";
const now = () => new Date().toISOString();
const dayOf = (d: string) => d?.slice(0, 10);

function SalesApp() {
  const crm = useOfflineCrm();
  const { cache, queue, online, syncing, mutate, sync, error } = crm;
  const [tab, setTab] = useState<Tab>("leads");
  const leadName = (id: string) => cache.leads.find((l) => l.id === id)?.full_name ?? "Lead";
  const leadOf = (id: string) => cache.leads.find((l) => l.id === id);
  const today = new Date().toISOString().slice(0, 10);
  const dueCount = cache.followups.filter((f) => !f.done && dayOf(f.due_at) <= today).length;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-3 py-2">
        <div><p className="text-sm font-semibold">Sales App</p><p className="text-[11px] text-muted-foreground">{cache.syncedAt ? `Synced ${new Date(cache.syncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Not synced yet"}{queue.length ? ` · ${queue.length} change(s) waiting` : ""}</p></div>
        <div className="flex items-center gap-2">
          <Badge variant={online ? "secondary" : "destructive"} className="gap-1">{online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{online ? "Online" : "Offline"}</Badge>
          <Button size="icon" variant="ghost" onClick={sync} disabled={!online || syncing}><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /></Button>
        </div>
      </header>
      {error && <p className="bg-destructive/10 px-3 py-1 text-xs text-destructive">{error}</p>}

      <main className="flex-1 space-y-2 p-3 pb-20">
        {tab === "leads" && <Leads crm={crm} />}
        {tab === "follow" && <FollowUps followups={cache.followups} leadOf={leadOf} leadName={leadName} mutate={mutate} today={today} />}
        {tab === "visits" && <Visits visits={cache.visits} leadOf={leadOf} leadName={leadName} properties={cache.properties} mutate={mutate} />}
        {tab === "search" && <PropertySearch properties={cache.properties} leads={cache.leads} />}
        {tab === "ai" && <ReCopilot leads={cache.leads.filter((l) => !l._pending)} onApplied={sync} compact />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 mx-auto grid max-w-md grid-cols-5 border-t bg-card">
        {([["leads", "Leads", Users], ["follow", "Follow-ups", Bell], ["visits", "Visits", MapPin], ["search", "Search", Search], ["ai", "Copilot", Sparkles]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === k ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{l}{k === "follow" && dueCount > 0 && <span className="absolute right-4 top-1 rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">{dueCount}</span>}
          </button>))}
      </nav>
    </div>
  );
}

function Leads({ crm }: { crm: ReturnType<typeof useOfflineCrm> }) {
  const { cache, mutate } = crm;
  const [q, setQ] = useState(""); const [temp, setTemp] = useState("all"); const [open, setOpen] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const [n, setN] = useState<any>({ full_name: "", phone: "", source: "Walk-in", requirement: "" });
  const [note, setNote] = useState(""); const [fu, setFu] = useState({ kind: "Call", days: "1" });
  const list = cache.leads.filter((l) => (temp === "all" || l.temperature === temp) && (!q || `${l.full_name} ${l.phone ?? ""} ${l.preferred_location ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const touch = (l: any, extra: any = {}) => mutate("re_clients", "update", l.id, { last_contacted_at: now(), ...extra });
  return (<>
    <div className="flex gap-2"><Input placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} />
      <Select value={temp} onValueChange={setTemp}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{["all", "Hot", "Warm", "Cold"].map((t) => <SelectItem key={t} value={t}>{t === "all" ? "All" : t}</SelectItem>)}</SelectContent></Select>
      <Button size="icon" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" /></Button></div>
    {adding && <div className="space-y-2 rounded-lg border p-3">
      <Input placeholder="Name" value={n.full_name} onChange={(e) => setN({ ...n, full_name: e.target.value })} />
      <Input placeholder="Mobile" inputMode="tel" value={n.phone} onChange={(e) => setN({ ...n, phone: e.target.value })} />
      <Select value={n.source} onValueChange={(v) => setN({ ...n, source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <Textarea rows={2} placeholder="Requirement (e.g. 3BHK near metro, ₹1 Cr)" value={n.requirement} onChange={(e) => setN({ ...n, requirement: e.target.value })} />
      <Button className="w-full" onClick={() => { if (!n.full_name.trim()) return toast.error("Name required"); mutate("re_clients", "insert", uuid(), { ...n, owner_id: cache.userId, temperature: "Warm", status: "active" }); setN({ full_name: "", phone: "", source: "Walk-in", requirement: "" }); setAdding(false); toast.success(navigator.onLine ? "Lead saved" : "Saved offline — will sync"); }}>Save lead</Button>
    </div>}
    {list.map((l) => (
      <div key={l.id} className="rounded-lg border bg-card p-3">
        <button className="w-full text-left" onClick={() => setOpen(open === l.id ? null : l.id)}>
          <div className="flex items-center justify-between"><span className="font-medium">{l.full_name}</span><div className="flex gap-1">{l._pending && <Badge variant="outline" className="text-[10px]">Pending sync</Badge>}<Badge variant={l.temperature === "Hot" ? "destructive" : "secondary"} className="text-[10px]">{l.temperature ?? "—"}</Badge></div></div>
          <p className="text-xs text-muted-foreground">{[l.phone, l.bhk && `${l.bhk} BHK`, l.preferred_location, l.budget_max && `up to ${cr(l.budget_max)}`].filter(Boolean).join(" · ")}</p>
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" asChild><a href={`tel:${l.phone ?? ""}`} onClick={() => touch(l)}><Phone className="mr-1 h-3 w-3" />Call</a></Button>
          <Button size="sm" variant="outline" asChild><a href={waLink(l.whatsapp || l.phone, `Hi ${l.full_name?.split(" ")[0]}, `)} target="_blank" rel="noreferrer" onClick={() => touch(l)}><MessageCircle className="mr-1 h-3 w-3" />WhatsApp</a></Button>
        </div>
        {open === l.id && <div className="mt-3 space-y-2 border-t pt-2">
          {l.requirement && <p className="whitespace-pre-line text-xs text-muted-foreground">{l.requirement}</p>}
          <div className="flex gap-1">{["Hot", "Warm", "Cold"].map((t) => <Button key={t} size="sm" variant={l.temperature === t ? "default" : "outline"} className="flex-1" onClick={() => touch(l, { temperature: t })}>{t}</Button>)}</div>
          <Textarea rows={2} placeholder="Call note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2"><Select value={fu.kind} onValueChange={(v) => setFu({ ...fu, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FOLLOWUP_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
            <Select value={fu.days} onValueChange={(v) => setFu({ ...fu, days: v })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{[["0", "Today"], ["1", "Tomorrow"], ["3", "In 3 days"], ["7", "In a week"]].map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent></Select></div>
          <Button size="sm" className="w-full" onClick={() => {
            if (note.trim()) touch(l, { requirement: [l.requirement, `[${new Date().toLocaleDateString("en-IN")}] ${note.trim()}`].filter(Boolean).join("\n") });
            mutate("re_followups", "insert", uuid(), { owner_id: cache.userId, client_id: l.id, kind: fu.kind, due_at: new Date(Date.now() + Number(fu.days) * 864e5).toISOString(), done: false, notes: note.trim() || null });
            setNote(""); toast.success("Saved");
          }}>Save note & follow-up</Button>
        </div>}
      </div>))}
    {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">{cache.syncedAt ? "No leads" : "Connect to the internet once to download your leads."}</p>}
  </>);
}

function FollowUps({ followups, leadOf, leadName, mutate, today }: any) {
  const groups = [["Overdue", (f: any) => dayOf(f.due_at) < today], ["Today", (f: any) => dayOf(f.due_at) === today], ["Upcoming", (f: any) => dayOf(f.due_at) > today]] as const;
  return (<>{groups.map(([g, fn]) => { const list = followups.filter((f: any) => !f.done && fn(f)); if (!list.length) return null; return (
    <div key={g} className="space-y-2"><p className="text-xs font-semibold uppercase text-muted-foreground">{g} ({list.length})</p>
      {list.map((f: any) => { const l = leadOf(f.client_id); return (
        <div key={f.id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
          <div className="flex-1"><p className="text-sm font-medium">{f.kind} · {leadName(f.client_id)}</p><p className="text-xs text-muted-foreground">{new Date(f.due_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{f.notes ? ` · ${f.notes}` : ""}</p></div>
          {l?.phone && <Button size="icon" variant="ghost" asChild><a href={f.kind === "WhatsApp" ? waLink(l.whatsapp || l.phone, `Hi ${l.full_name?.split(" ")[0]}, `) : `tel:${l.phone}`} target="_blank" rel="noreferrer">{f.kind === "WhatsApp" ? <MessageCircle className="h-4 w-4" /> : <Phone className="h-4 w-4" />}</a></Button>}
          <Button size="icon" variant="outline" onClick={() => { mutate("re_followups", "update", f.id, { done: true }); if (l) mutate("re_clients", "update", l.id, { last_contacted_at: now() }); }}><Check className="h-4 w-4" /></Button>
        </div>); })}</div>); })}
    {!followups.some((f: any) => !f.done) && <p className="py-8 text-center text-sm text-muted-foreground">All caught up 🎉</p>}</>);
}

function Visits({ visits, leadOf, leadName, properties, mutate }: any) {
  const [fb, setFb] = useState<Record<string, string>>({});
  const upcoming = [...visits].filter((v: any) => !["Completed", "Cancelled", "No Show"].includes(v.status)).sort((a: any, b: any) => a.scheduled_at.localeCompare(b.scheduled_at));
  const done = visits.filter((v: any) => v.status === "Completed").slice(0, 10);
  const checkIn = (v: any) => {
    const save = (lat: number | null, lng: number | null, method: string) => { mutate("re_site_visits", "update", v.id, { status: "Arrived", checkin_at: now(), lat, lng, checkin_method: method }); toast.success("Checked in"); };
    if (!navigator.geolocation) return save(null, null, "Manual");
    navigator.geolocation.getCurrentPosition((p) => save(p.coords.latitude, p.coords.longitude, "GPS"), () => save(null, null, "Manual"), { timeout: 8000 });
  };
  const card = (v: any) => { const l = leadOf(v.client_id); const p = properties.find((x: any) => x.id === v.property_id); return (
    <div key={v.id} className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between"><span className="font-medium">{leadName(v.client_id)}</span><Badge variant="secondary">{v.status}</Badge></div>
      <p className="text-xs text-muted-foreground">{new Date(v.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{p ? ` · ${p.title}` : ""}{v.meeting_point ? ` · ${v.meeting_point}` : ""}</p>
      {v.status !== "Completed" && <div className="grid grid-cols-3 gap-2">
        {l?.phone && <Button size="sm" variant="outline" asChild><a href={`tel:${l.phone}`}><Phone className="h-3 w-3" /></a></Button>}
        {v.meeting_point && <Button size="sm" variant="outline" asChild><a href={`https://maps.google.com/?q=${encodeURIComponent(v.meeting_point)}`} target="_blank" rel="noreferrer"><Navigation className="h-3 w-3" /></a></Button>}
        {v.status !== "Arrived" ? <Button size="sm" onClick={() => checkIn(v)}>Check in</Button> : <Button size="sm" onClick={() => { mutate("re_site_visits", "update", v.id, { status: "Completed", checkout_at: now(), feedback: fb[v.id] || v.feedback || null }); toast.success("Visit completed"); }}>Complete</Button>}
      </div>}
      {v.status === "Arrived" && <Textarea rows={2} placeholder="Customer feedback, interest, objections…" value={fb[v.id] ?? ""} onChange={(e) => setFb({ ...fb, [v.id]: e.target.value })} />}
      {v.feedback && v.status === "Completed" && <p className="text-xs">{v.feedback}</p>}
    </div>); };
  return (<><p className="text-xs font-semibold uppercase text-muted-foreground">Upcoming</p>{upcoming.map(card)}{!upcoming.length && <p className="text-sm text-muted-foreground">No visits scheduled.</p>}
    {done.length > 0 && <><p className="pt-2 text-xs font-semibold uppercase text-muted-foreground">Recently completed</p>{done.map(card)}</>}</>);
}

function PropertySearch({ properties, leads }: any) {
  const [f, setF] = useState({ q: "", bhk: "any", max: "", status: "Available" });
  const [lead, setLead] = useState("");
  const list = useMemo(() => properties.filter((p: any) => (f.status === "any" || p.inventory_status === f.status) && (f.bhk === "any" || Number(p.bhk) === Number(f.bhk)) && (!f.max || Number(p.price) <= Number(f.max) * 1e5) && (!f.q || `${p.title} ${p.location ?? ""} ${p.city ?? ""} ${p.tower ?? ""}`.toLowerCase().includes(f.q.toLowerCase()))).slice(0, 100), [properties, f]);
  const l = leads.find((x: any) => x.id === lead);
  return (<>
    <Input placeholder="Project, location, tower…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
    <div className="grid grid-cols-3 gap-2">
      <Select value={f.bhk} onValueChange={(v) => setF({ ...f, bhk: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["any", "1", "2", "3", "4", "5"].map((b) => <SelectItem key={b} value={b}>{b === "any" ? "Any BHK" : `${b} BHK`}</SelectItem>)}</SelectContent></Select>
      <Input placeholder="Max ₹ lakh" inputMode="numeric" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
      <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Available", "Hold", "any"].map((s) => <SelectItem key={s} value={s}>{s === "any" ? "Any status" : s}</SelectItem>)}</SelectContent></Select>
    </div>
    <Select value={lead} onValueChange={setLead}><SelectTrigger><SelectValue placeholder="Share with lead… (optional)" /></SelectTrigger><SelectContent>{leads.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.full_name}</SelectItem>)}</SelectContent></Select>
    <p className="text-xs text-muted-foreground">{list.length} units</p>
    {list.map((p: any) => (
      <div key={p.id} className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between"><span className="text-sm font-medium">{p.title}</span><span className="text-sm font-semibold">{cr(p.price)}</span></div>
        <p className="text-xs text-muted-foreground">{[p.bhk && `${p.bhk} BHK`, p.super_area && `${p.super_area} sq ft`, p.facing, p.floor_no && `Floor ${p.floor_no}`, p.location, p.inventory_status].filter(Boolean).join(" · ")}</p>
        {l && <Button size="sm" variant="outline" className="mt-2" asChild><a href={waLink(l.whatsapp || l.phone, `Hi ${l.full_name.split(" ")[0]}, sharing an option for you: ${p.title} — ${p.bhk ?? ""} BHK, ${p.super_area ?? ""} sq ft${p.facing ? ", " + p.facing + " facing" : ""}, ${cr(p.price)}. Shall I book a site visit?`)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3 w-3" />Share with {l.full_name.split(" ")[0]}</a></Button>}
      </div>))}
  </>);
}
