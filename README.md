# Colophony

Open-source infrastructure for literary magazines.

## What is Colophony?

Colophony is a self-hosted platform covering the full publication lifecycle for literary magazines: submission intake, editorial review, publication pipeline, and cross-instance federation. It provides the tools editors need to run a magazine and the tools writers need to manage their submissions — without vendor lock-in.

The platform is built around four components that work together as an integrated suite, or independently as your workflow requires. Federation support lets magazines collaborate on simultaneous submission detection, piece transfers, and writer identity portability across instances.

Colophony is designed for independent literary publications that want full control over their infrastructure and data.

## Components

| Component    | Scope                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| **Hopper**   | Submission management — forms, intake, review pipeline, decisions          |
| **Slate**    | Publication pipeline — copyedit, contracts, issue assembly, CMS publishing |
| **Relay**    | Notifications & communications — email, webhooks, in-app messaging         |
| **Register** | Identity & federation — cross-instance identity, sim-sub, piece transfers  |

## Features

- **Form builder** with custom fields, file uploads (resumable via tus), and embeddable submission forms
- **Review pipeline** with configurable stages, assignments, and bulk actions
- **Publication workflow** — copyediting, contract management (Documenso integration), and issue assembly
- **CMS publishing** with adapter support for static site generators
- **Notifications** — email (SMTP/SendGrid), webhooks, and in-app messaging
- **Cross-instance federation** — discover and trust other Colophony instances
- **Simultaneous submission detection** via the Blind Simultaneous Attestation Protocol (BSAP) — federated instances can detect overlapping submissions without revealing manuscript content or author identity to each other
- **Writer workspace** — personal portfolio, submission tracking, and analytics across magazines
- **Data portability** — export/import via the Common Submission Record (CSR) format
- **Plugin system** — extend functionality with SDK-based plugins and UI extensions
- **Analytics** — submission metrics for editors, personal stats for writers

## Quick Start

```bash
git clone https://github.com/colophony-project/colophony.git
cd colophony
pnpm docker:up        # PostgreSQL, Redis, MinIO, Zitadel
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm zitadel:setup
pnpm dev              # API on :4000, Web on :3000
```

Prerequisites: Node.js >= 22, pnpm 9.15+, Docker, tmux + Overmind. See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions.

## Tech Stack

| Layer        | Technologies                                              |
| ------------ | --------------------------------------------------------- |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend**  | Fastify 5, TypeScript, Drizzle ORM, BullMQ                |
| **Auth**     | Zitadel (OIDC)                                            |
| **Data**     | PostgreSQL 16+ (RLS), Redis 7+, MinIO (S3-compatible)     |
| **Infra**    | Docker Compose (self-hosted), Coolify + Hetzner (managed) |

## Documentation

- [Architecture](docs/architecture.md) — system design, component breakdown, development tracks
- [Licensing](docs/licensing.md) — AGPL/MIT boundary, obligations, FAQ
- [Governance](docs/governance.md) — decision-making, proposing changes, project direction
- [Testing](docs/testing.md) — test strategy, running tests, CI pipeline
- [Deployment](docs/deployment.md) — Docker Compose setup, managed hosting
- [Contributing](CONTRIBUTING.md) — development setup, workflow, PR process
- [Security Policy](SECURITY.md) — vulnerability reporting

## API

Colophony exposes three API surfaces:

- **tRPC** — internal use between the Next.js frontend and the API
- **REST + OpenAPI 3.1** — public API with full OpenAPI spec (`sdks/openapi.json`)
- **GraphQL** — queries and mutations via Pothos + Yoga

Client SDKs are available for [TypeScript](sdks/typescript/) and [Python](sdks/python/), generated from the OpenAPI spec.

## Deployment

Colophony supports two deployment models:

- **Self-hosted** — Docker Compose with PostgreSQL, Redis, MinIO, and Zitadel
- **Managed hosting** — Coolify on Hetzner (see [docs/deployment.md](docs/deployment.md))

## License

Colophony is licensed under [AGPL-3.0-or-later](LICENSE). SDKs and plugin tooling are licensed under MIT. See [docs/licensing.md](docs/licensing.md) for the full licensing boundary.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, workflow guidelines, and the PR process.

## Contact

hi@colophony.pub
