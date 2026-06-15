/**
 * Button with built-in mutation lifecycle feedback.
 *
 * Wraps the U4 {@link Button} primitive and tracks a mutation through:
 *   idle → running → success (brief checkmark flash) → idle
 *   idle → running → error (inline message) → idle (retryable)
 *
 * This centralises the busy/success/error UI so every form action in the CRM
 * behaves consistently without each screen re-implementing timers.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/styles/theme';

type MutationStatus = 'idle' | 'running' | 'success' | 'error';

export interface MutationButtonProps extends Omit<ButtonProps, 'onPress'> {
  /** Async action to run when the button is pressed. */
  onPress: () => Promise<void> | void;
  /** Label shown briefly after a successful mutation. Defaults to "Saved". */
  successLabel?: string;
  /** Override the inline error message; otherwise the thrown Error message is used. */
  errorLabel?: string;
  /** How long the success state is shown before returning to idle (ms). */
  successDurationMs?: number;
}

const DEFAULT_SUCCESS_DURATION_MS = 1500;

export function MutationButton({
  onPress,
  successLabel = 'Saved',
  errorLabel,
  successDurationMs = DEFAULT_SUCCESS_DURATION_MS,
  accessibilityLabel,
  children,
  right,
  ...buttonProps
}: MutationButtonProps) {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = status === 'running' || status === 'success';
  const isError = status === 'error';

  const handlePress = useCallback(async () => {
    if (isBusy) return;

    setStatus('running');
    setErrorMessage(null);

    try {
      await onPress();
      setStatus('success');
      setTimeout(() => {
        setStatus((current) => (current === 'success' ? 'idle' : current));
      }, successDurationMs);
    } catch (err) {
      const message =
        errorLabel ??
        (err instanceof Error ? err.message : 'Something went wrong');
      setErrorMessage(message);
      setStatus('error');
    }
  }, [onPress, isBusy, errorLabel, successDurationMs]);

  const successRight = useMemo(
    () => (
      <Ionicons
        name="checkmark"
        size={18}
        color={colors.primaryForeground}
        accessibilityLabel="Success"
      />
    ),
    [],
  );

  const errorRight = useMemo(
    () => (
      <Ionicons
        name="alert-circle"
        size={18}
        color={colors.destructive}
        accessibilityLabel="Error"
      />
    ),
    [],
  );

  return (
    <View className="w-full">
      <Button
        {...buttonProps}
        onPress={handlePress}
        loading={status === 'running'}
        disabled={isBusy || buttonProps.disabled}
        accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : 'Submit')}
        accessibilityState={{ busy: status === 'running', disabled: !!(isBusy || buttonProps.disabled) }}
        right={status === 'success' ? successRight : isError ? errorRight : right}
      >
        {status === 'success' ? successLabel : children}
      </Button>

      {isError && errorMessage ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={colors.destructive}
            accessibilityLabel="Error"
          />
          <Text className="flex-1 text-sm text-destructive">{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}
