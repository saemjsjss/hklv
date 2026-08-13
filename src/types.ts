/**
 * Shared types for the HKLV dashboard agent.
 *
 * The dashboard is a server-rendered PHP app with no API, so the agent reads it
 * by driving a logged-in browser and extracting structured data from the DOM.
 * These types describe that extracted data and the snapshots built from it.
 */

/** A single sidebar navigation link (label + URL + optional live badge count). */
export interface NavItem {
  group: string;
  label: string;
  href: string;
  /** Numeric badge shown next to the link (e.g. "Missing Documents 169"), if any. */
  badge?: number;
  /** Raw badge text when it is not a plain number. */
  badgeText?: string;
}

/** A labelled number read from a `.stat-card` or `.wf-item` on a page. */
export interface Metric {
  label: string;
  value: number;
  /** Where clicking the metric goes, when it links somewhere. */
  href?: string;
  /** Which visual block it came from, for grouping in the briefing. */
  section?: string;
}

/** A generic table extracted from a `.tbl` list page (students, tasks, …). */
export interface TableData {
  columns: string[];
  rows: string[][];
  /** Total row count if the page reports more than it renders (pagination). */
  rowCount: number;
}

/** Everything the crawler captured from one page in one visit. */
export interface PageSnapshot {
  url: string;
  title: string;
  /** Structural fingerprint used to detect layout changes between runs. */
  structureHash: string;
  metrics: Metric[];
  tables: TableData[];
  /** Present only for the dashboard/index page. */
  nav?: NavItem[];
  /** ISO timestamp of capture. */
  capturedAt: string;
  /** Set when the page could not be read (login lost, network, etc.). */
  error?: string;
}

/** A full crawl across the in-scope pages. */
export interface Snapshot {
  capturedAt: string;
  /** Source of the data: the live site or a local fixture (dry-run). */
  source: string;
  pages: Record<string, PageSnapshot>;
  /** Flat, de-duplicated set of the headline numbers for quick access. */
  headline: Metric[];
  nav: NavItem[];
}

/** One detected difference between the previous snapshot and the current one. */
export interface Change {
  kind: 'metric' | 'nav-added' | 'nav-removed' | 'structure' | 'badge';
  label: string;
  before?: number | string;
  after?: number | string;
  /** Human-friendly one-liner, e.g. "Missing Documents: 169 → 172 (+3)". */
  summary: string;
}

/** A prioritized duty derived from the current snapshot. */
export interface Duty {
  priority: number;
  title: string;
  detail: string;
  count?: number;
  /** Deep link into the dashboard where the work is done. */
  href?: string;
  /** The action id (if any) the agent can run to help with this duty. */
  action?: string;
}
