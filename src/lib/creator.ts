export const CREATOR_GROUP = "creator-economy";

export const DEAL_STAGES = [
  "New Lead", "Contacted", "Pitch Sent", "Negotiation", "Proposal Sent", "Contract Sent",
  "Contract Signed", "Content in Progress", "Approval", "Published", "Invoice Sent",
  "Payment Pending", "Paid", "Renewal",
] as const;

export const STAGE_PROBABILITY: Record<string, number> = {
  "New Lead": 10, Contacted: 15, "Pitch Sent": 20, Negotiation: 40, "Proposal Sent": 50,
  "Contract Sent": 70, "Contract Signed": 90, "Content in Progress": 95, Approval: 95,
  Published: 100, "Invoice Sent": 100, "Payment Pending": 100, Paid: 100, Renewal: 30,
};

export const BOOKED_STAGES = new Set(["Contract Signed", "Content in Progress", "Approval", "Published", "Invoice Sent", "Payment Pending", "Paid"]);
export const NEGOTIATION_STAGES = new Set(["Pitch Sent", "Negotiation", "Proposal Sent", "Contract Sent"]);

export const PLATFORMS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "Facebook", "X", "Podcast", "Blog", "Multi-platform"];
export const DEAL_TYPES = ["Sponsored post", "Integration", "UGC", "Affiliate", "Ambassador", "Event", "Product review", "Barter"];
export const CONTENT_TYPES = ["Reel", "Post", "Story", "Video", "Integration", "Short", "LinkedIn Post", "Podcast", "Blog", "UGC Video", "Live"];
export const DELIVERABLE_STATUSES = ["Draft", "Submitted", "Revision Required", "Approved", "Published"];
export const INVOICE_STATUSES = ["Draft", "Sent", "Viewed", "Partially Paid", "Paid", "Overdue"];
export const CONTACT_ROLES = ["Marketing Manager", "Influencer Marketing Manager", "PR Manager", "Agency", "Founder", "Procurement", "Finance", "Legal"];
export const ENQUIRY_SOURCES = ["Email", "Website", "Media Kit", "Instagram", "WhatsApp", "LinkedIn", "Contact form", "Marketplace", "Manual"];

export const DELIVERABLE_TONE: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-primary/15 text-primary",
  "Revision Required": "bg-destructive/15 text-destructive",
  Approved: "bg-accent text-accent-foreground",
  Published: "bg-secondary text-secondary-foreground",
};

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const lakh = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : inr(n));

export const invoiceTotal = (i: { amount: number; tax_pct: number }) =>
  Number(i.amount) * (1 + Number(i.tax_pct) / 100);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function isOverdue(i: { status: string; due_date: string | null }) {
  return i.status !== "Paid" && !!i.due_date && i.due_date < todayISO();
}
