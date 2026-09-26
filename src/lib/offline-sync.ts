import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tiny offline layer for the salesperson app.
 * - Data is cached in localStorage so the app still opens and lists work offline.
 * - Every change is applied to the cache immediately and queued; the queue is
 *   pushed to the server when the device is back online (or on "Sync now").
 */
const sb = supabase as any;
const CACHE = "digicrm-m-cache-v1";
const QUEUE = "digicrm-m-queue-v1";

export type Op = { id: string; table: string; kind: "insert" | "update"; values: any; rowId: string; at: string };
export type Cache = { leads: any[]; followups: any[]; visits: any[]; properties: any[]; syncedAt: string | null; userId: string | null };
const empty: Cache = { leads: [], followups: [], visits: [], properties: [], syncedAt: null, userId: null };
const KEY_OF: Record<string, keyof Cache> = { re_clients: "leads", re_followups: "followups", re_site_visits: "visits", re_properties: "properties" };

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };
export const uuid = () => (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function useOfflineCrm() {
  const [cache, setCache] = useState<Cache>(empty);
  const [queue, setQueue] = useState<Op[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setCache(read(CACHE, empty)); setQueue(read(QUEUE, [])); setOnline(navigator.onLine); }, []);

  const saveCache = (c: Cache) => { setCache(c); write(CACHE, c); };
  const saveQueue = (q: Op[]) => { setQueue(q); write(QUEUE, q); };

  const pull = useCallback(async (base: Cache) => {
    const { data: u } = await sb.auth.getUser();
    const [l, f, v, p] = await Promise.all([
      sb.from("re_clients").select("id,full_name,phone,whatsapp,email,source,temperature,ai_score,status,budget_min,budget_max,preferred_city,preferred_location,bhk,requirement,last_contacted_at,created_at").order("created_at", { ascending: false }).limit(500),
      sb.from("re_followups").select("id,client_id,kind,due_at,done,notes").eq("done", false).order("due_at").limit(500),
      sb.from("re_site_visits").select("id,client_id,property_id,project_id,scheduled_at,agent_name,meeting_point,status,checkin_at,checkout_at,lat,lng,interest,feedback").order("scheduled_at", { ascending: false }).limit(300),
      sb.from("re_properties").select("id,title,project_id,tower,floor_no,unit_no,city,location,price,bhk,super_area,carpet_area,facing,possession_date,construction_status,inventory_status").limit(1000),
    ]);
    const err = l.error || f.error || v.error || p.error;
    if (err) throw err;
    return { ...base, leads: l.data, followups: f.data, visits: v.data, properties: p.data, syncedAt: new Date().toISOString(), userId: u.user?.id ?? base.userId };
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true); setError(null);
    let q = read<Op[]>(QUEUE, []);
    try {
      for (const op of [...q]) {
        const res = op.kind === "insert" ? await sb.from(op.table).upsert({ id: op.rowId, ...op.values }) : await sb.from(op.table).update(op.values).eq("id", op.rowId);
        if (res.error) { setError(`${res.error.message} (${op.table})`); if (res.error.code && res.error.code !== "PGRST301") { q = q.filter((x) => x.id !== op.id); saveQueue(q); continue; } break; }
        q = q.filter((x) => x.id !== op.id); saveQueue(q);
      }
      saveCache(await pull(read(CACHE, empty)));
    } catch (e: any) { setError(e.message ?? "Sync failed"); }
    setSyncing(false);
  }, [pull]);

  useEffect(() => {
    const on = () => { setOnline(true); sync(); }; const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    if (navigator.onLine) sync();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sync]);

  /** Apply a change locally and queue it for the server. */
  const mutate = (table: string, kind: Op["kind"], rowId: string, values: any) => {
    const c = read(CACHE, empty); const key = KEY_OF[table];
    if (key && Array.isArray(c[key])) {
      const list = c[key] as any[];
      (c as any)[key] = kind === "insert" ? [{ id: rowId, ...values, _pending: true }, ...list] : list.map((r) => (r.id === rowId ? { ...r, ...values, _pending: true } : r));
      if (table === "re_followups" && values.done) (c as any)[key] = (c as any)[key].filter((r: any) => r.id !== rowId);
    }
    saveCache(c);
    const q = [...read<Op[]>(QUEUE, []), { id: uuid(), table, kind, values, rowId, at: new Date().toISOString() }];
    saveQueue(q);
    if (navigator.onLine) sync();
  };

  return { cache, queue, online, syncing, error, sync, mutate };
}
