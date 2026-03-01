# Colophony — Codex Review Rules

When reviewing code in this project, enforce these rules:

## Critical Rules

- **Multi-tenancy via RLS:** All tenant table queries MUST use `SET LOCAL` inside transactions, never session-level `SET`. `app_user` MUST NOT be superuser. All tenant tables MUST have `FORCE ROW LEVEL SECURITY`.
- **Webhook idempotency:** ALL webhook handlers (Stripe, Zitadel) MUST check processed status before handling. Use DB transactions.
- **PCI compliance:** NEVER log card numbers or CVV. NEVER store card data. Stripe Checkout only.
- **Audit logging:** Sensitive operations MUST be audit logged.
- **Input validation:** Use Zod schemas from `@colophony/types` on all API surfaces.
- **Defense-in-depth multi-tenancy:** Service methods querying tenant data MUST include explicit `organizationId` filter even when RLS is active. Unused `_orgId` parameters are a red flag.
- **SSRF protection:** Outbound HTTP calls to user-controlled URLs MUST validate via `validateOutboundUrl()`. Direct `fetch()` to user URLs without SSRF checks is Critical.
- **Unbounded queries:** List/query methods returning variable-size data MUST have a `LIMIT` or accept pagination parameters. Missing `LIMIT` is Important.

## Review Format

- Start with a one-line verdict: **LGTM**, **Minor issues**, or **Issues found**
- Group findings by severity: Critical, Important, Suggestions
- Reference specific file paths and line numbers (`file:line` format)
- Be concise — skip formatting nits (handled by linters)
- Run tests when possible to validate changes
