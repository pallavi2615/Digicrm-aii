import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Megaphone, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getBrandAccount, saveBrandAccount } from "@/lib/brand.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/brand")({
  head: () => ({
    meta: [
      { title: "Brand Portal | DigiCRM AI" },
      { name: "description", content: "Brands track creator campaigns, approve content, comment and discover creators." },
      { property: "og:title", content: "Brand Portal | DigiCRM AI" },
      { property: "og:description", content: "Track campaigns, approve deliverables and find creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandLayout,
});

export function useBrandAccount() {
  const fn = useServerFn(getBrandAccount);
  return useQuery({ queryKey: ["brand", "account"], queryFn: () => fn() });
}

const tabs = [
  { to: "/brand", label: "My campaigns", icon: Megaphone, exact: true },
  { to: "/brand/marketplace", label: "Find creators", icon: Search },
  { to: "/brand/campaigns", label: "Post a campaign", icon: Megaphone },
] as const;

function BrandLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, isLoading, refetch } = useBrandAccount();
  if (isLoading) return <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!data?.account) return <BrandSetup email={data?.email ?? ""} onDone={() => refetch()} />;
  return (
    <div className="space-y-4">
      <div className="border-b">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground"><Building2 className="h-4 w-4" /></div>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{data.account.company} · Brand Portal</h1>
            <p className="text-xs text-muted-foreground">Signed in as {data.email}</p>
          </div>
        </div>
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => {
            const active = "exact" in t ? pathname === t.to || pathname.startsWith("/brand/campaign/") : pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={cn("flex items-center gap-2 px-3 py-2 text-sm border-b-2",
                active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <t.icon className="h-4 w-4" />{t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

function BrandSetup({ email, onDone }: { email: string; onDone: () => void }) {
  const save = useServerFn(saveBrandAccount);
  const [f, setF] = useState({ company: "", contact_name: "", website: "", category: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await save({ data: f }); toast.success("Brand profile saved"); onDone(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card className="max-w-lg mx-auto mt-8">
      <CardHeader>
        <CardTitle>Set up your brand profile</CardTitle>
        <CardDescription>Campaigns creators share with {email || "your email"} will appear here automatically. You can also find creators and send briefs.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          {([["company", "Brand / company name *"], ["contact_name", "Your name"], ["website", "Website"], ["category", "Category (e.g. Beauty)"]] as const).map(([k, l]) => (
            <div key={k} className="space-y-1"><Label>{l}</Label>
              <Input required={k === "company"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}
