import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Plus, Sparkles, Trash2, Copy } from "lucide-react";
import { useProfiles, useInvalidateCreator, useCreatorAi, parseAiJson } from "@/lib/creator-data";
import { PLATFORMS, inr } from "@/lib/creator";
import { Pick } from "@/components/creator-deal-dialog";
import { toast } from "sonner";
import { InstagramCard } from "@/components/instagram-card";

export const Route = createFileRoute("/_authenticated/creator/roster")({
  head: () => ({ meta: [{ title: "Media Kit & Roster | DigiCRM AI" }, { name: "description", content: "Creator profiles, public media kits, rate cards and AI pricing." }] }),
  component: RosterPage,
});

type Platform = { platform: string; handle: string; followers: number; engagement: number };

const BASE_ITEMS = ["Instagram Reel", "Instagram Post", "Instagram Story", "YouTube Video", "YouTube Integration", "YouTube Shorts", "TikTok", "LinkedIn Post", "Podcast", "Blog", "UGC Video", "Live Event", "Product Review"];
const ADDONS = ["Usage rights", "Whitelisting", "Paid amplification", "Exclusivity", "Additional revisions", "Raw footage", "Rush delivery", "Extended licensing"];

function RosterPage() {
  const profiles = useProfiles();
  const invalidate = useInvalidateCreator();
  const [sel, setSel] = useState<string | null>(null);
  const list = profiles.data ?? [];
  useEffect(() => { if (!sel && list[0]) setSel(list[0].id); }, [list, sel]);

  const add = async () => {
    const handle = `creator-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await supabase.from("creator_profiles").insert({ handle, display_name: "New creator" }).select("id").single();
    if (error) return toast.error(error.message);
    invalidate(); setSel(data.id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit"><CardHeader className="pb-2"><CardTitle className="text-base">Creator roster</CardTitle>
        <CardDescription>Solo creators keep one profile. Agencies add every creator they manage.</CardDescription></CardHeader>
        <CardContent className="space-y-1">
          {list.map((p) => (
            <button key={p.id} onClick={() => setSel(p.id)} className={`w-full text-left rounded px-2 py-1.5 text-sm ${sel === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
              {p.display_name}<span className="block text-xs text-muted-foreground">/{p.handle}</span>
            </button>
          ))}
          <Button size="sm" variant="outline" className="w-full mt-2" onClick={add}><Plus className="h-4 w-4 mr-1" />Add creator</Button>
        </CardContent></Card>
      {sel ? <ProfileEditor key={sel} id={sel} onChange={invalidate} /> : <p className="text-sm text-muted-foreground">Add your first creator profile to build a media kit.</p>}
    </div>
  );
}

