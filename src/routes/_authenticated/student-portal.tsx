import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EduDocs } from "@/components/edu-portal";

export const Route = createFileRoute("/_authenticated/student-portal")({
  head: () => ({
    meta: [
      { title: "Student Admission Portal | DigiCRM AI" },
      { name: "description", content: "Submit admission documents, see verification status and track your admission stage and fees." },
      { property: "og:title", content: "Student Admission Portal | DigiCRM AI" },
      { property: "og:description", content: "Track your coaching admission, documents and fees in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentPortal,
});

const sb = supabase as any;
const STEPS = ["Application", "Documents", "Verified", "Admission", "Batch Allocation", "Active Student"];

function StudentPortal() {
  const qc = useQueryClient();
  useEffect(() => { sb.rpc("edu_applicant_claim").then(() => qc.invalidateQueries({ queryKey: ["edu-me"] })); }, [qc]);
  const { data: me = [], isLoading } = useQuery({ queryKey: ["edu-me"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    return (await sb.from("edu_students").select("*, edu_courses(name, fee), edu_fees(id, label, amount, paid_amount, due_date, status, reported_amount, reported_reference)").eq("applicant_user_id", u.user?.id ?? "")).data ?? [];
  } });
  const report = async (f: any) => {
    const bal = Number(f.amount) - Number(f.paid_amount || 0);
    const amt = prompt("Amount you paid (₹)", String(bal)); if (!amt) return;
    const ref = prompt("UTR / transaction reference"); if (!ref) return;
    const { error } = await sb.rpc("edu_report_fee_payment", { _fee: f.id, _amount: Number(amt), _ref: ref });
    if (error) alert(error.message); else qc.invalidateQueries({ queryKey: ["edu-me"] });
  };
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!me.length) return <div className="mx-auto max-w-xl p-6"><Card><CardHeader><CardTitle>No application found</CardTitle><CardDescription>Ask your institute to invite this email address, then refresh this page.</CardDescription></CardHeader></Card></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      {me.map((s: any) => {
        const idx = s.doc_status === "Verified" ? Math.max(2, STEPS.indexOf(s.stage)) : s.doc_status === "Pending" ? 0 : 1;
        return (
          <div key={s.id} className="space-y-4">
            <Card><CardHeader><CardTitle>{s.name}</CardTitle><CardDescription>{s.edu_courses?.name ?? s.exam ?? "Admission"} · current stage: <b>{s.stage}</b></CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">{STEPS.map((st, i) => <Badge key={st} variant={i <= idx ? "default" : "outline"}>{i < idx && <Check className="mr-1 h-3 w-3" />}{st}</Badge>)}</CardContent></Card>
            <EduDocs student={s} />
            {s.edu_fees?.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Fees</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
              {s.edu_fees.map((f: any) => { const paid = String(f.status).toLowerCase() === "paid"; return <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"><span>{f.label} · due {new Date(f.due_date).toLocaleDateString("en-IN")}</span><span className="flex items-center gap-2">₹{Number(f.amount).toLocaleString("en-IN")} <Badge variant={paid ? "default" : "secondary"}>{f.status}</Badge>
                {!paid && (f.reported_amount ? <Badge variant="outline">Awaiting approval · {f.reported_reference}</Badge> : <Button size="sm" variant="outline" onClick={() => report(f)}>I've paid</Button>)}</span></div>; })}
            </CardContent></Card>}
          </div>);
      })}
    </div>
  );
}
