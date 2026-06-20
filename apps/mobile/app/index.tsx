/**
 * Auth gate — the `/` route.
 *
 * Renders a splash spinner while the launch-time session check is in flight,
 * then redirects to the `(app)` shell when authenticated or the `(auth)/login`
 * screen when not. This is the single navigation pivot driven by the auth
 * state machine; individual screens never hardcode auth redirects.
 */
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

export default function Index() {
  const { status } = useAuth();

  if (status === 'initializing' || status === 'signingOut') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
