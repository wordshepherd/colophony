# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Colophony, please report it responsibly. **Do not open a public GitHub issue.**

Email **security@colophony.pub** with:

- A description of the vulnerability
- Steps to reproduce (or a proof of concept)
- The affected component(s), if known (Hopper, Slate, Relay, Register, or infrastructure)

We will acknowledge your report within 48 hours and aim to provide an initial assessment within 5 business days.

## What Qualifies

We are interested in vulnerabilities including but not limited to:

- Authentication or authorization bypass
- Row-level security (RLS) policy violations or tenant data leakage
- SQL injection, XSS, SSRF, or other OWASP Top 10 issues
- Webhook signature bypass or replay attacks
- Federation protocol vulnerabilities (trust handshake, BSAP, HTTP signatures)
- Sensitive data exposure (PII, credentials, audit logs)

## What Does Not Qualify

- Vulnerabilities in dependencies that do not have a demonstrated exploit path in Colophony
- Issues requiring physical access to the server
- Social engineering attacks
- Denial of service via volume (rate limiting is in place)

## Disclosure

We follow coordinated disclosure. Once a fix is available, we will:

1. Release a patched version
2. Credit the reporter (unless anonymity is requested)
3. Publish a security advisory via GitHub

## Scope

This policy covers the Colophony core (AGPL-licensed packages). For vulnerabilities in third-party dependencies (Zitadel, PostgreSQL, Redis, etc.), please report to the respective projects directly.
