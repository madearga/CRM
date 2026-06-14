import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { NetworkBanner } from "@/components/network-banner";

/**
 * U4 component gallery — renders every primitive to verify integration,
 * touch targets, and theme mapping in one screen.
 */
export default function GalleryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
        gap: 24,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-semibold text-foreground">
          Component Gallery
        </Text>
        <Link href="/" className="text-sm text-primary">
          Back
        </Link>
      </View>

      {/* Text variants */}
      <Card>
        <CardHeader>
          <CardTitle>Text</CardTitle>
          <CardDescription>Typography scale mapped to tokens.</CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          <Text className="text-xl font-semibold text-foreground">Page title</Text>
          <Text className="text-lg font-semibold text-foreground">Card title</Text>
          <Text className="text-base font-semibold text-foreground">Section label</Text>
          <Text className="text-sm text-foreground">Body text</Text>
          <Text className="text-sm text-muted-foreground">Muted text</Text>
          <Text className="text-xs text-muted-foreground">Caption</Text>
        </CardContent>
      </Card>

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Variants, sizes, loading, disabled.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <Button>Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <View className="flex-row gap-3">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button
              size="icon"
              accessibilityLabel="Add item"
              left={<View className="h-4 w-4 rounded-full bg-primary-foreground" />}
            />
          </View>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Status variants used in the MVP.</CardDescription>
        </CardHeader>
        <CardContent className="flex-row flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </CardContent>
      </Card>

      {/* Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Skeleton</CardTitle>
          <CardDescription>Pulse loading placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <View className="flex-row gap-2 pt-1">
            <Skeleton className="h-10 w-10 rounded-full" circle />
            <View className="flex-1 gap-2">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Empty state */}
      <Card>
        <CardHeader>
          <CardTitle>EmptyState</CardTitle>
          <CardDescription>Icon + title + description + action.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<View className="h-6 w-6 rounded bg-muted-foreground" />}
            title="No deals yet"
            description="Create your first deal to see it here."
            action={<Button size="sm">Create deal</Button>}
          />
        </CardContent>
      </Card>

      {/* Network banner */}
      <Card>
        <CardHeader>
          <CardTitle>NetworkBanner</CardTitle>
          <CardDescription>Offline warning + online confirmation.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3 overflow-hidden rounded-xl">
          <NetworkBanner online={false} onRetry={() => {}} />
          <NetworkBanner online />
        </CardContent>
      </Card>

      {/* Card edge case: long text */}
      <Card>
        <CardHeader>
          <CardTitle>
            This is an extremely long card title that should truncate gracefully after two lines rather than overflow the card bounds.
          </CardTitle>
          <CardDescription>
            Similarly, a very long description should be clamped to three lines so the card keeps a predictable footprint on small screens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-foreground">
            Content is not clamped; consumers decide how to handle overflow.
          </Text>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm">Cancel</Button>
          <Button size="sm">Confirm</Button>
        </CardFooter>
      </Card>
    </ScrollView>
  );
}
