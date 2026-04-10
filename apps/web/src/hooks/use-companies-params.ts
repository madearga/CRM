"use client";

import { parseAsString, parseAsBoolean, useQueryStates } from "nuqs";

export function useCompaniesParams() {
  const [params, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
    archived: parseAsBoolean.withDefault(false),
  });

  return {
    ...params,
    setParams,
    setSearch: (q: string) => setParams({ q: q || null }),
    toggleArchived: () => setParams({ archived: !params.archived ? true : null }),
  };
}
