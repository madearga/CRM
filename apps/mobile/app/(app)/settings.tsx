/**
 * Settings screen (U8).
 *
 * Shows the active account, current workspace/org name, app version, and the
 * sign-out action. Sign-out is guarded by a native confirmation dialog and
 * delegates to the auth provider's full cleanup chain:
 *   server sign-out (best-effort) → clear secure storage → reset Convex auth.
 */
import { useCallback, useMemo } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';
import { colors } from '@/styles/theme';

export default function SettingsScreen() {
  const { user, signOut, status } = useAuth();
  const router = useRouter();

  const currentUser = useQuery(api.user.getCurrentUser, {});
  const orgName = currentUser?.activeOrganization?.name;

  const appVersion = useMemo(() => {
    const config = Constants.expoConfig ?? Constants.manifest;
    return config?.version ?? '0.0.0';
  }, []);

  const isSigningOut = status === 'signingOut';

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign out?',
      "You'll need to sign in again to access your CRM.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void signOut();
          },
        },
      ],
      { cancelable: true },
    );
  }, [signOut]);

  const displayName = user?.name ?? user?.email ?? 'Account';
  const initials = useMemo(() => {
    const source = user?.name ?? user?.email ?? '?';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [user]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-10">
      <Text variant="h1">Settings</Text>

      {/** Account card **/}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex-row items-center gap-4">
          <View
            className="h-12 w-12 items-center justify-center rounded-full bg-primary"
            accessibilityRole="image"
            accessibilityLabel={`Avatar for ${displayName}`}
          >
            <Text className="text-base font-semibold text-primary-foreground">
              {initials}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body" className="font-semibold">{displayName}</Text>
            {user?.email ? <Text variant="muted">{user.email}</Text> : null}
          </View>
        </CardContent>
      </Card>

      {/** Workspace / org card **/}
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            <Ionicons
              name="business-outline"
              size={20}
              color={colors.mutedForeground}
              accessibilityLabel="Workspace"
            />
            <Text variant="body" className="flex-1">
              {orgName ?? 'Your workspace'}
            </Text>
          </View>
          {orgName ? null : (
            <Text variant="caption">Not available offline</Text>
          )}
        </CardContent>
      </Card>

      {/** App info card **/}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.mutedForeground}
                accessibilityLabel="App version"
              />
              <Text variant="body">Version</Text>
            </View>
            <Text variant="body" className="font-mono">{appVersion}</Text>
          </View>
        </CardContent>
      </Card>

      {/** Sign-out danger section **/}
      <View className="pt-2">
        <Button
          variant="destructive"
          className="w-full"
          loading={isSigningOut}
          disabled={isSigningOut}
          accessibilityLabel="Sign out of the app"
          onPress={handleSignOut}
        >
          Sign out
        </Button>
      </View>

      {/** Back to more tab (edge case when route is accessed via deep link) **/}
      <Button
        variant="ghost"
        className="mt-2 w-full"
        onPress={() => router.back()}
        accessibilityLabel="Go back"
      >
        Back
      </Button>
    </ScrollView>
  );
}
