# Bible — 安全扫描工作流

> 安全扫描专家必须遵守的检查流程、工具选择规则、OWASP 审计清单和交付标准。

## 通用流程

```
理解扫描范围 -> 依赖与供应链检查 -> 静态代码审计 -> API 端点审查 -> 认证授权验证 -> 敏感信息扫描 -> 配置安全审查 -> 汇总报告 -> 输出修复优先级
```

## OWASP Top 10 (2021) 系统审计

### A01: Broken Access Control
- [ ] 水平权限提升：修改 API 请求中的 user ID → 期望 403
- [ ] 垂直权限提升：普通用户 token 访问 admin 端点 → 期望 403
- [ ] CORS 验证：发送 `Origin: https://evil.com` → 不反射任意来源
- [ ] 强制浏览：请求 `/admin`, `/debug`, `/.env` → 403/404
- [ ] JWT claim 操纵：修改 role/is_admin/exp claims → 401
- [ ] IDOR/BOLA：跨用户请求资源（读/写/删除）→ 403
- [ ] Mass Assignment：添加 `role`, `is_admin` 等特权字段 → 服务端忽略

**修复要点：** Deny by default、UUID 替代自增 ID、服务端 access control、CORS 白名单

### A02: Cryptographic Failures
- [ ] 密码哈希：bcrypt/scrypt/argon2id（cost ≥ 10），禁止 MD5/SHA1
- [ ] 密钥管理：不在代码中硬编码密钥，使用环境变量或 secrets manager
- [ ] 随机数生成：`crypto.randomBytes()` 或 `secrets.token_urlsafe()`，禁止 `Math.random()`
- [ ] Timing-safe 比较：使用 `crypto.timingSafeEqual()` 比较密钥
- [ ] TLS：生产环境 HTTPS + HSTS preload
- [ ] 敏感数据不记录在日志中

**修复要点：** bcrypt(12+) 哈希密码、AES-256-GCM 加密、secrets manager 存储密钥

### A03: Injection
- [ ] SQL 注入：所有查询使用参数化查询 / Prisma ORM（禁止字符串拼接）
- [ ] XSS：服务端输出编码、Content-Security-Policy 头
- [ ] 命令注入：禁止 `eval()`, `exec()`, `os.system()`, `child_process` 拼接用户输入
- [ ] 模板注入：用户输入不直接传入模板引擎
- [ ] 路径遍历：验证和规范化文件路径，拒绝 `../` 序列
- [ ] 不安全反序列化：禁止 `pickle.loads()`, `yaml.load()`（使用 `yaml.safe_load()`）

**修复要点：** 参数化查询、输出编码（HTML/JS/URL 上下文）、allowlist 验证

### A04: Insecure Design
- [ ] 速率限制：登录/注册端点 5-10 次失败后 429
- [ ] 业务逻辑：所有计算在服务端执行，不信任客户端数据
- [ ] 多步骤流程：服务端验证每一步状态，防止步骤跳过
- [ ] n8n callback 幂等性：重复 callback 不覆盖已完成状态

**修复要点：** 状态机多步骤流程、服务端计算、CAPTCHA 公开表单

### A05: Security Misconfiguration
- [ ] 调试模式：生产环境关闭 debug / verbose errors
- [ ] 默认凭证：seed 密码不用于生产（文档说明必须修改）
- [ ] 安全头：CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- [ ] 错误信息：不泄露堆栈跟踪、SQL 语句、内部路径
- [ ] 服务器版本：移除 Server / X-Powered-By 头
- [ ] Next.js middleware deprecation warning 记录（当前不阻塞）

### A06: Vulnerable Components
- [ ] `npm audit`：无 critical/high 漏洞
- [ ] 依赖版本锁定：package-lock.json 完整
- [ ] EOL 检查：框架版本未过期
- [ ] 未使用依赖：已移除
- [ ] 关键依赖安全记录评估（auth 库、ORM、文件处理库）

### A07: Authentication Failures
- [ ] 暴力破解防护：登录失败限制或指数退避
- [ ] Session cookie flags：HttpOnly, Secure, SameSite
- [ ] Session 注销：logout 后 session 失效
- [ ] 用户名枚举：有效/无效用户名返回相同错误信息
- [ ] 密码策略：最小 8 字符（NIST SP 800-63B）
- [ ] JWT 配置：短期过期 + refresh token、算法固定（防止 alg:none 攻击）

### A08: Software and Data Integrity
- [ ] n8n callback 签名验证：使用 shared secret + timing-safe 比较
- [ ] CI/CD pipeline：签名提交、保护分支
- [ ] postinstall 脚本：`prisma generate` 自动化（已有）

### A09: Logging and Monitoring
- [ ] 认证事件记录：登录成功/失败都记录
- [ ] 日志脱敏：不包含密码、token、PII
- [ ] 管理操作审计：所有管理操作记录用户身份

### A10: SSRF
- [ ] 用户可控 URL 验证：域名/协议白名单
- [ ] 阻止私有 IP：10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x
- [ ] 云元数据端点：阻止访问 169.254.169.254
- [ ] n8n webhook URL：使用环境变量，不来自用户输入

## 检查清单（详细）

### 1. 依赖与供应链安全
```bash
npm audit                              # 已知 CVE 检查
npm audit --json                       # JSON 输出
npx audit-ci --high                    # CI 门禁（high+）
```
- [ ] 检查 package.json 中是否有过时或废弃的依赖
- [ ] 检查 lock 文件完整性（package-lock.json 存在且一致）
- [ ] 评估关键依赖的安全记录（next-auth, prisma, pdf-parse, mammoth, zod）
- [ ] 检查 typosquatting（与流行包名称相似度）

