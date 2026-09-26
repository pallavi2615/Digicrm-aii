import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApproval, actOnApproval } from "@/lib/creator.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/approve/$token")({
  loader: ({ params }) => getApproval({ data: { token: params.token } }),
  head: () => ({ meta: [
    { title: "Campaign Content Approval | DigiCRM AI" },
    { name: "description", content: "Review and approve creator content for your campaign." },
    { property: "og:title", content: "Campaign Content Approval" },
    { property: "og:description", content: "Review and approve creator content for your campaign." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  errorComponent: () => <div className="p-16 text-center text-muted-foreground">This approval link is not valid.</div>,
  component: Approval,
});

function Approval() {
  const { deal, deliverables } = Route.useLoaderData();
  const { token } = Route.useParams();
  const router = useRouter();
  const act = useServerFn(actOnApproval);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  if (!deal) return <div className="p-16 text-center text-muted-foreground">This approval link is not valid.</div>;

  const run = async (id: string, action: "approve" | "revise") => {
    if (action === "revise" && !comments[id]?.trim()) return toast.error("Tell the creator what to change");
    setBusy(id);
    try { await act({ data: { token, deliverableId: id, action, comment: comments[id] ?? "" } }); toast.success(action === "approve" ? "Approved" : "Revision requested"); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">{deal.creator_brands?.name} × {deal.creator_profiles?.display_name}</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{deal.campaign}</h1>
          {deal.objective && <p className="text-muted-foreground">{deal.objective}</p>}
          <p className="text-xs text-muted-foreground mt-1">{deal.start_date ?? ""}{deal.end_date ? ` → ${deal.end_date}` : ""}</p>
        </div>
        {deliverables.length === 0 && <p className="text-muted-foreground">No deliverables shared yet.</p>}
        {deliverables.map((d) => (
          <Card key={d.id}><CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <b className="flex-1">{d.quantity}× {d.content_type} · {d.platform}</b>
              <Badge variant={d.status === "Approved" ? "default" : d.status === "Revision Required" ? "destructive" : "outline"}>{d.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Due {d.due_date ?? "—"}{d.revision_count ? ` · ${d.revision_count} revision(s)` : ""}{d.posted_at ? ` · published ${d.posted_at}` : ""}</p>
            {d.caption && <p className="text-sm whitespace-pre-wrap"><b>Caption:</b> {d.caption}</p>}
            {d.draft_url && /^https?:\/\//.test(d.draft_url) && <a href={d.draft_url} target="_blank" rel="noreferrer noopener" className="text-sm text-primary underline">View draft</a>}
            {d.brand_comment && <p className="text-sm rounded bg-muted p-2">Your last note: {d.brand_comment}</p>}
            {["Submitted", "Draft", "Revision Required"].includes(d.status) && (
              <>
                <Textarea rows={2} placeholder="Comments for the creator" value={comments[d.id] ?? ""} onChange={(e) => setComments({ ...comments, [d.id]: e.target.value })} />
                <div className="flex gap-2">
                  <Button disabled={busy === d.id} onClick={() => run(d.id, "approve")}>Approve</Button>
                  <Button variant="outline" disabled={busy === d.id} onClick={() => run(d.id, "revise")}>Request revision</Button>
                </div>
              </>
            )}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
