/**
 * Midtrans Snap integration utilities.
 * Dynamically loads the Snap.js script and provides a typed wrapper for snap.pay().
 */

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks: {
          onSuccess?: (result: Record<string, unknown>) => void;
          onPending?: (result: Record<string, unknown>) => void;
          onError?: (result: Record<string, unknown>) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

const SANDBOX_URL = 'https://app.sandbox.midtrans.com/snap/snap.js';
const PRODUCTION_URL = 'https://app.midtrans.com/snap/snap.js';

let snapScriptLoaded = false;
let snapScriptPromise: Promise<void> | null = null;

/**
 * Dynamically load the Midtrans Snap.js script.
 * Uses NEXT_PUBLIC_ENVIRONMENT to decide sandbox vs production URL.
 * Resolves immediately if the script is already loaded.
 */
export function loadSnapScript(): Promise<void> {
  if (snapScriptLoaded && window.snap) return Promise.resolve();
  if (snapScriptPromise) return snapScriptPromise;

  const isProduction =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';

  const src = isProduction ? PRODUCTION_URL : SANDBOX_URL;

  snapScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      snapScriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      snapScriptPromise = null;
      reject(new Error('Failed to load Midtrans Snap script'));
    };
    document.head.appendChild(script);
  });

  return snapScriptPromise;
}

export interface SnapPayCallbacks {
  onSuccess?: (result: Record<string, unknown>) => void;
  onPending?: (result: Record<string, unknown>) => void;
  onClose?: () => void;
  onError?: (result: Record<string, unknown>) => void;
}

/**
 * Open the Midtrans Snap payment popup.
 * Loads the script if not yet loaded, then calls window.snap.pay(token, callbacks).
 */
export async function payWithSnap(
  snapToken: string,
  callbacks: SnapPayCallbacks,
): Promise<void> {
  await loadSnapScript();

  if (!window.snap) {
    throw new Error('Midtrans Snap not available after script load');
  }

  window.snap.pay(snapToken, callbacks);
}