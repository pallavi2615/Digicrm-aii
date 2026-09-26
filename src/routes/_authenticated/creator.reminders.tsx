import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runFollowupsNow } from "@/lib/brand.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, ListPlus, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, useDeliverables, useInvoices } from "@/lib/creator-data";
import { invoiceTotal, isOverdue, inr, todayISO } from "@/lib/creator";

export const Route = createFileRoute("/_authenticated/creator/reminders")({
  head: () => ({ meta: [{ title: "Follow-up Reminders | DigiCRM AI" }, { name: "description", content: "Follow-ups, content deadlines, unpaid invoices and renewals that need action." }] }),
  component: RemindersPage,
});

type Reminder = { key: string; kind: string; title: string; detail: string; dealId: string; urgent: boolean };

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function RemindersPage() {
  const deals = useDeals();
  const dels = useDeliverables();
  const invs = useInvoices();

  const list = useMemo<Reminder[]>(() => {
    const today = todayISO(); const soon = addDays(3); const month = addDays(30);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const out: Reminder[] = [];
    for (const d of deals.data ?? []) {
      const brand = d.creator_brands?.name ?? "Brand";
      if (d.stage !== "Paid" && d.next_action_at && d.next_action_at <= today)
        out.push({ key: `na-${d.id}`, kind: "Follow-up", title: `${brand}: ${d.next_action ?? "follow up"}`, detail: `${d.campaign} · due ${d.next_action_at}`, dealId: d.id, urgent: d.next_action_at < today });
      if (["Contacted", "Pitch Sent", "Negotiation", "Proposal Sent", "Contract Sent"].includes(d.stage) && d.updated_at < weekAgo)
        out.push({ key: `st-${d.id}`, kind: "No reply", title: `${brand} hasn't moved in 7+ days`, detail: `${d.campaign} · ${d.stage}`, dealId: d.id, urgent: false });
      if (["Published", "Paid"].includes(d.stage) && d.end_date && d.end_date >= today && d.end_date <= month)
        out.push({ key: `rn-${d.id}`, kind: "Renewal", title: `Pitch a renewal to ${brand}`, detail: `${d.campaign} ends ${d.end_date}`, dealId: d.id, urgent: false });
    }
    for (const x of dels.data ?? []) {
      if (x.due_date && x.due_date <= soon && !["Approved", "Published"].includes(x.status))
        out.push({ key: `dl-${x.id}`, kind: "Content due", title: `${x.content_type} for ${x.creator_deals?.campaign ?? "campaign"}`, detail: `${x.status} · due ${x.due_date}`, dealId: x.deal_id, urgent: x.due_date < today });
      if (x.status === "Submitted")
        out.push({ key: `ap-${x.id}`, kind: "Approval", title: `Chase brand approval: ${x.content_type}`, detail: x.creator_deals?.campaign ?? "", dealId: x.deal_id, urgent: false });
    }
    for (const i of invs.data ?? []) if (isOverdue(i))
      out.push({ key: `iv-${i.id}`, kind: "Payment", title: `Invoice ${i.number} overdue`, detail: `${i.creator_deals?.creator_brands?.name ?? ""} · ${inr(invoiceTotal(i) - Number(i.paid_amount))} due since ${i.due_date}`, dealId: i.deal_id, urgent: true });
    return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
  }, [deals.data, dels.data, invs.data]);

  const addTask = async (r: Reminder) => {
    const { error } = await supabase.from("tasks").insert({ title: r.title, description: `${r.kind} — ${r.detail}`, due_date: todayISO(), industry_group: "creator-economy" } as never);
    if (error) return toast.error(error.message);
    toast.success("Added to your tasks");
  };

  return (
    <div className="space-y-4">
    <AutomationCard />
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" />Follow-up reminders</CardTitle>
        <CardDescription>Worked out automatically from your deals, content and invoices. Open a deal to draft the message with AI.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">You're all caught up.</p>}
        {list.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-3 border rounded-lg p-3">
            <Badge variant={r.urgent ? "destructive" : "outline"}>{r.kind}</Badge>
            <div className="flex-1 min-w-48"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.detail}</p></div>
            <Button size="sm" variant="outline" asChild><Link to="/creator/deal/$id" params={{ id: r.dealId }}>Open deal</Link></Button>
            <Button size="sm" variant="ghost" onClick={() => addTask(r)}><ListPlus className="h-4 w-4 mr-1" />Task</Button>
          </div>
        ))}
      </CardContent>
    </Card>
    </div>
  );
}

function AutomationCard() {
  const run = useServerFn(runFollowupsNow);
  const [busy, setBusy] = useState(false);
  const outbox = useQuery({
    queryKey: ["creator", "outbox"],
    queryFn: async () => (await supabase.from("creator_email_outbox").select("id,to_email,audience,subject,status,created_at").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const go = async () => {
    setBusy(true);
    try { const r = await run(); toast.success(`${r.alerts} new alert(s), ${r.emails_queued} email(s) queued`); outbox.refetch(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-start gap-3 space-y-0">
        <div className="flex-1">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Automatic follow-up sequences</CardTitle>
          <CardDescription>Every morning: overdue follow-ups, approvals waiting 3+ days and overdue invoices create bell alerts for you, and reminder emails for you and the brand.</CardDescription>
        </div>
        <Button size="sm" onClick={go} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Run now</Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {(outbox.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No reminder emails yet.</p> :
          outbox.data!.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm border-b last:border-0 py-1">
              <Badge variant="outline">{m.audience}</Badge>
              <span className="flex-1 truncate">{m.subject}</span>
              <span className="text-xs text-muted-foreground truncate max-w-40">{m.to_email}</span>
              <Badge variant={m.status === "sent" ? "default" : "secondary"}>{m.status === "pending" ? "waiting to send" : m.status}</Badge>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
