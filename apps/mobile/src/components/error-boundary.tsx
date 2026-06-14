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

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  override render() {
    const { error, retryKey } = this.state;

    if (error) {
      const body =
        this.props.message ??
        error.message ??
        'Something went wrong while loading.';

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
