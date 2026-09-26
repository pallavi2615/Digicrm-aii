import { supabase } from "@/integrations/supabase/client";
import { COMMON_MODULES, type WorkspaceTemplate } from "./workspace-templates";

export type ApplyOptions = {
  tenantId: string;
  template: WorkspaceTemplate;
  subtype: string;
  locationMode: "single" | "multi" | "franchise";
  locations: string[];
  description?: string;
  sample?: boolean;
  /** Modules the user left switched on (defaults to all). */
  modules?: string[];
  settings?: Record<string, unknown>;
};

/** Writes pipeline/fields/agents into pack_configs and the rest into tenant_workspaces. */
export async function applyTemplate(o: ApplyOptions) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Please sign in again.");
  const t = o.template;
  const packSlug = `tpl-${t.slug}`;

  const packRow = {
    tenant_id: o.tenantId, group_slug: t.group, pack_slug: packSlug, name: `${t.name} · ${o.subtype}`, tagline: t.positioning,
    description: t.positioning, record_label: t.recordLabel, record_label_plural: t.recordLabelPlural, party_label: t.partyLabel,
    value_label: t.valueLabel, stages: t.stages, won_stages: t.wonStages, lost_stages: t.lostStages, fields: t.fields, agents: t.agents,
    kpi_labels: t.dashboard.map((k) => k.label), verifications: [], is_custom: true, updated_by: uid,
  };
  const { data: existing } = await supabase.from("pack_configs").select("id").eq("tenant_id", o.tenantId).eq("group_slug", t.group).eq("pack_slug", packSlug).maybeSingle();
  const pRes = existing
    ? await supabase.from("pack_configs").update({ ...packRow, archived_at: null } as never).eq("id", existing.id)
    : await supabase.from("pack_configs").insert(packRow as never);
  if (pRes.error) throw pRes.error;

  const { error: wErr } = await supabase.from("tenant_workspaces").upsert({
    tenant_id: o.tenantId, template_slug: t.slug, subtype: o.subtype, location_mode: o.locationMode,
    business_description: o.description ?? null, modules: o.modules ?? [...COMMON_MODULES, ...t.modules], template_config: t, settings: o.settings ?? {}, workflows: t.workflows,
    whatsapp_templates: t.whatsapp, reports: t.reports, roles: t.roles, integrations: t.integrations, dashboard: t.dashboard,
    created_by: uid, updated_at: new Date().toISOString(),
  } as never, { onConflict: "tenant_id" });
  if (wErr) throw wErr;

  await supabase.from("tenants").update({ industry: t.name } as never).eq("id", o.tenantId);

  if (o.locationMode !== "single" && o.locations.length) {
    const { data: have } = await supabase.from("tenant_locations").select("name").eq("tenant_id", o.tenantId);
    const names = new Set((have ?? []).map((x: any) => x.name));
    const rows = o.locations.filter((n) => n.trim() && !names.has(n.trim())).map((n, i) => ({
      tenant_id: o.tenantId, name: n.trim(),
      kind: i === 0 && o.locationMode !== "franchise" ? "Head Office" : o.locationMode === "franchise" && i > 0 ? "Franchise" : i === 0 ? "Head Office" : "Location",
      royalty_pct: o.locationMode === "franchise" && i > 0 ? 6 : 0, marketing_fee_pct: o.locationMode === "franchise" && i > 0 ? 2 : 0,
    }));
    if (rows.length) await supabase.from("tenant_locations").insert(rows as never);
  }

  if (o.sample) await seedSample(o.tenantId, t, packSlug, uid, o.locations);
  return { packSlug };
}

const NAMES = ["Aarav Sharma", "Priya Nair", "Rohan Gupta", "Sneha Iyer", "Vikram Singh", "Ananya Das", "Karan Mehta", "Isha Reddy", "Arjun Rao", "Meera Joshi", "Rahul Verma", "Pooja Patel"];

async function seedSample(tenantId: string, t: WorkspaceTemplate, packSlug: string, uid: string, locations: string[]) {
  const today = Date.now();
  const rows = NAMES.map((name, i) => {
    const stage = t.stages[i % t.stages.length]!;
    const fields: Record<string, unknown> = {};
    for (const fd of t.fields) {
      if (fd.type === "select" && fd.options) fields[fd.key] = fd.options[i % fd.options.length];
      else if (fd.type === "number") fields[fd.key] = (i + 1) * (fd.key.includes("pct") ? 1 : fd.key.includes("points") ? 120 : 3);
      else if (fd.type === "date") fields[fd.key] = new Date(today + ((i % 10) - 3) * 864e5).toISOString().slice(0, 10);
    }
    if (locations.length) fields.location = locations[i % locations.length];
    return {
      tenant_id: tenantId, group_slug: t.group, pack_slug: packSlug, title: name, contact_name: name,
      contact_phone: `98${String(10000000 + i * 7919).slice(0, 8)}`, stage, value: 1500 * (i + 1) * (t.wave === 2 ? 40 : 1),
      source: t.sources[i % t.sources.length], fields, owner_id: uid, created_by: uid, currency: "INR",
      won: t.wonStages.includes(stage) ? true : null,
    };
  });
  const { error } = await supabase.from("pack_records").insert(rows as never);
  if (error) throw error;
}
