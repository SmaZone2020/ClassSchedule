import type { GridRow } from "../periodGrid";

export interface RowMetric {
  top: number;
  height: number;
}

/** Pixel top/height of every grid row, derived from the fr weights. */
export function rowMetrics(rows: GridRow[], height: number, gap: number): RowMetric[] {
  if (!rows.length || height <= 0) return [];
  const totalGap = gap * Math.max(0, rows.length - 1);
  const weight = rows.reduce((sum, row) => sum + row.weight, 0) || 1;
  const unit = Math.max(0, (height - totalGap) / weight);

  let top = 0;
  return rows.map((row) => {
    const metric = { top, height: row.weight * unit };
    top += metric.height + gap;
    return metric;
  });
}

/** Block covering `span` rows starting at `index`. */
export function blockAt(
  metrics: RowMetric[],
  index: number,
  span: number
): RowMetric {
  const first = metrics[index];
  const last = metrics[Math.min(index + Math.max(1, span) - 1, metrics.length - 1)];
  if (!first || !last) return { top: 0, height: 0 };
  return { top: first.top, height: last.top + last.height - first.top };
}

/**
 * Row index under a client Y.
 *
 * Rows are separated by a gap, so a pointer can legitimately land *between*
 * two rows. Returning "the last row" in that case made every hover / drag /
 * resize jump to the bottom of the grid; instead pick the row containing the
 * point, else the nearest one by edge distance.
 */
export function rowIndexAt(
  grid: HTMLElement,
  metrics: RowMetric[],
  clientY: number
): number | null {
  if (!metrics.length) return null;
  const box = grid.getBoundingClientRect();
  if (box.height <= 0) return null;
  const y = clientY - box.top;

  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < metrics.length; index += 1) {
    const metric = metrics[index];
    if (metric.height <= 0) continue;
    if (y >= metric.top && y <= metric.top + metric.height) return index;

    const distance =
      y < metric.top ? metric.top - y : y - (metric.top + metric.height);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }

  return best >= 0 ? best : null;
}

/** Nearest real period for a pointer position; spacer rows are skipped. */
export function periodAt(
  grid: HTMLElement,
  rows: GridRow[],
  metrics: RowMetric[],
  clientY: number
): number | null {
  const index = rowIndexAt(grid, metrics, clientY);
  if (index === null) return null;
  if (rows[index]?.period != null) return rows[index].period;

  for (let offset = 1; offset < rows.length; offset += 1) {
    const before = rows[index - offset];
    if (before?.period != null) return before.period;
    const after = rows[index + offset];
    if (after?.period != null) return after.period;
  }
  return null;
}

/**
 * Same as `periodAt`, but always measures the live grid.
 *
 * The rendered metrics come from a `ResizeObserver` and can lag one frame
 * behind (or be empty before the first measurement). Pointer handlers must not
 * use them or a stale grid teleports the target.
 */
export function periodAtPoint(
  grid: HTMLElement,
  rows: GridRow[],
  clientY: number
): number | null {
  const gap = Number.parseFloat(getComputedStyle(grid).rowGap || "0") || 0;
  const metrics = rowMetrics(rows, grid.getBoundingClientRect().height, gap);
  return periodAt(grid, rows, metrics, clientY);
}

export function rowOfPeriod(rows: GridRow[], period: number): number | null {
  const index = rows.findIndex((row) => row.period === period);
  return index >= 0 ? index : null;
}

export function periodBounds(rows: GridRow[]): { min: number; max: number } {
  const periods = rows.map((row) => row.period).filter((value): value is number => value != null);
  if (!periods.length) return { min: 1, max: 1 };
  return { min: Math.min(...periods), max: Math.max(...periods) };
}

/** Day column date under a pointer position. */
export function dateAt(clientX: number, clientY: number): string | null {
  const element = document.elementFromPoint(clientX, clientY);
  const column = element?.closest(".schedule-day") as HTMLElement | null;
  return column?.dataset.date ?? null;
}

/** Day grid element under a pointer position. */
export function gridAt(clientX: number, clientY: number): HTMLElement | null {
  const element = document.elementFromPoint(clientX, clientY);
  return (element?.closest(".day-grid") as HTMLElement | null) ?? null;
}
