import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { GraduationCap, Loader2, Sparkles, Check, School, Plane } from "lucide-react";
import { toast } from "sonner";
import { educationSetup } from "@/lib/workspace.functions";
import { getTemplate } from "@/lib/workspace-templates";
import { applyTemplate } from "@/lib/workspace-apply";
import { claimIndustry } from "@/lib/industry-access";
import { useActiveTenant } from "@/lib/tenants";

export const Route = createFileRoute("/_authenticated/education-setup")({
  head: () => ({
    meta: [
      { title: "Education AI Setup | DigiCRM AI" },
      { name: "description", content: "Answer a few questions and AI builds your coaching, college or consultant CRM: pipeline, forms, dashboards and programs." },
      { property: "og:title", content: "Education AI Setup | DigiCRM AI" },
      { property: "og:description", content: "Self-configuring CRM for coaching institutes, colleges and education consultants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EducationSetup,
});

type Kind = "coaching" | "education" | "study_abroad" | "school" | "edtech" | "skill_training";
const TYPES: { k: Kind; label: string; hint: string; icon: any }[] = [
  { k: "coaching", label: "Coaching institute", hint: "NEET, JEE, UPSC, tuition…", icon: GraduationCap },
  { k: "education", label: "College / University", hint: "UG, PG, diploma admissions", icon: School },
  { k: "study_abroad", label: "Education consultant", hint: "Study abroad, admissions", icon: Plane },
  { k: "school", label: "School", hint: "K-12 admissions", icon: School },
  { k: "edtech", label: "EdTech", hint: "Online courses", icon: Sparkles },
  { k: "skill_training", label: "Skill / Training", hint: "Vocational, placement", icon: GraduationCap },
];

function EducationSetup() {
  const nav = useNavigate(); const qc = useQueryClient();
  const gen = useServerFn(educationSetup);
  const [kind, setKind] = useState<Kind>("coaching");
  const [a, setA] = useState({ name: "", city: "", branches: 1, programs: "", mode: "Offline", feeRange: "", notes: "" });
  const [plan, setPlan] = useState<any>(null);
  const [sample, setSample] = useState(true);
  const tpl = getTemplate(kind)!;
  const { active } = useActiveTenant();
  const switchWs = useMutation({
    mutationFn: async () => {
      if (!active?.id) throw new Error("No active workspace to switch.");
      await applyTemplate({ tenantId: active.id, template: { ...tpl, fields: [...tpl.fields, ...(plan?.extraFields ?? [])] }, subtype: plan?.subtype ?? tpl.subtypes[0]!, locationMode: "single", locations: [] });
    },
    onSuccess: async () => { await qc.invalidateQueries(); toast.success(`${active?.name} now uses ${tpl.name}`); nav({ to: "/coaching" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ask = useMutation({
    mutationFn: () => gen({ data: { businessType: kind, ...a } }),
    onSuccess: setPlan, onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser(); const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const template = { ...tpl, fields: [...tpl.fields, ...plan.extraFields] };
      const { data: id, error } = await supabase.rpc("create_my_tenant" as never, { _name: a.name.trim() || tpl.name, _industry: tpl.name } as never);
      if (error) throw error;
      const tenantId = id as unknown as string;
      try { await claimIndustry(uid, tpl.group); } catch { /* already set */ }
      localStorage.setItem("digicrm.active_tenant", tenantId);
      const locs = plan.branches.map((b: any) => b.name);
      await applyTemplate({ tenantId, template, subtype: plan.subtype, locationMode: locs.length > 1 ? "multi" : "single", locations: locs.length > 1 ? locs : [], description: a.notes, sample: false });
      {
        const sb = supabase as any;
        const { data: br } = await sb.from("edu_branches").insert(plan.branches.map((b: any) => ({ tenant_id: tenantId, name: b.name, city: b.city }))).select("id");
        const { data: cs } = plan.courses.length ? await sb.from("edu_courses").insert(plan.courses.map((c: any) => ({ tenant_id: tenantId, ...c }))).select("id,name") : { data: [] };
        const batches = plan.batches.map((b: any, i: number) => ({ tenant_id: tenantId, name: b.name, timing: b.timing, course_id: (cs ?? []).find((c: any) => c.name === b.course)?.id ?? cs?.[0]?.id ?? null, branch_id: br?.[i % (br?.length || 1)]?.id ?? null }));
        if (batches.length) await sb.from("edu_batches").insert(batches);
      }
      return kind;
    },
    onSuccess: async (k) => { await qc.invalidateQueries(); toast.success("Your education CRM is ready"); void k; nav({ to: "/coaching" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-primary" />Education AI Setup</h1>
        <p className="text-sm text-muted-foreground">Tell us about your institute. AI creates your admission pipeline, enquiry form, dashboard, programs, branches and batches.</p>
      </div>

      <Card><CardHeader><CardTitle className="text-base">1. What kind of institute are you?</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.k} onClick={() => { setKind(t.k); setPlan(null); }} className={`rounded-lg border p-3 text-left transition-colors ${kind === t.k ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
              <t.icon className="mb-1 h-4 w-4 text-primary" /><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-muted-foreground">{t.hint}</p>
            </button>))}
          {active && <div className="sm:col-span-3 flex flex-wrap items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground">Already have a workspace? Switch <b className="text-foreground">{active.name}</b> to {tpl.name} — your existing records stay.
            <Button size="sm" variant="outline" className="ml-auto" disabled={switchWs.isPending} onClick={() => switchWs.mutate()}>{switchWs.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Switch template</Button></div>}
        </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">2. A few details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Institute name</Label><Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Vidya NEET Academy" /></div>
          <div><Label>City</Label><Input value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} placeholder="e.g. Kota" /></div>
          <div><Label>Number of branches</Label><Input type="number" min={1} max={50} value={a.branches} onChange={(e) => setA({ ...a, branches: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} /></div>
          <div><Label>Teaching mode</Label><div className="flex gap-1">{["Offline", "Online", "Hybrid"].map((m) => <Button key={m} size="sm" type="button" variant={a.mode === m ? "default" : "outline"} onClick={() => setA({ ...a, mode: m })}>{m}</Button>)}</div></div>
          <div className="sm:col-span-2"><Label>{kind === "study_abroad" ? "Countries & services" : "Courses / programs you offer"}</Label><Textarea rows={2} value={a.programs} onChange={(e) => setA({ ...a, programs: e.target.value })} placeholder={kind === "study_abroad" ? "UK, Canada masters; IELTS coaching; visa filing" : kind === "education" ? "BBA, MBA, B.Tech CSE, B.Com" : "NEET 2-year, NEET dropper, Class 11 foundation"} /></div>
          <div><Label>Typical fee range</Label><Input value={a.feeRange} onChange={(e) => setA({ ...a, feeRange: e.target.value })} placeholder="₹60,000 – ₹1,50,000" /></div>
          <div><Label>Anything else?</Label><Input value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} placeholder="Scholarship test every month…" /></div>
          <Button className="sm:col-span-2" onClick={() => ask.mutate()} disabled={ask.isPending || !a.programs.trim()}>{ask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Build my CRM with AI</Button>
        </CardContent></Card>

      {plan && (
        <Card><CardHeader><CardTitle className="text-base">3. Review what AI built</CardTitle><CardDescription>{plan.summary || `${tpl.name} · ${plan.subtype}`}</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title={`Admission pipeline (${tpl.stages.length} stages)`}>{tpl.stages.map((s) => <Badge key={s} variant={tpl.wonStages.includes(s) ? "default" : "secondary"}>{s}</Badge>)}</Section>
            <Section title="Enquiry form fields">{[...tpl.fields, ...plan.extraFields].map((f: any) => <Badge key={f.key} variant={plan.extraFields.includes(f) ? "default" : "outline"}>{f.label}{plan.extraFields.includes(f) ? " · new" : ""}</Badge>)}</Section>
            <Section title="Dashboard">{tpl.dashboard.map((k) => <Badge key={k.label} variant="outline">{k.label}</Badge>)}</Section>
            <Section title="AI agents">{tpl.agents.map((g) => <Badge key={g.key} variant="outline">{g.label}</Badge>)}</Section>
            {plan.courses.length > 0 && <div><p className="mb-1 font-medium">Programs</p><div className="grid gap-1 sm:grid-cols-2">{plan.courses.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded border p-2"><span className="flex-1">{c.name}<span className="block text-xs text-muted-foreground">{c.mode} · {c.duration_months} months</span></span>
                <Input className="h-8 w-28" type="number" value={c.fee} onChange={(e) => { const cs = [...plan.courses]; cs[i] = { ...c, fee: Number(e.target.value) || 0 }; setPlan({ ...plan, courses: cs }); }} /></div>))}</div></div>}
            <Section title="Branches">{plan.branches.map((b: any, i: number) => <Badge key={i} variant="secondary">{b.name} · {b.city}</Badge>)}</Section>
            {plan.batches.length > 0 && <Section title="Batches">{plan.batches.map((b: any, i: number) => <Badge key={i} variant="outline">{b.name}{b.timing ? ` · ${b.timing}` : ""}</Badge>)}</Section>}
            {kind !== "coaching" && <div className="flex items-center gap-2"><Switch id="s" checked={sample} onCheckedChange={setSample} /><Label htmlFor="s">Add sample enquiries so I can try it</Label></div>}
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Create my {tpl.name}</Button>
          </CardContent></Card>)}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1 font-medium">{title}</p><div className="flex flex-wrap gap-1">{children}</div></div>;
}
