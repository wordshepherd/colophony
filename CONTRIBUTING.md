# Contributing to Colophony

Thank you for your interest in contributing to Colophony! We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm 9.15+
- Docker and Docker Compose
- tmux + [Overmind](https://github.com/DarthSim/overmind) (process manager for dev servers)

### Setup

```bash
pnpm docker:up        # Start core infrastructure (PostgreSQL, Redis, MinIO, Zitadel)
pnpm install          # Install dependencies
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed development data
pnpm zitadel:setup    # Provision Zitadel auth (after first volume creation)
pnpm dev              # Start dev servers (API: 4000, Web: 3000)
```

Overmind manages the dev servers. Useful commands while `pnpm dev` is running:

```bash
overmind connect api   # Attach to API logs (detach: Ctrl+B D)
overmind connect web   # Attach to Web logs
overmind restart api   # Restart API only
```

## Development Workflow

- Branch from `main` using the convention: `feat/<topic>`, `fix/<topic>`, or `chore/<topic>`
- Write [Conventional Commits](https://www.conventionalcommits.org/) — scope with the component name when specific (e.g., `feat(hopper): add bulk review action`)
- PRs are squash-merged into `main`

## Running Tests

```bash
pnpm test                                  # Unit tests (Vitest)
pnpm test:e2e                              # API integration tests
pnpm --filter @colophony/web test:e2e      # Playwright browser tests (needs dev servers running)
```

## Code Quality

```bash
pnpm lint          # ESLint
pnpm format        # Prettier (write)
pnpm format:check  # Prettier (check only)
pnpm type-check    # TypeScript (tsc --noEmit)
```

Git hooks enforce quality automatically:

- **Pre-commit:** secret scanning + Prettier formatting on staged files
- **Pre-push:** TypeScript type-check + ESLint

## Pull Request Process

The `main` branch is protected. All changes require:

1. A pull request
2. Passing CI (lint, type-check, tests, build)
3. Review from a maintainer

When submitting a PR:

- Fill out the [pull request template](.github/pull_request_template.md)
- New database tables must include RLS policies
- Sensitive operations must include audit logging
- All API inputs must be validated with Zod

## Architecture

Colophony is organized into four suite components (Hopper, Slate, Relay, Register) plus shared infrastructure. See [docs/architecture.md](docs/architecture.md) for the full architecture overview.

Per-directory `CLAUDE.md` files contain domain-specific context for each package and app.

## License

By contributing to Colophony, you agree that your contributions will be licensed under the [AGPL-3.0-or-later](LICENSE) license. See [docs/licensing.md](docs/licensing.md) for details on the licensing boundary (SDKs and plugin tooling use MIT).

## Reporting Issues

- **Bugs and feature requests:** [GitHub Issues](https://github.com/colophony-project/colophony/issues)
- **Security vulnerabilities or conduct concerns:** hi@colophony.pub
