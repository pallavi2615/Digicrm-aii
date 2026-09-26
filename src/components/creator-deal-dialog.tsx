import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBrands, useProfiles, useInvalidateCreator } from "@/lib/creator-data";
import { DEAL_STAGES, DEAL_TYPES, PLATFORMS, ENQUIRY_SOURCES, STAGE_PROBABILITY } from "@/lib/creator";
import { toast } from "sonner";

export function NewDealDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const brands = useBrands();
  const profiles = useProfiles();
  const invalidate = useInvalidateCreator();
  const [f, setF] = useState({ campaign: "", brand_id: "", new_brand: "", creator_id: "", value: "", platform: "", deal_type: "", stage: "New Lead", source: "Manual", deadline: "", next_action: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.campaign.trim()) return toast.error("Campaign name is required");
    setSaving(true);
    try {
      let brandId = f.brand_id || null;
      if (!brandId && f.new_brand.trim()) {
        const { data, error } = await supabase.from("creator_brands").insert({ name: f.new_brand.trim() }).select("id").single();
        if (error) throw error;
        brandId = data.id;
      }
      const { data, error } = await supabase.from("creator_deals").insert({
        campaign: f.campaign.trim(), brand_id: brandId, creator_id: f.creator_id || null,
        value: Number(f.value) || 0, platform: f.platform || null, deal_type: f.deal_type || null,
        stage: f.stage, probability: STAGE_PROBABILITY[f.stage] ?? 10, source: f.source,
        deadline: f.deadline || null, next_action: f.next_action || null, notes: f.notes || null,
      }).select("id").single();
      if (error) throw error;
      toast.success("Deal created");
      invalidate();
      onOpenChange(false);
      onCreated?.(data.id);
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New sponsorship deal</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Campaign</Label><Input value={f.campaign} onChange={(e) => set("campaign")(e.target.value)} placeholder="Diwali skincare launch" /></div>
          <div><Label>Brand</Label>
            <Select value={f.brand_id} onValueChange={set("brand_id")}><SelectTrigger><SelectValue placeholder="Pick a brand" /></SelectTrigger>
              <SelectContent>{(brands.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>…or new brand</Label><Input value={f.new_brand} onChange={(e) => set("new_brand")(e.target.value)} disabled={!!f.brand_id} /></div>
          <div><Label>Creator</Label>
            <Select value={f.creator_id} onValueChange={set("creator_id")}><SelectTrigger><SelectValue placeholder="Me / pick creator" /></SelectTrigger>
              <SelectContent>{(profiles.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Deal value (₹)</Label><Input type="number" value={f.value} onChange={(e) => set("value")(e.target.value)} /></div>
          <Pick label="Platform" value={f.platform} onChange={set("platform")} options={PLATFORMS} />
          <Pick label="Deal type" value={f.deal_type} onChange={set("deal_type")} options={DEAL_TYPES} />
          <Pick label="Stage" value={f.stage} onChange={set("stage")} options={[...DEAL_STAGES]} />
          <Pick label="Source" value={f.source} onChange={set("source")} options={ENQUIRY_SOURCES} />
          <div><Label>Deadline</Label><Input type="date" value={f.deadline} onChange={(e) => set("deadline")(e.target.value)} /></div>
          <div><Label>Next action</Label><Input value={f.next_action} onChange={(e) => set("next_action")(e.target.value)} placeholder="Send rate card" /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create deal"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div><Label>{label}</Label>
      <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
    </div>
  );
}
