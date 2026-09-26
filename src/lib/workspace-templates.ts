/**
 * DigiCRM-AI Industry Template Engine.
 *
 * A workspace template is a complete plug-and-play configuration: pipeline,
 * fields, dashboard, workflows, WhatsApp journeys, AI agents, reports, roles
 * and integrations. Applying one writes a `pack_configs` row (pipeline/fields/
 * agents) plus a `tenant_workspaces` row (everything else) for the tenant.
 */
import type { PackField, PackAgent } from "./industry-packs";

export type KpiMetric =
  | "count" | "new_7d" | "open" | "won" | "won_value" | "conversion" | "avg_value" | "stale"
  | `stage:${string}` | `sum:${string}` | `source:${string}`;
export type KpiDef = { label: string; metric: KpiMetric };

export type WorkflowTrigger = "inactive" | "in_stage" | "date_soon" | "new_record";
export type Workflow = {
  key: string;
  name: string;
  trigger: WorkflowTrigger;
  stage?: string;
  field?: string;
  days?: number;
  template: string; // WhatsApp template key
  action: string;   // human description of the follow-up action
  enabled: boolean;
};
export type WaTemplate = { key: string; name: string; body: string };
export type ReportDef = { key: string; name: string; by: "stage" | "source" | "location" | "month" | `field:${string}` };

export type WorkspaceTemplate = {
  slug: string;
  name: string;
  positioning: string;
  group: string;
  wave: 1 | 2;
  subtypes: string[];
  recordLabel: string;
  recordLabelPlural: string;
  partyLabel: string;
  valueLabel: string;
  sources: string[];
  stages: string[];
  wonStages: string[];
  lostStages: string[];
  fields: PackField[];
  dashboard: KpiDef[];
  modules: string[];
  workflows: Workflow[];
  whatsapp: WaTemplate[];
  agents: PackAgent[];
  reports: ReportDef[];
  roles: string[];
  integrations: string[];
};

const f = (key: string, label: string, type: PackField["type"] = "text", options?: string[]): PackField => ({
  key, label, type, ...(options ? { options } : {}),
});
const wf = (key: string, name: string, trigger: WorkflowTrigger, template: string, action: string, o: Partial<Workflow> = {}): Workflow => ({
  key, name, trigger, template, action, enabled: true, ...o,
});
const wa = (key: string, name: string, body: string): WaTemplate => ({ key, name, body });
const ag = (key: string, label: string, description: string, instruction: string): PackAgent => ({ key, label, description, instruction });
const r = (key: string, name: string, by: ReportDef["by"]): ReportDef => ({ key, name, by });

/** Modules every template ships with. */
export const COMMON_MODULES = [
  "Industry dashboard", "Lead CRM", "Customer 360", "Pipeline", "Appointments & bookings", "Sales & revenue",
  "Payments & billing", "WhatsApp CRM", "Marketing automation", "AI sales agent", "AI follow-up agent",
  "AI support agent", "Retention", "Loyalty & rewards", "Reviews & reputation", "Staff & team",
  "Tasks & workflows", "Reports & analytics", "Multi-location / franchise", "Role-based access", "AI copilot",
];

const SALES_AGENT = (who: string) => ag("sales", "AI Sales Agent", `Qualifies new ${who} enquiries and books the next step`,
  `Qualify the enquiry, capture missing details, suggest the next step and draft a short friendly WhatsApp reply (Hinglish is fine if the customer wrote in Hinglish). Never invent prices or availability not given in the record.`);
const FOLLOW_AGENT = ag("followup", "AI Follow-up Agent", "Writes the right follow-up for where the record is stuck",
  "Look at stage, last update and notes. Write one short follow-up message and the reason it should be sent now.");
const SUPPORT_AGENT = ag("support", "AI Support Agent", "Handles complaints and negative reviews",
  "Classify the issue, write an apologetic resolution message and say whether a manager must be escalated.");

