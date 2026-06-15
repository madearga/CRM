/**
 * Minimal React class ErrorBoundary for mobile query screens.
 *
 * Convex `useQuery` throws query errors (network, NOT_FOUND, auth) during
 * render so they can be caught by a boundary. This boundary renders a retry
 * affordance and, on retry, remounts its subtree via an incremented key so the
 * suspended query re-subscribes and re-runs.
 *
 * Class component because React requires classes for `getDerivedStateFromError`.
 */
import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional override for the error copy. Defaults to the thrown message. */
  message?: string;
  /** Optional title for the error state. */
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Bumped on retry to force a fresh subtree mount (re-runs queries). */
  retryKey: number;
}

/**
 * Generic, user-facing copy shown in place of any thrown error message. We
 * intentionally do NOT surface `error.message`: backend / Convex errors can
 * echo internal details (function names, ids, stack hints) that should never
 * reach the UI. Callers can still override via the `message` prop.
 */
const GENERIC_ERROR_MESSAGE = 'Something went wrong while loading.';

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Capture the error to trigger the fallback UI, but never render its raw
    // message — see {@link GENERIC_ERROR_MESSAGE}.
    return { error };
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  override render() {
    const { error, retryKey } = this.state;

    if (error) {
      // Sanitized copy: prefer an explicit prop override, otherwise the
      // generic message. `error.message` is deliberately NOT used.
      const body = this.props.message ?? GENERIC_ERROR_MESSAGE;

      return (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="h3" className="text-center">
            {this.props.title ?? 'Unable to load'}
          </Text>
          <Text variant="muted" className="mt-2 max-w-[280px] text-center">
            {body}
          </Text>
          <Button
            variant="default"
            className="mt-6"
            onPress={this.handleRetry}
            accessibilityLabel="Retry loading"
          >
            Retry
          </Button>
        </View>
      );
    }

    // Keying the wrapper remounts the subtree on retry → fresh useQuery.
    return (
      <View key={`eb-${retryKey}`} className="flex-1">
        {this.props.children}
      </View>
    );
  }
}