function ProfileEditor({ id, onChange }: { id: string; onChange: () => void }) {
  const profiles = useProfiles();
  const p = (profiles.data ?? []).find((x) => x.id === id);
  const [f, setF] = useState({ handle: "", display_name: "", bio: "", avatar_url: "", niche: "", location: "", categories: "", past_brands: "", agency_commission_pct: "0", manager_name: "", is_public: true, audience: "", followers: "0", engagement_rate: "0" });
  const [plats, setPlats] = useState<Platform[]>([]);
  const [testimonials, setTestimonials] = useState("");
  useEffect(() => {
    if (!p) return;
    const aud = p.audience as Record<string, string>;
    setF({ handle: p.handle, display_name: p.display_name, bio: p.bio ?? "", avatar_url: p.avatar_url ?? "", niche: p.niche ?? "", location: p.location ?? "",
      categories: (p.categories ?? []).join(", "), past_brands: (p.past_brands ?? []).join(", "), agency_commission_pct: String(p.agency_commission_pct), manager_name: p.manager_name ?? "",
      is_public: p.is_public, audience: aud?.summary ?? "", followers: String(p.followers ?? 0), engagement_rate: String(p.engagement_rate ?? 0) });
    setPlats((p.platforms as Platform[]) ?? []);
    setTestimonials(((p.testimonials as { quote: string; by: string }[]) ?? []).map((t) => `${t.quote} — ${t.by}`).join("\n"));
  }, [p]);

  const rates = useQuery({ queryKey: ["creator", "rates", id], queryFn: async () => (await supabase.from("creator_rate_cards").select("*").eq("creator_id", id).order("kind").order("price")).data ?? [] });
  const [r, setR] = useState({ item: BASE_ITEMS[0], kind: "base", price: "" });

  const save = async () => {
    const handle = f.handle.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
    const arr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    const { error } = await supabase.from("creator_profiles").update({
      handle, display_name: f.display_name, bio: f.bio || null, avatar_url: f.avatar_url || null, niche: f.niche || null, location: f.location || null,
      categories: arr(f.categories), past_brands: arr(f.past_brands), agency_commission_pct: Number(f.agency_commission_pct) || 0, manager_name: f.manager_name || null,
      followers: Math.max(0, Math.round(Number(f.followers) || 0)), engagement_rate: Math.max(0, Math.min(100, Number(f.engagement_rate) || 0)),
      is_public: f.is_public, audience: { summary: f.audience }, platforms: plats as never,
      testimonials: testimonials.split("\n").filter(Boolean).map((l) => { const [quote, by] = l.split(" — "); return { quote, by: by ?? "" }; }) as never,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message.includes("duplicate") ? "That handle is taken" : error.message);
    toast.success("Profile saved"); onChange();
  };
  const addRate = async () => {
    const { error } = await supabase.from("creator_rate_cards").insert({ creator_id: id, item: r.item, kind: r.kind, price: Number(r.price) || 0 });
    if (error) return toast.error(error.message);
    setR({ ...r, price: "" }); rates.refetch();
  };
  const url = typeof window !== "undefined" ? `${window.location.origin}/kit/${f.handle}` : "";

  if (!p) return null;
  return (
    <div className="space-y-4">
      <InstagramCard profileId={id} onSynced={() => { onChange(); profiles.refetch(); }} />
      <Card><CardHeader className="pb-2 flex-row items-center justify-between">
        <div><CardTitle className="text-base">Media kit profile</CardTitle><CardDescription>Public at <span className="font-mono">/kit/{f.handle}</span> with a "Hire me" brief form that creates deals.</CardDescription></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" asChild><a href={`/kit/${f.handle}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Open</a></Button>
        </div></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>Display name</Label><Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
            <div><Label>Handle</Label><Input value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} /></div>
            <div><Label>Photo URL</Label><Input value={f.avatar_url} onChange={(e) => setF({ ...f, avatar_url: e.target.value })} /></div>
            <div><Label>Niche</Label><Input value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} placeholder="Beauty & lifestyle" /></div>
            <div><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
            <div><Label>Agency commission %</Label><Input type="number" value={f.agency_commission_pct} onChange={(e) => setF({ ...f, agency_commission_pct: e.target.value })} /></div>
            <div><Label>Talent manager</Label><Input value={f.manager_name} onChange={(e) => setF({ ...f, manager_name: e.target.value })} placeholder="Who manages this creator" /></div>
            <div><Label>Total followers (marketplace)</Label><Input type="number" min={0} value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} /></div>
            <div><Label>Engagement rate %</Label><Input type="number" min={0} max={100} step="0.1" value={f.engagement_rate} onChange={(e) => setF({ ...f, engagement_rate: e.target.value })} /></div>
            <div className="sm:col-span-3"><Label>Bio</Label><Textarea rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
            <div><Label>Content categories (comma)</Label><Input value={f.categories} onChange={(e) => setF({ ...f, categories: e.target.value })} /></div>
            <div><Label>Past brands (comma)</Label><Input value={f.past_brands} onChange={(e) => setF({ ...f, past_brands: e.target.value })} /></div>
            <div><Label>Audience (age, gender, geography)</Label><Input value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="68% women, 18–34, Mumbai/Delhi" /></div>
            <div className="sm:col-span-3"><Label>Testimonials (one per line: quote — name)</Label><Textarea rows={2} value={testimonials} onChange={(e) => setTestimonials(e.target.value)} /></div>
          </div>
          <div>
            <Label>Social platforms</Label>
            {plats.map((pl, i) => (
              <div key={i} className="flex gap-2 mt-1">
                <select className="rounded border bg-background px-2 text-sm" value={pl.platform} onChange={(e) => setPlats(plats.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))}>{PLATFORMS.map((o) => <option key={o}>{o}</option>)}</select>
                <Input placeholder="@handle" value={pl.handle} onChange={(e) => setPlats(plats.map((x, j) => j === i ? { ...x, handle: e.target.value } : x))} />
                <Input type="number" placeholder="Followers" value={pl.followers || ""} onChange={(e) => setPlats(plats.map((x, j) => j === i ? { ...x, followers: Number(e.target.value) } : x))} />
                <Input type="number" step="0.1" placeholder="Engagement %" value={pl.engagement || ""} onChange={(e) => setPlats(plats.map((x, j) => j === i ? { ...x, engagement: Number(e.target.value) } : x))} />
                <Button size="icon" variant="ghost" onClick={() => setPlats(plats.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setPlats([...plats, { platform: "Instagram", handle: "", followers: 0, engagement: 0 }])}><Plus className="h-4 w-4 mr-1" />Add platform</Button>
          </div>
          <div className="flex items-center gap-3"><Switch checked={f.is_public} onCheckedChange={(v) => setF({ ...f, is_public: v })} /><span className="text-sm">Media kit is public</span><Button className="ml-auto" onClick={save}>Save profile</Button></div>
        </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Rate card</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="w-24"><Pick label="Type" value={r.kind} onChange={(v) => setR({ ...r, kind: v, item: v === "base" ? BASE_ITEMS[0] : ADDONS[0] })} options={["base", "addon"]} /></div>
              <div className="flex-1"><Pick label="Item" value={r.item} onChange={(v) => setR({ ...r, item: v })} options={r.kind === "base" ? BASE_ITEMS : ADDONS} /></div>
              <div className="w-28"><Label>₹</Label><Input type="number" value={r.price} onChange={(e) => setR({ ...r, price: e.target.value })} /></div>
              <Button onClick={addRate}><Plus className="h-4 w-4" /></Button>
            </div>
            {(rates.data ?? []).map((x) => (
              <div key={x.id} className="flex items-center justify-between border rounded p-2 text-sm">
                <span>{x.item} {x.kind === "addon" && <Badge variant="outline" className="ml-1 text-[10px]">add-on</Badge>}</span>
                <span className="flex items-center gap-2">{inr(Number(x.price))}<Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { await supabase.from("creator_rate_cards").delete().eq("id", x.id); rates.refetch(); }}><Trash2 className="h-3.5 w-3.5" /></Button></span>
              </div>
            ))}
          </CardContent></Card>
        <PricingCalc plats={plats} />
      </div>
    </div>
  );
}

