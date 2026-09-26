import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Star } from "lucide-react";
import { useBrands, useDeals, useInvoices, useInvalidateCreator } from "@/lib/creator-data";
import { BOOKED_STAGES, CONTACT_ROLES, lakh } from "@/lib/creator";
import { Pick } from "@/components/creator-deal-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creator/brands")({
  head: () => ({ meta: [{ title: "Brand CRM | DigiCRM AI" }, { name: "description", content: "Brands, agencies, contacts and relationship scorecards." }] }),
  component: BrandsPage,
});

const FIELDS = ["name", "company", "industry", "website", "logo_url", "location", "category", "company_size", "marketing_budget", "tags", "preferred_platforms", "preferred_content", "notes"] as const;

function BrandsPage() {
  const brands = useBrands();
  const deals = useDeals();
  const invoices = useInvoices();
  const invalidate = useInvalidateCreator();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | "new" | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { ltv: number; count: number; avg: number; paidDays: number[]; open: number }>();
    for (const d of deals.data ?? []) {
      if (!d.brand_id) continue;
      const s = m.get(d.brand_id) ?? { ltv: 0, count: 0, avg: 0, paidDays: [], open: 0 };
      if (BOOKED_STAGES.has(d.stage)) { s.ltv += Number(d.value); s.count += 1; } else s.open += 1;
      m.set(d.brand_id, s);
    }
    for (const i of invoices.data ?? []) {
      const bid = (deals.data ?? []).find((d) => d.id === i.deal_id)?.brand_id;
      if (!bid || !i.paid_at || !i.issued_at) continue;
      const s = m.get(bid); if (!s) continue;
      s.paidDays.push((new Date(i.paid_at).getTime() - new Date(i.issued_at).getTime()) / 864e5);
    }
    for (const s of m.values()) s.avg = s.count ? s.ltv / s.count : 0;
    return m;
  }, [deals.data, invoices.data]);

  const score = (id: string) => {
    const s = stats.get(id); if (!s) return 0;
    const speed = s.paidDays.length ? Math.max(0, 30 - s.paidDays.reduce((a, b) => a + b, 0) / s.paidDays.length) / 30 : 0.5;
    return Math.round(Math.min(5, s.count * 0.8 + Math.min(2, s.ltv / 500000) + speed * 1.5));
  };

  const list = (brands.data ?? []).filter((b) => !q || `${b.name} ${b.category ?? ""} ${b.industry ?? ""} ${(b.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Input placeholder="Search brands, category, tag" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button className="ml-auto" onClick={() => setOpenId("new")}><Plus className="h-4 w-4 mr-1" />Add brand</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Category</TableHead><TableHead>Lifetime value</TableHead><TableHead>Collabs</TableHead><TableHead>Avg deal</TableHead><TableHead>Open</TableHead><TableHead>Relationship</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">No brands yet.</TableCell></TableRow>}
            {list.map((b) => {
              const s = stats.get(b.id);
              return (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setOpenId(b.id)}>
                  <TableCell className="font-medium">{b.name}<div className="flex gap-1 mt-1">{(b.tags ?? []).slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div></TableCell>
                  <TableCell>{b.category ?? b.industry ?? "—"}</TableCell>
                  <TableCell>{lakh(s?.ltv ?? 0)}</TableCell>
                  <TableCell>{s?.count ?? 0}</TableCell>
                  <TableCell>{lakh(s?.avg ?? 0)}</TableCell>
                  <TableCell>{s?.open ?? 0}</TableCell>
                  <TableCell><span className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < score(b.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />)}</span></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
      {openId && <BrandSheet id={openId} onClose={() => setOpenId(null)} onSaved={invalidate} brand={(brands.data ?? []).find((b) => b.id === openId)} />}
    </div>
  );
}

type BrandRow = ReturnType<typeof useBrands>["data"] extends (infer T)[] | undefined ? T : never;

function BrandSheet({ id, brand, onClose, onSaved }: { id: string; brand?: BrandRow; onClose: () => void; onSaved: () => void }) {
  const isNew = id === "new";
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of FIELDS) { const v = brand?.[k as keyof BrandRow]; o[k] = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v); }
    return o;
  });
  const contacts = useQuery({
    queryKey: ["creator", "contacts", id], enabled: !isNew,
    queryFn: async () => (await supabase.from("creator_brand_contacts").select("*").eq("brand_id", id).order("created_at")).data ?? [],
  });
  const timeline = useQuery({
    queryKey: ["creator", "brand-activity", id], enabled: !isNew,
    queryFn: async () => (await supabase.from("creator_activities").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const deals = useDeals();
  const [c, setC] = useState({ name: "", role: "Marketing Manager", email: "", phone: "", whatsapp: "", linkedin: "" });

  const arr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    if (!f.name.trim()) return toast.error("Brand name required");
    const row = {
      name: f.name.trim(), company: f.company || null, industry: f.industry || null, website: f.website || null, logo_url: f.logo_url || null,
      location: f.location || null, category: f.category || null, company_size: f.company_size || null,
      marketing_budget: f.marketing_budget ? Number(f.marketing_budget) : null, tags: arr(f.tags),
      preferred_platforms: arr(f.preferred_platforms), preferred_content: arr(f.preferred_content), notes: f.notes || null,
    };
    const { error } = isNew ? await supabase.from("creator_brands").insert(row) : await supabase.from("creator_brands").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Brand saved"); onSaved(); if (isNew) onClose();
  };
  const addContact = async () => {
    if (!c.name.trim()) return;
    const { error } = await supabase.from("creator_brand_contacts").insert({ brand_id: id, ...c, email: c.email || null, phone: c.phone || null, whatsapp: c.whatsapp || null, linkedin: c.linkedin || null });
    if (error) return toast.error(error.message);
    setC({ ...c, name: "", email: "", phone: "", whatsapp: "", linkedin: "" }); contacts.refetch();
  };
  const del = async () => {
    if (!confirm("Delete this brand? Its contacts are removed too.")) return;
    await supabase.from("creator_brands").delete().eq("id", id); onSaved(); onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{isNew ? "New brand" : f.name}</SheetTitle></SheetHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {FIELDS.filter((k) => k !== "notes").map((k) => (
            <div key={k}><Label className="capitalize">{k.replace(/_/g, " ")}{["tags", "preferred_platforms", "preferred_content"].includes(k) ? " (comma separated)" : ""}</Label>
              <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} type={k === "marketing_budget" ? "number" : "text"} /></div>
          ))}
          <div className="col-span-2"><Label>Notes</Label><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 mt-3"><Button onClick={save}>Save</Button>{!isNew && <Button variant="ghost" onClick={del}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>}</div>

        {!isNew && (<>
          <h3 className="font-semibold mt-6 mb-2">Contacts</h3>
          <div className="space-y-2">
            {(contacts.data ?? []).map((x) => (
              <div key={x.id} className="rounded border p-2 text-sm flex items-start gap-2">
                <div className="flex-1"><b>{x.name}</b> <span className="text-muted-foreground">· {x.role}</span>
                  <div className="text-xs text-muted-foreground">{[x.email, x.phone, x.whatsapp && `WA ${x.whatsapp}`, x.linkedin].filter(Boolean).join(" · ")}</div></div>
                <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("creator_brand_contacts").delete().eq("id", x.id); contacts.refetch(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Input placeholder="Name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <Pick label="" value={c.role} onChange={(v) => setC({ ...c, role: v })} options={CONTACT_ROLES} />
            <Input placeholder="Email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
            <Input placeholder="Phone" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
            <Input placeholder="WhatsApp" value={c.whatsapp} onChange={(e) => setC({ ...c, whatsapp: e.target.value })} />
            <Input placeholder="LinkedIn URL" value={c.linkedin} onChange={(e) => setC({ ...c, linkedin: e.target.value })} />
          </div>
          <Button size="sm" className="mt-2" onClick={addContact}><Plus className="h-4 w-4 mr-1" />Add contact</Button>

          <h3 className="font-semibold mt-6 mb-2">Deals</h3>
          {(deals.data ?? []).filter((d) => d.brand_id === id).map((d) => (
            <Link key={d.id} to="/creator/deal/$id" params={{ id: d.id }} className="flex justify-between rounded border p-2 text-sm mb-1 hover:bg-muted/50">
              <span>{d.campaign}</span><span className="text-muted-foreground">{d.stage} · {lakh(Number(d.value))}</span>
            </Link>
          ))}

          <h3 className="font-semibold mt-6 mb-2">Relationship timeline</h3>
          <ol className="border-l ml-2 space-y-2">
            {(timeline.data ?? []).map((a) => (
              <li key={a.id} className="ml-4 text-sm"><span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()} · {a.kind}</span><p className="whitespace-pre-wrap">{a.body}</p></li>
            ))}
            {(timeline.data ?? []).length === 0 && <li className="ml-4 text-sm text-muted-foreground">No activity yet.</li>}
          </ol>
        </>)}
      </SheetContent>
    </Sheet>
  );
}
