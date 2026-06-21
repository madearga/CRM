/**
 * Contacts list screen (P2.1, Task B).
 *
 * Search → debounce → paginated `api.contacts.list`. Renders via the shared
 * `<SearchList>` wrapper; each row is a `<ContactRow>`. Tap pushes
 * `contacts/[id]` (detail built in Task C). The header + back button come
 * from the group's Stack `_layout.tsx`, so this body is just the list.
 */
import { ContactRow, type ContactRowItem } from '@/components/contact-row';
import { SearchList } from '@/components/search-list';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginatedQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';

export default function ContactsListScreen() {
  const { input, setInput, debounced } = useDebouncedSearch('', 250);

  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    { search: debounced || undefined },
    { initialNumItems: 25 },
  );

  const isLoadingFirst = status === 'LoadingFirstPage';
  const loadingMore = status === 'CanLoadMore';

  return (
    <SearchList<ContactRowItem>
      searchValue={input}
      onSearchChange={setInput}
      searchPlaceholder="Search contacts…"
      items={results as ContactRowItem[]}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ContactRow {...item} />}
      onEndReached={status === 'CanLoadMore' ? () => loadMore(25) : undefined}
      loadingMore={loadingMore}
      isLoadingFirst={isLoadingFirst}
      emptyTitle="No contacts yet"
      emptyMessage="Contacts created on the web will show up here."
      // ponytail: create flow is a later task — no CTA for now.
    />
  );
}