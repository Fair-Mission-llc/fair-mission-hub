'use client';
// Sprint 11 Revision 16.0: the portal's page-level error boundary. A page that throws while rendering shows this notice
// inside the portal frame instead of taking the whole app down. The frame (Providers, Shell) sits above this boundary,
// so the signed-in session stays in memory: no reload, so no trip back to the sign-in screen and no new session cookie.
import { useEffect } from 'react';
import { describeError } from '@kofc/shared';
import { Button, Notice } from '@/components/ui';

export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error('[portal] a page failed to render:', error);
  }, [error]);
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="error">This page hit a problem and could not be shown: {describeError(error)}</Notice>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    </div>
  );
}
