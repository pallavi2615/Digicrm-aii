import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { distAi } from "@/lib/distribution.functions";

export function useDistAi() {
  const fn = useServerFn(distAi);
  const [loading, setLoading] = useState(false);
  const run = async (data: { mode: "briefing" | "copilot" | "parse_order" | "visit_summary" | "sales_agent"; question?: string; message?: string; notes?: string }) => {
    setLoading(true);
    try { return ((await fn({ data } as any)) as any).text as string; }
    catch (e: any) { toast.error(e.message); return null; }
    finally { setLoading(false); }
  };
  return { run, loading };
}

export function parseJson<T>(t: string | null, fb: T): T {
  if (!t) return fb;
  try { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : fb; } catch { return fb; }
}

/** Very small markdown renderer: headings, bullets, bold. */
export function Md({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm">
      {text.split("\n").map((l, i) => {
        const b = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? <b key={j}>{p}</b> : p));
        if (/^#{1,3}\s/.test(l)) return <div key={i} className="font-semibold pt-2">{b(l.replace(/^#+\s/, ""))}</div>;
        if (/^\s*([-*]|\d+\.)\s/.test(l)) return <div key={i} className="pl-3">• {b(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</div>;
        return l.trim() ? <p key={i}>{b(l)}</p> : null;
      })}
    </div>
  );
}

export function AiButton({ loading, onClick, children }: { loading: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button size="sm" onClick={onClick} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}{children}</Button>;
}
