import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, MessageCircle, Sparkles, Loader2, Wand2 } from "lucide-react";
import { useRe, useReAi, matchScore, cr, waLink } from "@/lib/re-data";
import { Md } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/realestate/match")({
  head: () => ({ meta: [{ title: "MatchAI Property Matching | Real Estate CRM" }, { name: "description", content: "Match leads to available inventory with a match score and AI recommendations." }] }),
  component: MatchPage,
});

const blank = { budget_min: "", budget_max: "", city: "", location: "", bhk: "", size_min: "", possession: "" };

function MatchPage() {
  const ai = useReAi();
  const { data: leads = [] } = useRe("re_clients", "*", "full_name", true);
  const { data: units = [] } = useRe("re_properties", "*, re_projects(name, location, city, brochure_url)");
  const [leadId, setLeadId] = useState("");
  const [req, setReq] = useState<any>(blank);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [advice, setAdvice] = useState("");

  const lead = leads.find((l: any) => l.id === leadId);
  const loadLead = (id: string) => {
    setLeadId(id);
    const l = leads.find((x: any) => x.id === id);
    if (l) setReq({ budget_min: l.budget_min ?? "", budget_max: l.budget_max ?? "", city: l.preferred_city ?? "", location: l.preferred_location ?? "", bhk: l.bhk ?? "", size_min: l.size_min ?? "", possession: l.possession_pref ?? "" });
    setPicked([]); setAdvice("");
  };

  const results = useMemo(() => units.filter((u: any) => (u.inventory_status ?? "Available") === "Available")
    .map((u: any) => ({ u, ...matchScore({ ...req, budget_min: Number(req.budget_min) || null, budget_max: Number(req.budget_max) || null, bhk: Number(req.bhk) || null, size_min: Number(req.size_min) || null }, u) }))
    .sort((a: any, b: any) => b.score - a.score).slice(0, 30), [units, req]);

  const fromText = async () => {
    const r = await ai.run({ mode: "extract", text });
    if (!r) return;
    try {
      const j = JSON.parse(r.text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      setReq({ budget_min: j.budget_min ?? "", budget_max: j.budget_max ?? "", city: j.city ?? "", location: j.location ?? "", bhk: j.bhk ?? "", size_min: j.size_min ?? "", possession: j.possession ?? "" });
    } catch { /* ignore */ }
  };
  const recommend = async () => {
    const top = results.slice(0, 8).map((r: any) => ({ unit: r.u.title, project: r.u.re_projects?.name, price: r.u.price, bhk: r.u.bhk, area: r.u.super_area ?? r.u.area_sqft, facing: r.u.facing, location: r.u.location ?? r.u.city, status: r.u.construction_status, match: r.score }));
    const r = await ai.run({ mode: "recommend", text: text || lead?.requirement || JSON.stringify(req), question: JSON.stringify(top) });
    if (r) setAdvice(r.text);
  };
  const share = () => {
    const chosen = results.filter((r: any) => picked.includes(r.u.id));
    const lines = chosen.map((r: any, i: number) => `${i + 1}. ${r.u.re_projects?.name ? r.u.re_projects.name + " – " : ""}${r.u.title} · ${r.u.bhk ?? "?"} BHK · ${r.u.super_area ?? r.u.area_sqft ?? "?"} sq ft · ${cr(r.u.price)}${r.u.facing ? " · " + r.u.facing + " facing" : ""}${r.u.re_projects?.brochure_url ? "\nBrochure: " + r.u.re_projects.brochure_url : ""}`);
    const msg = `Hi${lead ? " " + lead.full_name.split(" ")[0] : ""}, here are properties that match your requirement:\n\n${lines.join("\n\n")}\n\nShall I book a site visit this weekend?`;
    window.open(waLink(lead?.whatsapp || lead?.phone, msg), "_blank");
  };

  const F = (k: string, label: string, type = "text") => (<div className="space-y-1"><Label className="text-xs">{label}</Label><Input type={type} value={req[k]} onChange={(e) => setReq({ ...req, [k]: e.target.value })} /></div>);

  return (
    <div className="p-4 md:p-6 grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Requirement</CardTitle><CardDescription>Pick a lead, type the criteria, or paste what the customer said.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Select value={leadId} onValueChange={loadLead}><SelectTrigger><SelectValue placeholder="Choose a lead (optional)" /></SelectTrigger><SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}</SelectContent></Select>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="I want something near school, 3 BHK, under ₹1.5 crore and preferably park-facing." />
            <Button size="sm" variant="outline" onClick={fromText} disabled={ai.loading || !text.trim()}>{ai.loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}Read with AI</Button>
            <div className="grid grid-cols-2 gap-2">{F("budget_min", "Budget min ₹", "number")}{F("budget_max", "Budget max ₹", "number")}{F("city", "City")}{F("location", "Location")}{F("bhk", "BHK", "number")}{F("size_min", "Min sq ft", "number")}</div>
            {F("possession", "Possession (Ready / 2027)")}
            <Button variant="ghost" size="sm" onClick={() => { setReq(blank); setLeadId(""); setText(""); }}>Clear</Button>
          </CardContent>
        </Card>
        {advice && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">AI recommendation</CardTitle></CardHeader><CardContent><Md text={advice} /></CardContent></Card>}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-sm text-muted-foreground">{results.length} available units ranked by match</div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={recommend} disabled={ai.loading || results.length === 0}><Sparkles className="h-3 w-3 mr-1" />Explain best 3</Button>
          <Button size="sm" onClick={share} disabled={picked.length === 0}><MessageCircle className="h-3 w-3 mr-1" />Share {picked.length || ""} on WhatsApp</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {results.map(({ u, score, checks }: any) => (
            <Card key={u.id} className={picked.includes(u.id) ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox checked={picked.includes(u.id)} onCheckedChange={(v) => setPicked(v ? [...picked, u.id] : picked.filter((x) => x !== u.id))} />
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{u.title}</div><div className="text-xs text-muted-foreground">{[u.re_projects?.name, u.location || u.city].filter(Boolean).join(" · ")}</div></div>
                  <Badge variant={score >= 80 ? "default" : "outline"}>{score}% match</Badge>
                </div>
                <div className="text-xs">{[u.bhk && `${u.bhk} BHK`, (u.super_area ?? u.area_sqft) && `${u.super_area ?? u.area_sqft} sq ft`, u.facing && `${u.facing} facing`, u.construction_status].filter(Boolean).join(" · ")}</div>
                <div className="font-semibold">{cr(u.price)}</div>
                <div className="flex flex-wrap gap-1">{checks.map((c: any) => <Badge key={c.label} variant="outline" className={c.ok ? "text-success border-success/40" : "text-muted-foreground"}>{c.ok ? <Check className="h-3 w-3 mr-0.5" /> : <X className="h-3 w-3 mr-0.5" />}{c.label}</Badge>)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
