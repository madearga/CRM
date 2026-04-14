import type {
  PaymentProvider,
  PaymentResult,
  ProviderConfig,
  RefundResult,
  VerificationResult,
  WebhookResult,
} from './interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SNAP_SANDBOX_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const SNAP_PRODUCTION_URL = 'https://app.midtrans.com/snap/v1/transactions';
const API_SANDBOX_BASE = 'https://api.sandbox.midtrans.com/v2';
const API_PRODUCTION_BASE = 'https://api.midtrans.com/v2';

function snapUrl(config: ProviderConfig): string {
  return config.sandboxMode ? SNAP_SANDBOX_URL : SNAP_PRODUCTION_URL;
}

function apiBase(config: ProviderConfig): string {
  return config.sandboxMode ? API_SANDBOX_BASE : API_PRODUCTION_BASE;
}

/** Base64-encoded Basic auth header value from the server key. */
function basicAuth(serverKey: string): string {
  return `Basic ${btoa(serverKey + ':')}`;
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export const midtransProvider: PaymentProvider = {
  name: 'midtrans',

  async initiatePayment({
    orderId,
    amount,
    currency = 'IDR',
    itemDetails,
    customerDetails,
    config,
  }): Promise<PaymentResult> {
    const body: Record<string, any> = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
        currency,
      },
    };

    if (itemDetails?.length) {
      body.item_details = itemDetails;
    }

    if (customerDetails) {
      body.customer_details = {
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        email: customerDetails.email,
        phone: customerDetails.phone,
      };
    }

    const res = await fetch(snapUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: basicAuth(config.serverKey),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Midtrans initiatePayment failed (${res.status}): ${text}`);
    }

    const data = await res.json();

    return {
      paymentRef: data.transaction_id ?? orderId,
      clientData: {
        token: data.token,
        redirectUrl: data.redirect_url,
      },
    };
  },

  async verifyPayment({ orderId, config }): Promise<VerificationResult> {
    const url = `${apiBase(config)}/${orderId}/status`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: basicAuth(config.serverKey),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Midtrans verifyPayment failed (${res.status}): ${text}`);
    }

    const data = await res.json();

    const statusMap: Record<string, VerificationResult['status']> = {
      capture: 'paid',
      settlement: 'paid',
      deny: 'failed',
      cancel: 'failed',
      expire: 'expired',
      pending: 'pending',
    };

    const status = statusMap[data.transaction_status] ?? 'pending';

    return {
      success: status === 'paid',
      status,
      paymentRef: data.transaction_id ?? orderId,
      metadata: {
        fraudStatus: data.fraud_status,
        paymentType: data.payment_type,
        transactionTime: data.transaction_time,
      },
    };
  },

  async handleWebhook({ body, headers, config }): Promise<WebhookResult> {
    const parsed = JSON.parse(body);

    // Verify HMAC-SHA512 signature (Midtrans uses SHA-512 keyed with server key)
    const signatureKey = parsed.signature_key ?? '';
    const expectedInput = [
      parsed.order_id,
      parsed.status_code,
      parsed.gross_amount,
      config.serverKey,
    ].join('');
    // Use subtle crypto for HMAC-SHA512 via the Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(config.serverKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(expectedInput));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (computed !== signatureKey) {
      throw new Error('Midtrans webhook signature verification failed');
    }

    const statusMap: Record<string, WebhookResult['status']> = {
      capture: 'paid',
      settlement: 'paid',
      deny: 'failed',
      cancel: 'failed',
      expire: 'expired',
      pending: 'pending',
      refund: 'refund',
    };

    const status = statusMap[parsed.transaction_status] ?? 'pending';

    return {
      orderId: parsed.order_id,
      status,
      paymentRef: parsed.transaction_id ?? parsed.order_id,
      metadata: {
        fraudStatus: parsed.fraud_status,
        paymentType: parsed.payment_type,
        transactionTime: parsed.transaction_time,
      },
    };
  },

  async refund({ orderId, amount, reason, config }): Promise<RefundResult> {
    const url = `${apiBase(config)}/${orderId}/refund`;
    const body: Record<string, any> = {};

    if (amount != null) {
      body.refund_amount = amount;
    }
    if (reason) {
      body.reason = reason;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: basicAuth(config.serverKey),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Midtrans refund failed (${res.status}): ${text}`);
    }

    const data = await res.json();

    return {
      success: data.status_code === '200' || data.status_code === 200,
      refundRef: data.refund_key ?? orderId,
    };
  },
};
