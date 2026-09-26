import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/creator";
import { roi } from "@/lib/creator-roi";

export const Route = createFileRoute("/_authenticated/creator/document/$kind/$id")({
  head: () => ({ meta: [{ title: "Proposal & Invoice PDF | DigiCRM AI" }, { name: "description", content: "Printable, branded proposal and invoice documents for brand deals." }] }),
  component: DocumentPage,
});

/** Branded proposal (kind=proposal, id=deal) or invoice (kind=invoice, id=invoice). Save as PDF from the print dialog. */
function DocumentPage() {
  const { kind, id } = Route.useParams();
  const q = useQuery({
    queryKey: ["creator", "doc", kind, id],
    queryFn: async () => {
      let dealId = id;
      let invoice: { number: string; amount: number; tax_pct: number; issued_at: string | null; due_date: string | null; paid_amount: number; status: string; notes: string | null } | null = null;
      if (kind === "invoice") {
        const { data, error } = await supabase.from("creator_invoices").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        invoice = data; dealId = data.deal_id;
      }
      const { data: deal } = await supabase.from("creator_deals").select("*, creator_brands(name,website,location), creator_profiles(display_name,handle,niche,location)").eq("id", dealId).maybeSingle();
      if (!deal) return null;
      const { data: dels } = await supabase.from("creator_deliverables").select("content_type,platform,quantity,due_date,reach,views,engagements,clicks,conversions,revenue_generated").eq("deal_id", dealId);
      return { deal, dels: dels ?? [], invoice };
    },
  });

  if (q.isLoading) return <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Document not found.</p>;
  const { deal, dels, invoice } = q.data;
  const creator = deal.creator_profiles?.display_name ?? "Creator";
  const amount = invoice ? Number(invoice.amount) : Number(deal.value);
  const taxPct = invoice ? Number(invoice.tax_pct) : Number(deal.gst_pct ?? 18);
  const tax = amount * taxPct / 100;
  if (kind === "report") return <Report deal={deal} dels={dels} creator={creator} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/creator/deal/$id" params={{ id: deal.id }}><ArrowLeft className="h-4 w-4 mr-1" />Deal</Link></Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Download PDF</Button>
      </div>
      <div className="print-area mx-auto max-w-3xl rounded-lg border bg-card p-10 text-sm space-y-6">
        <div className="flex justify-between items-start">
          <div><h1 className="text-2xl font-bold">{invoice ? "Tax Invoice" : "Collaboration Proposal"}</h1>
            <p className="text-muted-foreground">{creator}{deal.creator_profiles?.handle ? ` · @${deal.creator_profiles.handle}` : ""}</p></div>
          <div className="text-right text-xs">
            {invoice ? <><p className="font-semibold">{invoice.number}</p><p>Issued {invoice.issued_at}</p><p>Due {invoice.due_date ?? "on receipt"}</p></> : <p>Prepared {new Date().toLocaleDateString("en-IN")}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><p className="text-xs uppercase text-muted-foreground">For</p><p className="font-medium">{deal.creator_brands?.name ?? "Brand"}</p><p>{deal.creator_brands?.location ?? ""}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Campaign</p><p className="font-medium">{deal.campaign}</p><p>{deal.start_date ?? ""}{deal.end_date ? ` – ${deal.end_date}` : ""}</p></div>
        </div>
        {!invoice && deal.objective && <div><p className="text-xs uppercase text-muted-foreground">Objective</p><p>{deal.objective}</p></div>}
        <table className="w-full border-collapse">
          <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">Deliverable</th><th>Platform</th><th>Qty</th><th>Due</th></tr></thead>
          <tbody>
            {dels.length === 0 && <tr><td colSpan={4} className="py-2">{deal.deal_type ?? "Sponsored content"}</td></tr>}
            {dels.map((x, i) => <tr key={i} className="border-b"><td className="py-2">{x.content_type}</td><td>{x.platform}</td><td>{x.quantity}</td><td>{x.due_date ?? "—"}</td></tr>)}
          </tbody>
        </table>
        <div className="ml-auto w-64 space-y-1">
          <div className="flex justify-between"><span>Fee</span><span>{inr(amount)}</span></div>
          <div className="flex justify-between"><span>GST {taxPct}%</span><span>{inr(tax)}</span></div>
          <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{inr(amount + tax)}</span></div>
          {invoice && Number(invoice.paid_amount) > 0 && <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>{inr(Number(invoice.paid_amount))}</span></div>}
        </div>
        {(deal.usage_rights || deal.exclusivity || deal.payment_terms) && (
          <div className="space-y-1 text-xs">
            {deal.payment_terms && <p><b>Payment terms:</b> {deal.payment_terms}</p>}
            {deal.usage_rights && <p><b>Usage rights:</b> {deal.usage_rights}</p>}
            {deal.exclusivity && <p><b>Exclusivity:</b> {deal.exclusivity}</p>}
          </div>
        )}
        {invoice?.notes && <p className="text-xs">{invoice.notes}</p>}
        <p className="text-xs text-muted-foreground">Thank you for working with {creator}.</p>
      </div>
    </div>
  );
}

