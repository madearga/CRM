'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignForm } from '@/lib/convex/components/login-form';
import { useSession } from '@/lib/convex/auth-client';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { data, isPending } = useSession();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isPending && data?.session) {
      router.replace('/');
    }
  }, [data, isPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="relative w-full max-w-sm">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative rounded-2xl border bg-white/80 p-8 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
          {/* Branding */}
          <div className="mb-8 flex flex-col items-center">
            <div className="flex size-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
              <Building2 className="size-7 text-white" />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome to CRM
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sign in to manage your pipeline
            </p>
          </div>

          <SignForm />

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} CRM. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
