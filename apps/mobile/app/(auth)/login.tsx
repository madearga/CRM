/**
 * Google-only login screen (matches the web app's single-button flow).
 *
 * The CRM authenticates exclusively via Google OAuth — there is no
 * email/password form on web, so mobile mirrors that. Tapping the button
 * opens the system browser (expo-web-browser) for the Google consent flow;
 * the cross-domain one-time-token exchange is handled in `AuthProvider`.
 *
 * Navigation after success is driven by the root layout redirect based on
 * `useAuth().status`, so this screen never calls `router.push` itself.
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

export default function LoginScreen() {
  const { signInGoogle, error, status, clearError } = useAuth();
  const insets = useSafeAreaInsets();
  const isSigningIn = status === 'signingIn';

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    if (error) clearError();
    await signInGoogle();
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View className="w-full max-w-sm gap-8">
        <View className="gap-2">
          <Text variant="h1">Sign in</Text>
          <Text variant="muted">Continue with your Google account.</Text>
        </View>

        <Button
          variant="outline"
          onPress={handleGoogleSignIn}
          loading={isSigningIn}
          disabled={isSigningIn}
        >
          Continue with Google
        </Button>

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
          hitSlop={8}
        >
          <Text variant="caption" className="text-center">
            By continuing you agree to our Terms of Service and acknowledge our
            Privacy Policy.
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}