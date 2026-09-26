import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Wand2, Eye, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TemplatePreview } from "@/components/template-preview";
import { usePublishedTemplates, DEFAULT_SETTINGS, type WorkspaceSettings } from "@/lib/template-library";
import type { WorkspaceTemplate } from "@/lib/workspace-templates";
import { toast } from "sonner";
import { LOCATION_MODES, COMMON_MODULES } from "@/lib/workspace-templates";
import { recommendTemplate } from "@/lib/workspace.functions";
import { applyTemplate } from "@/lib/workspace-apply";
import { useActiveTenant } from "@/lib/tenants";
import { claimIndustry } from "@/lib/industry-access";

export const Route = createFileRoute("/_authenticated/workspace/setup")({
  head: () => ({
    meta: [
      { title: "AI Template Engine — set up your industry CRM | DigiCRM AI" },
      { name: "description", content: "Describe your business and DigiCRM AI configures pipeline, fields, dashboard, workflows, WhatsApp journeys, AI agents and reports." },
      { property: "og:title", content: "AI CRM that configures itself | DigiCRM AI" },
      { property: "og:description", content: "Pick your industry or describe your business — your CRM is ready in a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Setup,
});

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function Setup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { active } = useActiveTenant();
  const recommend = useServerFn(recommendTemplate);

  const [step, setStep] = useState(0);
  const [newWs, setNewWs] = useState(false);
  const [bizName, setBizName] = useState("");
  const [desc, setDesc] = useState("");
  const [tplSlug, setTplSlug] = useState("real-estate");
  const [subtype, setSubtype] = useState("Builder / developer");
  const [mode, setMode] = useState<"single" | "multi" | "franchise">("single");
  const [locs, setLocs] = useState<string[]>(["Head Office"]);
  const [sample, setSample] = useState(true);
  const [reason, setReason] = useState("");
  const { templates: WORKSPACE_TEMPLATES } = usePublishedTemplates();
  const getTemplate = (slug: string) => WORKSPACE_TEMPLATES.find((t) => t.slug === slug);
  const base = getTemplate(tplSlug);
  // Customisation state (step 4)
  const [stages, setStages] = useState<string[]>([]);
  const [won, setWon] = useState<string[]>([]);
  const [mods, setMods] = useState<string[]>([]);
  const [offWf, setOffWf] = useState<string[]>([]);
  const [offAgents, setOffAgents] = useState<string[]>([]);
  const [offFields, setOffFields] = useState<string[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [peek, setPeek] = useState<WorkspaceTemplate | null>(null);
  useEffect(() => {
    if (!base) return;
    setStages(base.stages); setWon(base.wonStages); setMods([...base.modules, ...COMMON_MODULES]);
    setOffWf([]); setOffAgents([]); setOffFields([]);
    setSettings({ ...DEFAULT_SETTINGS, defaultSource: base.sources[0] ?? DEFAULT_SETTINGS.defaultSource });
  }, [base?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  const tpl: WorkspaceTemplate | undefined = base && {
    ...base,
    stages: stages.map((x) => x.trim()).filter(Boolean),
    wonStages: stages.filter((x, i) => won.includes(base.stages[i] ?? x) || won.includes(x)).map((x) => x.trim()),
    lostStages: stages.filter((x, i) => base.lostStages.includes(base.stages[i] ?? "") || base.lostStages.includes(x)),
    modules: base.modules.filter((m) => mods.includes(m)),
    workflows: base.workflows.map((w) => {
      const idx = w.stage ? base.stages.indexOf(w.stage) : -1;
      return { ...w, enabled: !offWf.includes(w.key), ...(idx >= 0 && stages[idx] ? { stage: stages[idx]!.trim() } : {}) };
    }),
    agents: base.agents.filter((a) => !offAgents.includes(a.key)),
    fields: base.fields.filter((f) => !offFields.includes(f.key)),
  };
  const creating = newWs || !active;

  const ai = useMutation({
    mutationFn: () => recommend({ data: { description: desc } }),
    onSuccess: (r) => {
      setTplSlug(r.template); setSubtype(r.subtype); setMode(r.location_mode as never); setReason(r.reason);
      if (r.business_name && !bizName) setBizName(r.business_name);
      if (r.location_mode !== "single") setLocs(Array.from({ length: Math.min(r.locations, 12) }, (_, i) => (i === 0 ? (r.location_mode === "franchise" ? "Brand HQ" : "Head Office") : `${r.location_mode === "franchise" ? "Franchise" : "Location"} ${i}`)));
      setStep(1);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = (slug: string) => { const t = getTemplate(slug)!; setTplSlug(slug); setSubtype(t.subtypes[0]!); };

  const apply = useMutation({
    mutationFn: async () => {
      if (!tpl) throw new Error("Choose a template first.");
      let tenantId = active?.id;
      if (creating) {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id; if (!uid) throw new Error("Please sign in again.");
        const name = bizName.trim() || `${tpl.name.replace(" CRM", "")} business`;
        const { data: newId, error } = await supabase.rpc("create_my_tenant" as never, { _name: name, _industry: tpl.name } as never);
        if (error) throw error;
        const t = { id: newId as unknown as string };
        tenantId = t.id;
        try { await claimIndustry(uid, tpl.group); } catch { /* already assigned */ }
        localStorage.setItem("digicrm.active_tenant", t.id);
      }
      if (tpl.stages.length < 2) throw new Error("Keep at least two pipeline stages.");
      await applyTemplate({ tenantId: tenantId!, template: tpl, subtype, locationMode: mode, locations: mode === "single" ? [] : locs, description: desc, sample, modules: mods, settings });
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success(`${tpl?.name} is ready`);
      navigate({ to: "/workspace" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wand2 className="h-6 w-6 text-primary" />AI CRM that configures itself</h1>
        <p className="text-sm text-muted-foreground">Pick your industry — pipeline, fields, dashboard, workflows, WhatsApp journeys, AI agents and reports are created for you.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {["Your business", "Industry & type", "Locations", "Customise", "Preview & create"].map((l, i) => (
          <Badge key={l} variant={i === step ? "default" : i < step ? "secondary" : "outline"}>{i < step && <Check className="mr-1 h-3 w-3" />}{i + 1}. {l}</Badge>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Describe your business</CardTitle>
            <CardDescription>e.g. "I run a 3-location dental clinic in Pune" — or skip and choose from the list.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {active && (
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={newWs} onCheckedChange={(v) => setNewWs(!!v)} />
                Create a new workspace (otherwise “{active.name}” switches to this industry)</label>
            )}
            {creating && (<div className="space-y-1.5"><Label>Business name</Label><Input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Smile Dental Care" /></div>)}
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="I'm a 3-location dental clinic…" />
            <div className="flex gap-2">
              <Button disabled={desc.trim().length < 3 || ai.isPending} onClick={() => ai.mutate()}>
                {ai.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Configure with AI
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}>Choose manually</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Select your industry</CardTitle>
            {reason && <CardDescription className="text-primary">AI: {reason}</CardDescription>}</CardHeader>
          <CardContent className="space-y-4">
            {(["core", "education", "more"] as const).map((w) => (
              <div key={w} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{w === "core" ? "Core templates" : w === "education" ? "Education CRM suite" : "More templates"}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[...WORKSPACE_TEMPLATES].sort((a, b) => (a.slug === "real-estate" ? -1 : b.slug === "real-estate" ? 1 : 0)).map((t) => (t.slug === "real-estate" ? { ...t, wave: 1 as const } : t)).filter((t) => w === "education" ? t.group === "education" : t.group !== "education" && t.wave === (w === "core" ? 1 : 2)).map((t) => (
                    <button key={t.slug} onClick={() => pick(t.slug)} className={`rounded-lg border p-3 text-left transition-colors ${tplSlug === t.slug ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                      <p className="text-sm font-medium">{t.name}{t.slug === "real-estate" && <span className="ml-1 text-[10px] text-primary">Default</span>}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t.positioning}</p>
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setPeek(t); }} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Eye className="h-3 w-3" />Preview</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {tpl && (
              <div className="space-y-2">
                <Label>What type of business do you operate?</Label>
                <div className="flex flex-wrap gap-2">
                  {tpl.subtypes.map((s) => (<Button key={s} size="sm" variant={subtype === s ? "default" : "outline"} onClick={() => setSubtype(s)}>{s}</Button>))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">How many locations?</CardTitle>
            <CardDescription>The same engine runs 1 location or 1,000 franchise outlets.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {LOCATION_MODES.map((m) => (
                <button key={m.key} onClick={() => { setMode(m.key); if (m.key !== "single" && locs.length < 2) setLocs([m.key === "franchise" ? "Brand HQ" : "Head Office", m.key === "franchise" ? "Franchise 1" : "Location 1"]); }}
                  className={`rounded-lg border p-3 text-left ${mode === m.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <p className="text-sm font-medium">{m.label}</p><p className="text-xs text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
            {mode !== "single" && (
              <div className="space-y-2">
                {locs.map((l, i) => (<Input key={i} value={l} onChange={(e) => setLocs((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />))}
                <Button size="sm" variant="outline" onClick={() => setLocs((xs) => [...xs, `${mode === "franchise" ? "Franchise" : "Location"} ${xs.length}`])}>Add location</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && tpl && base && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Customise before creating</CardTitle>
            <CardDescription>Switch modules on or off, rename stages and set your defaults. You can change all of this later too.</CardDescription></CardHeader>
          <CardContent className="space-y-6 text-sm">
            <section className="space-y-2">
              <p className="font-medium">Pipeline stages</p>
              {stages.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  <Input value={st} onChange={(e) => setStages((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} className="max-w-xs" />
                  <label className="flex items-center gap-1 text-xs"><Checkbox checked={won.includes(base.stages[i] ?? st) || won.includes(st)} onCheckedChange={(v) => { const k = base.stages[i] ?? st; setWon((w) => (v ? [...w, k, st] : w.filter((x) => x !== k && x !== st))); }} />Counts as won</label>
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => setStages((xs) => { const a = [...xs]; [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; return a; })}><ArrowUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" disabled={i === stages.length - 1} onClick={() => setStages((xs) => { const a = [...xs]; [a[i + 1], a[i]] = [a[i]!, a[i + 1]!]; return a; })}><ArrowDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" disabled={stages.length <= 2} onClick={() => setStages((xs) => xs.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setStages((xs) => [...xs, `Stage ${xs.length + 1}`])}><Plus className="mr-1 h-3 w-3" />Add stage</Button>
            </section>
            <section className="space-y-2">
              <p className="font-medium">Modules</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {[...base.modules, ...COMMON_MODULES].map((m) => (
                  <label key={m} className="flex items-center justify-between rounded border px-2 py-1"><span>{m}{base.modules.includes(m) && <Badge variant="secondary" className="ml-1 text-[10px]">industry</Badge>}</span>
                    <Switch checked={mods.includes(m)} onCheckedChange={(v) => setMods((xs) => (v ? [...xs, m] : xs.filter((x) => x !== m)))} /></label>
                ))}
              </div>
            </section>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1"><p className="font-medium">Fields</p>{base.fields.map((f) => <label key={f.key} className="flex items-center gap-2"><Checkbox checked={!offFields.includes(f.key)} onCheckedChange={(v) => setOffFields((xs) => (v ? xs.filter((x) => x !== f.key) : [...xs, f.key]))} />{f.label}</label>)}</div>
              <div className="space-y-1"><p className="font-medium">Automations</p>{base.workflows.map((w) => <label key={w.key} className="flex items-center gap-2"><Checkbox checked={!offWf.includes(w.key)} onCheckedChange={(v) => setOffWf((xs) => (v ? xs.filter((x) => x !== w.key) : [...xs, w.key]))} />{w.name}</label>)}</div>
              <div className="space-y-1"><p className="font-medium">AI agents</p>{base.agents.map((a) => <label key={a.key} className="flex items-center gap-2"><Checkbox checked={!offAgents.includes(a.key)} onCheckedChange={(v) => setOffAgents((xs) => (v ? xs.filter((x) => x !== a.key) : [...xs, a.key]))} />{a.label}</label>)}</div>
            </section>
            <section className="space-y-2">
              <p className="font-medium">Defaults</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label className="text-xs">Default lead source</Label><Input value={settings.defaultSource} onChange={(e) => setSettings({ ...settings, defaultSource: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Flag for follow-up after (days)</Label><Input type="number" value={settings.staleDays} onChange={(e) => setSettings({ ...settings, staleDays: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-1"><Label className="text-xs">Loyalty points per ₹100</Label><Input type="number" value={settings.pointsPer100} onChange={(e) => setSettings({ ...settings, pointsPer100: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-1"><Label className="text-xs">Tax %</Label><Input type="number" value={settings.taxPct} onChange={(e) => setSettings({ ...settings, taxPct: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-1"><Label className="text-xs">Currency</Label><Input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Business hours</Label><Input value={settings.businessHours} onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })} /></div>
              </div>
            </section>
          </CardContent>
        </Card>
      )}

      {step === 4 && tpl && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Preview: this is exactly what will be created</CardTitle>
            <CardDescription>{tpl.name} · {subtype} · {LOCATION_MODES.find((m) => m.key === mode)?.label} · {mods.length} modules</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <TemplatePreview t={tpl} modules={mods} />
            <label className="flex items-center gap-2"><Checkbox checked={sample} onCheckedChange={(v) => setSample(!!v)} />Add 12 sample {tpl.recordLabelPlural.toLowerCase()} so the dashboard isn't empty</label>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!peek} onOpenChange={(o) => !o && setPeek(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{peek?.name} — preview</DialogTitle></DialogHeader>
          {peek && <TemplatePreview t={peek} />}
          <Button onClick={() => { if (peek) { pick(peek.slug); setPeek(null); } }}>Use this template</Button>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        {step > 0 && step < 4 && <Button disabled={step === 1 && !tpl} onClick={() => setStep((s) => s + 1)}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}
        {step === 4 && (
          <Button disabled={apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Create my {tpl?.name}
          </Button>
        )}
      </div>
    </div>
  );
}

