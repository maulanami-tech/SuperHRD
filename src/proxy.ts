import { NextRequest, NextResponse } from "next/server";

/**
 * Security headers applied to all responses.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/**
 * Methods that are considered state-changing and require CSRF origin validation.
 */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * Paths that bypass CSRF origin checks (server-to-server webhooks, auth flows).
 */
const CSRF_BYPASS_PATHS = ["/api/auth", "/api/n8n/callback"];

function addSecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

/**
 * Validate Origin header against Host header for CSRF protection.
 * Returns true if the request passes validation (or is exempt).
 */
function validateCsrfOrigin(req: NextRequest, pathname: string): boolean {
  // Skip CSRF check for methods that don't change state
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return true;
  }

  // Skip CSRF check for bypass paths (server-to-server, auth endpoints)
  for (const bypass of CSRF_BYPASS_PATHS) {
    if (pathname === bypass || pathname.startsWith(bypass + "/")) {
      return true;
    }
  }

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  // If no Origin header is present, this is a same-origin non-CORS request — allow
  if (!origin) {
    return true;
  }

  // Parse the origin to extract the host portion
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === host) {
      return true;
    }
  } catch {
    // Malformed origin header — reject
  }

  return false;
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Early bypass for static assets, auth routes, landing page, and server-to-server webhooks ---
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // n8n callback: no session check, no CSRF check (server-to-server), but still gets security headers
  if (pathname === "/api/n8n/callback") {
    return addSecurityHeaders(NextResponse.next());
  }

  // --- Admin routes: require session ---
  if (pathname.startsWith("/admin")) {
    const sessionToken =
      req.cookies.get("authjs.session-token") ??
      req.cookies.get("__Secure-authjs.session-token");

    if (!sessionToken) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL("/login", req.url)),
      );
    }

    // Note: isAdmin check happens in the actual route handler
    // Middleware only ensures authentication
    return addSecurityHeaders(NextResponse.next());
  }

  // --- All other routes: require session ---
  const sessionToken =
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token");

  if (!sessionToken) {
    if (pathname.startsWith("/api")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", req.url)),
    );
  }

  // --- CSRF origin validation for state-changing methods ---
  if (!validateCsrfOrigin(req, pathname)) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: "CSRF validation failed: origin mismatch" },
        { status: 403 },
      ),
    );
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
