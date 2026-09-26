import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WORKSPACE_TEMPLATES, type WorkspaceTemplate } from "./workspace-templates";

export type LibraryRow = {
  id: string; slug: string; based_on: string | null; definition: WorkspaceTemplate;
  status: "draft" | "published"; version: number; published_at: string | null; updated_at: string;
};

const sb = supabase as any;

/** Raw library rows (super admins see drafts too; others only published). */
export function useLibraryRows() {
  return useQuery({
    queryKey: ["template-library"],
    queryFn: async () => {
      const { data, error } = await sb.from("workspace_template_library").select("*").order("slug");
      if (error) throw error;
      return (data ?? []) as LibraryRow[];
    },
  });
}

/** Built-in templates with published library versions layered on top (same slug replaces; new slugs added). */
export function mergeTemplates(rows: LibraryRow[]): WorkspaceTemplate[] {
  const pub = rows.filter((r) => r.status === "published");
  const bySlug = new Map(pub.map((r) => [r.slug, normalise({ ...r.definition, slug: r.slug })]));
  const out = WORKSPACE_TEMPLATES.map((t) => bySlug.get(t.slug) ?? t);
  for (const r of pub) if (!WORKSPACE_TEMPLATES.some((t) => t.slug === r.slug)) out.push(bySlug.get(r.slug)!);
  return out;
}

export function usePublishedTemplates() {
  const q = useLibraryRows();
  return { templates: mergeTemplates(q.data ?? []), isLoading: q.isLoading };
}

/** Fill missing arrays so a partially-edited definition never crashes the UI. */
export function normalise(t: Partial<WorkspaceTemplate>): WorkspaceTemplate {
  const arr = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  return {
    slug: t.slug ?? "custom", name: t.name ?? "Untitled template", positioning: t.positioning ?? "", group: t.group ?? "commerce",
    wave: t.wave === 1 ? 1 : 2, subtypes: arr(t.subtypes).length ? arr(t.subtypes) : ["Standard"],
    recordLabel: t.recordLabel ?? "Customer", recordLabelPlural: t.recordLabelPlural ?? "Customers", partyLabel: t.partyLabel ?? "Customer",
    valueLabel: t.valueLabel ?? "Value", sources: arr(t.sources), stages: arr(t.stages).length ? arr(t.stages) : ["New", "Won"],
    wonStages: arr(t.wonStages), lostStages: arr(t.lostStages), fields: arr(t.fields), dashboard: arr(t.dashboard), modules: arr(t.modules),
    workflows: arr(t.workflows), whatsapp: arr(t.whatsapp), agents: arr(t.agents), reports: arr(t.reports), roles: arr(t.roles), integrations: arr(t.integrations),
  };
}

export type WorkspaceSettings = {
  defaultSource: string;
  staleDays: number;
  pointsPer100: number;
  taxPct: number;
  currency: string;
  businessHours: string;
};
export const DEFAULT_SETTINGS: WorkspaceSettings = { defaultSource: "Walk-in", staleDays: 14, pointsPer100: 1, taxPct: 5, currency: "INR", businessHours: "10:00–22:00" };
