/**
 * DOM extractors.
 *
 * `extractAllInPage` runs INSIDE the browser page (serialized by Playwright's
 * `page.evaluate` or Selenium's `executeScript`), so it must be completely
 * self-contained: only browser globals, no imports, no references to anything
 * in module scope at runtime. Type annotations are erased before serialization,
 * so referencing the `Raw*` interfaces for typing is safe.
 *
 * The extraction is deliberately STRUCTURAL — it keys off the dashboard's stable
 * class names (`.sb-item`, `.sb-badge`, `.stat-card`, `.wf-item`, `.tbl`) rather
 * than specific text or values. That is what lets it keep working as the CEO
 * changes counts and content daily.
 */
import { createHash } from 'node:crypto';
import type { Metric, NavItem, PageSnapshot, TableData } from '../types.js';

export interface RawNavItem {
  group: string;
  label: string;
  href: string;
  badgeText: string | null;
}
export interface RawMetric {
  label: string;
  value: number;
  href: string | null;
  section: string;
}
export interface RawTable {
  columns: string[];
  rows: string[][];
}
export interface RawPage {
  title: string;
  nav: RawNavItem[];
  metrics: RawMetric[];
  tables: RawTable[];
}

/** Extract nav, metrics and tables from the current page. Runs in the browser. */
export function extractAllInPage(): RawPage {
  const clean = (el: Element | null): string =>
    (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  const toNum = (s: string): number => parseInt(s.replace(/[^0-9-]/g, ''), 10);

  // ── Sidebar navigation (labels, URLs, badge counts) ──
  const nav: RawNavItem[] = [];
  document.querySelectorAll('.sb-group').forEach((group) => {
    const groupTitle = clean(group.querySelector('.sb-group-title'));
    group.querySelectorAll('a.sb-item').forEach((a) => {
      const badgeEl = a.querySelector('.sb-badge');
      const badgeText = badgeEl ? clean(badgeEl) : null;
      let label = clean(a);
      if (badgeText && label.endsWith(badgeText)) {
        label = label.slice(0, label.length - badgeText.length).trim();
      }
      const href = a instanceof HTMLAnchorElement ? a.href : '';
      if (label) nav.push({ group: groupTitle, label, href, badgeText });
    });
  });

  // ── Metrics: `.stat-card` (number + label) and `.wf-item` (label + count) ──
  const metrics: RawMetric[] = [];
  const pushMetric = (label: string, raw: string, el: Element, section: string): void => {
    const value = toNum(raw);
    if (!label || Number.isNaN(value)) return;
    const href = el instanceof HTMLAnchorElement ? el.href : null;
    metrics.push({ label, value, href, section });
  };
  document.querySelectorAll('.stat-card').forEach((card) => {
    const num = card.querySelector('.stat-num');
    const lbl = card.querySelector('.stat-lbl');
    if (num && lbl) pushMetric(clean(lbl), clean(num), card, 'stat');
  });
  document.querySelectorAll('.wf-item').forEach((item) => {
    const strong = item.querySelector('.wf-info strong');
    const count = item.querySelector('.wf-count');
    if (strong && count) pushMetric(clean(strong), clean(count), item, 'workflow');
  });

  // ── Generic list tables (students, tasks, partners, audit log, …) ──
  const tables: RawTable[] = [];
  document.querySelectorAll('table.tbl, table.table, table').forEach((tbl) => {
    const columns: string[] = [];
    tbl.querySelectorAll('thead th').forEach((th) => columns.push(clean(th)));
    const rows: string[][] = [];
    tbl.querySelectorAll('tbody tr').forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll('td').forEach((td) => cells.push(clean(td)));
      if (cells.length) rows.push(cells);
    });
    if (columns.length || rows.length) tables.push({ columns, rows });
  });

  return { title: document.title, nav, metrics, tables };
}

/**
 * Build a self-contained browser expression that runs `extractAllInPage`.
 *
 * The function is serialized with `.toString()` so it can run in the page via
 * Playwright/Selenium. Transpilers (esbuild/tsx) inject a `__name` helper into
 * the serialized source; we prepend a no-op shim so the expression evaluates in
 * the browser, where that helper does not exist.
 */
export function inPageScript(): string {
  return `(() => { const __name = (t) => t; return (${extractAllInPage.toString()})(); })()`;
}

/** Parse a badge string into a numeric count when possible. */
function parseNav(raw: RawNavItem[]): NavItem[] {
  return raw.map((n) => {
    const item: NavItem = { group: n.group, label: n.label, href: n.href };
    if (n.badgeText != null) {
      const num = Number(n.badgeText.replace(/[^0-9-]/g, ''));
      if (n.badgeText.trim() !== '' && !Number.isNaN(num)) item.badge = num;
      else item.badgeText = n.badgeText;
    }
    return item;
  });
}

/**
 * A fingerprint of a page's STRUCTURE (which labels/columns exist), independent
 * of the values. Changes when the CEO adds/removes a card, nav link or column —
 * not when a count merely ticks up or down.
 */
function structureHash(raw: RawPage): string {
  const skeleton = {
    nav: raw.nav.map((n) => `${n.group}:${n.label}`).sort(),
    metrics: raw.metrics.map((m) => m.label).sort(),
    tables: raw.tables.map((t) => t.columns.join('|')).sort(),
  };
  return createHash('sha1').update(JSON.stringify(skeleton)).digest('hex').slice(0, 12);
}

/** Turn a raw in-page extraction into a typed, hashed PageSnapshot. */
export function toPageSnapshot(
  raw: RawPage,
  url: string,
  opts: { includeNav?: boolean } = {},
): PageSnapshot {
  const metrics: Metric[] = raw.metrics.map((m) => ({
    label: m.label,
    value: m.value,
    href: m.href ?? undefined,
    section: m.section,
  }));
  const tables: TableData[] = raw.tables.map((t) => ({
    columns: t.columns,
    rows: t.rows,
    rowCount: t.rows.length,
  }));
  const snap: PageSnapshot = {
    url,
    title: raw.title,
    structureHash: structureHash(raw),
    metrics,
    tables,
    capturedAt: new Date().toISOString(),
  };
  if (opts.includeNav) snap.nav = parseNav(raw.nav);
  return snap;
}