const BASE_REPORTS = [r("stage", "Pipeline by stage", "stage"), r("source", "Lead source performance", "source"), r("location", "Location performance", "location"), r("month", "Revenue by month", "month")];

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    slug: "restaurant", name: "Restaurant CRM", positioning: "AI Restaurant Growth & Customer CRM", group: "commerce", wave: 1,
    subtypes: ["Fine dining", "Casual dining", "QSR / Fast food", "Cafe", "Cloud kitchen", "Bakery", "Bar & lounge", "Catering"],
    recordLabel: "Guest", recordLabelPlural: "Guests", partyLabel: "Customer", valueLabel: "Order value",
    sources: ["Website", "WhatsApp", "Instagram", "Facebook", "Google", "Walk-in", "Events", "Corporate enquiry", "Zomato", "Swiggy"],
    stages: ["New", "Contacted", "Interested", "Reservation", "Visited", "Order", "Repeat"],
    wonStages: ["Order", "Repeat"], lostStages: [],
    fields: [
      f("order_type", "Order type", "select", ["Dine-in", "Takeaway", "Delivery", "Bulk order", "Catering", "Corporate"]),
      f("party_size", "Party size", "number"), f("reservation_at", "Reservation date", "date"), f("table", "Table"),
      f("birthday", "Birthday", "date"), f("anniversary", "Anniversary", "date"),
      f("favourite_dishes", "Favourite dishes"), f("cuisine", "Favourite cuisine"),
      f("loyalty_points", "Loyalty points", "number"), f("rating", "Last review rating", "select", ["5", "4", "3", "2", "1"]),
      f("special_requests", "Special requests", "textarea"),
    ],
    dashboard: [
      { label: "Revenue (orders)", metric: "won_value" }, { label: "Orders", metric: "stage:Order" }, { label: "Repeat customers", metric: "stage:Repeat" },
      { label: "Reservations", metric: "stage:Reservation" }, { label: "New customers (7d)", metric: "new_7d" }, { label: "Avg order value", metric: "avg_value" },
      { label: "Loyalty points issued", metric: "sum:loyalty_points" }, { label: "Needs follow-up", metric: "stale" },
    ],
    modules: ["Table & reservation", "Waitlist & no-show tracking", "Order CRM (dine-in/takeaway/delivery/catering)", "Loyalty, coupons & referral", "Birthday/anniversary offers", "Outlet performance"],
    workflows: [
      wf("winback", "No order in 30 days → win-back offer", "inactive", "winback", "Send 10% comeback offer on WhatsApp", { days: 30 }),
      wf("bday", "Birthday tomorrow → birthday offer", "date_soon", "birthday", "Send birthday dessert offer", { field: "birthday", days: 1 }),
      wf("anniv", "Anniversary in 3 days → couple offer", "date_soon", "anniversary", "Send anniversary dinner offer", { field: "anniversary", days: 3 }),
      wf("resv", "Reservation → confirmation + reminder", "in_stage", "reservation", "Confirm table and remind 2 hours before", { stage: "Reservation" }),
      wf("review", "Visited → review request", "in_stage", "review", "Ask for a Google review", { stage: "Visited" }),
    ],
    whatsapp: [
      wa("reservation", "Reservation confirmation", "Hi {name}! Your table for {party_size} is confirmed on {reservation_at}. See you soon at {business} 🍽️"),
      wa("winback", "Win-back", "Hi {name}, we miss you at {business}! Here's 10% off your next order — valid this week."),
      wa("birthday", "Birthday offer", "Happy birthday {name}! 🎂 Enjoy a complimentary dessert at {business} this week."),
      wa("anniversary", "Anniversary offer", "Happy anniversary {name}! Celebrate with us — a special dinner offer awaits at {business}."),
      wa("review", "Review request", "Thanks for dining with us, {name}! Could you share a quick review? It really helps us."),
    ],
    agents: [
      ag("booking", "AI Restaurant Agent", "Books tables from chat messages", "Read the guest's message (e.g. 'Mujhe 8 logon ke liye Saturday ko table chahiye'), extract party size, date and time, and write a confirmation reply. List anything missing."),
      SALES_AGENT("restaurant"), FOLLOW_AGENT, SUPPORT_AGENT,
    ],
    reports: [...BASE_REPORTS, r("otype", "Revenue by channel (dine-in/delivery…)", "field:order_type"), r("rating", "Review ratings", "field:rating")],
    roles: ["Owner", "Outlet manager", "Captain / host", "Cashier", "Marketing"],
    integrations: ["POS (Petpooja, Posist)", "Zomato / Swiggy", "Google Business Profile", "WhatsApp", "Razorpay"],
  },
  {
    slug: "salon", name: "Salon & Beauty CRM", positioning: "AI Salon & Beauty Business CRM", group: "commerce", wave: 1,
    subtypes: ["Unisex salon", "Beauty parlour", "Spa", "Barbershop", "Nail studio", "Makeup studio", "Skin clinic"],
    recordLabel: "Client", recordLabelPlural: "Clients", partyLabel: "Client", valueLabel: "Bill value",
    sources: ["Walk-in", "WhatsApp", "Instagram", "Google", "Referral", "Website", "Justdial"],
    stages: ["Enquiry", "Consultation", "Appointment", "Service", "Payment", "Follow-up", "Repeat"],
    wonStages: ["Payment", "Follow-up", "Repeat"], lostStages: [],
    fields: [
      f("service", "Service", "select", ["Haircut", "Hair colour", "Hair spa", "Facial", "Cleanup", "Manicure", "Pedicure", "Bridal", "Massage"]),
      f("stylist", "Stylist / therapist"), f("appointment_at", "Appointment", "date"),
      f("membership", "Membership", "select", ["None", "Monthly", "Quarterly", "Annual", "VIP", "Family"]),
      f("membership_expiry", "Membership expiry", "date"), f("package_sessions", "Package sessions left", "number"),
      f("preferences", "Hair / skin preferences", "textarea"), f("loyalty_points", "Loyalty points", "number"),
      f("commission_pct", "Staff commission (%)", "number"),
    ],
    dashboard: [
      { label: "Revenue", metric: "won_value" }, { label: "Today's appointments", metric: "stage:Appointment" }, { label: "New clients (7d)", metric: "new_7d" },
      { label: "Repeat clients", metric: "stage:Repeat" }, { label: "Package sessions left", metric: "sum:package_sessions" }, { label: "Avg bill", metric: "avg_value" },
      { label: "Walk-ins", metric: "source:Walk-in" }, { label: "Due for reactivation", metric: "stale" },
    ],
    modules: ["Appointment book (stylist/chair)", "Memberships", "Packages & session tracking", "Staff commission & targets", "Upsell recommendations", "Product sales"],
    workflows: [
      wf("react60", "No visit in 60 days → reactivation", "inactive", "reactivate", "Send personalised comeback offer", { days: 60 }),
      wf("remind", "Appointment → reminder", "in_stage", "reminder", "Remind client of appointment", { stage: "Appointment" }),
      wf("renew", "Membership expires in 7 days → renewal", "date_soon", "renewal", "Offer renewal with bonus service", { field: "membership_expiry", days: 7 }),
      wf("upsell", "After service → upsell", "in_stage", "upsell", "Recommend treatment/package", { stage: "Follow-up" }),
    ],
    whatsapp: [
      wa("reminder", "Appointment reminder", "Hi {name}, reminder for your {service} appointment on {appointment_at} at {business}. Reply 1 to confirm."),
      wa("reactivate", "Reactivation", "Hi {name}, it's been a while! Book this week and get 15% off any service at {business} 💇"),
      wa("renewal", "Membership renewal", "Hi {name}, your {membership} membership ends on {membership_expiry}. Renew now and get a free hair spa!"),
      wa("upsell", "Upsell", "Loved your {service}, {name}? Our treatment package keeps it looking great — shall we book it?"),
    ],
    agents: [ag("booking", "AI Beauty Agent", "Books appointments from chat", "Read requests like 'Book my facial tomorrow at 5 PM', extract service, date and time and write a confirmation reply."), SALES_AGENT("salon"), FOLLOW_AGENT, SUPPORT_AGENT],
    reports: [...BASE_REPORTS, r("svc", "Revenue by service", "field:service"), r("stylist", "Revenue by stylist", "field:stylist"), r("mem", "Memberships", "field:membership")],
    roles: ["Owner", "Salon manager", "Stylist", "Therapist", "Front desk"],
    integrations: ["WhatsApp", "Google Business Profile", "Razorpay", "Tally"],
  },
  {
    slug: "gym", name: "Gym & Fitness CRM", positioning: "AI Fitness Membership & Sales CRM", group: "commerce", wave: 1,
    subtypes: ["Gym", "CrossFit box", "Yoga studio", "Pilates", "Martial arts", "Dance studio", "Sports academy"],
    recordLabel: "Member", recordLabelPlural: "Members", partyLabel: "Member", valueLabel: "Membership value",
    sources: ["Walk-in", "Website", "Instagram", "Google", "Referral", "Corporate", "WhatsApp"],
    stages: ["Lead", "Trial", "Visit", "Consultation", "Membership", "Active", "Renewal"],
    wonStages: ["Membership", "Active", "Renewal"], lostStages: [],
    fields: [
      f("plan", "Plan", "select", ["Monthly", "Quarterly", "Half-yearly", "Annual", "Couple", "Family", "Corporate"]),
      f("membership_expiry", "Membership expiry", "date"), f("goal", "Fitness goal", "select", ["Weight loss", "Muscle gain", "Fitness", "Rehab", "Sports"]),
      f("trainer", "Trainer"), f("pt_sessions_left", "PT sessions left", "number"), f("last_checkin", "Last check-in", "date"),
      f("attendance_30d", "Visits (30 days)", "number"),
    ],
    dashboard: [
      { label: "Active members", metric: "stage:Active" }, { label: "New members (7d)", metric: "new_7d" }, { label: "Trials", metric: "stage:Trial" },
      { label: "Renewals", metric: "stage:Renewal" }, { label: "Membership revenue", metric: "won_value" }, { label: "Conversion", metric: "conversion" },
      { label: "PT sessions left", metric: "sum:pt_sessions_left" }, { label: "Churn risk", metric: "stale" },
    ],
    modules: ["Membership plans", "Attendance / check-in (QR, biometric)", "Trainer CRM & commission", "PT package tracking", "Churn prediction", "Renewal agent"],
    workflows: [
      wf("r30", "Expiry in 30 days → renewal", "date_soon", "renewal", "Send renewal offer", { field: "membership_expiry", days: 30 }),
      wf("r7", "Expiry in 7 days → final reminder + trainer call", "date_soon", "renewal_final", "Trainer calls member", { field: "membership_expiry", days: 7 }),
      wf("churn", "No check-in for 18 days → churn alert", "date_soon", "missyou", "Notify trainer, send motivation offer", { field: "last_checkin", days: -18 }),
      wf("trial", "Trial → consultation booking", "in_stage", "trial", "Book consultation after trial", { stage: "Trial" }),
    ],
    whatsapp: [
      wa("renewal", "Renewal", "Hi {name}, your {plan} membership ends on {membership_expiry}. Renew this week and get 1 month free PT!"),
      wa("renewal_final", "Final reminder", "Hi {name}, only a few days left on your membership. Don't break the streak 💪 — renew today."),
      wa("missyou", "We miss you", "Hi {name}, we haven't seen you in a while! Your trainer {trainer} has a new plan ready for you."),
      wa("trial", "Trial follow-up", "Hope you enjoyed your trial, {name}! Shall we book a free fitness consultation?"),
    ],
    agents: [ag("renewal", "AI Renewal Agent", "Handles renewal outreach", "Use expiry date, attendance and plan to write a personalised renewal message with the best offer."),
      ag("churn", "AI Churn Predictor", "Scores churn risk", "Using last check-in and attendance, rate churn risk Low/Medium/High with a one-line reason and an action."), SALES_AGENT("gym"), FOLLOW_AGENT],
    reports: [...BASE_REPORTS, r("plan", "Members by plan", "field:plan"), r("trainer", "Trainer performance", "field:trainer"), r("goal", "Members by goal", "field:goal")],
    roles: ["Owner", "Gym manager", "Trainer", "Sales counsellor", "Front desk"],
    integrations: ["Biometric / QR access", "WhatsApp", "Razorpay", "Google Business Profile"],
  },
  ...EDUCATION_TEMPLATES(),
  {
    slug: "healthcare", name: "Healthcare CRM", positioning: "AI Patient Acquisition & Relationship CRM", group: "healthcare", wave: 1,
    subtypes: ["Clinic", "Hospital", "Dental", "Dermatology", "IVF", "Eye care", "Physiotherapy", "Aesthetic clinic"],
    recordLabel: "Patient", recordLabelPlural: "Patients", partyLabel: "Patient", valueLabel: "Treatment value",
    sources: ["Website", "Google", "Practo", "WhatsApp", "Walk-in", "Doctor referral", "Camp", "Instagram"],
    stages: ["Enquiry", "Consultation", "Appointment", "Treatment plan", "Procedure", "Follow-up", "Repeat"],
    wonStages: ["Procedure", "Follow-up", "Repeat"], lostStages: [],
    fields: [
      f("doctor", "Doctor"), f("department", "Department"), f("appointment_at", "Appointment", "date"),
      f("appointment_type", "Type", "select", ["New", "Follow-up", "Procedure", "Teleconsult"]),
      f("treatment", "Treatment"), f("next_followup", "Next follow-up", "date"), f("consent", "Consent on file", "select", ["Yes", "No"]),
      f("rating", "Feedback rating", "select", ["5", "4", "3", "2", "1"]),
    ],
    dashboard: [
      { label: "New enquiries (7d)", metric: "new_7d" }, { label: "Appointments", metric: "stage:Appointment" }, { label: "Treatment plans", metric: "stage:Treatment plan" },
      { label: "Procedures", metric: "stage:Procedure" }, { label: "Revenue", metric: "won_value" }, { label: "Conversion", metric: "conversion" },
      { label: "Follow-ups due", metric: "stage:Follow-up" }, { label: "No-show risk", metric: "stale" },
    ],
    modules: ["Appointment book (doctor/department)", "Treatment pipeline", "AI receptionist", "Follow-up agent", "Review management", "Consent & documents (clinical records stay in your HIS/EMR)"],
    workflows: [
      wf("remind", "Appointment → reminder", "in_stage", "reminder", "Remind patient", { stage: "Appointment" }),
      wf("fu", "Follow-up due in 2 days", "date_soon", "followup", "Book follow-up visit", { field: "next_followup", days: 2 }),
      wf("review", "Treatment done → review request", "in_stage", "review", "Ask for feedback and review", { stage: "Follow-up" }),
      wf("missed", "Enquiry idle 5 days → call back", "inactive", "callback", "Reception calls back", { days: 5 }),
    ],
    whatsapp: [
      wa("reminder", "Appointment reminder", "Hi {name}, your appointment with {doctor} is on {appointment_at} at {business}. Reply 1 to confirm, 2 to reschedule."),
      wa("followup", "Follow-up", "Hi {name}, it's time for your follow-up visit. Shall we book {next_followup}?"),
      wa("review", "Feedback", "Hi {name}, how was your experience at {business}? Please rate us 1–5."),
      wa("callback", "Call back", "Hi {name}, thanks for contacting {business}. Can we call you to book a consultation?"),
    ],
    agents: [ag("receptionist", "AI Receptionist", "Books appointments and answers FAQs", "Handle booking requests, doctor availability, location and pricing questions from the record data only. Never give medical advice; suggest seeing the doctor."), FOLLOW_AGENT, SUPPORT_AGENT],
    reports: [...BASE_REPORTS, r("doc", "Doctor performance", "field:doctor"), r("treat", "Treatment conversion", "field:treatment")],
    roles: ["Medical director", "Clinic manager", "Doctor", "Receptionist", "Billing"],
    integrations: ["HIS / EMR", "Practo", "Google Business Profile", "WhatsApp", "Razorpay"],
  },
  {
    slug: "diagnostics", name: "Diagnostics CRM", positioning: "AI Diagnostic Customer & Referral CRM", group: "healthcare", wave: 1,
    subtypes: ["Pathology lab", "Radiology / imaging", "Home collection", "Corporate wellness", "Multi-centre chain"],
    recordLabel: "Booking", recordLabelPlural: "Bookings", partyLabel: "Patient", valueLabel: "Booking value",
    sources: ["Website", "WhatsApp", "Doctor referral", "Walk-in", "Corporate", "Aggregator", "Google"],
    stages: ["Booking", "Assigned", "Collected", "In lab", "Processing", "Report ready", "Delivered"],
    wonStages: ["Report ready", "Delivered"], lostStages: [],
    fields: [
      f("tests", "Tests / package"), f("collection", "Collection", "select", ["Home", "Walk-in", "Corporate camp"]),
      f("collection_at", "Collection date", "date"), f("phlebotomist", "Phlebotomist"), f("referring_doctor", "Referring doctor"),
      f("corporate", "Corporate account"), f("next_test_due", "Next test due", "date"),
    ],
    dashboard: [
      { label: "Bookings (7d)", metric: "new_7d" }, { label: "Home collections", metric: "source:WhatsApp" }, { label: "In lab", metric: "stage:In lab" },
      { label: "Pending reports", metric: "stage:Processing" }, { label: "Revenue", metric: "won_value" }, { label: "Doctor referrals", metric: "source:Doctor referral" },
      { label: "Avg booking", metric: "avg_value" }, { label: "Stuck bookings", metric: "stale" },
    ],
    modules: ["Home collection tracker", "Doctor referral CRM", "Corporate accounts", "Recurring test reminders", "Package renewals"],
    workflows: [
      wf("ready", "Report ready → share", "in_stage", "report", "Send report link", { stage: "Report ready" }),
      wf("due", "Recurring test due in 7 days", "date_soon", "recurring", "Remind about next test", { field: "next_test_due", days: 7 }),
      wf("assign", "Booking → assign phlebotomist", "in_stage", "booking", "Confirm slot and collector", { stage: "Booking" }),
    ],
    whatsapp: [
      wa("booking", "Booking confirmation", "Hi {name}, your {tests} collection is booked for {collection_at}. Our collector {phlebotomist} will reach you."),
      wa("report", "Report ready", "Hi {name}, your report from {business} is ready. Reply REPORT to receive it."),
      wa("recurring", "Recurring test", "Hi {name}, your {tests} is due soon. Book a home collection today?"),
    ],
    agents: [ag("reminder", "AI Reminder Agent", "Recurring-test and package-renewal reminders", "Write a short renewal/recurring reminder using the record's tests and due date."), SALES_AGENT("diagnostics"), SUPPORT_AGENT],
    reports: [...BASE_REPORTS, r("doc", "Doctor referrals", "field:referring_doctor"), r("corp", "Corporate revenue", "field:corporate"), r("coll", "Collection type", "field:collection")],
    roles: ["Lab head", "Centre manager", "Phlebotomist", "Relationship manager", "Front desk"],
    integrations: ["LIMS", "WhatsApp", "Razorpay", "Google Maps"],
  },
  {
    slug: "retail", name: "Retail CRM", positioning: "AI Retail Customer & Loyalty CRM", group: "commerce", wave: 1,
    subtypes: ["Fashion & apparel", "Footwear", "Electronics", "Jewellery", "Grocery / supermarket", "Furniture", "D2C brand"],
    recordLabel: "Customer", recordLabelPlural: "Customers", partyLabel: "Customer", valueLabel: "Purchase value",
    sources: ["Store", "Website", "WhatsApp", "Instagram", "Marketplace", "Referral"],
    stages: ["Prospect", "First purchase", "Repeat", "Loyal", "VIP", "At risk"],
    wonStages: ["First purchase", "Repeat", "Loyal", "VIP"], lostStages: ["At risk"],
    fields: [
      f("tier", "Loyalty tier", "select", ["Silver", "Gold", "Platinum"]), f("loyalty_points", "Loyalty points", "number"),
      f("categories", "Favourite categories"), f("last_purchase", "Last purchase", "date"), f("birthday", "Birthday", "date"),
      f("store", "Home store"), f("coupon", "Active coupon"),
    ],
    dashboard: [
      { label: "Revenue", metric: "won_value" }, { label: "New customers (7d)", metric: "new_7d" }, { label: "Repeat customers", metric: "stage:Repeat" },
      { label: "VIPs", metric: "stage:VIP" }, { label: "AOV", metric: "avg_value" }, { label: "Loyalty points", metric: "sum:loyalty_points" },
      { label: "At risk", metric: "stage:At risk" }, { label: "No purchase 90d", metric: "stale" },
    ],
    modules: ["Omnichannel customer profile", "Loyalty tiers & points", "Offers (BOGO, first purchase, cart recovery)", "AI product recommendations", "Store performance"],
    workflows: [
      wf("react", "No purchase in 90 days → reactivation", "inactive", "react", "Personalised comeback offer", { days: 90 }),
      wf("bday", "Birthday in 2 days → offer", "date_soon", "birthday", "Birthday coupon", { field: "birthday", days: 2 }),
      wf("xsell", "First purchase → cross-sell", "in_stage", "xsell", "Recommend matching products", { stage: "First purchase" }),
    ],
    whatsapp: [
      wa("react", "Reactivation", "Hi {name}, new arrivals just landed at {business}! Here's 15% off for you this week."),
      wa("birthday", "Birthday", "Happy birthday {name}! 🎁 Enjoy a special gift coupon at {business}."),
      wa("xsell", "Cross-sell", "Hi {name}, customers who loved your last pick also bought these — want to see them?"),
    ],
    agents: [ag("reco", "AI Recommendation Agent", "Suggests next products", "From categories and purchase notes, suggest 3 complementary products and a short message (e.g. running shoes → sports socks, fitness accessories)."), SALES_AGENT("retail"), SUPPORT_AGENT],
    reports: [...BASE_REPORTS, r("tier", "Loyalty tiers", "field:tier"), r("store", "Store performance", "field:store")],
    roles: ["Owner", "Store manager", "Sales associate", "Marketing", "Cashier"],
    integrations: ["POS", "Shopify / WooCommerce", "Marketplaces", "WhatsApp", "Razorpay"],
  },
  // ---------------- Wave 2 ----------------
  wave2("real-estate", "Real Estate CRM", "AI Property Sales & Channel Partner CRM", "property", ["Builder / developer", "Broker", "Channel partner", "Rental / PG"], "Buyer", "Buyers", "Deal value",
    ["Lead", "Qualified", "Site visit", "Negotiation", "Booking", "Agreement", "Payment", "Possession"], ["Booking", "Agreement", "Payment", "Possession"],
    [f("property", "Property / unit"), f("budget", "Budget", "number"), f("site_visit_at", "Site visit", "date"), f("broker", "Broker / channel partner"), f("config", "Configuration", "select", ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Plot", "Commercial"])],
    ["99acres", "MagicBricks", "Housing", "Website", "Channel partner", "Walk-in"], { stage: "Site visit", field: "site_visit_at" }),
  wave2("automobile", "Automobile CRM", "AI Vehicle Sales & Service CRM", "mobility-supply-chain", ["Car dealer", "Two-wheeler dealer", "Used cars", "Commercial vehicles", "EV showroom"], "Customer", "Customers", "Vehicle value",
    ["Lead", "Test drive", "Quotation", "Finance", "Insurance", "Booking", "Delivery", "Service"], ["Booking", "Delivery", "Service"],
    [f("model", "Model"), f("test_drive_at", "Test drive", "date"), f("finance", "Finance", "select", ["Cash", "Loan"]), f("insurance_expiry", "Insurance expiry", "date"), f("service_due", "Next service", "date")],
    ["Walk-in", "Website", "CarDekho", "CarWale", "Referral", "Service"], { stage: "Test drive", field: "insurance_expiry" }),
  wave2("recruitment", "Recruitment CRM", "AI Hiring & Placement CRM", "professional-services", ["Staffing agency", "Executive search", "Campus hiring", "RPO"], "Candidate", "Candidates", "Placement fee",
    ["Sourced", "Screened", "Submitted", "Interview", "Offer", "Joined", "Invoiced"], ["Joined", "Invoiced"],
    [f("job", "Job / role"), f("employer", "Employer"), f("interview_at", "Interview", "date"), f("ctc", "Expected CTC", "number"), f("joining_date", "Joining date", "date")],
    ["Naukri", "LinkedIn", "Referral", "Website", "Job fair"], { stage: "Interview", field: "joining_date" }),
  wave2("travel", "Travel CRM", "AI Travel Enquiry & Booking CRM", "commerce", ["Tour operator", "Travel agent", "Visa consultant", "MICE / corporate travel"], "Traveller", "Travellers", "Package value",
    ["Enquiry", "Itinerary", "Quotation", "Booking", "Visa", "Payment", "Travelled", "Follow-up"], ["Booking", "Payment", "Travelled"],
    [f("destination", "Destination"), f("travel_date", "Travel date", "date"), f("pax", "Travellers", "number"), f("visa_status", "Visa", "select", ["Not needed", "Applied", "Approved", "Rejected"]), f("passport_expiry", "Passport expiry", "date")],
    ["Website", "Instagram", "WhatsApp", "Referral", "Google"], { stage: "Quotation", field: "travel_date" }),
  wave2("construction", "Construction CRM", "AI Project & Contractor CRM", "industrial", ["Contractor", "Interior design", "Architect", "Infra EPC"], "Project", "Projects", "Contract value",
    ["Lead", "Site visit", "Estimate", "Quotation", "Negotiation", "Won", "Execution", "Handover"], ["Won", "Execution", "Handover"],
    [f("site", "Site address"), f("site_visit_at", "Site visit", "date"), f("contractor", "Contractor"), f("milestone", "Current milestone"), f("milestone_due", "Milestone due", "date")],
    ["Website", "Referral", "Architect", "Justdial", "Google"], { stage: "Quotation", field: "milestone_due" }),
  wave2("solar", "Solar CRM", "AI Solar Sales & Installation CRM", "industrial", ["Residential rooftop", "Commercial & industrial", "Solar pumps", "EPC"], "Customer", "Customers", "System value",
    ["Lead", "Site survey", "Roof assessment", "Proposal", "Financing", "Subsidy", "Installation", "Maintenance"], ["Installation", "Maintenance"],
    [f("capacity_kw", "Capacity (kW)", "number"), f("roof_type", "Roof type", "select", ["RCC", "Tin shed", "Ground mount"]), f("survey_at", "Survey date", "date"), f("subsidy_status", "Subsidy", "select", ["Not applied", "Applied", "Approved", "Received"]), f("amc_due", "AMC due", "date")],
    ["Website", "Meta ads", "Referral", "Dealer", "Camp"], { stage: "Proposal", field: "amc_due" }),
  wave2("agency", "Agency CRM", "AI Agency Client & Retainer CRM", "professional-services", ["Digital marketing", "Creative", "Web / software", "PR", "Consulting"], "Client", "Clients", "Retainer value",
    ["Lead", "Discovery", "Proposal", "Negotiation", "Won", "Onboarding", "Active retainer", "Renewal"], ["Won", "Onboarding", "Active retainer", "Renewal"],
    [f("service", "Service"), f("retainer_monthly", "Monthly retainer", "number"), f("project", "Project"), f("renewal_date", "Renewal date", "date"), f("account_manager", "Account manager")],
    ["Website", "LinkedIn", "Referral", "Clutch", "Outbound"], { stage: "Proposal", field: "renewal_date" }),
  wave2("nbfc", "Finance / NBFC CRM", "AI Lending & Collection CRM", "financial-services", ["NBFC", "DSA", "Microfinance", "Co-operative bank", "Gold loan"], "Application", "Applications", "Loan amount",
    ["Lead", "Application", "KYC", "Documents", "Verification", "Underwriting", "Sanction", "Disbursement", "Collection"], ["Disbursement", "Collection"],
    [f("loan_type", "Loan type", "select", ["Personal", "Business", "Home", "LAP", "Gold", "Vehicle"]), f("monthly_income", "Monthly income", "number"), f("cibil", "Bureau score", "number"), f("emi_due", "EMI due", "date"), f("kyc_status", "KYC", "select", ["Pending", "Verified", "Rejected"])],
    ["Website", "DSA", "Branch", "Meta ads", "Referral"], { stage: "Documents", field: "emi_due" }),
];

function wave2(
  slug: string, name: string, positioning: string, group: string, subtypes: string[], recordLabel: string, recordLabelPlural: string, valueLabel: string,
  stages: string[], wonStages: string[], fields: PackField[], sources: string[], hooks: { stage: string; field: string },
): WorkspaceTemplate {
  return {
    slug, name, positioning, group, wave: 2, subtypes, recordLabel, recordLabelPlural, partyLabel: recordLabel, valueLabel, sources, stages, wonStages, lostStages: [], fields,
    dashboard: [
      { label: `New ${recordLabelPlural.toLowerCase()} (7d)`, metric: "new_7d" }, { label: "Open pipeline", metric: "open" }, { label: hooks.stage, metric: `stage:${hooks.stage}` },
      { label: "Won", metric: "won" }, { label: "Revenue", metric: "won_value" }, { label: "Conversion", metric: "conversion" }, { label: "Avg value", metric: "avg_value" }, { label: "Needs follow-up", metric: "stale" },
    ],
    modules: [`${name} pipeline`, ...stages.slice(1, 5).map((s) => `${s} tracking`)],
    workflows: [
      wf("new", `New ${recordLabel.toLowerCase()} → instant reply`, "new_record", "welcome", "Reply within 30 seconds"),
      wf("stage", `${hooks.stage} → reminder`, "in_stage", "stage", `Remind about ${hooks.stage.toLowerCase()}`, { stage: hooks.stage }),
      wf("date", `${fields.find((x) => x.key === hooks.field)?.label ?? "Date"} in 7 days → reminder`, "date_soon", "date", "Send reminder", { field: hooks.field, days: 7 }),
      wf("idle", "Idle 7 days → follow-up", "inactive", "followup", "Follow-up message", { days: 7 }),
    ],
    whatsapp: [
      wa("welcome", "Welcome", `Hi {name}, thanks for reaching {business}! Our team will help you right away.`),
      wa("stage", hooks.stage, `Hi {name}, a quick reminder about your ${hooks.stage.toLowerCase()} with {business}.`),
      wa("date", "Date reminder", `Hi {name}, just a heads-up from {business} — your date is coming up on {${hooks.field}}.`),
      wa("followup", "Follow-up", `Hi {name}, following up from {business}. Any questions we can help with?`),
    ],
    agents: [SALES_AGENT(name.replace(" CRM", "").toLowerCase()), FOLLOW_AGENT, SUPPORT_AGENT],
    reports: [...BASE_REPORTS, ...fields.filter((x) => x.type === "select").map((x) => r(x.key, `By ${x.label.toLowerCase()}`, `field:${x.key}` as const))],
    roles: ["Owner", "Manager", "Sales executive", "Operations", "Accounts"],
    integrations: ["WhatsApp", "Meta Lead Ads", "Google Sheets", "Razorpay"],
  };
}

export function getTemplate(slug: string | null | undefined) {
  return WORKSPACE_TEMPLATES.find((t) => t.slug === slug);
}

/** Fill {placeholders} from a record for a WhatsApp message. */
export function fillTemplate(body: string, rec: { contact_name?: string | null; title?: string; fields?: Record<string, unknown> | null }, business: string) {
  return body.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === "name") return rec.contact_name || rec.title || "there";
    if (k === "business") return business;
    const v = rec.fields?.[k];
    return v == null || v === "" ? "" : String(v);
  });
}

