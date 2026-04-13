'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['organization', 'user'] as const;
type Step = (typeof STEPS)[number];

export function OnboardingOverlay() {
  const [step, setStep] = useState<Step>('organization');
  const [orgName, setOrgName] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  const handleSubmit = async () => {
    if (step === 'organization') {
      if (orgName.trim().length < 2) return;
      setStep('user');
      return;
    }

    // Final step — submit to backend
    setIsSubmitting(true);
    setError(null);
    try {
      await completeOnboarding({
        organizationName: orgName.trim(),
        userName: userName.trim(),
      });
      toast.success('Setup complete! Start by adding your first contact');
      // Convex query will re-fetch user with activeOrganization, overlay disappears
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canProceed =
    (step === 'organization' && orgName.trim().length >= 2) ||
    (step === 'user' && userName.trim().length >= 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-md space-y-8 px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Building2 className="size-6 text-white" />
          </div>
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            CRM
          </span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                STEPS.indexOf(step) >= i
                  ? 'w-8 bg-white'
                  : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 'organization' ? (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Name your workspace
            </h1>
            <p className="text-sm text-neutral-400">
              This is your company or team name
            </p>
            <Input
              placeholder="e.g. Acme Inc."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-12 border-white/10 bg-white/5 text-white placeholder:text-neutral-500"
            />
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              What should we call you?
            </h1>
            <p className="text-sm text-neutral-400">
              Your name will appear on invoices and to team members
            </p>
            <Input
              placeholder="e.g. John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-12 border-white/10 bg-white/5 text-white placeholder:text-neutral-500"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !canProceed}
          className="h-12 w-full bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          {isSubmitting
            ? 'Setting up...'
            : step === 'organization'
              ? 'Continue'
              : 'Get started'}
        </Button>
      </div>
    </div>
  );
}
