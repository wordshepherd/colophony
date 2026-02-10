# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue.
2. Email **security@prospector.dev** (or create a [GitHub Security Advisory](https://github.com/your-org/prospector/security/advisories/new)) with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. You will receive an acknowledgment within **48 hours**.
4. We aim to provide a fix within **7 days** for critical issues.

## Security Measures

This project implements:

- **Row-Level Security (RLS)** — PostgreSQL FORCE RLS on all tenant tables
- **Non-superuser application role** — app_user cannot bypass RLS
- **JWT + refresh token rotation** — 15-min access tokens, single-use refresh tokens
- **Rate limiting** — 100 req/min default, 20 req/min auth endpoints
- **Security headers** — CSP, HSTS, X-Content-Type-Options
- **Pre-commit secret scanning** — blocks live API keys, private keys, .env files
- **Input validation** — Zod schemas on all tRPC procedure inputs
- **File virus scanning** — ClamAV via BullMQ before files reach production storage
- **Audit logging** — all sensitive operations logged with actor, IP, user-agent
- **GDPR compliance** — data export, erasure, consent management, retention policies

## Responsible Disclosure

We appreciate security researchers who follow responsible disclosure. We will:

- Acknowledge your report promptly
- Keep you informed of our progress
- Credit you in the advisory (unless you prefer anonymity)
