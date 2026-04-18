export type TimeRange =
  | "today"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "custom"
  | "all_time";

export interface DateRange {
  start_date: string;
  end_date: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type BoundedTimeRange = Exclude<TimeRange, "all_time" | "custom">;

function computeStart(range: BoundedTimeRange, now: Date): Date {
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());

    case "this_week": {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }

    case "this_month":
      return new Date(now.getFullYear(), now.getMonth(), 1);

    case "last_30_days": {
      const d = new Date(now);
      d.setDate(now.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
}

/**
 * Converts a symbolic time range to a concrete { start_date, end_date } pair.
 * Returns undefined for "all_time" (no date filter).
 */
export function resolveDateRange(
  timeRange: TimeRange,
  customStart?: string,
  customEnd?: string,
): DateRange | undefined {
  if (timeRange === "all_time") return undefined;

  const now = new Date();
  const end = toDateStr(now);

  if (timeRange === "custom") {
    if (!customStart || !customEnd) return undefined;
    return { start_date: customStart, end_date: customEnd };
  }

  return { start_date: toDateStr(computeStart(timeRange, now)), end_date: end };
}
