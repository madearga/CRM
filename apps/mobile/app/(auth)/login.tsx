/**
 * Email + password login screen.
 *
 * UX requirements (U3):
 *  - Email field with email keyboard + `returnKeyType="next"` → focuses the
 *    password field.
 *  - Password field with `returnKeyType="go"` → submits.
 *  - Inline error rendered directly below the password field.
 *  - Submit button disabled (and showing a spinner) while a sign-in is in
 *    flight; the auth machine's double-tap guard backs this up.
 *  - `KeyboardAvoidingView` keeps both fields reachable when the keyboard is
 *    up on iOS.
 *
 * Uses U4 primitives (Button, Text) plus a bare `TextInput` (no `Input`
 * primitive ships yet — U4 only has Button/Text/Card/Badge/Skeleton).
 *
 * Navigation after success is handled by the root layout redirect based on
 * `useAuth().status`, so this screen never calls `router.push` itself.
 */
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

export default function LoginScreen() {
  const { signInEmail, error, status, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const isSigningIn = status === 'signingIn';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSigningIn;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // On success the root layout redirect takes over; on failure the auth
    // machine surfaces the error inline below the password field.
    await signInEmail(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-sm gap-8">
          <View className="gap-2">
            <Text variant="h1">Sign in</Text>
            <Text variant="muted">
              Use your CRM credentials to continue.
            </Text>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Text variant="body-sm">Email</Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) clearError();
                }}
                placeholder="you@company.com"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                className="h-12 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                accessibilityLabel="Email"
              />
            </View>

            <View className="gap-2">
              <Text variant="body-sm">Password</Text>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) clearError();
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                className="h-12 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                accessibilityLabel="Password"
              />
              {/* Inline error below the password field. */}
              {error ? (
                <Text
                  className="text-sm text-destructive"
                  accessibilityRole="alert"
                >
                  {error}
                </Text>
              ) : null}
            </View>
          </View>

          <Button
            onPress={handleSubmit}
            loading={isSigningIn}
            disabled={!canSubmit}
          >
            Sign in
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
