/**
 * Payment provider interface and shared types for the commerce payment system.
 */

/** Result of initiating a payment through a provider. */
export type PaymentResult = {
  paymentRef: string;
  clientData: Record<string, any>;
};

/** Result of verifying a payment status with the provider. */
export type VerificationResult = {
  success: boolean;
  status: 'paid' | 'failed' | 'pending' | 'expired';
  paymentRef: string;
  metadata?: Record<string, any>;
};

/** Parsed result from a provider webhook notification. */
export type WebhookResult = {
  orderId: string;
  status: 'paid' | 'failed' | 'pending' | 'expired' | 'refund';
  paymentRef: string;
  metadata?: Record<string, any>;
};

/** Result of issuing a refund through a provider. */
export type RefundResult = {
  success: boolean;
  refundRef: string;
};

/** Configuration for a payment provider instance. */
export type ProviderConfig = {
  serverKey: string;
  clientKey: string;
  sandboxMode: boolean;
  [key: string]: any;
};

/** Contract every payment provider must implement. */
export interface PaymentProvider {
  readonly name: string;

  /** Create a payment transaction and return reference + client-side data. */
  initiatePayment(args: {
    orderId: string;
    amount: number;
    currency?: string;
    itemDetails?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    customerDetails?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    config: ProviderConfig;
  }): Promise<PaymentResult>;

  /** Check the current status of a payment with the provider. */
  verifyPayment(args: {
    orderId: string;
    config: ProviderConfig;
  }): Promise<VerificationResult>;

  /** Parse and validate an incoming webhook from the provider. */
  handleWebhook(args: {
    body: string;
    headers: Record<string, string>;
    config: ProviderConfig;
  }): Promise<WebhookResult>;

  /** Issue a full or partial refund for a transaction. */
  refund(args: {
    orderId: string;
    amount?: number;
    reason?: string;
    config: ProviderConfig;
  }): Promise<RefundResult>;
}
