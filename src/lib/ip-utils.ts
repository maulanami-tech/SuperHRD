const PRIVATE_IP_PREFIXES = [
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
  "127.",
  "::1",
  "fc00:", "fd00:",
  "fe80:",
  "::ffff:127.", "::ffff:10.", "::ffff:172.16.", "::ffff:192.168.",
];

function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  return PRIVATE_IP_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function extractIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    for (const ip of ips) {
      if (!isPrivateIp(ip)) {
        return ip;
      }
    }
    return "unknown";
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed && !isPrivateIp(trimmed)) {
      return trimmed;
    }
  }

  return "unknown";
}

export function getClientIpFromRequest(req: { headers: Headers }): string {
  return extractIpFromHeaders(req.headers);
}

export function getClientIpFromHeaders(headers: Headers): string {
  return extractIpFromHeaders(headers);
}
