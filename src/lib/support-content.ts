// Real Help & Support content for the Netting Reconciliation app — answers
// about how this specific tool behaves, not a generic fintech-template FAQ.
// Kept as data so the FAQ list and contact cards can be extended without
// touching the page component.

export type FaqCategory =
  'data-sources' | 'matching' | 'duplicates' | 'privacy' | 'ai' | 'general';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
}

export const faqItems: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'What files can I upload, and where do they come from?',
    category: 'data-sources',
    answer:
      'CSV or XLSX extracts from three sources: Dynamics 365, Prism BSS, and bank statements (CABS, CBZ, NMB, Stanbic, BancABC, Ecocash, FBC, AFC, MetBank, NedBank, ZB, and others). Upload them on the Data Sources page — the app auto-detects the header row and parses dates, amounts, and references from whatever column layout each source uses.',
  },
  {
    id: 'faq-2',
    question: 'Why is my match rate 0% or lower than I expected?',
    category: 'matching',
    answer:
      'The reconciliation engine only matches records that exist across sources for the same period. A 0% rate almost always means only one source has been uploaded so far, or the uploaded files cover different date ranges. Upload the corresponding Dynamics/Prism/bank extract for the same period and the rate will reflect real matching, not a placeholder.',
  },
  {
    id: 'faq-3',
    question: 'How does the app decide something is a duplicate?',
    category: 'duplicates',
    answer:
      "Two layers. On upload, a file-level fingerprint catches re-uploading the exact same extract. Inside matching, a record-level check groups transactions that share a reference, amount, and date (or an identical row when there's no usable reference) — a shared reference alone isn't enough, since some bank statements reuse narrative-style reference text across genuinely distinct transactions.",
  },
  {
    id: 'faq-4',
    question:
      "I marked something 'Not a duplicate' by mistake — can I undo it?",
    category: 'duplicates',
    answer:
      'Yes. Go to Settings → Data & Privacy, or use "Restore all" on the Possible Duplicates panel on Overview. Either clears the override and puts that group back up for review on the next reconciliation run.',
  },
  {
    id: 'faq-5',
    question: 'Is any of my data sent to a server?',
    category: 'privacy',
    answer:
      "No, with one exception. Every extract you upload, every match, and every preference is parsed and stored only in this browser (localStorage) — there's no backend database yet. The one exception is the AI Assistant: when you ask it a question, the reconciliation context relevant to that question is sent to whichever AI provider you've configured for that chat.",
  },
  {
    id: 'faq-6',
    question: 'What can the AI Assistant actually see and do?',
    category: 'ai',
    answer:
      "It's grounded in your current reconciliation state — the same matches, exceptions, and totals visible on the dashboard — so it can answer questions like \"what's driving today's exception count\" without you digging through spreadsheets. It can't take actions on your behalf or see anything you haven't uploaded in this session.",
  },
  {
    id: 'faq-7',
    question: 'When will this connect to live Dynamics 365 and Prism data?',
    category: 'general',
    answer:
      'Live integration is blocked on API access being provisioned for both systems. Until then, the app runs in demo mode: upload real exported extracts and everything else — matching, exceptions, duplicate detection, analytics — runs exactly as it will once the live connection is in place.',
  },
  {
    id: 'faq-8',
    question:
      'How are exceptions classified (timing vs. mispost vs. investigate)?',
    category: 'matching',
    answer:
      'Timing differences are amounts that match but land on different dates within a tolerance window. Mispost is a same-day, same-source mismatch that suggests the wrong account or category. Investigate is anything with no plausible counterpart at all — these are the ones worth reviewing first, and the highest-value ones surface as notifications.',
  },
];

export interface TeamContact {
  name: string;
  role: string;
  email: string;
}

export const teamContacts: TeamContact[] = [
  {
    name: 'Christopher Munyau',
    role: 'Project Lead / Accountant — Payables',
    email: 'christophert.munyau@gmail.com',
  },
  { name: 'Cuthbert Musengi', role: 'Engineering Lead', email: '' },
];

export type ProjectStatusState = 'done' | 'in-progress' | 'blocked';

export interface ProjectStatusItem {
  area: string;
  state: ProjectStatusState;
  note: string;
}

// Mirrors the Status table in the repo README — keep the two in sync when
// a new area ships or a blocker clears.
export const projectStatus: ProjectStatusItem[] = [
  {
    area: 'Branding & shell',
    state: 'done',
    note: 'Liquid Intelligent Technologies theme',
  },
  {
    area: 'Data Sources',
    state: 'done',
    note: 'CSV/XLSX upload for Dynamics, Prism, and bank extracts',
  },
  {
    area: 'Reconciliation engine',
    state: 'done',
    note: 'Matching, exception classification, duplicate detection',
  },
  {
    area: 'Dashboard analytics & reporting',
    state: 'done',
    note: 'Overview widgets, trend charts, exception assignment',
  },
  {
    area: 'Notifications',
    state: 'done',
    note: 'Derived live from reconciliation state',
  },
  {
    area: 'Settings',
    state: 'done',
    note: 'Profile, data controls, alert thresholds',
  },
  {
    area: 'AI Assistant',
    state: 'in-progress',
    note: 'Built — needs a provider API key to leave demo mode',
  },
  {
    area: 'Live Dynamics 365 / Prism integration',
    state: 'blocked',
    note: 'Blocked on API access provisioning',
  },
];
