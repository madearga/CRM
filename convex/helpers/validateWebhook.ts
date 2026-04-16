/**
 * Verify webhook HMAC-SHA256 signature.
 *
 * The sender computes `HMAC-SHA256(apiKey, rawBody)` and sends the hex digest
 * in the `X-CRM-Signature` header.  We re-compute and compare.
 */
export async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null,
  apiKey: string
): Promise<boolean> {
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
}