### 2. 认证与授权
- [ ] 密码哈希：bcrypt/argon2（cost ≥ 10）
- [ ] JWT 配置：短期过期、refresh token、固定算法（禁止 alg:none）
- [ ] Session cookie flags：HttpOnly, Secure, SameSite=Strict
- [ ] 路由保护 middleware 覆盖所有受保护页面和 API
- [ ] 每个 API 端点逐一验证权限检查（GET /api/candidates, POST /api/upload 等）
- [ ] CSRF 防护措施

### 3. 输入验证与注入防护
- [ ] 所有用户输入经过 Zod schema 服务端校验
- [ ] SQL 注入：Prisma ORM 参数化查询（无原始 SQL 拼接）
- [ ] XSS：输出编码 + Content-Security-Policy
- [ ] 文件上传：MIME 类型 + magic bytes + 文件大小限制（已有 FIX-005）
- [ ] 路径遍历：文件路径消毒（uuid 文件名，原始名称仅存 DB）

### 4. 敏感数据保护
- [ ] `.env` 在 `.gitignore` 中
- [ ] 密码使用 bcrypt（已有）
- [ ] 密钥比较使用 `crypto.timingSafeEqual()`（已有 FIX-004）
- [ ] 错误响应不泄露内部信息
- [ ] 日志中无敏感信息明文记录
- [ ] git history 扫描：无密钥泄露（`git log -p` 搜索密钥模式）

### 5. API 安全
- [ ] 所有受保护端点返回 401/403
- [ ] Webhook/callback 端点验证 shared secret（已有）
- [ ] IDOR/BOLA 测试：修改资源 ID → 期望 403
- [ ] 响应体不包含多余内部信息
- [ ] CORS 配置合理

### 6. 配置与部署安全
- [ ] `.gitignore` 覆盖：.env, dev.db, uploads/, generated/, test-results/, playwright-report/
- [ ] Next.js 安全配置：security headers
- [ ] 生产环境无 debug 模式
- [ ] HTTPS 强制（生产环境）

## 场景路由

| 场景 | 优先动作 | 关键要求 |
|---|---|---|
| 新功能代码审查 | 按 OWASP Top 10 逐项扫描 | 覆盖新增/修改文件 |
| 发布前安全门禁 | 聚焦 CRITICAL/HIGH | 给出 GO/NO-GO |
| 依赖漏洞响应 | `npm audit` + 评估影响 | 区分可利用 vs 理论风险 |
| 定期安全巡检 | 全量扫描 + 与上次对比 | 标注新增/已修复/残余 |
| 事件响应（疑似泄露） | 密钥暴露检查 + 影响评估 | 给出轮换和缓解步骤 |

## 风险等级定义（CVSS 3.1）

| 等级 | CVSS | 定义 | 修复时限 |
|---|---|---|---|
| **CRITICAL** | ≥ 9.0 | 可直接被利用导致数据泄露或系统控制 | 立即修复，阻断发布 |
| **HIGH** | 7.0-8.9 | 可被利用但需要特定条件 | 24 小时内修复 |
| **MEDIUM** | 4.0-6.9 | 需要多个条件组合，或影响有限 | 下一个迭代修复 |
| **LOW** | 0.1-3.9 | 理论风险，实际利用概率极低 | 排入技术债务 |
| **INFO** | 0.0 | 安全最佳实践建议，非漏洞 | 可选改进 |

## 安全/不安全代码模式速查

| 模式 | ❌ 不安全 | ✅ 安全替代 |
|---|---|---|
| SQL 查询 | `` `SELECT * WHERE id = ${id}` `` | `prisma.findUnique({ where: { id } })` |
| 密码哈希 | `md5(password)` / `sha1(password)` | `bcrypt.hash(password, 12)` |
| 密钥比较 | `secret === expected` | `crypto.timingSafeEqual()` |
| 随机 token | `Math.random()` | `crypto.randomBytes(32)` |
| 命令执行 | `` `cat ${userInput}` `` | `subprocess.run(['cat', path], ...)` |
| YAML 解析 | `yaml.load(data)` | `yaml.safe_load(data)` |
| 文件路径 | `` `${uploads}/${filename}` `` | 路径规范化 + 目录边界检查 |
| JWT 验证 | `jwt.decode(token)` (无验证) | `jwt.verify(token, secret)` |

## 交付标准

1. 安全报告必须包含：扫描范围、OWASP Top 10 覆盖情况、发现列表（含 CVSS 评分和 OWASP 映射）、修复建议、残余风险声明。
2. 每个 CRITICAL/HIGH 发现必须说明：触发条件、影响范围、CVSS vector、修复代码对比示例。
3. 报告末尾必须包含「扫描未覆盖区域」声明——未检查的维度不能遗漏。
4. 高影响动作（如建议撤销密钥、暂停服务）需要用户确认。
5. 如果扫描未完成，说明阻塞原因和可继续推进的路径。

## 工具选择

| 检查类型 | 推荐工具/方法 |
|---|---|
| 依赖漏洞 | `npm audit`, `npx audit-ci` |
| 静态代码分析 | Grep/glob 模式搜索, ESLint security plugin, Semgrep |
| 密钥泄露检测 | `.env` 文件检查, `git log -p` 搜索密钥模式, TruffleHog, Gitleaks |
| API 安全 | 代码审查 + curl 测试 |
| 配置检查 | next.config.ts, middleware.ts, .gitignore 文件审查 |
| 安全头检查 | `curl -sI URL \| grep -iE "(strict-transport\|content-security\|x-frame\|x-content-type)"` |

## 参考文档

- `references/owasp-top10-checklist.md` — OWASP Top 10 详细测试程序和 CVSS 评分指导
- `references/attack-patterns.md` — XSS/SQLi/SSRF/JWT/IDOR 测试 payload 和检测模式
