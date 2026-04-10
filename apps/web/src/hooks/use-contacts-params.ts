"use client";

import { parseAsString, useQueryStates } from "nuqs";

export function useContactsParams() {
  const [params, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
  });

  return {
    ...params,
    setParams,
    setSearch: (q: string) => setParams({ q: q || null }),
  };
}
