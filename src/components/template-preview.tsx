import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Workflow as WfIcon, MessageCircle } from "lucide-react";
import { COMMON_MODULES, type WorkspaceTemplate } from "@/lib/workspace-templates";

/** Read-only walkthrough of everything a template will create. */
export function TemplatePreview({ t, modules }: { t: WorkspaceTemplate; modules?: string[] }) {
  const mods = modules ?? [...t.modules, ...COMMON_MODULES];
  return (
    <Tabs defaultValue="modules" className="w-full">
      <TabsList className="flex flex-wrap h-auto">
        {["modules", "fields", "pipeline", "workflows", "dashboard", "agents"].map((k) => (
          <TabsTrigger key={k} value={k} className="capitalize">{k === "agents" ? "AI agents" : k}</TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="modules">
        <div className="flex flex-wrap gap-1.5">{mods.map((m) => <Badge key={m} variant={t.modules.includes(m) ? "default" : "outline"}>{m}</Badge>)}</div>
        <p className="mt-2 text-xs text-muted-foreground">Filled = industry-specific module · outline = common module</p>
      </TabsContent>
      <TabsContent value="fields">
        <div className="grid gap-2 sm:grid-cols-2">
          {t.fields.map((f) => (
            <div key={f.key} className="rounded-md border p-2 text-sm">
              <div className="font-medium">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.type}{f.options?.length ? ` · ${f.options.join(", ")}` : ""}</div>
            </div>
          ))}
          {t.fields.length === 0 && <p className="text-sm text-muted-foreground">No custom fields</p>}
        </div>
        {t.sources.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Lead sources: {t.sources.join(", ")}</p>}
      </TabsContent>
      <TabsContent value="pipeline">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {t.stages.map((s, i) => (
            <div key={s + i} className="min-w-[120px] rounded-md border bg-muted/30 p-2">
              <div className="text-xs text-muted-foreground">Stage {i + 1}</div>
              <div className="text-sm font-medium">{s}</div>
              {t.wonStages.includes(s) && <Badge className="mt-1 text-[10px]">Won</Badge>}
              {t.lostStages.includes(s) && <Badge variant="destructive" className="mt-1 text-[10px]">Lost</Badge>}
              <div className="mt-2 h-8 rounded border border-dashed" />
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="workflows" className="space-y-2">
        {t.workflows.map((w) => (
          <div key={w.key} className="flex items-start gap-2 rounded-md border p-2 text-sm">
            <WfIcon className="mt-0.5 h-4 w-4 text-primary" />
            <div className="flex-1"><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.action}</div></div>
            <Badge variant={w.enabled ? "default" : "outline"}>{w.enabled ? "On" : "Off"}</Badge>
          </div>
        ))}
        {t.whatsapp.length > 0 && (
          <div className="rounded-md border p-2 text-xs space-y-1">
            <div className="font-medium flex items-center gap-1"><MessageCircle className="h-3 w-3" />WhatsApp templates</div>
            {t.whatsapp.map((w) => <div key={w.key}><b>{w.name}:</b> {w.body}</div>)}
          </div>
        )}
      </TabsContent>
      <TabsContent value="dashboard">
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {t.dashboard.map((k) => (
            <div key={k.label} className="rounded-md border p-2"><div className="text-[11px] text-muted-foreground">{k.label}</div><div className="text-lg font-bold text-muted-foreground/60">—</div></div>
          ))}
        </div>
        {t.reports.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Reports: {t.reports.map((r) => r.name).join(" · ")}</p>}
      </TabsContent>
      <TabsContent value="agents" className="space-y-2">
        {t.agents.map((a) => (
          <div key={a.key} className="rounded-md border p-2 text-sm">
            <div className="font-medium flex items-center gap-1"><Bot className="h-4 w-4 text-primary" />{a.label}</div>
            <div className="text-xs text-muted-foreground">{a.description}</div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Roles: {t.roles.join(", ")} · Integrations: {t.integrations.join(", ")}</p>
      </TabsContent>
    </Tabs>
  );
}
