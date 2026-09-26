import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getBrandCampaigns } from "@/lib/brand.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/creator";

export const Route = createFileRoute("/_authenticated/brand/")({
  head: () => ({ meta: [{ title: "My Campaigns | Brand Portal" }, { name: "description", content: "All creator campaigns shared with your brand." }] }),
  component: Campaigns,
});

function Campaigns() {
  const fn = useServerFn(getBrandCampaigns);
  const { data, isLoading } = useQuery({ queryKey: ["brand", "campaigns"], queryFn: () => fn() });
  if (isLoading) return <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!data?.length) return (
    <Card><CardContent className="p-10 text-center space-y-3">
      <p className="text-muted-foreground">No campaigns yet. When a creator adds your email to a deal, or you send a brief, it shows up here.</p>
      <Button asChild><Link to="/brand/marketplace">Find creators</Link></Button>
    </CardContent></Card>
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.map((d) => (
        <Link key={d.id} to="/brand/campaign/$id" params={{ id: d.id }}>
          <Card className="hover:border-primary transition-colors h-full"><CardContent className="p-5 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{d.campaign}</p>
                <p className="text-sm text-muted-foreground">with {d.creator_profiles?.display_name ?? "Creator"}{d.platform ? ` · ${d.platform}` : ""}</p>
              </div>
              <Badge variant="outline">{d.stage}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{inr(Number(d.value))}</Badge>
              <Badge variant="secondary">{d.approved}/{d.total} approved</Badge>
              {d.pending > 0 && <Badge>{d.pending} awaiting your review</Badge>}
            </div>
          </CardContent></Card>
        </Link>
      ))}
    </div>
  );
}