function PricingCalc({ plats }: { plats: Platform[] }) {
  const ai = useCreatorAi();
  const top = plats[0];
  const [i, setI] = useState({ followers: String(top?.followers ?? ""), engagement: String(top?.engagement ?? ""), platform: top?.platform ?? "Instagram", content: "Instagram Reel", brand_size: "Mid-size", usage_rights: "30 days organic", exclusivity: "None", duration: "1 month" });
  const [out, setOut] = useState<{ low?: number; high?: number; recommended?: number; rationale?: string; addons?: { name: string; price: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setOut(parseAiJson(await ai({ mode: "pricing", inputs: i }))); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI pricing calculator</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(i) as (keyof typeof i)[]).map((k) => (
            <div key={k}><Label className="text-xs capitalize">{k.replace(/_/g, " ")}</Label><Input value={i[k]} onChange={(e) => setI({ ...i, [k]: e.target.value })} /></div>
          ))}
        </div>
        <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}Suggest quote</Button>
        {out && (
          <div className="rounded border p-3 text-sm space-y-1">
            <p className="text-lg font-bold">{inr(out.low ?? 0)} – {inr(out.high ?? 0)}</p>
            {out.recommended != null && <p>Recommended: <b>{inr(out.recommended)}</b></p>}
            <p className="text-muted-foreground">{out.rationale}</p>
            {!!out.addons?.length && <p className="text-xs">{out.addons.map((a) => `${a.name} ${inr(a.price)}`).join(" · ")}</p>}
          </div>
        )}
      </CardContent></Card>
  );
}
