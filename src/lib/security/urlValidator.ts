/**
 * AI Launch QA — Security & SSRF Validation Engine
 * Enforces strict isolation, private RFC1918 / loopback / cloud metadata blocking
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
  errorCode?: 'INVALID_URL' | 'SECURITY_BLOCKED' | 'UNSUPPORTED_SCHEME' | 'PRIVATE_IP';
  details?: string;
}

// Blocked Hostnames / Patterns
const FORBIDDEN_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  'instance-data',
  'metadata.internal',
  'kubernetes.default',
  'vault.internal',
];

// Blocked ports that are dangerous or non-HTTP/S
const FORBIDDEN_PORTS = [
  21, 22, 23, 25, 53, 110, 143, 445, 1433, 1521, 3306, 5432, 6379, 8080, 9200, 11211, 27017, 28017
];

/**
 * Checks whether an IPv4 address belongs to a reserved/private network
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b, c, d] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private RFC1918)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private RFC1918)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private RFC1918)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-Local / AWS & GCP Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Validates a target URL before any audit or crawler navigation is initiated
 */
export function validateTargetUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      error: 'URL cannot be empty.',
      errorCode: 'INVALID_URL',
    };
  }

  const trimmed = rawUrl.trim();

  // Auto-prepend https:// if protocol is omitted
  let formattedUrl = trimmed;
  if (!/^https?:\/\//i.test(formattedUrl)) {
    // Check if dangerous schemes were explicitly attempted
    if (/^(file|ftp|gopher|data|javascript|blob|mailto|ssh|telnet|dict):/i.test(formattedUrl)) {
      return {
        isValid: false,
        error: 'Unsupported URL scheme. Only HTTP and HTTPS are permitted.',
        errorCode: 'UNSUPPORTED_SCHEME',
        details: 'Blocked protocol for browser safety.',
      };
    }
    formattedUrl = `https://${formattedUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(formattedUrl);
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format. Please provide a well-formed web address.',
      errorCode: 'INVALID_URL',
    };
  }

  // Enforce HTTP / HTTPS protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Forbidden scheme '${parsed.protocol}'. Only http:// and https:// targets can be audited.`,
      errorCode: 'UNSUPPORTED_SCHEME',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check forbidden exact hostnames
  if (FORBIDDEN_HOSTNAMES.includes(hostname)) {
    return {
      isValid: false,
      error: `Security policy blocked request: target '${hostname}' is a loopback or internal host.`,
      errorCode: 'SECURITY_BLOCKED',
      details: 'SSRF Protection: Access to localhost, loopback, and metadata endpoints is disallowed.',
    };
  }

  // Check for IPv4 literal strings
  const isIpv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (isIpv4Pattern.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return {
        isValid: false,
        error: `Security policy blocked request: '${hostname}' is inside a private or link-local RFC1918 range.`,
        errorCode: 'PRIVATE_IP',
        details: 'SSRF Protection: Direct access to private internal IP addresses is prohibited.',
      };
    }
  }

  // Check forbidden subdomains or metadata endpoints
  if (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.includes('169.254.169.254')
  ) {
    return {
      isValid: false,
      error: `Security policy blocked request to internal/private domain '${hostname}'.`,
      errorCode: 'SECURITY_BLOCKED',
    };
  }

  // Check port restrictions if non-standard
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    if (FORBIDDEN_PORTS.includes(portNum)) {
      return {
        isValid: false,
        error: `Access to port ${portNum} is restricted for security.`,
        errorCode: 'SECURITY_BLOCKED',
      };
    }
  }

  // Normalize: Clean hash fragments from audit target root
  parsed.hash = '';

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
  };
}
