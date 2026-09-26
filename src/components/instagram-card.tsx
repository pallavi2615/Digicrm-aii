import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Loader2, RefreshCw, Unlink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startInstagramConnect, getInstagramStatus, syncInstagram, disconnectInstagram } from "@/lib/instagram.functions";

export function InstagramCard({ profileId, onSynced }: { profileId: string; onSynced: () => void }) {
  const status = useServerFn(getInstagramStatus);
  const start = useServerFn(startInstagramConnect);
  const sync = useServerFn(syncInstagram);
  const disc = useServerFn(disconnectInstagram);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["ig", profileId], queryFn: () => status({ data: { profileIds: [profileId] } }) });
  const row: any = q.data?.rows?.[0];

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type !== "instagramConnect") return;
      q.refetch(); onSynced();
      e.data.ok ? toast.success("Instagram connected — media kit numbers updated") : toast.error("Instagram connection failed");
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [q, onSynced]);

  const connect = async () => {
    const popup = window.open("", "ig-connect", "width=520,height=720");
    if (!popup) return toast.error("Allow pop-ups to connect Instagram");
    try {
      const { url } = await start({ data: { profileId } });
      popup.location.href = url;
    } catch (e: any) { popup.close(); toast.error(e.message); }
  };
  const doSync = async () => {
    setBusy(true);
    try { const s = await sync({ data: { profileId } }); toast.success(`Synced: ${s.followers.toLocaleString("en-IN")} followers · ${s.engagement}%`); q.refetch(); onSynced(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Instagram className="h-5 w-5" /></div>
          <div className="text-sm">
            {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : row ? (
              <>
                <div className="font-medium">@{row.username} · {Number(row.followers ?? 0).toLocaleString("en-IN")} followers · {row.engagement_rate ?? 0}% engagement</div>
                <div className="text-xs text-muted-foreground">
                  {row.synced_at ? `Last synced ${new Date(row.synced_at).toLocaleString("en-IN")}` : "Not synced yet"}
                  {row.last_error ? ` · ${row.last_error}` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">Instagram stats</div>
                <div className="text-xs text-muted-foreground">
                  {q.data?.configured ? "Connect a Business or Creator account to fill followers and engagement automatically." : "Waiting for the Meta app ID and secret to be added."}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {row ? (
            <>
              <Button size="sm" variant="outline" onClick={doSync} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Sync now</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await disc({ data: { profileId } }); q.refetch(); }}><Unlink className="h-4 w-4" /></Button>
            </>
          ) : (
            <Button size="sm" onClick={connect} disabled={!q.data?.configured}><Instagram className="h-4 w-4 mr-1" />Connect Instagram</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
