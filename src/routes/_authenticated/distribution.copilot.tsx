import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiButton, Md, useDistAi } from "@/components/dist-ai";

export const Route = createFileRoute("/_authenticated/distribution/copilot")({
  head: () => ({ meta: [{ title: "AI Management Copilot | DigiDistribution AI" }, { name: "description", content: "Ask questions about your distribution network and get answers from live data." }] }),
  component: CopilotPage,
});

const SUGGESTED = ["Which territories are underperforming?", "Which distributors have declining orders?", "Show me dormant retailers.", "What is our projected month-end revenue?", "Which partners have high outstanding?", "Which products are at risk of stock-out?"];

function CopilotPage() {
  const ai = useDistAi();
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const ask = async (question = q) => {
    if (!question.trim()) return;
    const a = await ai.run({ mode: "copilot", question });
    if (a) setLog([{ q: question, a }, ...log]);
    setQ("");
  };
  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ask your distribution data</CardTitle><CardDescription>Answers come only from your own network's orders, partners, stock, collections and targets.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Why did Maharashtra sales decline?" />
          <div className="flex flex-wrap gap-2">{SUGGESTED.map((s) => <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={ai.loading}>{s}</Button>)}</div>
          <AiButton loading={ai.loading} onClick={() => ask()}>Ask</AiButton>
        </CardContent>
      </Card>
      {log.map((l, i) => (
        <Card key={i}><CardContent className="p-4 space-y-2"><div className="font-medium text-sm">{l.q}</div><Md text={l.a} /></CardContent></Card>
      ))}
    </div>
  );
}
