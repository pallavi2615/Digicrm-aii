import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, useInvalidateCreator } from "@/lib/creator-data";
import { DEAL_STAGES, STAGE_PROBABILITY, lakh } from "@/lib/creator";
import { NewDealDialog } from "@/components/creator-deal-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/deals")({
  head: () => ({ meta: [{ title: "Sponsorship Pipeline | DigiCRM AI" }, { name: "description", content: "Drag-and-drop brand deal pipeline from new lead to paid and renewal." }] }),
  component: DealsBoard,
});

function DealsBoard() {
  const { data, isLoading } = useDeals();
  const invalidate = useInvalidateCreator();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const deals = useMemo(() => (data ?? []).filter((d) =>
    !q || `${d.campaign} ${d.creator_brands?.name ?? ""} ${d.platform ?? ""}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  const move = async (id: string, stage: string) => {
    const d = data?.find((x) => x.id === id);
    if (!d || d.stage === stage) return;
    const { error } = await supabase.from("creator_deals")
      .update({ stage, probability: STAGE_PROBABILITY[stage] ?? d.probability, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("creator_activities").insert({ deal_id: id, brand_id: d.brand_id, kind: "stage", body: `Moved from ${d.stage} to ${stage}` });
    invalidate();
  };

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search campaign, brand, platform" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="text-sm text-muted-foreground">{deals.length} deals · {lakh(deals.reduce((n, d) => n + Number(d.value), 0))}</div>
        <Button className="ml-auto" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New deal</Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const col = deals.filter((d) => d.stage === stage);
          return (
            <div key={stage} className="w-64 shrink-0 rounded-lg bg-muted/40 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) move(dragId, stage); setDragId(null); }}>
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wide">{stage}</span>
                <Badge variant="outline" className="text-[10px]">{col.length} · {lakh(col.reduce((n, d) => n + Number(d.value), 0))}</Badge>
              </div>
              <div className="space-y-2 min-h-16">
                {col.map((d) => (
                  <Card key={d.id} draggable onDragStart={() => setDragId(d.id)} className="cursor-grab active:cursor-grabbing">
                    <CardContent className="p-3 space-y-1.5">
                      <Link to="/creator/deal/$id" params={{ id: d.id }} className="font-medium text-sm hover:underline block">{d.campaign}</Link>
                      <p className="text-xs text-muted-foreground">{d.creator_brands?.name ?? "No brand"}{d.creator_profiles ? ` · ${d.creator_profiles.display_name}` : ""}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">{lakh(Number(d.value))}</Badge>
                        {d.platform && <Badge variant="outline" className="text-[10px]">{d.platform}</Badge>}
                        <Badge variant="outline" className="text-[10px]">{d.probability}%</Badge>
                      </div>
                      {(d.next_action || d.deadline) && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" />{d.next_action ?? "Deadline"}{d.deadline ? ` · ${d.deadline}` : ""}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <NewDealDialog open={open} onOpenChange={setOpen} onCreated={(id) => navigate({ to: "/creator/deal/$id", params: { id } })} />
    </div>
  );
}
