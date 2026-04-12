"use client";

import { parseAsString, useQueryStates } from "nuqs";

export type DateRange =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year";

export function useDashboardParams() {
  const [params, setParams] = useQueryStates({
    range: parseAsString.withDefault("this_month"),
  });

  const setRange = (range: DateRange) => setParams({ range });

  return {
    range: (params.range as DateRange) || "this_month",
    setRange,
  };
}