type RDel = { content_type: string; platform: string | null; reach: number; views: number; engagements: number; clicks: number; conversions: number; revenue_generated: number };
function Report({ deal, dels, creator }: { deal: { id: string; campaign: string; value: number; creator_brands: { name: string } | null }; dels: RDel[]; creator: string }) {
  const s = (k: keyof RDel) => dels.reduce((a, d) => a + Number(d[k] ?? 0), 0);
  const t = { reach: s("reach"), views: s("views"), engagements: s("engagements"), clicks: s("clicks"), conversions: s("conversions"), revenue: s("revenue_generated") };
  const m = roi(Number(deal.value), t);
  const rows: [string, string][] = [["Reach", t.reach.toLocaleString()], ["Views", t.views.toLocaleString()], ["Engagements", t.engagements.toLocaleString()], ["Engagement rate", `${m.er.toFixed(2)}%`],
    ["Clicks", t.clicks.toLocaleString()], ["CTR", `${m.ctr.toFixed(2)}%`], ["Conversions", t.conversions.toLocaleString()], ["Conversion rate", `${m.cvr.toFixed(2)}%`],
    ["CPM", inr(Math.round(m.cpm))], ["CPC", inr(Math.round(m.cpc))], ["CPE", inr(Math.round(m.cpe * 100) / 100)], ["Revenue generated", inr(t.revenue)], ["ROAS", `${m.roas.toFixed(2)}×`]];
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/creator/deal/$id" params={{ id: deal.id }}><ArrowLeft className="h-4 w-4 mr-1" />Deal</Link></Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Download PDF</Button>
      </div>
      <div className="print-area mx-auto max-w-3xl rounded-lg border bg-card p-10 text-sm space-y-6">
        <div><h1 className="text-2xl font-bold">Campaign Performance Report</h1>
          <p className="text-muted-foreground">{deal.campaign} · {deal.creator_brands?.name ?? "Brand"} × {creator}</p></div>
        <div className="grid grid-cols-3 gap-3">{rows.map(([l, v]) => <div key={l} className="border rounded p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-bold">{v}</p></div>)}</div>
        <table className="w-full border-collapse text-xs">
          <thead><tr className="border-b text-left uppercase text-muted-foreground"><th className="py-2">Deliverable</th><th>Reach</th><th>Views</th><th>Eng.</th><th>Clicks</th><th>Conv.</th></tr></thead>
          <tbody>{dels.map((d, i) => <tr key={i} className="border-b"><td className="py-2">{d.content_type} · {d.platform}</td><td>{d.reach}</td><td>{d.views}</td><td>{d.engagements}</td><td>{d.clicks}</td><td>{d.conversions}</td></tr>)}</tbody>
        </table>
        <p className="text-xs text-muted-foreground">Costs calculated on a campaign fee of {inr(Number(deal.value))}.</p>
      </div>
    </div>
  );
}
