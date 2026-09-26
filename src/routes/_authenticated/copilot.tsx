import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReCopilot } from "@/components/re-copilot";
import { EduCopilot } from "@/components/edu-portal";
import { useRe, useReInvalidate } from "@/lib/re-data";
import { useActiveTenant } from "@/lib/tenants";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/copilot")({
  head: () => ({
    meta: [
      { title: "AI Sales Copilot | DigiCRM AI" },
      { name: "description", content: "One AI sales copilot for real estate and coaching: answers lead questions, recommends units or courses, drafts WhatsApp and updates the CRM." },
      { property: "og:title", content: "AI Sales Copilot | DigiCRM AI" },
      { property: "og:description", content: "Real estate and education sales copilot that updates your CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CopilotHub,
});

function CopilotHub() {
  const { data: leads = [] } = useRe("re_clients", "id,full_name,phone", "created_at");
  const inv = useReInvalidate(); const qc = useQueryClient();
  const { active } = useActiveTenant();
  const { data: students = [] } = useQuery({ queryKey: ["edu", "copilot-students", active?.id], enabled: !!active?.id,
    queryFn: async () => ((await (supabase as any).from("edu_students").select("id,name,phone").eq("tenant_id", active!.id).order("created_at", { ascending: false }).limit(500)).data ?? []) });
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <Card><CardHeader><CardTitle>AI Sales Copilot</CardTitle><CardDescription>Pick a module and a lead. It answers, recommends only what you actually have, drafts the WhatsApp message and — when switched on — updates the CRM.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="re"><TabsList><TabsTrigger value="re">Real estate</TabsTrigger><TabsTrigger value="edu">Coaching & education</TabsTrigger></TabsList>
            <TabsContent value="re"><ReCopilot leads={leads} onApplied={inv} /></TabsContent>
            <TabsContent value="edu">{active?.id ? <EduCopilot tid={active.id} students={students} onApplied={() => qc.invalidateQueries({ queryKey: ["edu"] })} /> : <p className="text-sm text-muted-foreground">Choose a workspace first.</p>}</TabsContent>
          </Tabs>
        </CardContent></Card>
    </div>
  );
}
