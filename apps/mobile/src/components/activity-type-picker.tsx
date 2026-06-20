/**
 * Activity type picker (U6).
 *
 * Renders a horizontal wrap of selectable chips for the user-facing activity
 * types. The system-only `status_change` type (auto-generated on deal stage
 * transitions) is hidden from the picker — users never log it manually.
 *
 * Source of truth: `ACTIVITY_TYPES` from `@crm/domain`.
 */
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { colors } from '@/styles/theme';
import { ACTIVITY_TYPES, type ActivityType } from '@crm/domain';

/** Types a user can manually create. `status_change` is system-only. */
export const USER_ACTIVITY_TYPES = ACTIVITY_TYPES.filter(
  (t): t is Exclude<ActivityType, 'status_change'> => t !== 'status_change',
);

const TYPE_META: Record<
  Exclude<ActivityType, 'status_change'>,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  call: { label: 'Call', icon: 'call-outline' },
  email: { label: 'Email', icon: 'mail-outline' },
  meeting: { label: 'Meeting', icon: 'people-outline' },
  note: { label: 'Note', icon: 'document-text-outline' },
};

export interface ActivityTypePickerProps {
  value: ActivityType;
  onChange: (type: ActivityType) => void;
  /** Extra class names for the container. */
  className?: string;
}

export const ActivityTypePicker = memo(function ActivityTypePicker({
  value,
  onChange,
  className,
}: ActivityTypePickerProps) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {USER_ACTIVITY_TYPES.map((type) => {
        const meta = TYPE_META[type];
        const selected = value === type;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Activity type: ${meta.label}`}
            className={cn(
              'min-h-[44px] flex-row items-center gap-2 rounded-md border px-3.5 py-2.5',
              selected
                ? 'border-primary bg-primary'
                : 'border-border bg-card',
            )}
          >
            <Ionicons
              name={meta.icon}
              size={16}
              color={selected ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              className={cn(
                'text-sm font-medium',
                selected
                  ? 'text-primary-foreground'
                  : 'text-foreground',
              )}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
