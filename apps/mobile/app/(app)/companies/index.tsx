/**
 * Companies list screen (P2.1, Task D).
 *
 * Search → debounce → paginated `api.companies.list`. Renders via the shared
 * `<SearchList>` wrapper; each row is a `<CompanyRow>`. Tap pushes
 * `companies/[id]` (detail built in Task E). The header + back button come
 * from the group's Stack `_layout.tsx`, so this body is just the list.
 */
import { CompanyRow, type CompanyRowItem } from '@/components/company-row';
import { SearchList } from '@/components/search-list';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginatedQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';

export default function CompaniesListScreen() {
  const { input, setInput, debounced } = useDebouncedSearch('', 250);

  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    { search: debounced || undefined },
    { initialNumItems: 25 },
  );

  const isLoadingFirst = status === 'LoadingFirstPage';
  const loadingMore = status === 'CanLoadMore';

  return (
    <SearchList<CompanyRowItem>
      searchValue={input}
      onSearchChange={setInput}
      searchPlaceholder="Search companies…"
      items={results as CompanyRowItem[]}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <CompanyRow {...item} />}
      onEndReached={status === 'CanLoadMore' ? () => loadMore(25) : undefined}
      loadingMore={loadingMore}
      isLoadingFirst={isLoadingFirst}
      emptyTitle="No companies yet"
      emptyMessage="Companies created on the web will show up here."
      // ponytail: create flow is a later task — no CTA for now.
    />
  );
}