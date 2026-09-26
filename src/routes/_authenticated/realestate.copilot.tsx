import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReCopilot } from "@/components/re-copilot";
import { useRe, useReInvalidate } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/copilot")({
  head: () => ({
    meta: [
      { title: "AI Sales Copilot — Real Estate | DigiCRM AI" },
      { name: "description", content: "Ask about any lead, get matching units and ready WhatsApp follow-ups, with the CRM updated automatically." },
      { property: "og:title", content: "AI Sales Copilot | DigiCRM AI" },
      { property: "og:description", content: "Lead answers, property recommendations and WhatsApp drafts that update your CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CopilotPage,
});

function CopilotPage() {
  const { data: leads = [] } = useRe("re_clients", "id,full_name,phone", "created_at");
  const inv = useReInvalidate();
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <Card><CardHeader><CardTitle>AI Sales Copilot</CardTitle><CardDescription>Pick a lead and ask anything. It recommends only units that are actually available, drafts the WhatsApp message, and — when “Update CRM automatically” is on — saves budget, BHK, location, temperature, notes and the next follow-up.</CardDescription></CardHeader>
        <CardContent><ReCopilot leads={leads} onApplied={inv} /></CardContent></Card>
    </div>
  );
}
