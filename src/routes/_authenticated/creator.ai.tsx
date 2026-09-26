import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, Send, Sparkles } from "lucide-react";
import { useCreatorAi, useProfiles, useBrands, useBrandContact, parseAiJson } from "@/lib/creator-data";
import { Badge } from "@/components/ui/badge";
import { CreatorSendButtons } from "@/components/creator-send-buttons";
import { supabase } from "@/integrations/supabase/client";
import { Pick } from "@/components/creator-deal-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/ai")({
  head: () => ({ meta: [{ title: "AI Studio | DigiCRM AI" }, { name: "description", content: "AI command centre and pitch generator for creator brand deals." }] }),
  component: AiStudio,
});

const PROMPTS = [
  "What needs my attention today?",
  "Show me all deals that need follow-up.",
  "Which brands haven't moved for 7 days?",
  "Which deals are likely to close?",
  "Which deals are blocked and why?",
  "Show brands that generated more than ₹2 lakh in the last 12 months.",
];

function AiStudio() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CommandCenter />
      <PitchGenerator />
      <div className="lg:col-span-2"><BrandFinder /></div>
    </div>
  );
}

function CommandCenter() {
  const ai = useCreatorAi();
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: question }]); setQ(""); setBusy(true);
    try { const t = await ai({ mode: "ask", question }); setMsgs((m) => [...m, { role: "ai", text: t }]); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card className="flex flex-col"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI command centre</CardTitle>
      <CardDescription>Answers from your own deals, invoices and deliverables.</CardDescription></CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">{PROMPTS.map((p) => <Button key={p} size="sm" variant="outline" className="h-7 text-xs" onClick={() => ask(p)} disabled={busy}>{p}</Button>)}</div>
        <div className="flex-1 min-h-64 max-h-[480px] overflow-y-auto space-y-2 rounded border p-3 bg-muted/20">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">Ask anything about your brand deals.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground ml-8" : "bg-card border mr-8"}`}>{m.text}</div>
          ))}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Draft a renewal proposal for my best brands…" />
          <Button type="submit" disabled={busy}><Send className="h-4 w-4" /></Button>
        </form>
      </CardContent></Card>
  );
}

function PitchGenerator() {
  const ai = useCreatorAi();
  const profiles = useProfiles();
  const brands = useBrands();
  const [channel, setChannel] = useState("Email");
  const [creatorId, setCreatorId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [brand, setBrand] = useState("");
  const [campaign, setCampaign] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const contact = useBrandContact(brandId || null);

  const run = async () => {
    const b = (brands.data ?? []).find((x) => x.id === brandId);
    const p = (profiles.data ?? []).find((x) => x.id === creatorId) ?? (profiles.data ?? [])[0];
    const brandText = b ? `${b.name}; ${b.category ?? ""}; ${b.website ?? ""}; prefers ${(b.preferred_platforms ?? []).join(", ")}; notes: ${b.notes ?? ""}` : brand;
    if (!brandText.trim()) return toast.error("Pick or describe a brand");
    const creatorText = p ? `${p.display_name}, ${p.niche ?? ""}, ${p.location ?? ""}. ${p.bio ?? ""} Platforms: ${JSON.stringify(p.platforms)}. Audience: ${JSON.stringify(p.audience)}. Past brands: ${(p.past_brands ?? []).join(", ")}` : "Independent creator";
    setBusy(true);
    try { setOut(await ai({ mode: "pitch", channel, brand: brandText, campaign: campaign || "Open to ideas", creator: creatorText })); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base">AI pitch generator</CardTitle>
      <CardDescription>Personalised pitches you review before sending.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Pick label="Channel" value={channel} onChange={setChannel} options={["Email", "Instagram DM", "LinkedIn message", "WhatsApp message", "Proposal", "Negotiation response"]} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Brand from CRM</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">— none —</option>{(brands.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><Label>…or describe a brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!!brandId} placeholder="Minimalist, D2C skincare" /></div>
        </div>
        <div><Label>Creator</Label>
          <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
            <option value="">First profile</option>{(profiles.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
        <div><Label>Campaign idea</Label><Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Festive gifting reel series" /></div>
        <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}Generate</Button>
        <Textarea rows={10} value={out} onChange={(e) => setOut(e.target.value)} placeholder="Your pitch appears here." />
        {contact.data && <p className="text-xs text-muted-foreground">To: {contact.data.name}{contact.data.email ? ` · ${contact.data.email}` : ""}</p>}
        <CreatorSendButtons text={out} email={contact.data?.email} phone={contact.data?.whatsapp || contact.data?.phone} linkedin={contact.data?.linkedin}
          subject={campaign ? `Collaboration: ${campaign}` : undefined}
          onSent={async (ch) => {
            if (brandId) await supabase.from("creator_activities").insert({ brand_id: brandId, kind: ch === "Email" ? "email" : "message", body: `Pitch sent by ${ch}:\n${out}` });
          }} />
        <Copy className="hidden" />
      </CardContent></Card>
  );
}

type Prospect = { name: string; category?: string; website?: string | null; why?: string; pitch_angle?: string; est_budget_inr?: number | null };

function BrandFinder() {
  const ai = useCreatorAi();
  const profiles = useProfiles();
  const [creatorId, setCreatorId] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Prospect[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const find = async () => {
    const p = profiles.data?.find((x) => x.id === creatorId) ?? profiles.data?.[0];
    if (!p) return toast.error("Add a creator profile first");
    setBusy(true);
    try {
      const out = parseAiJson<{ brands?: Prospect[] }>(await ai({ mode: "prospects", goal: goal || "Find relevant sponsors",
        creator: JSON.stringify({ name: p.display_name, niche: p.niche, location: p.location, categories: p.categories, past_brands: p.past_brands, followers: p.followers, engagement: p.engagement_rate, audience: p.audience }) }));
      setRows(out.brands ?? []);
      if (!out.brands?.length) toast.message("No suggestions this time");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const add = async (b: Prospect) => {
    const { error } = await supabase.from("creator_brands").insert({ name: b.name, category: b.category ?? null, website: b.website ?? null,
      marketing_budget: b.est_budget_inr ?? null, tags: ["prospect", "ai-agent"], notes: [b.why, b.pitch_angle && `Pitch angle: ${b.pitch_angle}`].filter(Boolean).join("\n") });
    if (error) return toast.error(error.message);
    setAdded((a) => ({ ...a, [b.name]: true })); toast.success(`${b.name} added to your brands as a prospect`);
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">AI Brand Deal Agent — find brands</CardTitle>
        <CardDescription>AI suggests brands that fit your audience. You review and add them; outreach is always sent by you.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-md h-9 px-2 bg-background text-sm" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
            {(profiles.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <Input className="flex-1 min-w-60" placeholder="e.g. Skincare brands launching in monsoon" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Button onClick={find} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Find brands</Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((b) => (
            <div key={b.name} className="border rounded-md p-3 text-sm space-y-1">
              <div className="flex items-center gap-2"><b className="flex-1">{b.name}</b>{b.category && <Badge variant="secondary">{b.category}</Badge>}</div>
              {b.why && <p className="text-muted-foreground">{b.why}</p>}
              {b.pitch_angle && <p><span className="text-muted-foreground">Angle:</span> {b.pitch_angle}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant={added[b.name] ? "secondary" : "default"} disabled={added[b.name]} onClick={() => add(b)}>{added[b.name] ? "Added" : "Add as prospect"}</Button>
                {b.website && /^https?:\/\//.test(b.website) && <Button size="sm" variant="ghost" asChild><a href={b.website} target="_blank" rel="noreferrer">Website</a></Button>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
