# QA Log

> Track manual and MCP-assisted testing sessions. Each entry records what was tested,
> how (Chrome DevTools MCP vs Playwright vs manual browser), issues found, and
> automation candidates identified.
>
> **When to add an entry:** After any exploratory testing, pre-release smoke test,
> or regression check done outside of automated test suites.
>
> **Automation rule:** If the same check appears 3+ times in this log, it should be
> promoted to a Playwright E2E test. Tag it `[AUTOMATE]` and create a backlog item.

## Template

<!-- Copy this for new entries -->
<!--
## YYYY-MM-DD — [Focus Area]

**Method:** Chrome DevTools MCP | Playwright MCP | Manual browser
**Areas tested:**
- [ ] [Area]: [what was verified] — [PASS|FAIL|ISSUE #N]

**Issues found:**
- None | #N: [description]

**Automation candidates:**
- None | [Check description] — [count of times tested manually]
-->

## Entries

Newest first.

---
