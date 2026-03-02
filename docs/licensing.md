# Licensing

> **TL;DR:** Colophony is free to use, modify, and self-host. If you modify the source code and run it as a network service, you must share your modifications under the same license. Unmodified deployments have no obligations beyond preserving the license notice.

The authoritative license text is in [`LICENSE`](../LICENSE) at the repository root.

---

## Colophony License: AGPL-3.0-or-later

Colophony is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) or any later version.

### What can I do?

| Action                                           | Allowed? | Conditions                                     |
| ------------------------------------------------ | -------- | ---------------------------------------------- |
| Use Colophony for your literary magazine         | Yes      | None                                           |
| Self-host on your own infrastructure             | Yes      | None                                           |
| Modify the source code for internal use          | Yes      | None                                           |
| Run a modified version as a network service      | Yes      | Must publish your modifications under AGPL-3.0 |
| Distribute modified copies                       | Yes      | Must include source under AGPL-3.0             |
| Build and sell plugins (via the Plugin SDK)      | Yes      | Plugins are separate works (see below)         |
| Use Colophony's REST/GraphQL API from your code  | Yes      | API consumers are not derivative works         |
| Offer Colophony as a hosted service (unmodified) | Yes      | None (no modifications = no obligation)        |
| Offer a modified Colophony as a hosted service   | Yes      | Must publish your modifications under AGPL-3.0 |

---

## MIT-Licensed Components

Some components are licensed under the permissive [MIT License](https://opensource.org/licenses/MIT) to reduce friction for plugin developers and API consumers.

| Package                           | License | Rationale                                   |
| --------------------------------- | ------- | ------------------------------------------- |
| `@colophony/plugin-sdk`           | MIT     | Plugin developers should not inherit AGPL   |
| `@colophony/create-plugin`        | MIT     | Scaffolding tool for plugin developers      |
| `@colophony/sdk` (TypeScript SDK) | MIT     | API consumers should not inherit AGPL       |
| `colophony` (Python SDK)          | MIT     | API consumers should not inherit AGPL       |
| `@colophony/eslint-config`        | MIT     | Shared dev tooling, not part of the runtime |
| `@colophony/typescript-config`    | MIT     | Shared dev tooling, not part of the runtime |

---

## Third-Party AGPL Boundary

Colophony depends on two AGPL-licensed projects that run as **separate Docker containers**, communicating only via network APIs:

### Zitadel (Authentication)

- **License:** AGPL-3.0
- **Interaction:** Zitadel runs in its own container. Colophony communicates via OIDC and REST APIs. No Zitadel source code is included in or linked with Colophony.
- **Implication:** The AGPL boundary is at the network API. Colophony's code is not a derivative work of Zitadel. If you modify Zitadel itself, Zitadel's AGPL applies to those modifications.

### Coolify (Deployment Orchestration)

- **License:** AGPL-3.0
- **Interaction:** Coolify runs as a separate management platform on the hosting infrastructure. Colophony interacts with it via REST API for deployment automation.
- **Implication:** Same network-boundary separation as Zitadel. No source linkage.

---

## Plugin Developers

The **Plugin SDK** (`@colophony/plugin-sdk`) is MIT-licensed. Plugins that depend only on the SDK are separate works and can use any license. The SDK provides:

- Adapter interfaces (email, storage, payment, CMS)
- Hook definitions and lifecycle contracts
- Configuration schema helpers
- A testing harness

Plugins that copy or modify AGPL-licensed Colophony core code (beyond what the SDK provides) would be subject to the AGPL. In practice, the SDK is designed so that plugins never need to do this.

---

## Self-Hosters

| Scenario                                           | Obligation                                                 |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Run Colophony unmodified                           | None (preserve the LICENSE file)                           |
| Modify Colophony and run it for your organization  | None (internal use is not distribution or network service) |
| Modify Colophony and offer it as a network service | Publish your modifications under AGPL-3.0                  |
| Use Colophony's API from your own application      | None (API consumers are not derivative works)              |
| Swap Zitadel for a different auth provider         | None (your code is yours; Zitadel itself remains AGPL)     |

---

## Disclaimer

This document is a plain-language summary for convenience. It is not legal advice. The [`LICENSE`](../LICENSE) file is the authoritative legal text. If there is any conflict between this document and the LICENSE file, the LICENSE file governs.