export const LOCATION_MODES = [
  { key: "single", label: "Single location", desc: "Business → Team → Customers" },
  { key: "multi", label: "Multi-location", desc: "Head office → Locations → Teams → Customers" },
  { key: "franchise", label: "Franchise", desc: "Brand → Franchisees → Locations → Teams, with royalty" },
] as const;

/** Education CRM Suite — six specialised workspaces sharing one engine. */
function EDUCATION_TEMPLATES(): WorkspaceTemplate[] {
  const EDU_ROLES = ["Director", "Admission head", "Counsellor", "Accounts", "Faculty", "Branch manager"];
  const EDU_INT = ["Meta Lead Ads", "Google Ads", "Google Sheets", "WhatsApp", "Razorpay", "DigiVerify (documents)"];
  const COUNSELLOR = (what: string) => ag("counsellor", "AI Counsellor", `Answers ${what} questions and books counselling`,
    `From messages like "Mujhe NEET 2027 ke liye coaching chahiye", ask only for missing details (class, marks, target exam, city, online/offline, budget, batch timing), recommend up to three programs from the configured courses only and propose a counselling slot. Never invent fees, results or guarantees.`);
  const ADMISSION = ag("admission", "AI Admission Agent", "Captures and qualifies enquiries", "Qualify the enquiry (hot/warm/cold), fill missing fields and suggest the next pipeline step with a one-line reason.");
  const DOCS = ag("documents", "AI Document Agent", "Tracks missing documents", "List the documents still missing for this record, flag inconsistencies between fields, and draft a polite checklist reminder.");
  const FEE = ag("fee", "AI Fee Agent", "Fee reminders", "Write a respectful fee reminder to the parent/student with amount and due date from the record. Offer to share instalment options, never threaten.");
  const SUCCESS = ag("success", "AI Student Success Agent", "Flags engagement and performance risk", "Using attendance, test scores, assignments and fee status in the record, say if the student is at risk, list the reasons and suggest who (parent, counsellor, faculty) should be informed per institute policy.");
  const MKT = ag("marketing", "AI Marketing Agent", "Creates campaigns", "Given an audience and goal, write campaign copy, 3 WhatsApp messages, a follow-up sequence, landing page headline and a short call script.");
  const MGMT = ag("copilot", "AI Management Copilot", "Explains business performance", "Summarise admissions, applications, revenue and pending fees, list what needs attention and 3-5 suggested actions. Only use numbers provided.");
  const PARENT = [f("parent_name", "Parent name"), f("parent_relation", "Relationship", "select", ["Father", "Mother", "Guardian"]), f("parent_phone", "Parent phone"), f("parent_occupation", "Parent occupation")];
  const FEES = [f("fee_total", "Total fee", "number"), f("fee_paid", "Fee paid", "number"), f("fee_due_date", "Next fee due", "date")];
  const common = (t: Omit<WorkspaceTemplate, "group" | "wave" | "roles" | "integrations" | "partyLabel"> & Partial<WorkspaceTemplate>): WorkspaceTemplate => ({
    group: "education", wave: 1, partyLabel: t.recordLabel, roles: EDU_ROLES, integrations: EDU_INT, ...t,
  });
  const feeFlow = [
    wf("fee7", "Fee due in 7 days → reminder", "date_soon", "fee", "Early fee reminder to parent", { field: "fee_due_date", days: 7 }),
    wf("fee3", "Fee due in 3 days → reminder", "date_soon", "fee", "Fee reminder to parent", { field: "fee_due_date", days: 3 }),
  ];
  const feeWa = wa("fee", "Fee reminder", "Dear parent, the fee instalment for {name} is due on {fee_due_date}. You can pay online or at the centre. Thank you — {business}");

  return [
    common({
      slug: "coaching", name: "Coaching Institute CRM", positioning: "AI Admission, Batch & Student Success CRM for coaching",
      subtypes: ["NEET", "JEE", "UPSC", "SSC / Banking", "CUET", "CAT / CLAT", "CA / CMA / CS", "IELTS / PTE / GRE / GMAT", "Coding / skill", "Local tuition"],
      recordLabel: "Student", recordLabelPlural: "Students", valueLabel: "Fee",
      sources: ["Website", "Google Ads", "Meta Ads", "Instagram", "YouTube", "WhatsApp", "Walk-in", "Referral", "School seminar", "Education fair", "Telecalling", "SEO", "Counselling camp"],
      stages: ["New Lead", "Contacted", "Qualified", "Counselling", "Demo / Trial Class", "Interested", "Application", "Fee Negotiation", "Admission", "Batch Allocation", "Active Student"],
      wonStages: ["Admission", "Batch Allocation", "Active Student"], lostStages: [],
      fields: [f("class_level", "Class", "select", ["9", "10", "11", "12", "Dropper", "Graduate", "Working"]), f("school", "School"), f("board", "Board", "select", ["CBSE", "ICSE", "State", "IB"]), f("exam", "Target exam"), f("target_year", "Target year", "number"), f("current_score", "Current score (%)", "number"), f("course", "Preferred course"), f("branch", "Preferred branch"), f("mode", "Mode", "select", ["Offline", "Online", "Hybrid"]), f("batch", "Batch"), f("demo_date", "Demo class date", "date"), f("budget", "Budget", "number"), ...PARENT, ...FEES],
      dashboard: [{ label: "Leads (7d)", metric: "new_7d" }, { label: "Counselling", metric: "stage:Counselling" }, { label: "Demo booked", metric: "stage:Demo / Trial Class" }, { label: "Admissions", metric: "won" }, { label: "Fee revenue", metric: "won_value" }, { label: "Collected", metric: "sum:fee_paid" }, { label: "Conversion", metric: "conversion" }, { label: "Uncontacted / stale", metric: "stale" }],
      modules: ["Course management", "Batch management", "Demo / trial classes", "Fee instalments & reminders", "Attendance", "Tests & performance", "AI student risk", "Parent CRM", "Branch / franchise", "AI counsellor"],
      workflows: [
        wf("new", "New enquiry → instant reply", "new_record", "welcome", "Reply within 5 minutes and book counselling"),
        wf("demo", "Demo tomorrow → reminder", "date_soon", "demo", "WhatsApp demo reminder", { field: "demo_date", days: 1 }),
        wf("demofu", "Demo done, no admission → follow-up", "in_stage", "demo_fu", "Post-demo follow-up sequence", { stage: "Interested" }),
        ...feeFlow,
        wf("idle", "Lead idle 7 days → reactivation", "inactive", "react", "Reactivation message", { days: 7 }),
      ],
      whatsapp: [
        wa("welcome", "Welcome", "Hi {name}, thanks for your interest in {exam} coaching at {business}! When can our counsellor call you for a free guidance session?"),
        wa("demo", "Demo reminder", "Hi {name}, reminder: your free demo class at {business} is on {demo_date}. Please reach 10 minutes early."),
        wa("demo_fu", "Post-demo", "Hi {name}, hope you enjoyed the demo! Seats in the {batch} batch are filling — shall we reserve yours?"),
        feeWa,
        wa("react", "Reactivation", "Hi {name}, new {exam} batches start soon at {business}. Want a free counselling call this week?"),
      ],
      agents: [COUNSELLOR("course and batch"), ADMISSION, FEE, SUCCESS, FOLLOW_AGENT, MKT, MGMT],
      reports: [...BASE_REPORTS, r("course", "Course-wise admissions", "field:course"), r("exam", "Exam-wise leads", "field:exam"), r("batch", "Batch-wise admissions", "field:batch")],
    }),
    common({
      slug: "education", name: "College / University CRM", positioning: "AI Admission & Student Lifecycle CRM for colleges and universities",
      subtypes: ["Private college", "University", "Engineering", "Management", "Medical / nursing", "Law", "Arts & science"],
      recordLabel: "Applicant", recordLabelPlural: "Applicants", valueLabel: "Fee",
      sources: ["Website", "Education portals", "Google", "Meta", "Events", "School partnership", "Agents", "Education fair", "Referral", "Direct"],
      stages: ["Enquiry", "Counselling", "Application Started", "Submitted", "Under Review", "Shortlisted", "Offer", "Accepted", "Enrolled"],
      wonStages: ["Accepted", "Enrolled"], lostStages: [],
      fields: [f("program", "Program"), f("department", "Department"), f("intake", "Intake"), f("score_pct", "12th / UG score (%)", "number"), f("entrance_score", "Entrance score", "number"), f("interview_date", "Interview date", "date"), f("scholarship", "Scholarship", "select", ["None", "Merit", "Sports", "Need-based", "Girl student", "International"]), f("hostel", "Hostel", "select", ["Yes", "No"]), f("counsellor", "Counsellor"), ...PARENT, ...FEES],
      dashboard: [{ label: "Enquiries (7d)", metric: "new_7d" }, { label: "Submitted", metric: "stage:Submitted" }, { label: "Offers", metric: "stage:Offer" }, { label: "Confirmed", metric: "won" }, { label: "Fee revenue", metric: "won_value" }, { label: "Collected", metric: "sum:fee_paid" }, { label: "Conversion", metric: "conversion" }, { label: "Stale applicants", metric: "stale" }],
      modules: ["Program & seat management", "Application management", "Entrance / merit", "Scholarship CRM", "Fee management", "Student lifecycle", "Placement CRM", "Alumni CRM", "AI admission agent"],
      workflows: [
        wf("inc", "Application incomplete → reminder", "in_stage", "app_reminder", "Day 1 WhatsApp, day 3 counsellor task", { stage: "Application Started" }),
        wf("int", "Interview in 2 days → reminder", "date_soon", "interview", "Interview reminder", { field: "interview_date", days: 2 }),
        wf("offer", "Offer pending → acceptance nudge", "in_stage", "offer", "Offer acceptance follow-up", { stage: "Offer" }),
        ...feeFlow,
      ],
      whatsapp: [
        wa("app_reminder", "Application reminder", "Hi {name}, your application for {program} at {business} is almost done — complete it today to keep your seat."),
        wa("interview", "Interview", "Hi {name}, your admission interview for {program} is on {interview_date}. Please carry your documents."),
        wa("offer", "Offer", "Congratulations {name}! Your offer for {program} is ready. Confirm your seat before the deadline."),
        feeWa,
      ],
      agents: [ag("counsellor", "AI Admission Agent", "Answers fee, eligibility and deadline questions", "Answer questions like 'Can I apply with 72%?' only from configured program data; if unsure, offer a counsellor call and capture the lead."), ag("copilot_call", "AI Counsellor Copilot", "Call prep and notes", "Summarise the applicant, past interactions, objections and the best next action; after a call turn notes into a summary + next step."), DOCS, FEE, ag("placement", "AI Placement Agent", "Matches eligible students to jobs", "Match eligible students to configured job openings by course, score and location. Explain eligibility."), FOLLOW_AGENT, MKT, MGMT],
      reports: [...BASE_REPORTS, r("program", "Program demand", "field:program"), r("couns", "Counsellor conversion", "field:counsellor"), r("sch", "Scholarships", "field:scholarship")],
    }),
    common({
      slug: "study_abroad", name: "Education Consultant CRM", positioning: "AI Study Abroad & Admission Consulting CRM",
      subtypes: ["Study abroad", "Immigration-linked education", "College admission consultant", "Career counsellor", "Overseas agency"],
      recordLabel: "Applicant", recordLabelPlural: "Applicants", valueLabel: "Service fee",
      sources: ["Website", "Meta Ads", "Google Ads", "Instagram", "Education fair", "Sub-agent", "Referral", "Walk-in", "Seminar"],
      stages: ["Lead", "Initial Counselling", "Profile Assessment", "Shortlisting", "University Selection", "Application", "Documents", "Submitted", "Offer", "Deposit", "Visa", "Enrollment"],
      wonStages: ["Visa", "Enrollment"], lostStages: [],
      fields: [f("dob", "Date of birth", "date"), f("highest_qual", "Highest qualification"), f("gpa", "GPA / %", "number"), f("test", "Test", "select", ["IELTS", "TOEFL", "PTE", "GRE", "GMAT", "SAT", "None"]), f("test_score", "Test score", "number"), f("country", "Preferred country", "select", ["UK", "USA", "Canada", "Australia", "Germany", "Ireland", "New Zealand", "Other"]), f("course", "Course"), f("university", "University"), f("intake", "Intake"), f("budget", "Budget (₹)", "number"), f("app_deadline", "Application deadline", "date"), f("deposit_deadline", "Deposit deadline", "date"), f("visa_date", "Visa appointment", "date"), f("commission", "Expected commission", "number"), f("sub_agent", "Sub-agent")],
      dashboard: [{ label: "Leads (7d)", metric: "new_7d" }, { label: "Applications", metric: "stage:Application" }, { label: "Submitted", metric: "stage:Submitted" }, { label: "Offers", metric: "stage:Offer" }, { label: "Visas / enrolled", metric: "won" }, { label: "Service revenue", metric: "won_value" }, { label: "Expected commission", metric: "sum:commission" }, { label: "Stale files", metric: "stale" }],
      modules: ["Applicant 360", "AI university matching", "Document checklist", "Deadline engine", "University partner CRM", "Commission tracking", "Sub-agent management", "Visa tracking"],
      workflows: [
        wf("dl", "Application deadline in 7 days", "date_soon", "deadline", "Deadline reminder + counsellor task", { field: "app_deadline", days: 7 }),
        wf("dep", "Deposit deadline in 5 days", "date_soon", "deposit", "Deposit reminder", { field: "deposit_deadline", days: 5 }),
        wf("docs", "Documents stage → checklist", "in_stage", "docs", "Send document checklist", { stage: "Documents" }),
        wf("visa", "Visa appointment in 3 days", "date_soon", "visa", "Visa prep reminder", { field: "visa_date", days: 3 }),
      ],
      whatsapp: [
        wa("deadline", "Deadline", "Hi {name}, the application deadline for {university} ({course}) is {app_deadline}. Let's finish your file this week."),
        wa("deposit", "Deposit", "Hi {name}, congratulations on your offer! The deposit for {university} is due by {deposit_deadline}."),
        wa("docs", "Document checklist", "Hi {name}, please share: passport, mark sheets, {test} score card, SOP, 2 LORs, CV and bank statements."),
        wa("visa", "Visa prep", "Hi {name}, your visa appointment is on {visa_date}. Carry original documents and financial proofs."),
      ],
      agents: [ag("matcher", "AI University Matcher", "Shortlists universities from your configured data", "From a profile like '7.2 CGPA, IELTS 7, ₹25L budget, MSc Data Science UK', build a shortlist only from the organisation's configured universities/courses with fit reasons. Mark it as a draft for counsellor review."), DOCS, ADMISSION, FOLLOW_AGENT, MKT, MGMT],
      reports: [...BASE_REPORTS, r("country", "By country", "field:country"), r("uni", "University performance", "field:university"), r("agent", "Sub-agent performance", "field:sub_agent")],
      roles: ["Director", "Branch head", "Counsellor", "Application officer", "Visa officer", "Accounts", "Sub-agent"],
    }),
    common({
      slug: "school", name: "School CRM", positioning: "AI Admission & Parent Engagement CRM for schools",
      subtypes: ["CBSE", "ICSE", "State board", "IB / Cambridge", "Pre-school", "Boarding"],
      recordLabel: "Student", recordLabelPlural: "Students", valueLabel: "Annual fee",
      sources: ["Website", "Walk-in", "Referral", "Meta Ads", "Google", "Hoarding", "Open house", "Existing parent"],
      stages: ["Enquiry", "Campus Visit", "Application", "Interaction / Test", "Offer", "Fee Paid", "Admitted"],
      wonStages: ["Fee Paid", "Admitted"], lostStages: [],
      fields: [f("grade", "Grade applying for"), f("dob", "Date of birth", "date"), f("previous_school", "Previous school"), f("visit_date", "Campus visit", "date"), f("transport", "Transport", "select", ["Yes", "No"]), f("sibling", "Sibling in school", "select", ["Yes", "No"]), ...PARENT, ...FEES],
      dashboard: [{ label: "Enquiries (7d)", metric: "new_7d" }, { label: "Campus visits", metric: "stage:Campus Visit" }, { label: "Applications", metric: "stage:Application" }, { label: "Admitted", metric: "won" }, { label: "Fee revenue", metric: "won_value" }, { label: "Collected", metric: "sum:fee_paid" }, { label: "Conversion", metric: "conversion" }, { label: "Stale", metric: "stale" }],
      modules: ["Admission pipeline", "Campus visits", "Parent CRM", "Fee instalments", "Transport", "Announcements"],
      workflows: [wf("visit", "Campus visit tomorrow", "date_soon", "visit", "Visit reminder", { field: "visit_date", days: 1 }), wf("app", "Application pending", "in_stage", "app", "Application reminder", { stage: "Application" }), ...feeFlow],
      whatsapp: [wa("visit", "Visit reminder", "Dear parent, we look forward to your campus visit at {business} on {visit_date}."), wa("app", "Application", "Dear parent, {name}'s application for grade {grade} is pending. Can we help complete it?"), feeWa],
      agents: [COUNSELLOR("admission"), FEE, FOLLOW_AGENT, MGMT],
      reports: [...BASE_REPORTS, r("grade", "By grade", "field:grade")],
      roles: ["Principal", "Admission officer", "Accounts", "Teacher", "Transport head"],
    }),
    common({
      slug: "edtech", name: "EdTech CRM", positioning: "AI Sales & Learner Success CRM for online education",
      subtypes: ["Test prep app", "Upskilling", "K-12 online", "Live cohorts", "Recorded courses"],
      recordLabel: "Learner", recordLabelPlural: "Learners", valueLabel: "Plan value",
      sources: ["App signup", "Website", "Meta Ads", "Google Ads", "YouTube", "Instagram", "Affiliate", "Webinar", "Referral"],
      stages: ["Signup", "Free Trial", "Demo Call", "Interested", "Payment Link Sent", "Paid", "Enrolled", "Onboarded", "Active Learner", "Renewal"],
      wonStages: ["Paid", "Enrolled", "Onboarded", "Active Learner", "Renewal"], lostStages: [],
      fields: [f("course", "Course / plan"), f("plan", "Plan", "select", ["Monthly", "Quarterly", "Annual", "Lifetime"]), f("trial_end", "Trial ends", "date"), f("renewal_date", "Renewal date", "date"), f("progress", "Course progress (%)", "number"), f("last_active", "Last active", "date"), f("emi", "EMI", "select", ["Yes", "No"]), f("enrolled_on", "Enrolled on", "date"), f("cohort", "Cohort / batch"), f("next_live", "Next live session", "date"), f("live_attended", "Live sessions attended", "number"), f("class_level", "Class / level"), ...PARENT],
      dashboard: [{ label: "Signups (7d)", metric: "new_7d" }, { label: "On trial", metric: "stage:Free Trial" }, { label: "Paid", metric: "won" }, { label: "Revenue", metric: "won_value" }, { label: "Conversion", metric: "conversion" }, { label: "Avg plan", metric: "avg_value" }, { label: "Enrolled", metric: "stage:Enrolled" }, { label: "Inactive", metric: "stale" }],
      modules: ["Course enrollments", "Live sessions", "Parent CRM", "Trial conversion", "Payment links", "Learner progress", "Renewals", "Webinars", "Affiliate tracking"],
      workflows: [wf("trial", "Trial ends in 2 days", "date_soon", "trial", "Upgrade nudge", { field: "trial_end", days: 2 }), wf("renew", "Renewal in 7 days", "date_soon", "renew", "Renewal reminder", { field: "renewal_date", days: 7 }), wf("pay", "Payment link sent, unpaid", "in_stage", "pay", "Payment follow-up", { stage: "Payment Link Sent" }), wf("live", "Live session tomorrow", "date_soon", "live", "Live class reminder to learner and parent", { field: "next_live", days: 1 }), wf("inactive", "Learner inactive 7 days", "inactive", "parent", "Progress alert to parent", { days: 7 })],
      whatsapp: [wa("trial", "Trial ending", "Hi {name}, your free trial of {course} ends on {trial_end}. Upgrade today to keep your progress!"), wa("renew", "Renewal", "Hi {name}, your {plan} plan renews on {renewal_date}. Keep learning with {business}!"), wa("pay", "Payment", "Hi {name}, your seat for {course} is reserved — complete the payment to start learning."), wa("live", "Live session", "Hi {name}, your live class for {course} ({cohort}) is on {next_live}. Join on time!"), wa("parent", "Parent update", "Dear parent, {name} has completed {progress}% of {course} and attended {live_attended} live sessions. — {business}")],
      agents: [ADMISSION, SUCCESS, FOLLOW_AGENT, MKT, MGMT],
      reports: [...BASE_REPORTS, r("plan", "By plan", "field:plan"), r("course", "By course", "field:course"), r("cohort", "By cohort", "field:cohort")],
      roles: ["Founder", "Sales head", "Academic counsellor", "Learner success", "Marketing"],
    }),
    common({
      slug: "skill_training", name: "Skill / Training Institute CRM", positioning: "AI Enrollment & Placement CRM for skill and vocational training",
      subtypes: ["IT / coding", "Digital marketing", "Vocational / ITI", "Language", "Aviation / hospitality", "Corporate training"],
      recordLabel: "Trainee", recordLabelPlural: "Trainees", valueLabel: "Course fee",
      sources: ["Website", "Meta Ads", "Google Ads", "Walk-in", "Referral", "College tie-up", "Job fair", "Govt scheme"],
      stages: ["Enquiry", "Counselling", "Demo", "Enrolled", "In Training", "Certified", "Placed"],
      wonStages: ["Enrolled", "In Training", "Certified", "Placed"], lostStages: [],
      fields: [f("course", "Course"), f("qualification", "Qualification"), f("batch", "Batch"), f("demo_date", "Demo date", "date"), f("placement_status", "Placement", "select", ["Not started", "Interviewing", "Placed", "Not interested"]), f("company", "Placed at"), f("salary", "Salary (₹/yr)", "number"), ...FEES],
      dashboard: [{ label: "Enquiries (7d)", metric: "new_7d" }, { label: "Demos", metric: "stage:Demo" }, { label: "Enrolled", metric: "won" }, { label: "Placed", metric: "stage:Placed" }, { label: "Revenue", metric: "won_value" }, { label: "Collected", metric: "sum:fee_paid" }, { label: "Conversion", metric: "conversion" }, { label: "Stale", metric: "stale" }],
      modules: ["Course & batch", "Demo classes", "Fee instalments", "Certification", "Placement CRM", "Employer CRM"],
      workflows: [wf("demo", "Demo tomorrow", "date_soon", "demo", "Demo reminder", { field: "demo_date", days: 1 }), wf("idle", "Enquiry idle 5 days", "inactive", "react", "Follow-up", { days: 5 }), ...feeFlow],
      whatsapp: [wa("demo", "Demo reminder", "Hi {name}, your free {course} demo at {business} is on {demo_date}."), wa("react", "Follow-up", "Hi {name}, the next {course} batch starts soon with placement support. Want to join?"), feeWa],
      agents: [COUNSELLOR("course"), ag("placement", "AI Placement Agent", "Matches trainees to jobs", "Match certified trainees to configured job openings and write an intro message."), FEE, FOLLOW_AGENT, MGMT],
      reports: [...BASE_REPORTS, r("course", "By course", "field:course"), r("placement", "Placement status", "field:placement_status")],
      roles: ["Director", "Counsellor", "Trainer", "Placement officer", "Accounts"],
    }),
  ];
}
