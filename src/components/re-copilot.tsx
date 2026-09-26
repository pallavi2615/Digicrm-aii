import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { reCopilot } from "@/lib/re-copilot.functions";
import { Md } from "@/components/dist-ai";
import { cr, waLink } from "@/lib/re-data";

type Turn = { q: string; res: any };

export function ReCopilot({ leads, initialLeadId, onApplied, compact }: { leads: any[]; initialLeadId?: string | null; onApplied?: () => void; compact?: boolean }) {
  const fn = useServerFn(reCopilot);
  const [leadId, setLeadId] = useState<string>(initialLeadId ?? "none");
  const [q, setQ] = useState(""); const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false); const [turns, setTurns] = useState<Turn[]>([]);
  const ask = async (question = q) => {
    if (!question.trim()) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return toast.error("The copilot needs internet. Your notes are still saved offline.");
    setBusy(true);
    try {
      const res: any = await fn({ data: { clientId: leadId === "none" ? null : leadId, question, apply, history: turns.flatMap((t) => [{ role: "user" as const, text: t.q }, { role: "assistant" as const, text: String(t.res.answer ?? "").slice(0, 3900) }]).slice(-20) } });
      setTurns((t) => [...t, { q: question, res }]); setQ("");
      if (res.applied?.length) { toast.success("CRM updated"); onApplied?.(); }
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  const quick = leadId === "none"
    ? ["Which hot leads should I call today?", "Which 2BHK units under ₹80L are available?"]
    : ["Recommend 3 units for this lead", "Draft a follow-up after the site visit", "Customer said budget is now ₹1.2 Cr and wants 3BHK near metro — update CRM"];
  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? "" : "md:grid-cols-[1fr_auto]"}`}>
        <Select value={leadId} onValueChange={setLeadId}><SelectTrigger><SelectValue placeholder="Pick a lead" /></SelectTrigger>
          <SelectContent><SelectItem value="none">No specific lead (general question)</SelectItem>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.full_name}{l.phone ? ` · ${l.phone}` : ""}</SelectItem>)}</SelectContent></Select>
        <div className="flex items-center gap-2"><Switch id="apply" checked={apply} onCheckedChange={setApply} /><Label htmlFor="apply" className="text-xs">Update CRM automatically</Label></div>
      </div>
      <div className="flex flex-wrap gap-1">{quick.map((x) => <Button key={x} size="sm" variant="outline" className="h-auto whitespace-normal py-1 text-left text-xs" onClick={() => ask(x)} disabled={busy}>{x}</Button>)}</div>
      <div className="flex gap-2"><Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything, or paste what the customer said…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
        <Button onClick={() => ask()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}</Button></div>
      {turns.map((t, i) => (
        <div key={i} className="space-y-2 text-sm">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">{t.q}</div>
          <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm border bg-card p-3">
          {t.res.answer && <Md text={t.res.answer} />}
          {t.res.recommendations?.length > 0 && <div className="space-y-1">{t.res.recommendations.map((r: any) => (
            <div key={r.property_id} className="rounded bg-muted p-2"><p className="font-medium">{r.unit.title}{r.unit.unit_no ? ` · ${r.unit.tower ?? ""} ${r.unit.unit_no}` : ""} — {cr(r.unit.price)}</p><p className="text-xs text-muted-foreground">{[r.unit.bhk && `${r.unit.bhk} BHK`, r.unit.super_area && `${r.unit.super_area} sq ft`, r.unit.facing, r.unit.location].filter(Boolean).join(" · ")}</p><p className="text-xs">{r.why}</p></div>))}</div>}
          {t.res.whatsapp && <div className="rounded border-l-2 border-primary bg-primary/5 p-2"><p>{t.res.whatsapp}</p><Button size="sm" className="mt-2" asChild><a href={waLink(t.res.phone, t.res.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3 w-3" />Open in WhatsApp</a></Button></div>}
          {t.res.applied?.length > 0 && <div className="flex flex-wrap items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" />{t.res.applied.map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}</div>}
        </div></div>))}
      {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Copilot is thinking…</div>}
      <div ref={(el) => el?.scrollIntoView({ block: "nearest" })} />
    </div>
  );
}
