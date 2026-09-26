import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Users, TrendingUp, MapPin } from "lucide-react";
import { searchMarketplace, sendMarketplaceBrief } from "@/lib/brand.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PLATFORMS } from "@/lib/creator";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/brand/marketplace")({
  head: () => ({ meta: [{ title: "Creator Marketplace | Brand Portal" }, { name: "description", content: "Search creators by followers, engagement and category, then send a brief." }] }),
  component: Marketplace,
});

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
type Creator = { id: string; display_name: string; handle: string; niche: string | null; location: string | null; bio: string | null; avatar_url: string | null; categories: string[]; followers: number; engagement_rate: number };

function Marketplace() {
  const search = useServerFn(searchMarketplace);
  const [f, setF] = useState({ q: "", category: "all", minFollowers: "0", minEngagement: "0", sort: "followers" as "followers" | "engagement" });
  const [target, setTarget] = useState<Creator | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["brand", "market", f],
    queryFn: () => search({ data: { q: f.q, category: f.category === "all" ? "" : f.category, minFollowers: Number(f.minFollowers), minEngagement: Number(f.minEngagement), sort: f.sort } }),
  });

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1 lg:col-span-2"><Label>Search</Label><Input placeholder="Name, niche, city…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
        <div className="space-y-1"><Label>Category</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{(data?.categories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label>Min followers</Label>
          <Select value={f.minFollowers} onValueChange={(v) => setF({ ...f, minFollowers: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["0", "10000", "50000", "100000", "500000", "1000000"].map((v) => <SelectItem key={v} value={v}>{v === "0" ? "Any" : `${fmt(Number(v))}+`}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label>Min engagement</Label>
          <Select value={f.minEngagement} onValueChange={(v) => setF({ ...f, minEngagement: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["0", "1", "2", "3", "5", "8"].map((v) => <SelectItem key={v} value={v}>{v === "0" ? "Any" : `${v}%+`}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label>Sort by</Label>
          <Select value={f.sort} onValueChange={(v) => setF({ ...f, sort: v as "followers" | "engagement" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="followers">Followers</SelectItem><SelectItem value="engagement">Engagement</SelectItem></SelectContent>
          </Select></div>
      </CardContent></Card>

      {isLoading ? <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div> :
        !data?.creators.length ? <p className="text-muted-foreground text-center py-10">No creators match these filters.</p> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.creators.map((c) => (
            <Card key={c.id}><CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                {c.avatar_url ? <img src={c.avatar_url} alt={c.display_name} className="h-12 w-12 rounded-full object-cover" /> :
                  <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold">{c.display_name[0]}</div>}
                <div className="min-w-0"><p className="font-semibold truncate">{c.display_name}</p><p className="text-xs text-muted-foreground">@{c.handle}{c.niche ? ` · ${c.niche}` : ""}</p></div>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />{fmt(c.followers)}</span>
                <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-muted-foreground" />{Number(c.engagement_rate).toFixed(1)}%</span>
                {c.location && <span className="flex items-center gap-1 truncate"><MapPin className="h-4 w-4 text-muted-foreground" />{c.location}</span>}
              </div>
              {c.bio && <p className="text-sm text-muted-foreground line-clamp-2">{c.bio}</p>}
              <div className="flex flex-wrap gap-1">{(c.categories ?? []).slice(0, 4).map((x) => <Badge key={x} variant="secondary">{x}</Badge>)}</div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setTarget(c as Creator)}>Send brief</Button>
                <Button size="sm" variant="outline" asChild><a href={`/kit/${c.handle}`} target="_blank" rel="noreferrer">Media kit</a></Button>
              </div>
            </CardContent></Card>
          ))}
        </div>}
      <BriefDialog creator={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function BriefDialog({ creator, onClose }: { creator: Creator | null; onClose: () => void }) {
  const send = useServerFn(sendMarketplaceBrief);
  const nav = useNavigate();
  const [f, setF] = useState({ campaign: "", budget: "", platform: "", deadline: "", brief: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator) return;
    setBusy(true);
    try {
      const r = await send({ data: { creatorId: creator.id, campaign: f.campaign, budget: f.budget ? Number(f.budget) : null, platform: f.platform, deadline: f.deadline, brief: f.brief } });
      toast.success(`Brief sent to ${creator.display_name}`);
      onClose(); setF({ campaign: "", budget: "", platform: "", deadline: "", brief: "" });
      nav({ to: "/brand/campaign/$id", params: { id: r.dealId } });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!creator} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Campaign brief for {creator?.display_name}</DialogTitle><DialogDescription>The creator gets this in their CRM and can reply from there.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Campaign name *</Label><Input required value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Budget (₹)</Label><Input type="number" min={0} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></div>
            <div className="space-y-1"><Label>Go-live by</Label><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Platform</Label>
            <Select value={f.platform} onValueChange={(v) => setF({ ...f, platform: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Brief</Label><Textarea rows={4} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} placeholder="Deliverables, key messages, dos and don'ts…" /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send brief</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
