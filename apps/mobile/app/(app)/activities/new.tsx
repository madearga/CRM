/**
 * New Activity screen (U6).
 *
 * Quick-log a planned activity via `api.activities.schedule`:
 *   - title (required)
 *   - type (call / email / meeting / note — from `ACTIVITY_TYPES`)
 *   - linked entity (required) — searchable via `api.search.globalSearch`
 *   - due time — quick-pick chips (no native date-picker dependency in U6)
 *   - notes (optional)
 *
 * Validation reuses `ACTIVITY_TYPES` / `ENTITY_TYPES` from `@crm/domain` as the
 * source of truth via a local Zod schema (domain exports const enums, not Zod
 * schemas yet). On success the screen pops back; the new activity shows up in
 * the Upcoming list via Convex live queries.
 */
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';

import { ActivityTypePicker } from '@/components/activity-type-picker';
import { EntityPicker, type EntityOption } from '@/components/entity-picker';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useMutation } from '@/hooks/use-convex';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format-date';
import { colors } from '@/styles/theme';
import { ACTIVITY_TYPES, ENTITY_TYPES } from '@crm/domain';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const USER_ACTIVITY_TYPES = ACTIVITY_TYPES.filter((t) => t !== 'status_change');

const CreateActivitySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Add a title')
    .max(200, 'Title is too long (200 chars max)'),
  type: z.enum(USER_ACTIVITY_TYPES as unknown as [string, ...string[]]),
  entityType: z.enum(ENTITY_TYPES as unknown as [string, ...string[]]),
  entityId: z.string().min(1),
  scheduledAt: z.number(),
  description: z.string().trim().max(2000, 'Notes are too long').optional(),
});

type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
type FormErrors = Partial<Record<keyof CreateActivityInput, string>>;

// ---------------------------------------------------------------------------
// Due-time quick picks
// ---------------------------------------------------------------------------

interface DueOption {
  key: string;
  label: string;
  compute: () => number;
}

function atHour(base: Date, hour: number): number {
  const x = new Date(base);
  x.setHours(hour, 0, 0, 0);
  return x.getTime();
}

const DUE_OPTIONS: DueOption[] = [
  {
    key: '1h',
    label: 'In 1 hour',
    compute: () => Date.now() + 60 * 60 * 1000,
  },
  {
    key: 'tonight',
    label: 'Today, 6 PM',
    compute: () => {
      const t = atHour(new Date(), 18);
      return t <= Date.now() ? atHour(new Date(Date.now() + 86400000), 18) : t;
    },
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow, 9 AM',
    compute: () => atHour(new Date(Date.now() + 86400000), 9),
  },
  {
    key: '3d',
    label: 'In 3 days',
    compute: () => Date.now() + 3 * 86400000,
  },
  {
    key: '1w',
    label: 'Next week',
    compute: () => Date.now() + 7 * 86400000,
  },
];

const DEFAULT_DUE_KEY = 'tomorrow';

// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="body-sm" className="mb-2 mt-1">
      {children}
    </Text>
  );
}

const fieldClass =
  'h-12 rounded-md border border-border bg-card px-3 text-sm text-foreground';

export default function NewActivityScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof USER_ACTIVITY_TYPES)[number]>('call');
  const [entity, setEntity] = useState<EntityOption | null>(null);
  const [dueKey, setDueKey] = useState<string>(DEFAULT_DUE_KEY);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // Success flash: briefly show a saved state before navigating back so the
  // user gets feedback without a toast/haptics dependency (added in U8).
  const [justSaved, setJustSaved] = useState(false);

  const scheduleActivity = useMutation(api.activities.schedule);

  const scheduledAt = useMemo(() => {
    const opt = DUE_OPTIONS.find((o) => o.key === dueKey) ?? DUE_OPTIONS[2];
    return opt.compute();
  }, [dueKey]);

  const canSubmit = title.trim().length > 0 && entity !== null;

  const handleSubmit = async () => {
    if (!entity) {
      setErrors({ entityId: 'Link an entity to continue' });
      return;
    }

    const input: CreateActivityInput = {
      title: title.trim(),
      type,
      entityType: entity.entityType,
      entityId: entity.entityId,
      scheduledAt,
      description: notes.trim() || undefined,
    };

    const parsed = CreateActivitySchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CreateActivityInput;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await scheduleActivity({
        title: parsed.data.title,
        description: parsed.data.description,
        type: parsed.data.type as (typeof USER_ACTIVITY_TYPES)[number],
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        scheduledAt: parsed.data.scheduledAt,
      });

      // Brief success flash, then pop. The Upcoming list refreshes via Convex
      // live query automatically.
      setJustSaved(true);
      setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(app)/activities');
      }, 350);
    } catch (err) {
      setErrors({
        title:
          err instanceof Error
            ? err.message
            : 'Could not create activity. Try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View>
          <SectionLabel>Title</SectionLabel>
          <TextInput
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
            }}
            placeholder="e.g. Follow-up call with Acme"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
            accessibilityLabel="Activity title"
            className={fieldClass}
          />
          {errors.title ? (
            <Text className="mt-1.5 text-sm text-destructive" accessibilityRole="alert">
              {errors.title}
            </Text>
          ) : null}
        </View>

        {/* Type */}
        <View className="mt-6">
          <SectionLabel>Type</SectionLabel>
          <ActivityTypePicker value={type} onChange={setType} />
        </View>

        {/* Linked entity */}
        <View className="mt-6">
          <SectionLabel>Linked to</SectionLabel>
          <EntityPicker
            value={entity}
            onChange={(next) => {
              setEntity(next);
              if (errors.entityId) setErrors((e) => ({ ...e, entityId: undefined }));
            }}
            error={errors.entityId}
          />
          {entity == null ? (
            <Text variant="caption" className="mt-1.5">
              Search a deal, contact, or company to link this activity.
            </Text>
          ) : null}
        </View>

        {/* Due time */}
        <View className="mt-6">
          <SectionLabel>When</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {DUE_OPTIONS.map((opt) => {
              const active = dueKey === opt.key;
              return (
                <Button
                  key={opt.key}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setDueKey(opt.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt.label}
                >
                  {opt.label}
                </Button>
              );
            })}
          </View>
          <Text variant="caption" className="mt-2">
            {formatDateTime(scheduledAt)}
          </Text>
        </View>

        {/* Notes */}
        <View className="mt-6">
          <SectionLabel>Notes (optional)</SectionLabel>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any context for this activity…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            accessibilityLabel="Activity notes"
            className="min-h-[88px] rounded-md border border-border bg-card p-3 text-sm text-foreground"
            style={{ textAlignVertical: 'top' }}
          />
        </View>
      </ScrollView>

      {/* Sticky submit bar */}
      <View
        className="border-t border-border bg-background px-4 pb-6 pt-3"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      >
        <Button
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit || submitting}
          left={
            justSaved ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.primaryForeground} />
            ) : undefined
          }
        >
          {justSaved ? 'Saved' : 'Save activity'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
