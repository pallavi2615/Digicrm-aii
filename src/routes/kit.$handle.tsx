import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMediaKit, submitBrief } from "@/lib/creator.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/kit/$handle")({
  loader: async ({ params }) => {
    const r = await getMediaKit({ data: { handle: params.handle } });
    if (!r.profile) throw notFound();
    return r;
  },
  head: ({ loaderData }) => {
    const p = loaderData?.profile;
    const title = p ? `${p.display_name} — Media Kit` : "Media Kit";
    const desc = p?.bio?.slice(0, 150) || `Work with ${p?.display_name ?? "this creator"} — audience, past brands and rates.`;
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  notFoundComponent: () => <div className="p-16 text-center text-muted-foreground">This media kit is not available.</div>,
  component: MediaKit,
});

type Plat = { platform: string; handle: string; followers: number; engagement: number };
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n || 0));

function MediaKit() {
  const { profile: p, rates } = Route.useLoaderData();
  const send = useServerFn(submitBrief);
  const [f, setF] = useState({ brand: "", contact_name: "", email: "", phone: "", campaign: "", budget: "", platform: "", brief: "", website: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  const plats = (p.platforms as Plat[]) ?? [];
  const aud = (p.audience as { summary?: string })?.summary;
  const tests = (p.testimonials as { quote: string; by: string }[]) ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await send({ data: { ...f, handle: p.handle, budget: f.budget ? Number(f.budget) : null } }); setDone(true); }
    catch (err) { toast.error((err as Error).message.includes("email") ? "Please enter a valid email" : "Could not send — check the fields and try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 py-14 flex flex-col sm:flex-row items-center gap-6">
          {p.avatar_url ? <img src={p.avatar_url} alt={p.display_name} className="h-28 w-28 rounded-full object-cover border-4 border-background/30" />
            : <div className="h-28 w-28 rounded-full bg-background/20 flex items-center justify-center text-4xl font-bold">{p.display_name[0]}</div>}
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{p.display_name}</h1>
            <p className="opacity-90">{[p.niche, p.location].filter(Boolean).join(" · ")}</p>
            <a href="#hire" className="inline-block mt-3 rounded-full bg-background text-foreground px-5 py-2 text-sm font-semibold">Hire me</a>
          </div>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {p.bio && <p className="text-lg leading-relaxed">{p.bio}</p>}
        {plats.length > 0 && <section><h2 className="font-semibold mb-3">Platforms</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {plats.map((pl, i) => <Card key={i}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{pl.platform}</p><p className="text-2xl font-bold">{fmt(pl.followers)}</p><p className="text-xs">{pl.handle} · {pl.engagement}% engagement</p></CardContent></Card>)}
        </div></section>}
        {aud && <section><h2 className="font-semibold mb-2">Audience</h2><p className="text-muted-foreground">{aud}</p></section>}
        {(p.categories ?? []).length > 0 && <div className="flex flex-wrap gap-2">{p.categories.map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>}
        {(p.past_brands ?? []).length > 0 && <section><h2 className="font-semibold mb-2">Brands I've worked with</h2><div className="flex flex-wrap gap-2">{p.past_brands.map((b: string) => <Badge key={b} variant="outline" className="text-sm py-1">{b}</Badge>)}</div></section>}
        {tests.length > 0 && <section className="grid md:grid-cols-2 gap-3">{tests.map((t, i) => <Card key={i}><CardContent className="p-4 italic">"{t.quote}"<p className="not-italic text-sm text-muted-foreground mt-2">— {t.by}</p></CardContent></Card>)}</section>}
        {rates.length > 0 && <section><h2 className="font-semibold mb-3">Rate card</h2><div className="grid sm:grid-cols-2 gap-2">
          {rates.map((r, i) => <div key={i} className="flex justify-between border rounded p-3 text-sm"><span>{r.item}{r.kind === "addon" ? " (add-on)" : ""}</span><b>₹{Number(r.price).toLocaleString("en-IN")}</b></div>)}
        </div></section>}
        <section id="hire"><Card><CardContent className="p-6">
          <h2 className="text-xl font-bold mb-1">Send a campaign brief</h2>
          {done ? <p className="text-muted-foreground">Thanks! Your brief has reached {p.display_name}. Expect a reply soon.</p> : (
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 mt-3">
              <div><Label>Brand</Label><Input required value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
              <div><Label>Your name</Label><Input required value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
              <div><Label>Campaign</Label><Input required value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} /></div>
              <div><Label>Budget (₹)</Label><Input type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Platform</Label><Input value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder="Instagram, YouTube…" /></div>
              <div className="sm:col-span-2"><Label>Brief</Label><Textarea rows={4} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></div>
              <input type="text" tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
              <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "Sending…" : "Send brief"}</Button>
            </form>
          )}
        </CardContent></Card></section>
      </main>
    </div>
  );
}
