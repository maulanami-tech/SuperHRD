# PoC 1: DEAD MIDDLEWARE — All Security Controls Disabled

## Severity: CRITICAL

## Finding
`src/proxy.ts` contains comprehensive security middleware logic but is **never loaded by Next.js**:
- File is named `proxy.ts`, not `middleware.ts`
- Exported function is `proxy()`, not `middleware()`
- No file imports or references `proxy.ts`
- No `src/middleware.ts` exists in the project

## Impact
ALL security controls in `proxy.ts` are **dead code**:
1. **CSRF Protection** — Disabled. State-changing POST/PUT/DELETE/PATCH requests have no origin validation.
2. **Session Checks** — Disabled at middleware level. API routes rely solely on per-handler `auth()` calls.
3. **Security Headers** — Disabled. No `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy` headers are set.
4. **Admin Path Protection** — Disabled. No middleware-level redirect for unauthenticated `/admin` access.
5. **Static Asset Bypass** — No middleware, so there's no early bypass for `_next/static`, `favicon`, etc.

## Proof
```bash
# Step 1: Verify no middleware.ts exists
find src/ -name "middleware.ts" -o -name "middleware.js" 2>/dev/null
# Expected: No output (file does not exist)

# Step 2: Verify proxy.ts is never imported
grep -r "proxy" src/ --include="*.ts" | grep -v "node_modules" | grep -v "proxy.ts"
# Expected: No import references to proxy.ts

# Step 3: Verify export name mismatch
grep "export default" src/proxy.ts
# Output: export default function proxy()
# Next.js requires: export default function middleware()

# Step 4: Verify no middleware config
grep "middleware" src/proxy.ts
# Only found in the config export — but config is irrelevant since function name is wrong
```

## Expected Output
The proxy.ts security controls are completely inert. All API routes are accessible without session tokens at the middleware level (each route must implement its own auth check).

## Exploitation
An attacker can:
1. Make CSRF attacks against POST /api/topup/qris, POST /api/upload, etc. with no origin validation
2. Access admin routes without session cookies at the middleware level
3. No security headers are set on any response
