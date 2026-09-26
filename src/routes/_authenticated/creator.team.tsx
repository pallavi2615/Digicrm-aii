import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { inr } from "@/lib/creator";

export const Route = createFileRoute("/_authenticated/creator/team")({
  head: () => ({ meta: [{ title: "Team & Approvals | Creator CRM" }, { name: "description", content: "Invite managers, finance and campaign managers and approve contracts and invoices." }] }),
  component: TeamPage,
});

export const TEAM_ROLES = {
  manager: { label: "Manager", perms: ["See every deal", "Edit pricing & send proposals", "Approve contracts", "Approve invoices", "View payments"] },
  finance: { label: "Finance", perms: ["See every deal", "Approve invoices", "Record payments", "View payments"] },
  campaign_manager: { label: "Campaign manager", perms: ["See every deal", "Manage deliverables & approvals", "Send proposals"] },
} as const;
type Role = keyof typeof TEAM_ROLES;

export function useMyTeamRole() {
  return useQuery({
    queryKey: ["creator", "my-team-role"],
    queryFn: async () => {
      const { data } = await supabase.rpc("creator_my_team_role" as any);
      return ((data as any[]) ?? []) as { owner_id: string; role: Role }[];
    },
  });
}

function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const my = useMyTeamRole();
  const members = useQuery({
    queryKey: ["creator", "team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creator_team_members" as any).select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const myRole = my.data?.[0]?.role;
  const isOwnerView = !myRole;
  const canContracts = isOwnerView || myRole === "manager";
  const canInvoices = isOwnerView || myRole === "manager" || myRole === "finance";

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    const { error } = await supabase.from("creator_team_members" as any).insert({ email: e, role });
    if (error) return toast.error(error.message);
    setEmail(""); toast.success("Invited — they get access as soon as they sign in with this email");
    qc.invalidateQueries({ queryKey: ["creator", "team"] });
  };

  const pending = useQuery({
    queryKey: ["creator", "approvals"],
    queryFn: async () => {
      const [c, i] = await Promise.all([
        supabase.from("creator_contracts").select("id, title, status, approved_at, approved_by_name, deal_id, creator_deals(campaign)").order("created_at", { ascending: false }).limit(50),
        supabase.from("creator_invoices").select("id, number, amount, status, approved_at, approved_by_name, deal_id, creator_deals(campaign)").order("created_at", { ascending: false }).limit(50),
      ]);
      return { contracts: (c.data ?? []) as any[], invoices: (i.data ?? []) as any[] };
    },
  });

  const approve = async (table: "creator_contracts" | "creator_invoices", id: string, on: boolean) => {
    const name = (user?.user_metadata as any)?.full_name || user?.email || "Team";
    const { error } = await supabase.from(table).update(on
      ? { approved_by: user?.id, approved_at: new Date().toISOString(), approved_by_name: name } as any
      : { approved_by: null, approved_at: null, approved_by_name: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(on ? "Approved" : "Approval removed");
    qc.invalidateQueries({ queryKey: ["creator"] });
  };

  return (
    <div className="space-y-4">
      {myRole && (
        <Card className="border-primary/40"><CardContent className="p-4 text-sm">
          You're working as <b>{TEAM_ROLES[myRole].label}</b> for this creator: {TEAM_ROLES[myRole].perms.join(" · ")}.
        </CardContent></Card>
      )}

      {isOwnerView && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Team</CardTitle>
            <CardDescription>Invite people by email. They sign up or log in with that email and immediately see your Creator CRM with their role's permissions — no need to share your account.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-xs" placeholder="manager@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TEAM_ROLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={invite}><UserPlus className="h-4 w-4 mr-1" />Invite</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(members.data ?? []).filter((m) => m.owner_id === user?.id).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <Select value={m.role} onValueChange={async (v) => { await supabase.from("creator_team_members" as any).update({ role: v }).eq("id", m.id); members.refetch(); }}>
                        <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(TEAM_ROLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Badge variant={m.status === "Active" ? "default" : "secondary"}>{m.status === "Active" ? "Active" : "Invite pending"}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={async () => { await supabase.from("creator_team_members" as any).delete().eq("id", m.id); members.refetch(); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              {Object.entries(TEAM_ROLES).map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3 text-sm"><div className="font-medium mb-1">{v.label}</div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">{v.perms.map((p) => <li key={p}>✓ {p}</li>)}</ul></div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <ApprovalList title="Contracts" can={canContracts} who="Owner or Manager"
          rows={(pending.data?.contracts ?? []).map((c) => ({ id: c.id, name: c.title, sub: c.creator_deals?.campaign, status: c.status, at: c.approved_at, by: c.approved_by_name }))}
          onToggle={(id, on) => approve("creator_contracts", id, on)} />
        <ApprovalList title="Invoices" can={canInvoices} who="Owner, Manager or Finance"
          rows={(pending.data?.invoices ?? []).map((i) => ({ id: i.id, name: `${i.number} · ${inr(Number(i.amount))}`, sub: i.creator_deals?.campaign, status: i.status, at: i.approved_at, by: i.approved_by_name }))}
          onToggle={(id, on) => approve("creator_invoices", id, on)} />
      </div>
    </div>
  );
}

function ApprovalList({ title, rows, can, who, onToggle }: { title: string; can: boolean; who: string; rows: { id: string; name: string; sub?: string; status: string; at: string | null; by: string | null }[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title} approvals</CardTitle><CardDescription>Can approve: {who}{can ? "" : " — your role can view only"}</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
            <div className="min-w-0"><div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground truncate">{r.sub} · {r.status}{r.at ? ` · approved by ${r.by ?? "—"} on ${new Date(r.at).toLocaleDateString("en-IN")}` : ""}</div></div>
            {r.at
              ? <Button size="sm" variant="ghost" disabled={!can} onClick={() => onToggle(r.id, false)}><X className="h-4 w-4 mr-1" />Undo</Button>
              : <Button size="sm" disabled={!can} onClick={() => onToggle(r.id, true)}><Check className="h-4 w-4 mr-1" />Approve</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
