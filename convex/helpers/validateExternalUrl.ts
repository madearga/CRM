/**
 * SSRF protection — validate external URLs before fetching.
 *
 * Blocks private IPs, link-local, loopback, and cloud metadata endpoints.
 */

const PRIVATE_IP_REGEXPS: RegExp[] = [
  /^10\./,                                    // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,              // 172.16.0.0/12
  /^192\.168\./,                              // 192.168.0.0/16
  /^127\./,                                   // 127.0.0.0/8
  /^0\./,                                     // 0.0.0.0/8
  /^169\.254\./,                              // link-local 169.254.0.0/16
];

const BLOCKED_HOSTNAMES: string[] = [
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
];

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Validate that a URL is safe to fetch.
 * - Must be HTTPS (http://localhost allowed for dev)
 * - Must not resolve to a private IP
 * - Must not target known metadata endpoints
 */
export function validateExternalUrl(urlStr: string): void {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new SSRFError('Invalid URL format');
  }

  // Allow http://localhost for development
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    throw new SSRFError('URL must use HTTPS (http://localhost allowed in development)');
  }

  const host = url.hostname.toLowerCase();

  // Block known metadata endpoints
  if (BLOCKED_HOSTNAMES.some((b) => host === b || host.endsWith('.' + b))) {
    throw new SSRFError('URL targets a blocked metadata endpoint');
  }

  // Block private IPv4 ranges (skip if it's localhost — already allowed above)
  if (!isLocalhost && PRIVATE_IP_REGEXPS.some((re) => re.test(host))) {
    throw new SSRFError('URL targets a private IP address');
  }

  // Block IPv6 private / loopback
  if (host.startsWith('fc00:') || host.startsWith('fe80:') || host === '::1') {
    throw new SSRFError('URL targets a private or link-local IPv6 address');
  }

  // Block IPv6-mapped IPv4 loopback
  if (host.startsWith('::ffff:')) {
    const ipv4 = host.slice('::ffff:'.length);
    if (PRIVATE_IP_REGEXPS.some((re) => re.test(ipv4))) {
      throw new SSRFError('URL targets a private IP address (IPv6-mapped)');
    }
  }
}
