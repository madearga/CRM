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
    <div className="relative flex min-h-dvh items-center justify-center overflow-x-clip bg-background p-4">
      {/* Ambient glass backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-[8%] h-96 w-96 rounded-full bg-[radial-gradient(circle,var(--glow-indigo),transparent_65%)]" />
        <div className="absolute bottom-[-10%] right-[6%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,var(--glow-violet),transparent_65%)]" />
      </div>

      <div className="glass backdrop-blur-xl relative w-full max-w-sm rounded-xl p-8 shadow-lg shadow-black/20">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary shadow-lg shadow-black/30">
            <Building2 className="size-7 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            Selamat datang di Ruang
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Masuk untuk mengelola pipeline kamu
          </p>
        </div>

        <SignForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Ruang. All rights reserved.
        </p>
      </div>
    </div>
  );
}
