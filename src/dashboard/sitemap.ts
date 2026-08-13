/**
 * Known map of the dashboard, seeded from the sidebar.
 *
 * This is the agent's baseline understanding of what pages exist and what they
 * are for. The live sidebar is re-read on every crawl, so pages the CEO adds
 * later are still discovered and flagged as changes — this list just gives the
 * agent stable, human-friendly names and defines the default read scope.
 */
export interface Route {
  key: string;
  group: string;
  label: string;
  /** `*.php[?query]` path relative to the admin base URL. */
  path: string;
  /** Included in the default read crawl (kept small to be gentle on the site). */
  crawl: boolean;
  /** Extra context for the AI about what this page is. */
  note?: string;
}

export const ROUTES: Route[] = [
  { key: 'dashboard', group: 'Overview', label: 'Dashboard', path: 'index.php', crawl: true, note: 'Headline KPIs: pipeline stages, needs-attention, programs, universities.' },

  // Leads
  { key: 'consult_requests', group: 'Leads', label: 'Consultation Requests', path: 'consult_requests.php', crawl: true, note: 'Incoming consultation leads to assign/respond to.' },
  { key: 'consultants', group: 'Leads', label: 'Consultants', path: 'consult_consultants.php', crawl: false },
  { key: 'consult_guidelines', group: 'Leads', label: 'Guidelines', path: 'consult_guidelines.php', crawl: false },
  { key: 'consult_performance', group: 'Leads', label: 'Performance', path: 'consult_performance.php', crawl: false },

  // Admissions
  { key: 'admission_windows', group: 'Admissions', label: 'Admission Windows', path: 'admission_windows.php', crawl: false },
  { key: 'window_applications', group: 'Admissions', label: 'Window Applications', path: 'window_applications.php', crawl: false },
  { key: 'review_queue', group: 'Admissions', label: 'Review Queue', path: 'review_queue.php', crawl: true, note: 'Documents awaiting review.' },

  // Students
  { key: 'students', group: 'Student Management', label: 'All Students', path: 'students.php', crawl: false, note: 'Master student list; supports ?status, ?filter_docs, ?stage, ?prog, ?uni, ?source filters.' },
  { key: 'students_pending', group: 'Student Management', label: 'Pending Payments', path: 'students.php?status=pending', crawl: false },
  { key: 'students_missing_docs', group: 'Student Management', label: 'Missing Documents', path: 'students.php?filter_docs=missing', crawl: false },

  // Team
  { key: 'tasks', group: 'Team', label: 'Tasks', path: 'tasks.php', crawl: true, note: 'Team task board.' },
  { key: 'work_report', group: 'Team', label: 'Work Reports', path: 'work_report.php', crawl: false },
  { key: 'consultations', group: 'Team', label: 'Consultations', path: 'consultations.php', crawl: true, note: 'Consultations to assign/complete.' },
  { key: 'employees', group: 'Team', label: 'Employees', path: 'employees.php', crawl: false },

  // Automation (actions live here)
  { key: 'reminders', group: 'Automation', label: 'Document Reminders', path: 'reminders.php', crawl: true, note: 'Send document reminders to students.' },
  { key: 'notice', group: 'Automation', label: 'Send Notice', path: 'notice.php', crawl: false, note: 'Broadcast a notice.' },
  { key: 'ai_review', group: 'Automation', label: 'AI Document Review', path: 'ai_review.php', crawl: false },

  // B2B
  { key: 'partners', group: 'B2B', label: 'Partners', path: 'partners.php', crawl: false },
  { key: 'partner_messages', group: 'B2B', label: 'Partner Messages', path: 'partner_messages.php', crawl: true, note: 'Messages from B2B partners to reply to.' },

  // Reports & Tools
  { key: 'reports', group: 'Reports & Tools', label: 'Reports', path: 'reports.php', crawl: false },
  { key: 'audit_log', group: 'Reports & Tools', label: 'Audit Log', path: 'audit_log.php', crawl: true, note: 'Who-did-what across the dashboard.' },
];

/** Paths visited by the default read crawl. */
export const DEFAULT_CRAWL: string[] = ROUTES.filter((r) => r.crawl).map((r) => r.path);

export function routeByPath(path: string): Route | undefined {
  return ROUTES.find((r) => r.path === path);
}
