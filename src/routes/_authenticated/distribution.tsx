import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Network, Package, ShoppingCart, BadgePercent, Wallet, MapPin, Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndustryGuard } from "@/components/industry-guard";
import { DIST_GROUP } from "@/lib/dist-data";

export const Route = createFileRoute("/_authenticated/distribution")({
  head: () => ({
    meta: [
      { title: "DigiDistribution AI | DigiCRM AI" },
      { name: "description", content: "Distributor, dealer and retailer network with orders, schemes, credit, collections, field sales and AI agents." },
      { property: "og:title", content: "DigiDistribution AI | DigiCRM AI" },
      { property: "og:description", content: "Turn your entire distribution network into one AI-powered sales machine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Layout,
});

const tabs = [
  { to: "/distribution", label: "HQ Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/distribution/network", label: "Network", icon: Network },
  { to: "/distribution/orders", label: "Orders", icon: ShoppingCart },
  { to: "/distribution/products", label: "Products & Stock", icon: Package },
  { to: "/distribution/schemes", label: "Schemes & Targets", icon: BadgePercent },
  { to: "/distribution/collections", label: "Credit & Collections", icon: Wallet },
  { to: "/distribution/field", label: "Field Sales & Beats", icon: MapPin },
  { to: "/distribution/loyalty", label: "Loyalty", icon: Gift },
  { to: "/distribution/copilot", label: "AI Copilot", icon: Sparkles },
] as const;

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string, exact?: boolean) => (exact ? pathname === to : pathname.startsWith(to));
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card/50 backdrop-blur px-6 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground"><Network className="h-4 w-4" /></div>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>DigiDistribution AI</h1>
            <p className="text-xs text-muted-foreground">Manufacturer · Super Distributor · Distributor · Dealer · Retailer</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className={cn("flex items-center gap-2 px-3 py-2 text-sm border-b-2 whitespace-nowrap",
              active(t.to, "exact" in t ? t.exact : false) ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="h-4 w-4" />{t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <IndustryGuard group={DIST_GROUP}><div className="p-4 md:p-6"><Outlet /></div></IndustryGuard>
      </div>
    </div>
  );
}
