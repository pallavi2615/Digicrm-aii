export function roi(fee: number, t: { reach: number; views: number; engagements: number; clicks: number; conversions: number; revenue: number }) {
  const r = (a: number, b: number) => (b ? a / b : 0);
  return {
    cpm: r(fee, t.reach) * 1000, cpc: r(fee, t.clicks), cpe: r(fee, t.engagements),
    ctr: r(t.clicks, t.views || t.reach) * 100, er: r(t.engagements, t.reach) * 100,
    cvr: r(t.conversions, t.clicks) * 100, roas: r(t.revenue, fee),
  };
}
