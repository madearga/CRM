'use client';

import dynamic from 'next/dynamic';

const TemplateForm = dynamic(
  () => import('@/components/templates/template-form').then(m => ({ default: m.TemplateForm })),
  { loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div> }
);

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <TemplateForm />
    </div>
  );
}
