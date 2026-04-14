import { midtransProvider } from './midtrans';
import type { PaymentProvider, ProviderConfig } from './interface';

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const providers: Record<string, PaymentProvider> = {
  midtrans: midtransProvider,
};

/**
 * Return a PaymentProvider by name.
 * Throws if the provider is not registered.
 */
export function getPaymentProvider(providerName: string): PaymentProvider {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(
      `Unknown payment provider "${providerName}". Available: ${Object.keys(providers).join(', ')}`,
    );
  }
  return provider;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/**
 * Build a ProviderConfig for the given organisation.
 *
 * - Secrets (keys) are read from environment variables so they never touch the DB.
 * - Non-sensitive settings (sandboxMode, extra flags) come from the
 *   `paymentProviders` table record.
 */
export function getProviderConfig(args: {
  providerName: string;
  /** DB record from the paymentProviders table (plain object). */
  dbRecord: {
    sandboxMode?: boolean;
    config?: Record<string, any>;
  };
}): ProviderConfig {
  const { providerName, dbRecord } = args;

  let serverKey: string;
  let clientKey: string;

  switch (providerName) {
    case 'midtrans':
      serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
      clientKey = process.env.MIDTRANS_CLIENT_KEY ?? '';
      break;
    default:
      throw new Error(`No env mapping for provider "${providerName}"`);
  }

  return {
    serverKey,
    clientKey,
    sandboxMode: dbRecord.sandboxMode ?? false,
    ...(dbRecord.config ?? {}),
  };
}

// Re-export types for convenience
export type { PaymentProvider, ProviderConfig, PaymentResult, VerificationResult, WebhookResult, RefundResult } from './interface';
