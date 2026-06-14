/**
 * "More" tab — profile, app info, and the sign-out action.
 *
 * Sign-out goes through the mobile auth provider so the full cleanup chain
 * runs: server sign-out (best-effort) → clear secure storage → reset Convex
 * auth → the root redirect sends the user back to the login screen.
 */
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';

export default function MoreScreen() {
  const { user, signOut, status } = useAuth();
  const isSigningOut = status === 'signingOut';

  return (
    <View className="flex-1 bg-background px-6 pt-12 gap-6">
      <View className="gap-1">
        <Text variant="h2">{user?.name ?? user?.email ?? 'Account'}</Text>
        {user?.email ? (
          <Text variant="muted">{user.email}</Text>
        ) : null}
      </View>

      <View className="gap-3">
        <Button variant="outline" disabled>
          Settings
        </Button>
        <Button
          variant="destructive"
          loading={isSigningOut}
          disabled={isSigningOut}
          onPress={() => void signOut()}
        >
          Sign out
        </Button>
      </View>
    </View>
  );
}
