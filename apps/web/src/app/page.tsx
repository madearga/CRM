import { authGuard } from '@/lib/convex/rsc';

export default async function HomePage() {
  await authGuard();

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Your CRM dashboard will appear here.
      </p>
    </div>
  );
}
