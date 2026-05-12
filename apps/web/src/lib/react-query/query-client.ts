import type { ConvexReactClient } from 'convex/react';

import { ConvexQueryClient } from '@convex-dev/react-query';
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from '@tanstack/react-query';
import { formatDistanceToNow } from '@/lib/format-date';
import { toast } from 'sonner';
import SuperJSON from 'superjson';

export const createQueryClient = ({
  convex,
}: {
  convex?: ConvexReactClient;
} = {}) => {
  const convexQueryClient = convex ? new ConvexQueryClient(convex) : null;

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
        shouldRedactErrors: () => {
          // We should not catch Next.js server errors
          // as that's how Next.js detects dynamic pages
          // so we cannot redact them.
          // Next.js also automatically redacts errors for us
          // with better digests.
          return false;
        },
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
      mutations: {
        onError: (error: any) => {
          if (error.message.includes('limit')) {
            const messages = [
              'Slow down. Rate limit reached.',
              'Too many requests. Wait a moment.',
              'Rate limit hit. Try again shortly.',
              'Slow down. Rate limit reached.',
              'Too many requests. Wait a moment.',
              'Rate limit hit. Try again shortly.',
            ];

            const randomMessage =
              messages[Math.floor(Math.random() * messages.length)];
            let retryInMessage = '';

            if (error.data?.retryAfter) {
              retryInMessage +=
                ' Try again ' +
                formatDistanceToNow(Date.now() + error.data.retryAfter, {
                  addSuffix: true,
                }) +
                '.';
            }

            toast.error(`${randomMessage}${retryInMessage}`);
          } else {
            const genericMessages = [
              'Something went wrong.',
              'Request failed.',
              'An error occurred.',
            ];

            const randomError =
              genericMessages[
                Math.floor(Math.random() * genericMessages.length)
              ];
            toast.error(error.data?.message || randomError);
            console.error(error);
          }
        },
      },
      queries: {
        ...(convexQueryClient
          ? {
              queryFn: convexQueryClient.queryFn(),
              queryKeyHashFn: convexQueryClient.hashFn(),
            }
          : {}),
        refetchInterval: false,
        refetchOnMount: true, // true
        refetchOnReconnect: false, // true
        refetchOnWindowFocus: false, // true
        retry: false,
        retryOnMount: false, // avoid infinite query

        // refetchOnWindowFocus: process.env.NODE_ENV === 'production',
        // retry: process.env.NODE_ENV === 'production',
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // staleTime: 0,
      },
    },
  });
  convexQueryClient?.connect(queryClient);

  return queryClient;
};
