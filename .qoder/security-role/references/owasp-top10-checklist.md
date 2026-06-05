# OWASP Top 10 (2021) — Next.js / TypeScript 安全检查清单

> 针对 Next.js App Router + Prisma + SQLite + NextAuth 技术栈的适配版本。
> 来源：OWASP Top 10 (2021) + claude-skills/engineering-team/security-pen-testing

---

## A01: Broken Access Control

**CWEs:** CWE-200, CWE-201, CWE-352, CWE-639, CWE-862, CWE-863

### Next.js 特定检查点

| # | 检查项 | 方法 | 期望结果 |
|---|---|---|---|
| 1 | middleware.ts 路由保护 | 检查 matcher 配置 | 所有 /dashboard, /upload, /candidates/*, /api/* (除 auth/callback) 被保护 |
| 2 | API 路由 session 检查 | 每个 route.ts 调用 auth() | 未登录返回 401 JSON |
| 3 | IDOR 测试 | 修改 /api/candidates/[id] 中的 id | 无越权访问（当前 MVP 单角色，暂低风险） |
| 4 | n8n callback 认证 | POST /api/n8n/callback 无 secret | 返回 401 |
| 5 | CORS | 检查 Next.js 默认 CORS 行为 | 不反射任意 Origin |

### 代码模式检测

```typescript
// ❌ BAD: API route without auth check
export async function GET() {
  const candidates = await prisma.candidate.findMany();
  return NextResponse.json(candidates);
}

// ✅ GOOD: Auth check before data access
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const candidates = await prisma.candidate.findMany({ where: { submittedById: session.user.id } });
  return NextResponse.json(candidates);
}
```

### CVSS 参考
- 未认证 admin 访问: **9.8** — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- 水平权限提升（读）: **6.5** — AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N
- 垂直权限提升到 admin: **8.8** — AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H

---

## A02: Cryptographic Failures

**CWEs:** CWE-259, CWE-327, CWE-328, CWE-330, CWE-331

### 检查点

| # | 检查项 | 方法 | 期望结果 |
|---|---|---|---|
| 1 | 密码哈希 | 检查 seed.ts / auth.ts | bcrypt (cost ≥ 10) 或 argon2id |
| 2 | 密钥比较 | 检查 callback route | `crypto.timingSafeEqual()` |
| 3 | Token 生成 | 检查 n8nRunId 生成 | `uuid.v4()` 或 `crypto.randomUUID()` |
| 4 | 硬编码密钥 | grep 搜索 .ts/.tsx 文件 | 无硬编码 secret/password/key |
| 5 | .env 保护 | 检查 .gitignore | .env 被忽略 |
| 6 | NEXTAUTH_SECRET | 检查生成方式 | 随机生成，非默认值 |

### CVSS 参考
- 明文传输密码: **7.5** — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N
- 弱密码哈希 (MD5): **7.5**
- 硬编码加密密钥: **7.2**

---

## A03: Injection

**CWEs:** CWE-20, CWE-74, CWE-75, CWE-77, CWE-78, CWE-79, CWE-89

### 检查点

| # | 检查项 | 方法 | 期望结果 |
|---|---|---|---|
| 1 | SQL 注入 | 搜索 `` ` `` 和 `$` 在 prisma 调用中 | 无字符串拼接查询 |
| 2 | XSS | 检查 `dangerouslySetInnerHTML` 使用 | 不存在或已净化 |
| 3 | 命令注入 | 搜索 `eval`, `exec`, `child_process` | 不存在 |
| 4 | 路径遍历 | 检查文件路径构造 | 使用 uuid 文件名，原始名称仅存 DB |
| 5 | 模板注入 | 检查 `{{` 在响应中 | 用户输入不直接渲染 |

### 代码模式检测

```typescript
// ❌ BAD: SQL injection via template literal
const result = await prisma.$queryRawUnsafe(`SELECT * FROM Candidate WHERE name = '${name}'`);

// ✅ GOOD: Prisma ORM parameterized
const result = await prisma.candidate.findMany({ where: { name: { contains: name } } });
```

```typescript
// ❌ BAD: XSS via dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ GOOD: Text content (React auto-escapes)
<p>{userContent}</p>
```

### CVSS 参考
- SQL 注入（未认证）: **9.8**
- Stored XSS: **7.1** — AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N
- 命令注入: **9.8**

---

## A07: Authentication Failures

**CWEs:** CWE-255, CWE-259, CWE-287, CWE-288, CWE-384, CWE-798

### NextAuth v5 特定检查点

| # | 检查项 | 方法 | 期望结果 |
|---|---|---|---|
| 1 | Credentials 验证 | 检查 auth.ts authorize | bcrypt.compare 验证密码 |
| 2 | Session 策略 | 检查 session config | JWT strategy |
| 3 | Session 包含 user ID | 检查 jwt/session callbacks | token.id 和 session.user.id 存在 |
| 4 | Logout 功能 | 检查 logout server action | session 被清除 |
| 5 | Seed 密码文档 | 检查 README | 说明 admin123 仅用于开发 |
| 6 | JWT 算法 | 检查 NextAuth 默认 | RS256 或 HS256（非 none） |

### CVSS 参考
- 认证绕过: **9.8**
- Session 固定: **7.5**
- 用户名枚举: **5.3**

---

## A05: Security Misconfiguration

### 检查点

| # | 检查项 | 方法 | 期望结果 |
|---|---|---|---|
| 1 | Debug 模式 | 检查 next.config.ts | 生产环境无 source maps |
| 2 | 安全头 | `curl -sI URL` | CSP, X-Frame-Options, HSTS 存在 |
| 3 | 错误信息 | 触发 404/500 | 无堆栈跟踪泄露 |
| 4 | .gitignore | 检查文件内容 | .env, dev.db, uploads/, node_modules/ |
| 5 | 默认凭证 | 检查 seed.ts | 密码 "admin123" 仅开发用 |

---

## A06: Vulnerable Components

### 检查命令

```bash
npm audit                           # 检查已知 CVE
npm audit --json                    # JSON 输出
npm outdated                        # 过时依赖
npx audit-ci --high                 # CI 门禁（high+ 失败）
```

---

## 安全头推荐配置

| Header | 推荐值 |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `geolocation=(), microphone=(), camera=()` |

---

## 密钥检测正则模式

```
AWS Access Key:     AKIA[0-9A-Z]{16}
GitHub Token:       ghp_[A-Za-z0-9]{36}
Private Key:        -----BEGIN (RSA |EC )?PRIVATE KEY-----
Generic Secret:     (?i)(password|secret|api_key)\s*=\s*["']?\S{8,}
JWT Token:          eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+
NextAuth Secret:    NEXTAUTH_SECRET\s*=\s*["']
```
