import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Inbox } from "lucide-react";
import { useCreatorAi, parseAiJson, useDeals, useInvalidateCreator, useBrands } from "@/lib/creator-data";
import { ENQUIRY_SOURCES, lakh } from "@/lib/creator";
import { Pick } from "@/components/creator-deal-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/inbox")({
  head: () => ({ meta: [{ title: "Brand Enquiries | DigiCRM AI" }, { name: "description", content: "Paste any brand email or DM and AI turns it into a CRM deal." }] }),
  component: InboxPage,
});

type Parsed = {
  brand?: string | null; contact_name?: string | null; contact_email?: string | null; contact_role?: string | null;
  campaign?: string | null; budget?: number | null; platform?: string | null;
  deliverables?: { content_type: string; platform?: string; quantity?: number }[];
  deadline?: string | null; usage_rights?: string | null; location?: string | null; requirements?: string | null;
};

function InboxPage() {
  const ai = useCreatorAi();
  const deals = useDeals();
  const brands = useBrands();
  const invalidate = useInvalidateCreator();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [source, setSource] = useState("Email");
  const [p, setP] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = async () => {
    if (text.trim().length < 10) return toast.error("Paste the email or DM first");
    setBusy(true);
    try { setP(parseAiJson<Parsed>(await ai({ mode: "parse", text }))); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const create = async () => {
    if (!p) return;
    try {
      let brandId: string | null = null;
      if (p.brand) {
        const existing = (brands.data ?? []).find((b) => b.name.toLowerCase() === p.brand!.toLowerCase());
        if (existing) brandId = existing.id;
        else {
          const { data, error } = await supabase.from("creator_brands").insert({ name: p.brand, location: p.location ?? null }).select("id").single();
          if (error) throw error;
          brandId = data.id;
        }
        if (p.contact_name) await supabase.from("creator_brand_contacts").insert({ brand_id: brandId, name: p.contact_name, email: p.contact_email ?? null, role: p.contact_role ?? null });
      }
      const { data: deal, error } = await supabase.from("creator_deals").insert({
        campaign: p.campaign || `${p.brand ?? "Brand"} enquiry`, brand_id: brandId, value: Number(p.budget) || 0,
        platform: p.platform ?? null, deadline: p.deadline ?? null, usage_rights: p.usage_rights ?? null,
        requirements: p.requirements ?? null, source, stage: "New Lead", next_action: "Reply to enquiry",
        next_action_at: new Date().toISOString().slice(0, 10),
      }).select("id").single();
      if (error) throw error;
      if (p.deliverables?.length) {
        await supabase.from("creator_deliverables").insert(p.deliverables.map((d) => ({ deal_id: deal.id, content_type: d.content_type || "Post", platform: d.platform ?? p.platform ?? null, quantity: Number(d.quantity) || 1, due_date: p.deadline ?? null })));
      }
      await supabase.from("creator_activities").insert({ deal_id: deal.id, brand_id: brandId, kind: "enquiry", body: `Enquiry via ${source}:\n${text.slice(0, 3000)}` });
      toast.success("Deal created from enquiry");
      invalidate();
      navigate({ to: "/creator/deal/$id", params: { id: deal.id } });
    } catch (e) { toast.error((e as Error).message); }
  };

  const set = (k: keyof Parsed) => (v: string) => setP((x) => ({ ...(x ?? {}), [k]: k === "budget" ? Number(v) : v }));
  const recent = (deals.data ?? []).filter((d) => d.stage === "New Lead").slice(0, 10);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI email / DM parser</CardTitle>
          <CardDescription>Paste a brand's email, Instagram DM or WhatsApp message. AI pulls out the brand, budget, deliverables and deadline.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="w-48"><Pick label="Came from" value={source} onChange={setSource} options={ENQUIRY_SOURCES} /></div>
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hi Rinki, we'd like to collaborate on our upcoming campaign…" />
          <Button onClick={parse} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}Extract details</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Review before creating</CardTitle></CardHeader>
        <CardContent>
          {!p ? <p className="text-sm text-muted-foreground">Extracted details appear here for you to check.</p> : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["brand", "contact_name", "contact_email", "contact_role", "campaign", "budget", "platform", "deadline", "usage_rights", "location"] as const).map((k) => (
                  <div key={k}><Label className="capitalize text-xs">{k.replace(/_/g, " ")}</Label><Input value={p[k] == null ? "" : String(p[k])} onChange={(e) => set(k)(e.target.value)} /></div>
                ))}
              </div>
              <div><Label className="text-xs">Requirements</Label><Textarea rows={3} value={p.requirements ?? ""} onChange={(e) => set("requirements")(e.target.value)} /></div>
              {!!p.deliverables?.length && <div className="flex flex-wrap gap-1">{p.deliverables.map((d, i) => <Badge key={i} variant="secondary">{d.quantity ?? 1}× {d.content_type} {d.platform ? `· ${d.platform}` : ""}</Badge>)}</div>}
              <Button onClick={create}>Create deal</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Inbox className="h-4 w-4" />New enquiries</CardTitle>
          <CardDescription>Includes briefs sent from your public media kit "Hire me" form.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && <p className="text-sm text-muted-foreground">No new enquiries.</p>}
          {recent.map((d) => (
            <button key={d.id} onClick={() => navigate({ to: "/creator/deal/$id", params: { id: d.id } })} className="w-full text-left flex justify-between rounded border p-2.5 text-sm hover:bg-muted/50">
              <span><b>{d.campaign}</b> <span className="text-muted-foreground">· {d.creator_brands?.name ?? ""}</span></span>
              <span className="flex gap-2"><Badge variant="outline">{d.source}</Badge><span>{lakh(Number(d.value))}</span></span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
