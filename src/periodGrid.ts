import type { Day, Session, Settings } from "./types";
import { sessionRange } from "./scheduleUtils";

export interface GridRow {
  /** Period number, or null for a spacer row between two blocks. */
  period: number | null;
  weight: number;
}

export interface PlacedCard {
  session: Session;
  index: number;
  start: number;
  span: number;
}

export interface DayColumn {
  day: Day;
  cards: PlacedCard[];
  loose: Array<{ session: Session; index: number }>;
}

export interface WeekGrid {
  rows: GridRow[];
  days: DayColumn[];
  /** CSS `grid-template-rows` value shared by the rail and every day. */
  template: string;
}

/**
 * Lays the visible days onto a shared period grid.
 *
 * `compact` collapses every period without a class across the whole week into a
 * thin spacer (keeping one spacer between two occupied blocks so gaps stay
 * readable). Without it all configured periods get equal height.
 */
export function buildWeekGrid(
  days: Day[],
  settings: Settings,
  full = false
): WeekGrid {
  const periods = [...settings.periods].sort((a, b) => a.index - b.index);
  const periodNumbers = periods.map((item) => item.index);

  const parsed = days.map((day) => {
    const cards: PlacedCard[] = [];
    const loose: DayColumn["loose"] = [];
    day.sessions.forEach((session, index) => {
      const range = sessionRange(session);
      if (!range) {
        loose.push({ session, index });
        return;
      }
      const span = Math.max(1, range.end - range.start + 1);
      cards.push({ session, index, start: range.start, span });
    });
    return { day, cards, loose };
  });

  const occupied = new Set<number>();
  parsed.forEach((column) =>
    column.cards.forEach((card) => {
      for (let period = card.start; period < card.start + card.span; period += 1) {
        occupied.add(period);
      }
    })
  );

  const rows = !full && settings.panel.compact
    ? compactRows(periodNumbers, occupied)
    : periodNumbers.map((period) => ({ period, weight: 1 }));

  const rowOf = new Map<number, number>();
  rows.forEach((row, index) => {
    if (row.period !== null) rowOf.set(row.period, index);
  });

  const columns = parsed.map((column) => ({
    ...column,
    cards: column.cards
      .map((card) => ({ ...card, start: rowOf.get(card.start) ?? 0 }))
      .sort((a, b) => a.start - b.start)
  }));

  return {
    rows,
    days: columns,
    template: rows.length
      ? rows.map((row) => `${row.weight}fr`).join(" ")
      : "1fr"
  };
}

function compactRows(periodNumbers: number[], occupied: Set<number>): GridRow[] {
  const used = periodNumbers.filter((period) => occupied.has(period));
  if (!used.length) return periodNumbers.map((period) => ({ period, weight: 1 }));

  const rows: GridRow[] = [];
  periodNumbers.forEach((period) => {
    if (occupied.has(period)) {
      rows.push({ period, weight: 1 });
      return;
    }
    const nextUsed = periodNumbers.some(
      (candidate) => candidate > period && occupied.has(candidate)
    );
    const previousUsed = rows.some((row) => row.period !== null);
    // One thin spacer where a real gap sits between two class blocks.
    if (previousUsed && nextUsed) {
      rows.push({ period: null, weight: 0.22 });
    }
  });

  return rows;
}
