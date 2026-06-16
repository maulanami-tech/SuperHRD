import type { NextConfig } from "next";

function getAllowedDevOrigins() {
  const origins = new Set<string>(["localhost", "127.0.0.1"]);
  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL;

  if (appUrl) {
    try {
      origins.add(new URL(appUrl).host);
    } catch {
      // Ignore invalid local env URLs in dev.
    }
  }

  return Array.from(origins);
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
