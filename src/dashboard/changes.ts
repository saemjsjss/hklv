/**
 * Change detection.
 *
 * Diffs the previous snapshot against the current one so the briefing can lead
 * with "what changed since last time" — mirroring the CEO's near-daily edits so
 * the manager (and the agent's own understanding) never fall behind.
 */
import type { Change, NavItem, Snapshot } from '../types.js';

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function navMap(nav: NavItem[]): Map<string, NavItem> {
  return new Map(nav.map((n) => [n.label, n]));
}

export function diffSnapshots(prev: Snapshot, curr: Snapshot): Change[] {
  const changes: Change[] = [];

  // Headline metric value changes.
  const prevMetrics = new Map(prev.headline.map((m) => [m.label, m.value]));
  for (const m of curr.headline) {
    const before = prevMetrics.get(m.label);
    if (before !== undefined && before !== m.value) {
      changes.push({
        kind: 'metric',
        label: m.label,
        before,
        after: m.value,
        summary: `${m.label}: ${before} → ${m.value} (${signed(m.value - before)})`,
      });
    }
  }

  // Nav additions / removals and badge changes.
  const prevNav = navMap(prev.nav);
  const currNav = navMap(curr.nav);
  for (const label of currNav.keys()) {
    if (!prevNav.has(label)) {
      changes.push({ kind: 'nav-added', label, summary: `New menu item added: "${label}"` });
    }
  }
  for (const label of prevNav.keys()) {
    if (!currNav.has(label)) {
      changes.push({ kind: 'nav-removed', label, summary: `Menu item removed: "${label}"` });
    }
  }
  for (const [label, n] of currNav) {
    const p = prevNav.get(label);
    if (p && p.badge !== undefined && n.badge !== undefined && p.badge !== n.badge) {
      changes.push({
        kind: 'badge',
        label,
        before: p.badge,
        after: n.badge,
        summary: `${label} badge: ${p.badge} → ${n.badge} (${signed(n.badge - p.badge)})`,
      });
    }
  }

  // Per-page structural changes (a card, column or menu item appeared/disappeared).
  for (const [path, page] of Object.entries(curr.pages)) {
    const before = prev.pages[path];
    if (
      before &&
      before.structureHash !== 'error' &&
      page.structureHash !== 'error' &&
      before.structureHash !== page.structureHash
    ) {
      changes.push({
        kind: 'structure',
        label: path,
        summary: `Layout of ${path} changed — a card, column, or section was added or removed.`,
      });
    }
  }

  return changes;
}
