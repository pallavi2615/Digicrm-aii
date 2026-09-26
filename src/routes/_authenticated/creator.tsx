import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, KanbanSquare, Building2, Inbox, Receipt, Users, Sparkles, Clapperboard, BellRing, BarChart3, Megaphone, Wallet, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndustryGuard } from "@/components/industry-guard";
import { CREATOR_GROUP } from "@/lib/creator";

export const Route = createFileRoute("/_authenticated/creator")({
  head: () => ({
    meta: [
      { title: "Creator Brand Deal CRM | DigiCRM AI" },
      { name: "description", content: "Brands, sponsorship pipeline, deliverables, approvals, invoices and AI deal tools for creators and agencies." },
      { property: "og:title", content: "Creator Brand Deal CRM | DigiCRM AI" },
      { property: "og:description", content: "Pitch to paid — the sponsorship CRM for creators and influencer agencies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorLayout,
});

const tabs = [
  { to: "/creator", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/creator/deals", label: "Deals", icon: KanbanSquare },
  { to: "/creator/brands", label: "Brands", icon: Building2 },
  { to: "/creator/inbox", label: "Enquiries", icon: Inbox },
  { to: "/creator/invoices", label: "Invoices & Revenue", icon: Receipt },
  { to: "/creator/income", label: "Income", icon: Wallet },
  { to: "/creator/campaigns", label: "Open Campaigns", icon: Megaphone },
  { to: "/creator/roster", label: "Media Kit & Roster", icon: Users },
  { to: "/creator/reminders", label: "Reminders", icon: BellRing },
  { to: "/creator/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/creator/ai", label: "AI Studio", icon: Sparkles },
  { to: "/creator/team", label: "Team & Approvals", icon: UserCog },
] as const;

function CreatorLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  // Team members invited by email get linked (and given Creator CRM access) on first visit
  useEffect(() => {
    supabase.rpc("creator_claim_invites" as any).then(({ data }) => { if (Number(data) > 0) qc.invalidateQueries(); });
  }, [qc]);
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card/50 backdrop-blur">
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground">
              <Clapperboard className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Creator Brand Deal CRM</h1>
              <p className="text-xs text-muted-foreground">Enquiry · Pitch · Contract · Content · Invoice · Paid · Renewal</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to}
                className={cn("flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap",
                  isActive(t.to, "exact" in t ? t.exact : false) || (t.to === "/creator/deals" && pathname.startsWith("/creator/deal/"))
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground")}>
                <t.icon className="h-4 w-4" />{t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <IndustryGuard group={CREATOR_GROUP}>
          <div className="p-4 md:p-6"><Outlet /></div>
        </IndustryGuard>
      </div>
    </div>
  );
}
