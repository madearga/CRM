"use client";

import { parseAsString, parseAsBoolean, useQueryStates } from "nuqs";

export function useSubscriptionsParams() {
  const [params, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
    archived: parseAsBoolean.withDefault(false),
    state: parseAsString,
  });

  return {
    ...params,
    setParams,
    setSearch: (q: string) => setParams({ q: q || null }),
    setState: (state: string | null) => setParams({ state: state || null }),
    toggleArchived: () => setParams({ archived: !params.archived ? true : null }),
  };
}
