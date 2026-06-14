/**
 * Activities tab — placeholder until U6 builds the list + quick-create flow.
 */
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function ActivitiesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text variant="h2">Activities</Text>
      <Text variant="muted" className="mt-2">
        Activity list + quick log arrives in U6.
      </Text>
    </View>
  );
}
