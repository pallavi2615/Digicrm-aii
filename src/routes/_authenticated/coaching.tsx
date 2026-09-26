import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { GraduationCap, Loader2, MessageCircle, Plus, Sparkles, Wand2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/lib/tenants";
import { EduDocs, EduCopilot } from "@/components/edu-portal";
import { EduFranchise } from "@/components/edu-franchise";
import { coachingAi } from "@/lib/coaching.functions";
import { Md } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/coaching")({
  head: () => ({
    meta: [
      { title: "Coaching Institute CRM — admissions, batches, fees | DigiCRM AI" },
      { name: "description", content: "Leads, counselling, demo classes, batches, fees, attendance, tests, at-risk students and AI counsellor for coaching institutes." },
      { property: "og:title", content: "Coaching Institute CRM | DigiCRM AI" },
      { property: "og:description", content: "Run admissions, batches, fees and student success for NEET, JEE, UPSC and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachingCRM,
});

const sb = supabase as any;
const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const STAGES = ["New Lead", "Contacted", "Qualified", "Counselling", "Demo / Trial Class", "Interested", "Application", "Fee Negotiation", "Admission", "Batch Allocation", "Active Student"];
const ADMITTED = ["Admission", "Batch Allocation", "Active Student"];
const SOURCES = ["Website", "Google Ads", "Meta Ads", "Instagram", "YouTube", "WhatsApp", "Walk-in", "Referral", "School seminar", "Education fair", "Telecalling", "SEO", "Counselling camp"];
const DEMO_STATUS = ["Requested", "Scheduled", "Attended", "Missed", "Converted"];
const wa = (phone: string | null | undefined, text: string) => { const d = (phone ?? "").replace(/\D/g, "").slice(-10); return `https://wa.me/${d ? "91" + d : ""}?text=${encodeURIComponent(text)}`; };
type Variant = { title: string; flow: string; labels: Record<string, string>; tabs?: Partial<Record<"demos" | "courses" | "students" | "admissions" | "counsellor", string>> };
export const EDU_VARIANTS: Record<string, Variant> = {
  coaching: { title: "Coaching Institute CRM", flow: "Lead → Counselling → Demo → Admission → Batch → Student", labels: {} },
  school: { title: "School Admissions CRM", flow: "Enquiry → Parent call → Campus visit → Application → Admission → Class allotted", labels: { "New Lead": "Enquiry", Contacted: "Parent contacted", Counselling: "Parent counselling", "Demo / Trial Class": "Campus visit", "Fee Negotiation": "Fee discussion", "Batch Allocation": "Class / section allotted", "Active Student": "Enrolled student" }, tabs: { demos: "Campus visits", courses: "Classes & sections", students: "Students & parents", admissions: "Admissions & documents", counsellor: "AI admission advisor" } },
  education: { title: "College / University CRM", flow: "Enquiry → Counselling → Application → Documents → Admission → Enrolled", labels: { "New Lead": "Enquiry", "Demo / Trial Class": "Campus tour", "Batch Allocation": "Course allotted", "Active Student": "Enrolled" }, tabs: { demos: "Campus tours", courses: "Programs & intakes", students: "Enrolled students", admissions: "Applications & documents", counsellor: "AI admission counsellor" } },
  study_abroad: { title: "Education Consultant CRM", flow: "Enquiry → Profile → Shortlist → Application → Offer → Visa", labels: { "New Lead": "Enquiry", Counselling: "Profile evaluation", "Demo / Trial Class": "University shortlist", Application: "Applications filed", "Fee Negotiation": "Service fee", Admission: "Offer received", "Batch Allocation": "Visa filed", "Active Student": "Visa approved" }, tabs: { demos: "University shortlist", courses: "Countries & programs", students: "Applicants", admissions: "Applications & visa docs", counsellor: "AI profile counsellor" } },
  edtech: { title: "EdTech CRM", flow: "Signup → Trial → Demo call → Paid → Enrolled → Active learner", labels: { "New Lead": "Signup", Counselling: "Demo call", "Demo / Trial Class": "Free trial", Application: "Payment link sent", "Fee Negotiation": "Plan discussion", Admission: "Paid / enrolled", "Batch Allocation": "Cohort / live batch", "Active Student": "Active learner" }, tabs: { demos: "Free trials & live sessions", courses: "Courses & cohorts", students: "Learners & parents", admissions: "Enrollments & KYC", counsellor: "AI learning advisor" } },
  skill_training: { title: "Skill / Training CRM", flow: "Enquiry → Counselling → Demo → Enrolment → Batch → Placement", labels: { "New Lead": "Enquiry", Admission: "Enrolled", "Active Student": "In training" }, tabs: { demos: "Demo sessions", courses: "Programs & batches", students: "Trainees", admissions: "Enrolment & documents", counsellor: "AI career counsellor" } },
};
const VariantCtx = createContext<Variant>(EDU_VARIANTS.coaching!);
const useLbl = () => { const v = useContext(VariantCtx); return (s: string) => v.labels[s] ?? s; };
const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
const addDays = (n: number) => day(new Date(Date.now() + n * 864e5));

function CoachingCRM() {
  const { active, loading } = useActiveTenant();
  const tid = active?.id;
  const { data: wsSlug } = useQuery({ queryKey: ["edu", "ws-slug", tid], enabled: !!tid, queryFn: async () => (await sb.from("tenant_workspaces").select("template_slug").eq("tenant_id", tid).maybeSingle()).data?.template_slug ?? "coaching" });
  const variant = EDU_VARIANTS[wsSlug ?? "coaching"] ?? EDU_VARIANTS.coaching!;
  const qc = useQueryClient();
  const ai = useServerFn(coachingAi);
  const [busy, setBusy] = useState<string | null>(null);
  const [branch, setBranch] = useState("all");

  const t = (table: string, select = "*", order = "created_at") => useQuery({
    queryKey: ["edu", table, tid], enabled: !!tid,
    queryFn: async () => { const { data, error } = await sb.from(table).select(select).eq("tenant_id", tid).order(order, { ascending: false }).limit(5000); if (error) throw error; return data ?? []; },
  }).data ?? [];
  const branches = t("edu_branches", "*", "name");
  const courses = t("edu_courses", "*", "name");
  const batches = t("edu_batches", "*, edu_courses(name)", "name");
  const allStudents = t("edu_students", "*, edu_courses(name), edu_batches(name)");
  const demos = t("edu_demos", "*, edu_students(name, phone)", "scheduled_at");
  const fees = t("edu_fees", "*, edu_students(name, phone, parent_name, parent_phone, branch_id)", "due_date");
  const attendance = t("edu_attendance", "*", "day");
  const tests = t("edu_tests", "*", "test_date");
  const actions = t("edu_actions", "*, edu_students(name, phone, parent_phone)", "priority");
  const refresh = () => qc.invalidateQueries({ queryKey: ["edu"] });
  const run = async (p: PromiseLike<{ error: any }>, ok?: string) => { const { error } = await p; if (error) { toast.error(error.message); return false; } if (ok) toast.success(ok); refresh(); return true; };

  const students = allStudents.filter((s: any) => branch === "all" || s.branch_id === branch);
  const today = day(new Date());
  const monthStart = day(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // ---- Student risk engine ----
  const risk = useMemo(() => {
    const m = new Map<string, string[]>();
    const since14 = addDays(-14);
    for (const s of allStudents.filter((x: any) => ADMITTED.includes(x.stage))) {
      const reasons: string[] = [];
      const att = attendance.filter((a: any) => a.student_id === s.id && a.day >= since14);
      if (att.length >= 3) { const pct = att.filter((a: any) => a.present).length / att.length; if (pct < 0.75) reasons.push(`Attendance ${Math.round(pct * 100)}% (last 14 days)`); }
      const ts = tests.filter((x: any) => x.student_id === s.id).sort((a: any, b: any) => a.test_date.localeCompare(b.test_date));
      if (ts.length >= 2) { const pc = (x: any) => (x.marks / x.max_marks) * 100; const last = pc(ts[ts.length - 1]), prev = pc(ts[ts.length - 2]); if (prev - last >= 10) reasons.push(`Test score fell ${Math.round(prev - last)} points`); if (last < 40) reasons.push(`Latest test ${Math.round(last)}%`); }
      const overdue = fees.filter((f: any) => f.student_id === s.id && f.status !== "Paid" && f.status !== "Waived" && f.due_date < today);
      if (overdue.length) reasons.push(`Fee overdue ${inr(overdue.reduce((a: number, f: any) => a + Number(f.amount) - Number(f.paid_amount), 0))}`);
      if (reasons.length) m.set(s.id, reasons);
    }
    return m;
  }, [allStudents, attendance, tests, fees, today]);

  // ---- Dashboard numbers ----
  const k = useMemo(() => {
    const leads = students.filter((s: any) => !ADMITTED.includes(s.stage));
    const paidFees = fees.filter((f: any) => branch === "all" || f.edu_students?.branch_id === branch);
    const collected = (from: string) => paidFees.filter((f: any) => f.paid_at && day(f.paid_at) >= from).reduce((a: number, f: any) => a + Number(f.paid_amount), 0);
    const pending = paidFees.filter((f: any) => f.status !== "Paid" && f.status !== "Waived");
    const act = students.filter((s: any) => ADMITTED.includes(s.stage));
    const att30 = attendance.filter((a: any) => a.day >= addDays(-30));
    return {
      newLeads: leads.filter((s: any) => s.stage === "New Lead").length,
      todayLeads: students.filter((s: any) => day(s.created_at) === today).length,
      uncontacted: leads.filter((s: any) => s.stage === "New Lead" && !s.last_contacted_at).length,
      hot: leads.filter((s: any) => s.temperature === "Hot").length,
      counselling: students.filter((s: any) => s.stage === "Counselling").length,
      demoBooked: demos.filter((d: any) => d.status === "Scheduled").length,
      demoAttended: demos.filter((d: any) => ["Attended", "Converted"].includes(d.status)).length,
      conversion: students.length ? Math.round((act.length / students.length) * 100) : 0,
      newAdm: act.filter((s: any) => s.admitted_at && day(s.admitted_at) >= monthStart).length,
      pendingAdm: students.filter((s: any) => ["Application", "Fee Negotiation"].includes(s.stage)).length,
      today: collected(today), mtd: collected(monthStart),
      pending: pending.filter((f: any) => f.due_date < today).reduce((a: number, f: any) => a + Number(f.amount) - Number(f.paid_amount), 0),
      upcoming: pending.filter((f: any) => f.due_date >= today).reduce((a: number, f: any) => a + Number(f.amount) - Number(f.paid_amount), 0),
      discount: act.reduce((a: number, s: any) => a + Number(s.discount || 0) + Number(s.scholarship || 0), 0),
      active: students.filter((s: any) => s.stage === "Active Student").length,
      attendance: att30.length ? Math.round((att30.filter((a: any) => a.present).length / att30.length) * 100) : 0,
      atRisk: risk.size,
      dropouts: students.filter((s: any) => s.lost_reason && s.admitted_at).length,
    };
  }, [students, fees, demos, attendance, risk, branch, today, monthStart]);

  const courseAdm = courses.map((c: any) => ({ name: c.name, admissions: students.filter((s: any) => s.course_id === c.id && ADMITTED.includes(s.stage)).length, revenue: students.filter((s: any) => s.course_id === c.id && ADMITTED.includes(s.stage)).reduce((a: number, s: any) => a + Number(s.fee_total || 0) - Number(s.discount || 0) - Number(s.scholarship || 0), 0) }));
  const funnel = STAGES.map((s) => ({ name: (variant.labels[s] ?? s).replace(" / Trial Class", ""), count: students.filter((x: any) => x.stage === s).length }));
  const branchRows = branches.map((b: any) => {
    const ss = allStudents.filter((s: any) => s.branch_id === b.id);
    const coll = fees.filter((f: any) => f.edu_students?.branch_id === b.id && f.paid_at && day(f.paid_at) >= monthStart).reduce((a: number, f: any) => a + Number(f.paid_amount), 0);
    return { ...b, leads: ss.length, adm: ss.filter((s: any) => ADMITTED.includes(s.stage)).length, coll };
  });

  async function generateActions() {
    if (!tid) return;
    setBusy("gen");
    const open = new Set(actions.filter((a: any) => a.status === "Open").map((a: any) => `${a.kind}|${a.student_id}`));
    const rows: any[] = [];
    const add = (kind: string, student_id: string, audience: string, reason: string, priority: number) => { if (!open.has(`${kind}|${student_id}`)) { open.add(`${kind}|${student_id}`); rows.push({ tenant_id: tid, kind, student_id, audience, reason, priority }); } };
    const tomorrow = addDays(1);
    for (const d of demos) {
      if (d.status === "Scheduled" && day(d.scheduled_at) === tomorrow) add("Demo reminder", d.student_id, "Student", `Demo class tomorrow at ${new Date(d.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`, 1);
      if (d.status === "Missed") add("Reschedule demo", d.student_id, "Student", "Missed the demo class — offer a new slot", 1);
      if (d.status === "Attended") add("Post-demo follow-up", d.student_id, "Student", "Attended demo but not admitted yet", 2);
    }
    for (const f of fees) {
      if (f.status === "Paid" || f.status === "Waived") continue;
      const diff = Math.round((new Date(f.due_date).getTime() - new Date(today).getTime()) / 864e5);
      const bal = Number(f.amount) - Number(f.paid_amount);
      if ([7, 3, 0].includes(diff)) add(`Fee reminder (${diff === 0 ? "due today" : diff + " days"})`, f.student_id, "Parent", `${f.label} ${inr(bal)} due ${f.due_date}`, diff === 0 ? 1 : 2);
      if (diff < 0) add("Fee overdue", f.student_id, "Parent", `${f.label} ${inr(bal)} overdue since ${f.due_date}`, 1);
    }
    for (const [sid, reasons] of risk) add("At-risk student", sid, "Parent", reasons.join("; "), 1);
    for (const s of allStudents) {
      if (s.stage === "New Lead" && !s.last_contacted_at && s.temperature === "Hot") add("Call hot lead", s.id, "Student", "Hot lead not contacted yet", 1);
      if (!ADMITTED.includes(s.stage) && !s.lost_reason && new Date(s.updated_at) < new Date(Date.now() - 7 * 864e5)) add("Reactivate lead", s.id, "Student", `No update for 7+ days at ${s.stage}`, 3);
    }
    if (!rows.length) { toast.info("Nothing new to follow up right now."); setBusy(null); return; }
    await run(sb.from("edu_actions").insert(rows), `${rows.length} follow-up actions created`);
    setBusy(null);
  }

  async function seed() {
    if (!tid) return;
    setBusy("seed");
    try {
      const { data: br } = await sb.from("edu_branches").insert([{ tenant_id: tid, name: "Laxmi Nagar", city: "Delhi", monthly_target: 1500000 }, { tenant_id: tid, name: "Sector 18", city: "Noida", monthly_target: 1000000 }]).select();
      const { data: cs } = await sb.from("edu_courses").insert([
        { tenant_id: tid, name: "NEET 2027 Two-Year", exam: "NEET", duration_months: 24, fee: 180000, mode: "Offline", description: "Class 11 + 12 integrated" },
        { tenant_id: tid, name: "JEE Main + Advanced 2027", exam: "JEE", duration_months: 24, fee: 195000, mode: "Offline" },
        { tenant_id: tid, name: "NEET Dropper 2026", exam: "NEET", duration_months: 11, fee: 120000, mode: "Hybrid" },
        { tenant_id: tid, name: "CUET Crash Course", exam: "CUET", duration_months: 3, fee: 25000, mode: "Online" },
      ]).select();
      const { data: bt } = await sb.from("edu_batches").insert([
        { tenant_id: tid, course_id: cs[0].id, branch_id: br[0].id, name: "NEET 2027 | Morning | 8 AM", faculty: "Dr. Mehra", room: "A1", timing: "8:00–11:00", capacity: 40, start_date: addDays(-60) },
        { tenant_id: tid, course_id: cs[1].id, branch_id: br[0].id, name: "JEE 2027 | Evening | 4 PM", faculty: "R. Sharma", room: "B2", timing: "16:00–19:00", capacity: 35, start_date: addDays(-45) },
        { tenant_id: tid, course_id: cs[2].id, branch_id: br[1].id, name: "NEET Dropper | Full day", faculty: "S. Iyer", room: "N1", timing: "9:00–15:00", capacity: 50, start_date: addDays(-90) },
      ]).select();
      const names = ["Avyaan Gupta", "Riya Sharma", "Kabir Singh", "Ananya Verma", "Ishaan Jain", "Saanvi Mishra", "Arjun Yadav", "Diya Kapoor", "Vivaan Arora", "Myra Khanna", "Reyansh Bansal", "Kiara Malhotra", "Aarav Sinha", "Tara Chopra", "Dhruv Rawat", "Nisha Rana"];
      const stages = ["Active Student", "Active Student", "Active Student", "Active Student", "Active Student", "Batch Allocation", "Admission", "Fee Negotiation", "Application", "Interested", "Demo / Trial Class", "Counselling", "Qualified", "Contacted", "New Lead", "New Lead"];
      const rows = names.map((n, i) => {
        const ci = i % 3; const adm = ADMITTED.includes(stages[i]);
        return { tenant_id: tid, name: n, phone: "98" + String(10000000 + i * 7919).slice(0, 8), city: i % 2 ? "Noida" : "Delhi", class_level: ci === 2 ? "Dropper" : "11", school: "DPS", board: "CBSE", exam: cs[ci].exam, target_year: 2027, current_score: 70 + (i % 25), source: SOURCES[i % SOURCES.length], stage: stages[i], temperature: i > 12 ? "Hot" : i % 3 ? "Warm" : "Cold", counsellor: i % 2 ? "Pooja" : "Rahul", branch_id: br[ci === 2 ? 1 : 0].id, course_id: cs[ci].id, batch_id: adm ? bt[ci].id : null, parent_name: "Mr. " + n.split(" ")[1], parent_relation: "Father", parent_phone: "97" + String(20000000 + i * 104729).slice(0, 8), parent_occupation: "Business", fee_total: adm ? cs[ci].fee : 0, discount: adm && i % 2 ? 10000 : 0, scholarship: adm && i === 0 ? 15000 : 0, last_contacted_at: i < 14 ? new Date().toISOString() : null };
      });
      const { data: st } = await sb.from("edu_students").insert(rows).select();
      const adm = st.filter((s: any) => ADMITTED.includes(s.stage));
      const fee: any[] = []; const att: any[] = []; const tst: any[] = [];
      adm.forEach((s: any, i: number) => {
        const net = Number(s.fee_total) - Number(s.discount) - Number(s.scholarship); const inst = Math.round(net / 4);
        [-50, -20, i % 2 ? -3 : 3, 40].forEach((d, j) => fee.push({ tenant_id: tid, student_id: s.id, label: `Instalment ${j + 1}`, amount: inst, due_date: addDays(d), paid_amount: d < -10 || (d < 0 && i % 2 === 0) ? inst : 0, paid_at: d < 0 && (d < -10 || i % 2 === 0) ? new Date(Date.now() + d * 864e5).toISOString() : null, method: "UPI" }));
        for (let d = 1; d <= 14; d++) att.push({ tenant_id: tid, student_id: s.id, batch_id: s.batch_id, day: addDays(-d), present: i === 1 ? d % 3 === 0 : d % 7 !== 0 });
        [-28, -14, -2].forEach((d, j) => tst.push({ tenant_id: tid, student_id: s.id, test_name: `Mock Test ${j + 1}`, subject: "Full syllabus", test_date: addDays(d), marks: i === 2 ? 520 - j * 90 : 480 + j * 30 + i * 5, max_marks: 720, rank: 5 + i + j }));
      });
      await sb.from("edu_fees").insert(fee); await sb.from("edu_attendance").insert(att); await sb.from("edu_tests").insert(tst);
      const lead = st.filter((s: any) => ["Demo / Trial Class", "Interested", "Counselling"].includes(s.stage));
      await sb.from("edu_demos").insert(lead.map((s: any, i: number) => ({ tenant_id: tid, student_id: s.id, batch_id: bt[0].id, scheduled_at: new Date(Date.now() + (i === 0 ? 1 : i === 1 ? -2 : -1) * 864e5).toISOString(), status: i === 0 ? "Scheduled" : i === 1 ? "Attended" : "Missed" })));
      toast.success("Sample institute created"); refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  if (loading) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!tid) return <div className="p-8 text-sm text-muted-foreground">Create or select a workspace first.</div>;

  const Kpi = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</CardContent></Card>
  );

  return (
    <VariantCtx.Provider value={variant}>
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" /><div><h1 className="text-xl font-semibold">{variant.title}</h1><p className="text-xs text-muted-foreground">{active?.name} · {variant.flow}</p></div></div>
        <div className="flex flex-wrap gap-2">
          <Select value={branch} onValueChange={setBranch}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All branches</SelectItem>{branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
          {allStudents.length === 0 && <Button variant="outline" onClick={seed} disabled={busy === "seed"}>{busy === "seed" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Add sample data</Button>}
        </div>
      </div>

      <Tabs defaultValue="dash">
        <TabsList className="flex h-auto flex-wrap">
          {[["dash", "Dashboard"], ["leads", "Leads & pipeline"], ["demos", variant.tabs?.demos ?? "Demo classes"], ["courses", variant.tabs?.courses ?? "Courses & batches"], ["students", variant.tabs?.students ?? "Students"], ["fees", "Fees"], ["franchise", "Franchise / HQ"], ["admissions", variant.tabs?.admissions ?? "Admissions & documents"], ["salescopilot", "Sales copilot"], ["counsellor", variant.tabs?.counsellor ?? "AI counsellor"], ["actions", `Follow-ups (${actions.filter((a: any) => a.status === "Open").length})`], ["campaigns", "Campaigns"], ["copilot", "Command center"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="dash" className="space-y-4">
          <Section title="Leads"><Kpi label="New enquiries" value={k.newLeads} /><Kpi label="Today's leads" value={k.todayLeads} /><Kpi label="Uncontacted" value={k.uncontacted} /><Kpi label="Hot leads" value={k.hot} /><Kpi label="In counselling" value={k.counselling} /><Kpi label="Demo booked" value={k.demoBooked} /><Kpi label="Demo attended" value={k.demoAttended} /><Kpi label="Admission conversion" value={k.conversion + "%"} /></Section>
          <Section title="Admissions & revenue"><Kpi label="New admissions (month)" value={k.newAdm} /><Kpi label="Pending admissions" value={k.pendingAdm} /><Kpi label="Today's collection" value={inr(k.today)} /><Kpi label="MTD collection" value={inr(k.mtd)} /><Kpi label="Overdue fees" value={inr(k.pending)} /><Kpi label="Upcoming fees" value={inr(k.upcoming)} /><Kpi label="Discounts + scholarships" value={inr(k.discount)} /></Section>
          <Section title="Students"><Kpi label="Active students" value={k.active} /><Kpi label="Attendance (30d)" value={k.attendance + "%"} /><Kpi label="At-risk students" value={k.atRisk} /><Kpi label="Dropouts" value={k.dropouts} /></Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Admission funnel</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer><BarChart data={funnel}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={3} /></BarChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Course-wise admissions & revenue</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Admissions</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader><TableBody>{courseAdm.map((c: any) => <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell>{c.admissions}</TableCell><TableCell>{inr(c.revenue)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          </div>
          {branchRows.length > 1 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Branch performance (HQ view)</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>Leads</TableHead><TableHead>Admissions</TableHead><TableHead>Collection (MTD)</TableHead><TableHead>Target</TableHead></TableRow></TableHeader><TableBody>{branchRows.map((b: any) => <TableRow key={b.id}><TableCell>{b.name}, {b.city}</TableCell><TableCell>{b.leads}</TableCell><TableCell>{b.adm}</TableCell><TableCell>{inr(b.coll)}</TableCell><TableCell>{inr(b.monthly_target)} ({b.monthly_target ? Math.round((b.coll / b.monthly_target) * 100) : 0}%)</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
        </TabsContent>

        <TabsContent value="leads"><Leads tid={tid} students={students} courses={courses} batches={batches} branches={branches} run={run} /></TabsContent>
        <TabsContent value="demos"><Demos tid={tid} demos={demos} students={allStudents} batches={batches} run={run} /></TabsContent>
        <TabsContent value="courses"><Courses tid={tid} courses={courses} batches={batches} branches={branches} students={allStudents} run={run} /></TabsContent>
        <TabsContent value="students"><Students tid={tid} students={students.filter((s: any) => ADMITTED.includes(s.stage))} attendance={attendance} tests={tests} risk={risk} run={run} ai={ai} /></TabsContent>
        <TabsContent value="fees"><Fees tid={tid} fees={fees} students={allStudents.filter((s: any) => ADMITTED.includes(s.stage))} run={run} today={today} /></TabsContent>
        <TabsContent value="admissions" className="space-y-3">
          <p className="text-sm text-muted-foreground">Leads in Application or Fee Negotiation. Invite the applicant to the student portal, or verify documents here — the student moves to Admission once all three are verified.</p>
          {allStudents.filter((s: any) => ["Interested", "Application", "Fee Negotiation", "Admission"].includes(s.stage) && s.doc_status !== "Verified").map((s: any) => (
            <div key={s.id}><p className="mb-1 text-sm font-medium">{s.name} · {s.stage}</p><EduDocs student={s} staff onChange={refresh} /></div>))}
          {!allStudents.some((s: any) => ["Interested", "Application", "Fee Negotiation", "Admission"].includes(s.stage) && s.doc_status !== "Verified") && <p className="text-sm text-muted-foreground">No applications waiting for documents.</p>}
        </TabsContent>
        <TabsContent value="franchise">{tid && <EduFranchise tid={tid} branches={branches} students={allStudents} fees={fees} courses={courses} onChange={refresh} />}</TabsContent>
        <TabsContent value="salescopilot">{tid && <EduCopilot tid={tid} students={allStudents} onApplied={refresh} />}</TabsContent>
        <TabsContent value="counsellor"><Counsellor tid={tid} ai={ai} courses={courses} branches={branches} run={run} /></TabsContent>
        <TabsContent value="actions">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><div><CardTitle className="text-sm">AI follow-up engine</CardTitle><CardDescription>Admission Agent scores every new lead, Counsellor Agent books counselling for qualified leads, Fee Agent runs daily. Also: demo reminders, missed demos, fee reminders (7/3/0 days, overdue), at-risk alerts to parents, hot leads and idle leads.</CardDescription></div><div className="flex gap-2"><Button variant="outline" onClick={async () => { const { data, error } = await sb.rpc("edu_run_fee_agent", { _tenant: tid }); if (error) toast.error(error.message); else { toast.success(`Fee Agent created ${data} reminder(s)`); refresh(); } }}>Run Fee Agent</Button><Button onClick={generateActions} disabled={busy === "gen"}>{busy === "gen" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Find follow-ups</Button></div></CardHeader>
            <CardContent className="space-y-2">
              {actions.filter((a: any) => a.status === "Open").map((a: any) => {
                const phone = a.audience === "Parent" ? a.edu_students?.parent_phone : a.edu_students?.phone;
                return (<div key={a.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={a.priority === 1 ? "destructive" : "secondary"}>{a.kind}</Badge>{a.agent && <Badge variant="outline">{a.agent}</Badge>}<span className="text-sm font-medium">{a.edu_students?.name}</span><span className="text-xs text-muted-foreground">→ {a.audience} · {a.reason}</span></div>
                  {a.message && <p className="rounded bg-muted p-2 text-sm">{a.message}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy === a.id} onClick={async () => { setBusy(a.id); try { await ai({ data: { tenantId: tid, mode: "draft_action", id: a.id } }); refresh(); } catch (e: any) { toast.error(e.message); } setBusy(null); }}>{busy === a.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}AI draft</Button>
                    {a.message && <Button size="sm" asChild><a href={wa(phone, a.message)} target="_blank" rel="noreferrer" onClick={() => sb.from("edu_actions").update({ status: "Sent" }).eq("id", a.id).then(refresh)}><MessageCircle className="mr-1 h-3 w-3" />Open in WhatsApp</a></Button>}
                    <Button size="sm" variant="ghost" onClick={() => run(sb.from("edu_actions").update({ status: "Done" }).eq("id", a.id))}>Mark done</Button>
                  </div>
                </div>);
              })}
              {!actions.some((a: any) => a.status === "Open") && <p className="text-sm text-muted-foreground">No open follow-ups. Click “Find follow-ups”.</p>}
            </CardContent></Card>
        </TabsContent>
        <TabsContent value="campaigns"><AiBox tid={tid} ai={ai} mode="campaign" title="AI marketing campaign" placeholder="NEET 2027 campaign for Class 11 students in Delhi NCR — WhatsApp, Meta and Google. Goal: 200 counselling bookings." /></TabsContent>
        <TabsContent value="copilot"><AiBox tid={tid} ai={ai} mode="briefing" title="AI education command center" placeholder="What happened today? (leave empty for a full briefing)" allowEmpty /></TabsContent>
      </Tabs>
    </div>
    </VariantCtx.Provider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div></div>;
}

function Leads({ tid, students, courses, batches, branches, run }: any) {
  const lbl = useLbl();
  const [q, setQ] = useState(""); const [src, setSrc] = useState("all"); const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", phone: "", exam: "", class_level: "", source: "Website", temperature: "Warm", parent_name: "", parent_phone: "", course_id: "", branch_id: "" });
  const list = students.filter((s: any) => (src === "all" || s.source === src) && (!q || `${s.name} ${s.phone} ${s.exam}`.toLowerCase().includes(q.toLowerCase())));
  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const ok = await run(sb.from("edu_students").insert({ tenant_id: tid, ...form, course_id: form.course_id || null, branch_id: form.branch_id || null }), "Lead added");
    if (ok) { setOpen(false); setForm({ ...form, name: "", phone: "", parent_name: "", parent_phone: "" }); }
  };
  const move = (s: any, stage: string) => {
    const patch: any = { stage, last_contacted_at: new Date().toISOString() };
    if (ADMITTED.includes(stage) && !Number(s.fee_total)) { const c = courses.find((c: any) => c.id === s.course_id); if (c) patch.fee_total = c.fee; }
    run(sb.from("edu_students").update(patch).eq("id", s.id), `Moved to ${stage}`);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><Input placeholder="Search name, phone, exam" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <Select value={src} onValueChange={setSrc}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Button onClick={() => setOpen(!open)}><Plus className="mr-1 h-4 w-4" />New lead</Button></div>
      {open && <Card><CardContent className="grid gap-2 p-3 md:grid-cols-4">
        {[["name", "Student name"], ["phone", "Mobile"], ["exam", "Target exam"], ["class_level", "Class"], ["parent_name", "Parent name"], ["parent_phone", "Parent mobile"]].map(([k, l]) => <div key={k}><Label className="text-xs">{l}</Label><Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>)}
        <Pick label="Source" value={form.source} options={SOURCES} onChange={(v: string) => setForm({ ...form, source: v })} />
        <Pick label="Temperature" value={form.temperature} options={["Hot", "Warm", "Cold"]} onChange={(v: string) => setForm({ ...form, temperature: v })} />
        <Pick label="Course" value={form.course_id} options={courses.map((c: any) => [c.id, c.name])} onChange={(v: string) => setForm({ ...form, course_id: v })} />
        <Pick label="Branch" value={form.branch_id} options={branches.map((c: any) => [c.id, c.name])} onChange={(v: string) => setForm({ ...form, branch_id: v })} />
        <div className="flex items-end"><Button onClick={save}>Save lead</Button></div>
      </CardContent></Card>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => { const col = list.filter((s: any) => s.stage === stage); return (
          <div key={stage} className="w-60 shrink-0 rounded-lg bg-muted/40 p-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const s = students.find((x: any) => x.id === e.dataTransfer.getData("id")); if (s && s.stage !== stage) move(s, stage); }}>
            <p className="mb-2 text-xs font-semibold">{lbl(stage)} <span className="text-muted-foreground">({col.length})</span></p>
            <div className="space-y-2">{col.map((s: any) => (
              <div key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", s.id)} className="cursor-grab rounded-md border bg-card p-2 text-xs space-y-1">
                <div className="flex items-center justify-between"><span className="font-medium">{s.name}</span><Badge variant={s.temperature === "Hot" ? "destructive" : "outline"} className="text-[10px]">{s.temperature}</Badge></div>
                <p className="text-muted-foreground">{[s.exam, s.class_level && "Class " + s.class_level, s.source].filter(Boolean).join(" · ")}</p>
                {s.edu_courses?.name && <p>{s.edu_courses.name}</p>}
                {s.stage === "Batch Allocation" && <Select value={s.batch_id ?? ""} onValueChange={(v) => run(sb.from("edu_students").update({ batch_id: v, stage: "Active Student" }).eq("id", s.id), "Batch allocated")}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Allocate batch" /></SelectTrigger><SelectContent>{batches.filter((b: any) => !s.course_id || b.course_id === s.course_id).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>}
                <div className="flex gap-1"><a className="text-primary hover:underline" href={wa(s.phone, `Hi ${s.name}, this is from the admissions team.`)} target="_blank" rel="noreferrer">WhatsApp</a>{s.phone && <a className="text-primary hover:underline" href={`tel:${s.phone}`} onClick={() => sb.from("edu_students").update({ last_contacted_at: new Date().toISOString() }).eq("id", s.id)}>Call</a>}</div>
              </div>))}</div>
          </div>); })}
      </div>
      <p className="text-xs text-muted-foreground">Drag cards between stages. Stage names can be renamed in workspace setup or the Template Builder.</p>
    </div>
  );
}

function Pick({ label, value, options, onChange }: any) {
  return <div><Label className="text-xs">{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{options.map((o: any) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <SelectItem key={v} value={v}>{l}</SelectItem>; })}</SelectContent></Select></div>;
}

function Demos({ tid, demos, students, batches, run }: any) {
  const [f, setF] = useState<any>({ student_id: "", batch_id: "", scheduled_at: "" });
  const counts = DEMO_STATUS.map((s) => ({ s, n: demos.filter((d: any) => d.status === s).length }));
  return (<div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{counts.map((c) => <Card key={c.s}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{c.s}</p><p className="text-xl font-semibold">{c.n}</p></CardContent></Card>)}</div>
    <Card><CardContent className="grid gap-2 p-3 md:grid-cols-4">
      <Pick label="Student" value={f.student_id} options={students.filter((s: any) => !ADMITTED.includes(s.stage)).map((s: any) => [s.id, s.name])} onChange={(v: string) => setF({ ...f, student_id: v })} />
      <Pick label="Batch" value={f.batch_id} options={batches.map((b: any) => [b.id, b.name])} onChange={(v: string) => setF({ ...f, batch_id: v })} />
      <div><Label className="text-xs">Date & time</Label><Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} /></div>
      <div className="flex items-end"><Button onClick={async () => { if (!f.student_id || !f.scheduled_at) return toast.error("Pick a student and time"); if (await run(sb.from("edu_demos").insert({ tenant_id: tid, student_id: f.student_id, batch_id: f.batch_id || null, scheduled_at: new Date(f.scheduled_at).toISOString() }), "Demo scheduled")) await sb.from("edu_students").update({ stage: "Demo / Trial Class" }).eq("id", f.student_id); }}>Schedule demo</Button></div>
    </CardContent></Card>
    <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>When</TableHead><TableHead>Status</TableHead><TableHead>Feedback</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {demos.map((d: any) => <TableRow key={d.id}><TableCell>{d.edu_students?.name}</TableCell><TableCell>{new Date(d.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
        <TableCell><Select value={d.status} onValueChange={async (v) => { await run(sb.from("edu_demos").update({ status: v }).eq("id", d.id)); if (v === "Attended") await sb.from("edu_students").update({ stage: "Interested" }).eq("id", d.student_id); if (v === "Converted") await sb.from("edu_students").update({ stage: "Application" }).eq("id", d.student_id); }}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{DEMO_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></TableCell>
        <TableCell><Input className="h-8" defaultValue={d.feedback ?? ""} onBlur={(e) => e.target.value !== (d.feedback ?? "") && run(sb.from("edu_demos").update({ feedback: e.target.value }).eq("id", d.id))} /></TableCell>
        <TableCell><a className="text-xs text-primary hover:underline" href={wa(d.edu_students?.phone, `Hi ${d.edu_students?.name}, reminder: your demo class is on ${new Date(d.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`)} target="_blank" rel="noreferrer">Remind</a></TableCell></TableRow>)}
    </TableBody></Table>
  </div>);
}

function Courses({ tid, courses, batches, branches, students, run }: any) {
  const [c, setC] = useState<any>({ name: "", exam: "", fee: "", duration_months: "12", mode: "Offline" });
  const [b, setB] = useState<any>({ name: "", course_id: "", branch_id: "", faculty: "", room: "", timing: "", capacity: "40", start_date: "" });
  return (<div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Courses</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid grid-cols-2 gap-2">{[["name", "Course name"], ["exam", "Exam"], ["fee", "Fee (₹)"], ["duration_months", "Months"]].map(([k, l]) => <div key={k}><Label className="text-xs">{l}</Label><Input value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></div>)}
        <Pick label="Mode" value={c.mode} options={["Offline", "Online", "Hybrid"]} onChange={(v: string) => setC({ ...c, mode: v })} />
        <div className="flex items-end"><Button onClick={async () => { if (!c.name) return toast.error("Name required"); if (await run(sb.from("edu_courses").insert({ tenant_id: tid, ...c, fee: Number(c.fee) || 0, duration_months: Number(c.duration_months) || 12 }), "Course added")) setC({ ...c, name: "", fee: "" }); }}>Add course</Button></div></div>
      <Table><TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Fee</TableHead><TableHead>Mode</TableHead><TableHead>Students</TableHead></TableRow></TableHeader><TableBody>{courses.map((x: any) => <TableRow key={x.id}><TableCell>{x.name}<p className="text-xs text-muted-foreground">{x.exam} · {x.duration_months} months</p></TableCell><TableCell>{inr(x.fee)}</TableCell><TableCell>{x.mode}</TableCell><TableCell>{students.filter((s: any) => s.course_id === x.id && ADMITTED.includes(s.stage)).length}</TableCell></TableRow>)}</TableBody></Table>
    </CardContent></Card>
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Batches</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><Label className="text-xs">Batch name</Label><Input placeholder="NEET 2027 | Morning | 8 AM" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></div>
        <Pick label="Course" value={b.course_id} options={courses.map((x: any) => [x.id, x.name])} onChange={(v: string) => setB({ ...b, course_id: v })} />
        <Pick label="Branch" value={b.branch_id} options={branches.map((x: any) => [x.id, x.name])} onChange={(v: string) => setB({ ...b, branch_id: v })} />
        {[["faculty", "Faculty"], ["room", "Room"], ["timing", "Timetable"], ["capacity", "Capacity"]].map(([k, l]) => <div key={k}><Label className="text-xs">{l}</Label><Input value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} /></div>)}
        <div><Label className="text-xs">Start date</Label><Input type="date" value={b.start_date} onChange={(e) => setB({ ...b, start_date: e.target.value })} /></div>
        <div className="flex items-end"><Button onClick={async () => { if (!b.name || !b.course_id) return toast.error("Name and course required"); if (await run(sb.from("edu_batches").insert({ tenant_id: tid, ...b, branch_id: b.branch_id || null, capacity: Number(b.capacity) || 40, start_date: b.start_date || null }), "Batch added")) setB({ ...b, name: "" }); }}>Add batch</Button></div>
      </div>
      <Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Faculty</TableHead><TableHead>Fill</TableHead></TableRow></TableHeader><TableBody>{batches.map((x: any) => { const n = students.filter((s: any) => s.batch_id === x.id).length; return <TableRow key={x.id}><TableCell>{x.name}<p className="text-xs text-muted-foreground">{x.edu_courses?.name} · {x.timing} · Room {x.room}</p></TableCell><TableCell>{x.faculty}</TableCell><TableCell>{n}/{x.capacity}</TableCell></TableRow>; })}</TableBody></Table>
    </CardContent></Card>
    <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Branches</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
      {branches.map((x: any) => <Badge key={x.id} variant="secondary">{x.name}, {x.city}</Badge>)}
      <BranchAdd tid={tid} run={run} />
    </CardContent></Card>
  </div>);
}

function BranchAdd({ tid, run }: any) {
  const [n, setN] = useState(""); const [c, setC] = useState("");
  return <div className="flex gap-2"><Input className="h-8 w-36" placeholder="Branch" value={n} onChange={(e) => setN(e.target.value)} /><Input className="h-8 w-28" placeholder="City" value={c} onChange={(e) => setC(e.target.value)} /><Button size="sm" onClick={async () => { if (n && (await run(sb.from("edu_branches").insert({ tenant_id: tid, name: n, city: c }), "Branch added"))) { setN(""); setC(""); } }}>Add</Button></div>;
}

function Students({ tid, students, attendance, tests, risk, run, ai }: any) {
  const [batch, setBatch] = useState("all"); const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<Record<string, string>>({});
  const [test, setTest] = useState<any>({ student_id: "", test_name: "", subject: "", marks: "", max_marks: "720", rank: "" });
  const batchesUsed = Array.from(new Map(students.filter((s: any) => s.batch_id).map((s: any) => [s.batch_id, s.edu_batches?.name])).entries()) as [string, string][];
  const list = students.filter((s: any) => batch === "all" || s.batch_id === batch);
  const today = day(new Date());
  const markToday = async (s: any, present: boolean) => run(sb.from("edu_attendance").upsert({ tenant_id: tid, student_id: s.id, batch_id: s.batch_id, day: today, present }, { onConflict: "student_id,day" }));
  return (<div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><Select value={batch} onValueChange={setBatch}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All batches</SelectItem>{batchesUsed.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" size="sm" onClick={() => Promise.all(list.map((s: any) => markToday(s, true)))}>Mark all present today</Button></div>
    <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Batch</TableHead><TableHead>Attendance 14d</TableHead><TableHead>Last test</TableHead><TableHead>Today</TableHead><TableHead>Risk</TableHead><TableHead>Parent</TableHead></TableRow></TableHeader><TableBody>
      {list.map((s: any) => {
        const a = attendance.filter((x: any) => x.student_id === s.id && x.day >= addDays(-14)); const pct = a.length ? Math.round((a.filter((x: any) => x.present).length / a.length) * 100) : null;
        const t = tests.filter((x: any) => x.student_id === s.id).sort((a: any, b: any) => b.test_date.localeCompare(a.test_date))[0];
        const td = attendance.find((x: any) => x.student_id === s.id && x.day === today);
        const r = risk.get(s.id);
        return (<TableRow key={s.id}><TableCell className="font-medium">{s.name}<p className="text-xs text-muted-foreground">{s.exam} · {s.phone}</p></TableCell><TableCell className="text-xs">{s.edu_batches?.name ?? "—"}</TableCell>
          <TableCell>{pct == null ? "—" : `${pct}%`}</TableCell><TableCell>{t ? `${t.marks}/${t.max_marks}${t.rank ? " · #" + t.rank : ""}` : "—"}</TableCell>
          <TableCell><div className="flex gap-1"><Button size="sm" variant={td?.present === true ? "default" : "outline"} className="h-7 px-2" onClick={() => markToday(s, true)}>P</Button><Button size="sm" variant={td?.present === false ? "destructive" : "outline"} className="h-7 px-2" onClick={() => markToday(s, false)}>A</Button></div></TableCell>
          <TableCell>{r ? <span className="flex items-start gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3 shrink-0" />{r.join("; ")}</span> : <Badge variant="outline">OK</Badge>}</TableCell>
          <TableCell className="space-y-1">
            <Button size="sm" variant="outline" className="h-7" disabled={busy === s.id} onClick={async () => { setBusy(s.id); try { const res: any = await ai({ data: { tenantId: tid, mode: "parent_update", id: s.id } }); setMsg({ ...msg, [s.id]: res.text }); } catch (e: any) { toast.error(e.message); } setBusy(null); }}>{busy === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "AI update"}</Button>
            {msg[s.id] && <a className="block text-xs text-primary hover:underline" href={wa(s.parent_phone, msg[s.id])} target="_blank" rel="noreferrer">Send to {s.parent_name ?? "parent"}</a>}
          </TableCell></TableRow>);
      })}
    </TableBody></Table>
    {Object.entries(msg).length > 0 && <Card><CardContent className="space-y-2 p-3">{Object.entries(msg).map(([id, m]) => <p key={id} className="rounded bg-muted p-2 text-sm"><b>{students.find((s: any) => s.id === id)?.name}:</b> {m}</p>)}</CardContent></Card>}
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Record test score</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-7">
      <Pick label="Student" value={test.student_id} options={students.map((s: any) => [s.id, s.name])} onChange={(v: string) => setTest({ ...test, student_id: v })} />
      {[["test_name", "Test"], ["subject", "Subject"], ["marks", "Marks"], ["max_marks", "Out of"], ["rank", "Rank"]].map(([k, l]) => <div key={k}><Label className="text-xs">{l}</Label><Input value={test[k]} onChange={(e) => setTest({ ...test, [k]: e.target.value })} /></div>)}
      <div className="flex items-end"><Button onClick={async () => { if (!test.student_id || !test.test_name || test.marks === "") return toast.error("Student, test and marks required"); if (await run(sb.from("edu_tests").insert({ tenant_id: tid, ...test, marks: Number(test.marks), max_marks: Number(test.max_marks) || 100, rank: test.rank ? Number(test.rank) : null }), "Score saved")) setTest({ ...test, marks: "", rank: "" }); }}>Save</Button></div>
    </CardContent></Card>
  </div>);
}

function Fees({ tid, fees, students, run, today }: any) {
  const [f, setF] = useState<any>({ student_id: "", count: "4", first_due: addDays(0) });
  const [filter, setFilter] = useState("open");
  const plan = async () => {
    const s = students.find((x: any) => x.id === f.student_id); if (!s) return toast.error("Pick a student");
    const net = Number(s.fee_total || 0) - Number(s.discount || 0) - Number(s.scholarship || 0); if (net <= 0) return toast.error("Set the student's total fee first");
    const n = Math.max(1, Number(f.count) || 1); const each = Math.round(net / n);
    const rows = Array.from({ length: n }, (_, i) => { const d = new Date(f.first_due); d.setMonth(d.getMonth() + i * 2); return { tenant_id: tid, student_id: s.id, label: `Instalment ${i + 1}`, amount: i === n - 1 ? net - each * (n - 1) : each, due_date: day(d) }; });
    run(sb.from("edu_fees").insert(rows), `${n} instalments created`);
  };
  const list = fees.filter((x: any) => filter === "all" || (filter === "open" ? !["Paid", "Waived"].includes(x.status) : filter === "overdue" ? !["Paid", "Waived"].includes(x.status) && x.due_date < today : x.status === "Paid"));
  return (<div className="space-y-3">
    <Card><CardContent className="grid gap-2 p-3 md:grid-cols-4">
      <Pick label="Student" value={f.student_id} options={students.map((s: any) => [s.id, `${s.name} (${inr(Number(s.fee_total || 0) - Number(s.discount || 0) - Number(s.scholarship || 0))})`])} onChange={(v: string) => setF({ ...f, student_id: v })} />
      <div><Label className="text-xs">Instalments</Label><Input value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></div>
      <div><Label className="text-xs">First due date</Label><Input type="date" value={f.first_due} onChange={(e) => setF({ ...f, first_due: e.target.value })} /></div>
      <div className="flex items-end"><Button onClick={plan}>Create fee plan</Button></div>
    </CardContent></Card>
    <div className="flex gap-2">{["open", "overdue", "paid", "all"].map((x) => <Button key={x} size="sm" variant={filter === x ? "default" : "outline"} onClick={() => setFilter(x)} className="capitalize">{x}</Button>)}</div>
    <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Instalment</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {list.map((x: any) => { const bal = Number(x.amount) - Number(x.paid_amount); const late = x.status !== "Paid" && x.due_date < today; return (
        <TableRow key={x.id}><TableCell>{x.edu_students?.name}</TableCell><TableCell>{x.label}</TableCell><TableCell className={late ? "text-destructive" : ""}>{x.due_date}</TableCell><TableCell>{inr(x.amount)}</TableCell><TableCell>{inr(x.paid_amount)}</TableCell>
          <TableCell><Badge variant={x.status === "Paid" ? "default" : late ? "destructive" : "secondary"}>{late && x.status !== "Paid" ? "Overdue" : x.status}</Badge></TableCell>
          <TableCell className="flex gap-2">{x.status !== "Paid" && <><Button size="sm" className="h-7" onClick={() => { const v = prompt("Amount received (₹)", String(bal)); if (v) run(sb.from("edu_fees").update({ paid_amount: Number(x.paid_amount) + Number(v), method: "Recorded", paid_at: new Date().toISOString() }).eq("id", x.id), "Payment recorded"); }}>Record payment</Button>
            <a className="text-xs text-primary hover:underline self-center" href={wa(x.edu_students?.parent_phone, `Dear ${x.edu_students?.parent_name ?? "parent"}, ${x.label} of ${inr(bal)} for ${x.edu_students?.name} is ${late ? "overdue since" : "due on"} ${x.due_date}. Thank you.`)} target="_blank" rel="noreferrer">Remind</a></>}</TableCell></TableRow>); })}
    </TableBody></Table>
  </div>);
}

function Counsellor({ tid, ai, courses, branches, run }: any) {
  const [chat, setChat] = useState<{ who: "student" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [last, setLast] = useState<any>(null);
  const send = async () => {
    if (!input.trim()) return; const next = [...chat, { who: "student" as const, text: input }]; setChat(next); setInput(""); setBusy(true);
    try { const res: any = await ai({ data: { tenantId: tid, mode: "counsellor", text: next.map((m) => `${m.who === "student" ? "Student" : "Counsellor"}: ${m.text}`).join("\n") } }); setLast(res.result); setChat([...next, { who: "ai", text: res.result.reply }]); } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  const ex = last?.extracted ?? {};
  const recs = (last?.recommended_course_ids ?? []).map((id: string) => courses.find((c: any) => c.id === id)).filter(Boolean);
  const book = async () => {
    if (!ex.name && !ex.phone) return toast.error("Ask for the student's name or mobile first");
    await run(sb.from("edu_students").insert({ tenant_id: tid, name: ex.name || "Website enquiry", phone: ex.phone, city: ex.city, class_level: ex.class_level, exam: ex.exam, target_year: ex.target_year, current_score: ex.current_score, budget: ex.budget, source: "AI counsellor", stage: "Counselling", temperature: "Hot", course_id: recs[0]?.id ?? null, branch_id: branches[0]?.id ?? null, notes: chat.map((m) => `${m.who}: ${m.text}`).join("\n") }), "Lead created and counselling booked");
  };
  return (<div className="grid gap-4 lg:grid-cols-3">
    <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">AI counsellor — try it as a student</CardTitle><CardDescription>Answers only from your configured courses. Try “Mujhe NEET 2027 ke liye coaching chahiye.”</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        <div className="max-h-96 space-y-2 overflow-y-auto">{chat.map((m, i) => <div key={i} className={`rounded-lg p-2 text-sm ${m.who === "student" ? "ml-10 bg-primary/10" : "mr-10 bg-muted"}`}>{m.text}</div>)}{busy && <Loader2 className="h-4 w-4 animate-spin" />}</div>
        <div className="flex gap-2"><Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type as the student…" /><Button onClick={send} disabled={busy}>Send</Button></div>
        {chat.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setChat([]); setLast(null); }}>New conversation</Button>}
      </CardContent></Card>
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Captured details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
      {Object.entries(ex).filter(([, v]) => v != null && v !== "").map(([k, v]) => <p key={k}><span className="text-muted-foreground">{k.replace("_", " ")}:</span> {String(v)}</p>)}
      {last?.missing?.length > 0 && <p className="text-xs text-muted-foreground">Still missing: {last.missing.join(", ")}</p>}
      {recs.length > 0 && <div><p className="text-xs font-medium">Suggested programs</p>{recs.map((c: any) => <p key={c.id}>• {c.name} — {inr(c.fee)}</p>)}</div>}
      {courses.length === 0 && <p className="text-xs text-destructive">Add courses first so the counsellor can recommend them.</p>}
      <Button className="w-full" onClick={book} disabled={!last}>Book counselling (add to CRM)</Button>
    </CardContent></Card>
  </div>);
}

function AiBox({ tid, ai, mode, title, placeholder, allowEmpty }: any) {
  const [text, setText] = useState(""); const [out, setOut] = useState(""); const [busy, setBusy] = useState(false);
  return (<Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="space-y-2">
    <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
    <Button disabled={busy || (!allowEmpty && !text.trim())} onClick={async () => { setBusy(true); try { const r: any = await ai({ data: { tenantId: tid, mode, text } }); setOut(r.text); } catch (e: any) { toast.error(e.message); } setBusy(false); }}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Generate</Button>
    {out && <div className="rounded-lg border p-3 text-sm"><Md text={out} /></div>}
  </CardContent></Card>);
}
