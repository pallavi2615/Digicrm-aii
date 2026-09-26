import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { openCampaigns, applyToCampaign } from "@/lib/brand.functions";
import { useProfiles } from "@/lib/creator-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inr } from "@/lib/creator";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/campaigns")({
  head: () => ({ meta: [{ title: "Open Brand Campaigns | DigiCRM AI" }, { name: "description", content: "Discover campaigns brands have posted and apply with a pitch." }] }),
  component: OpenCampaigns,
});

type Camp = { id: string; company: string; title: string; brief: string | null; budget: number | null; platform: string | null; category: string | null; min_followers: number; deadline: string | null };

function OpenCampaigns() {
  const fn = useServerFn(openCampaigns);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["creator", "open-campaigns"], queryFn: () => fn() });
  const [target, setTarget] = useState<Camp | null>(null);
  if (isLoading) return <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  const applied = new Map((data?.applied ?? []).map((a) => [a.campaign_id, a.status]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Campaigns brands have posted on the marketplace. Applying adds the deal to your pipeline at "Proposal Sent".</p>
      {!data?.campaigns.length && <Card><CardContent className="p-10 text-center text-muted-foreground">No open campaigns right now.</CardContent></Card>}
      <div className="grid gap-3 md:grid-cols-2">
        {(data?.campaigns ?? []).map((c) => (
          <Card key={c.id}><CardContent className="p-5 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1"><p className="font-semibold">{c.title}</p><p className="text-sm text-muted-foreground">{c.company}</p></div>
              {c.budget != null && <Badge variant="outline">{inr(Number(c.budget))}</Badge>}
            </div>
            {c.brief && <p className="text-sm line-clamp-3">{c.brief}</p>}
            <div className="flex flex-wrap gap-1 text-xs">
              {c.platform && <Badge variant="secondary">{c.platform}</Badge>}
              {c.category && <Badge variant="secondary">{c.category}</Badge>}
              {c.min_followers > 0 && <Badge variant="secondary">{c.min_followers.toLocaleString()}+ followers</Badge>}
              {c.deadline && <Badge variant="secondary">by {c.deadline}</Badge>}
            </div>
            {applied.has(c.id) ? <Badge>{applied.get(c.id)}</Badge> : <Button size="sm" onClick={() => setTarget(c as Camp)}>Apply</Button>}
          </CardContent></Card>
        ))}
      </div>
      <ApplyDialog camp={target} onClose={() => setTarget(null)} onDone={refetch} />
    </div>
  );
}

function ApplyDialog({ camp, onClose, onDone }: { camp: Camp | null; onClose: () => void; onDone: () => void }) {
  const apply = useServerFn(applyToCampaign);
  const profiles = useProfiles();
  const nav = useNavigate();
  const [f, setF] = useState({ creatorId: "", pitch: "", quote: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const creatorId = f.creatorId || profiles.data?.[0]?.id;
    if (!camp || !creatorId) return toast.error("Add a creator profile first");
    setBusy(true);
    try {
      const r = await apply({ data: { campaignId: camp.id, creatorId, pitch: f.pitch, quote: f.quote ? Number(f.quote) : null } });
      toast.success("Applied — added to your pipeline"); onClose(); onDone();
      nav({ to: "/creator/deal/$id", params: { id: r.dealId } });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!camp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Apply to {camp?.title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Creator</Label>
            <select className="w-full border rounded-md h-9 px-2 bg-background text-sm" value={f.creatorId} onChange={(e) => setF({ ...f, creatorId: e.target.value })}>
              {(profiles.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select></div>
          <div className="space-y-1"><Label>Your quote (₹)</Label><Input type="number" min={0} value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} /></div>
          <div className="space-y-1"><Label>Pitch *</Label><Textarea required rows={5} value={f.pitch} onChange={(e) => setF({ ...f, pitch: e.target.value })} placeholder="Why you're a fit, content idea, deliverables…" /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit application</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
