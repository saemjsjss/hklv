/**
 * Duties engine + briefing renderer.
 *
 * This is deterministic and AI-free so it always works (the AI layer only
 * *rewrites* this into friendlier prose when a Groq key is present). It turns
 * the live KPIs into a prioritized, plain-English "here's what to do" list.
 */
import { pageUrl } from '../config.js';
import type { Change, Duty, Metric, Snapshot } from '../types.js';

interface DutyRule {
  keys: string[];
  /** Fallback page whose table row-count is used if no KPI/badge matched. */
  pagePath?: string;
  title: (n: number) => string;
  detail: string;
  href: string;
  action?: string;
  priority: number;
}

const RULES: DutyRule[] = [
  {
    keys: ['Pending Payment', 'Payment Verification'],
    title: (n) => `Verify ${n} pending payment${n > 1 ? 's' : ''}`,
    detail: 'Students are waiting for payment approval before they can move forward.',
    href: 'students.php?status=pending',
    priority: 1,
  },
  {
    keys: ['Missing Documents'],
    title: (n) => `Chase ${n} student${n > 1 ? 's' : ''} with missing documents`,
    detail: 'Verified students who still have not uploaded required documents. I can send reminders.',
    href: 'students.php?filter_docs=missing',
    action: 'send_reminders',
    priority: 2,
  },
  {
    keys: ['Consultation Requests'],
    title: (n) => `Handle ${n} consultation request${n > 1 ? 's' : ''}`,
    detail: 'New leads waiting to be assigned or answered.',
    href: 'consult_requests.php',
    priority: 2,
  },
  {
    keys: ['Docs to Review', 'Documents Under Review', 'Review Queue'],
    title: (n) => `Review ${n} document${n > 1 ? 's' : ''}`,
    detail: 'Documents submitted by students and awaiting your review.',
    href: 'review_queue.php',
    priority: 3,
  },
  {
    keys: ['Partner Messages'],
    pagePath: 'partner_messages.php',
    title: (n) => `Reply to ${n} partner message${n > 1 ? 's' : ''}`,
    detail: 'B2B partners are waiting for a response.',
    href: 'partner_messages.php',
    action: 'reply_partner',
    priority: 3,
  },
];

function lookup(snap: Snapshot, keys: string[], pagePath?: string): number {
  const matches = (label: string) =>
    keys.some((k) => label.toLowerCase().includes(k.toLowerCase()));

  const metric = snap.headline.find((m) => matches(m.label));
  if (metric) return metric.value;

  const nav = snap.nav.find((n) => n.badge !== undefined && matches(n.label));
  if (nav?.badge !== undefined) return nav.badge;

  if (pagePath) {
    const table = snap.pages[pagePath]?.tables?.[0];
    if (table) return table.rowCount;
  }
  return 0;
}

/** Derive a prioritized duty list from the current snapshot. */
export function computeDuties(snap: Snapshot): Duty[] {
  const duties: Duty[] = [];
  for (const rule of RULES) {
    const count = lookup(snap, rule.keys, rule.pagePath);
    if (count <= 0) continue;
    duties.push({
      priority: rule.priority,
      title: rule.title(count),
      detail: rule.detail,
      count,
      href: pageUrl(rule.href),
      action: rule.action,
    });
  }
  duties.sort((a, b) => a.priority - b.priority || (b.count ?? 0) - (a.count ?? 0));
  return duties;
}

/**
 * Pick the metrics worth leading with: the known-important KPIs in a sensible
 * order first, then any other non-zero numbers, so the briefing does not open
 * with a wall of zeros (e.g. empty admission windows).
 */
export function selectHeadline(snap: Snapshot, limit = 9): Metric[] {
  const preferred = [
    'Total Students',
    'Pending Payment',
    'Verified',
    'Missing Documents',
    'Docs to Review',
    'Documents Under Review',
    'Admitted',
    'This Week',
    'This Month',
  ];
  const out: Metric[] = [];
  const used = new Set<Metric>();
  for (const key of preferred) {
    const m = snap.headline.find((x) => !used.has(x) && x.label.toLowerCase().includes(key.toLowerCase()));
    if (m) {
      out.push(m);
      used.add(m);
    }
  }
  for (const m of snap.headline) {
    if (out.length >= limit) break;
    if (!used.has(m) && m.value > 0) out.push(m);
  }
  return out.slice(0, limit);
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Render the full plain-text briefing (Telegram-friendly, no special markup).
 */
export function renderBriefing(snap: Snapshot, changes: Change[], duties: Duty[]): string {
  const out: string[] = [];
  out.push(`🌅 HKLV Briefing — ${dateLabel(snap.capturedAt)}`);
  out.push('');

  out.push('📊 Where things stand');
  const top = selectHeadline(snap);
  if (top.length === 0) out.push('• (no headline numbers could be read)');
  for (const m of top) out.push(`• ${m.label}: ${m.value}`);
  out.push('');

  out.push('🔔 What changed since last time');
  if (changes.length === 0) {
    out.push('• No changes since the last check.');
  } else {
    for (const c of changes.slice(0, 12)) out.push(`• ${c.summary}`);
  }
  out.push('');

  out.push('✅ Your duties (most important first)');
  if (duties.length === 0) {
    out.push('• Nothing urgent right now — inbox is clear. 🎉');
  } else {
    duties.forEach((d, i) => {
      out.push(`${i + 1}. ${d.title}`);
      out.push(`   ${d.detail}`);
      if (d.href) out.push(`   → ${d.href}`);
    });
  }
  out.push('');
  out.push('Reply anytime, e.g. "what needs my attention?" or "send document reminders".');
  return out.join('\n');
}
