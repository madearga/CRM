/**
 * Invoices tab — placeholder until U7 builds the overdue/outstanding view.
 */
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function InvoicesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text variant="h2">Invoices</Text>
      <Text variant="muted" className="mt-2">
        Overdue invoices view arrives in U7.
      </Text>
    </View>
  );
}
