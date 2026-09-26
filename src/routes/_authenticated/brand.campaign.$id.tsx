import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getBrandCampaign, brandActOnDeliverable, brandComment } from "@/lib/brand.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { inr, invoiceTotal } from "@/lib/creator";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/brand/campaign/$id")({
  head: () => ({ meta: [{ title: "Campaign | Brand Portal" }, { name: "description", content: "Review deliverables, approve content and comment." }] }),
  component: Campaign,
});

type Comment = { id: string; deliverable_id: string | null; author_role: string; author_name: string | null; body: string; created_at: string };

function Thread({ rows }: { rows: Comment[] }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      {rows.map((c) => (
        <div key={c.id} className={`rounded-md p-2 text-sm ${c.author_role === "brand" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
          <p className="text-xs text-muted-foreground">{c.author_name ?? c.author_role} · {new Date(c.created_at).toLocaleString()}</p>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
    </div>
  );
}

function Campaign() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getBrandCampaign);
  const act = useServerFn(brandActOnDeliverable);
  const comment = useServerFn(brandComment);
  const { data, isLoading, error } = useQuery({ queryKey: ["brand", "campaign", id], queryFn: () => get({ data: { id } }) });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["brand"] });

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (error || !data?.deal) return <p className="text-muted-foreground">{(error as Error)?.message ?? "Campaign not found."}</p>;
  const d = data.deal;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); setNotes((n) => ({ ...n, [key]: "" })); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Button asChild variant="ghost" size="sm"><Link to="/brand"><ArrowLeft className="h-4 w-4 mr-1" />All campaigns</Link></Button>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold">{d.campaign}</h2>
          <p className="text-sm text-muted-foreground">with {d.creator_profiles?.display_name}{d.platform ? ` · ${d.platform}` : ""} · {d.start_date ?? "—"}{d.end_date ? ` → ${d.end_date}` : ""}</p>
        </div>
        <Badge>{d.stage}</Badge>
        <Badge variant="outline">{inr(Number(d.value))}</Badge>
      </div>
      {(d.objective || d.usage_rights || d.exclusivity) && (
        <Card><CardContent className="p-4 text-sm grid sm:grid-cols-3 gap-3">
          <div><p className="text-xs text-muted-foreground">Objective</p>{d.objective ?? "—"}</div>
          <div><p className="text-xs text-muted-foreground">Usage rights</p>{d.usage_rights ?? "—"}</div>
          <div><p className="text-xs text-muted-foreground">Exclusivity</p>{d.exclusivity ?? "—"}</div>
        </CardContent></Card>
      )}

      <h3 className="font-semibold">Deliverables</h3>
      {data.deliverables.length === 0 && <p className="text-sm text-muted-foreground">The creator hasn't added deliverables yet.</p>}
      {data.deliverables.map((v) => {
        const key = v.id;
        return (
          <Card key={v.id}><CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <b className="flex-1">{v.quantity}× {v.content_type} · {v.platform ?? ""}</b>
              <Badge variant={v.status === "Approved" || v.status === "Published" ? "default" : v.status === "Revision Required" ? "destructive" : "outline"}>{v.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Due {v.due_date ?? "—"}{v.revision_count ? ` · ${v.revision_count} revision(s)` : ""}{v.posted_at ? ` · published ${v.posted_at}` : ""}</p>
            {(v.reach > 0 || v.views > 0) && <p className="text-xs rounded bg-muted p-2">Results: {v.reach.toLocaleString()} reach · {v.views.toLocaleString()} views · {v.engagements.toLocaleString()} engagements · {v.clicks.toLocaleString()} clicks · {v.conversions.toLocaleString()} conversions</p>}
            {v.caption && <p className="text-sm whitespace-pre-wrap"><b>Caption:</b> {v.caption}</p>}
            {v.script && <p className="text-sm whitespace-pre-wrap"><b>Script:</b> {v.script}</p>}
            {v.draft_url && /^https?:\/\//.test(v.draft_url) && <a href={v.draft_url} target="_blank" rel="noreferrer noopener" className="text-sm text-primary underline">View draft</a>}
            <Thread rows={data.comments.filter((c) => c.deliverable_id === v.id)} />
            <Textarea placeholder="Comment or describe changes…" value={notes[key] ?? ""} onChange={(e) => setNotes({ ...notes, [key]: e.target.value })} rows={2} />
            <div className="flex flex-wrap gap-2">
              {v.status === "Submitted" && <>
                <Button size="sm" disabled={busy === key} onClick={() => run(key, () => act({ data: { dealId: id, deliverableId: v.id, action: "approve", comment: notes[key] ?? "" } }), "Approved")}>Approve</Button>
                <Button size="sm" variant="outline" disabled={busy === key} onClick={() => run(key, () => act({ data: { dealId: id, deliverableId: v.id, action: "revise", comment: notes[key] ?? "" } }), "Changes requested")}>Request changes</Button>
              </>}
              <Button size="sm" variant="ghost" disabled={busy === key || !notes[key]?.trim()} onClick={() => run(key, () => comment({ data: { dealId: id, deliverableId: v.id, body: notes[key] } }), "Comment sent")}>Comment only</Button>
            </div>
          </CardContent></Card>
        );
      })}

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign conversation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Thread rows={data.comments.filter((c) => !c.deliverable_id)} />
          <Textarea placeholder="Message the creator…" value={notes.general ?? ""} onChange={(e) => setNotes({ ...notes, general: e.target.value })} rows={2} />
          <Button size="sm" disabled={busy === "general" || !notes.general?.trim()} onClick={() => run("general", () => comment({ data: { dealId: id, body: notes.general } }), "Message sent")}>Send</Button>
        </CardContent>
      </Card>

      {data.invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.invoices.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-b last:border-0 pb-2">
                <b className="flex-1">{i.number}</b>
                <span>{inr(invoiceTotal({ amount: Number(i.amount), tax_pct: Number(i.tax_pct) }))}</span>
                <span className="text-muted-foreground">due {i.due_date ?? "—"}</span>
                <Badge variant={i.status === "Paid" ? "default" : i.status === "Overdue" ? "destructive" : "outline"}>{i.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
