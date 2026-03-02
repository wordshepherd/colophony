# Governance

> How decisions are made in Colophony and how that will evolve.

---

## Overview

Colophony uses a **solo-maintainer** governance model. David Mahaffey is the project lead with final decision authority on architecture, releases, and project direction.

This is intentionally lightweight. The project is young (v2 rewrite launched early 2026) and adding formal governance structures before there is a community to govern would be premature. The model will evolve as contributors join — see [Evolution](#evolution) below.

## Current Roles

- **Maintainer** (David) — architecture decisions, code review, merge authority, release management, and project direction.

There are no formal contributor tiers or committees. Contributors who demonstrate sustained, high-quality engagement may be invited to take on more responsibility over time (e.g., triaging issues, reviewing PRs in specific areas), but this will happen organically rather than through a predefined ladder.

## Decision-Making

**Day-to-day decisions** — maintainer discretion. Bug fixes, dependency updates, minor features, and refactors are decided during development and documented in the devlog.

**Architectural decisions** — documented in [docs/architecture.md](architecture.md), which tracks the component structure, development tracks, and a decision log. Significant architectural choices are recorded there so future contributors can understand the rationale.

**Product priorities** — driven by the [backlog](backlog.md) (`docs/backlog.md`), which organizes work into tracks with priority levels (P0–P3). Community input via GitHub Issues influences prioritization, but the maintainer makes final scheduling decisions.

**Licensing** — settled. AGPL-3.0-or-later for core, MIT for SDKs and plugin tooling. See [docs/licensing.md](licensing.md) for the full boundary and rationale.

## Proposing Changes

**Bug reports and feature requests** — open a [GitHub Issue](https://github.com/colophony-project/colophony/issues). Provide enough context for someone unfamiliar with the problem to understand it.

**Major changes** — new components, architectural shifts, federation protocol changes, or anything that would affect multiple tracks — should be proposed as a GitHub Issue with the `proposal` label. A good proposal includes:

- **Problem statement** — the current limitation or need
- **Proposed approach** — what you want to build or change
- **Alternatives considered** — what else was evaluated and why it was set aside

The maintainer will typically respond within a week. There will be a discussion period before implementation begins to surface concerns and refine the approach. There is no formal RFC numbering system or accept/reject ceremony — this is a conversation, not a bureaucracy.

## Roadmap

Development is organized into **tracks** that group related work by component or concern. Track status and scope are documented in [docs/architecture.md](architecture.md) Section 6.

Deferred work is tracked in [docs/backlog.md](backlog.md) with priority levels:

| Priority | Meaning                               |
| -------- | ------------------------------------- |
| **P0**   | Blocking — must resolve before moving |
| **P1**   | Important — next session or soon      |
| **P2**   | Wanted — schedule when bandwidth fits |
| **P3**   | Nice-to-have — backlog indefinitely   |

There is no fixed release cadence. Releases happen when a coherent set of changes is ready. Versioning follows [semver](https://semver.org/) (`v{major}.{minor}.{patch}`).

## Code Review

All changes go through pull request review. Reviewers look for:

- **RLS policies** on tenant tables (multi-tenancy correctness)
- **Audit logging** for sensitive operations
- **Input validation** (Zod) on all API surfaces
- **Tests** for new functionality
- **Conventional commit messages** with component scope

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full PR process and development workflow.

## Evolution

This governance model will evolve as the project grows. Possible future changes include:

- Formal contributor roles (e.g., component maintainers, triagers)
- A decision-making process that includes more voices on architectural questions
- A steering group if the project reaches a scale that warrants one

Colophony is licensed under AGPL-3.0-or-later, which ensures the codebase remains forkable regardless of project status or maintainer availability.

Community input on governance changes is welcome via [GitHub Issues](https://github.com/colophony-project/colophony/issues). This document will be updated to reflect reality as it changes — not to describe aspirations.

## References

- [CONTRIBUTING.md](../CONTRIBUTING.md) — development setup, workflow, PR process
- [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) — community standards
- [SECURITY.md](../SECURITY.md) — vulnerability reporting
- [docs/licensing.md](licensing.md) — AGPL/MIT boundary
- [docs/architecture.md](architecture.md) — system design, tracks, decision log
- [docs/backlog.md](backlog.md) — deferred work, priorities
