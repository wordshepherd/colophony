# Plugin / Extension System Research

> **Research date:** 2026-02-11
> **Status:** Complete -- recommendation ready for review
> **Parent document:** [docs/architecture-v2-planning.md](../architecture-v2-planning.md) (Section 5.8)
> **Context:** Colophony v2 needs an extensible architecture for adapters, integrations, and community contributions. The platform's philosophy is "integration hub with curated open-source defaults."
> **Note:** This document was originally written under the project name "Prospector" (v1). All references have been updated to use the current name "Colophony".

---

## Table of Contents

1. [Systems Studied](#1-systems-studied)
   - [A. WordPress Hooks/Filters](#a-wordpress-hooksfilters-model)
   - [B. Strapi Plugin Architecture](#b-strapi-plugin-architecture)
   - [C. Ghost Integrations Model](#c-ghost-integrations-model)
   - [D. OJS Plugin System](#d-ojs-open-journal-systems-plugin-system)
   - [E. Grafana Plugin Architecture](#e-grafana-plugin-architecture)
   - [F. VS Code Extension Model](#f-vs-code-extension-model)
   - [G. Backstage Plugin Architecture](#g-backstage-spotify-plugin-architecture)
2. [Design Patterns Evaluation](#2-design-patterns-evaluation)
3. [Plugin Categories for Colophony](#3-plugin-categories-for-colophony)
4. [Recommended Architecture](#4-recommended-architecture)
5. [Plugin SDK Package Structure](#5-plugin-sdk-package-structure)
6. [Security Model](#6-security-model)
7. [Plugin Distribution](#7-plugin-distribution)
8. [Plugin Development Experience](#8-plugin-development-experience)
9. [Configuration](#9-configuration)
10. [Comparison Summary](#10-comparison-summary)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Open Questions](#13-open-questions)

---

## 1. Systems Studied

### A. WordPress Hooks/Filters Model

WordPress has the most successful plugin ecosystem ever built, with over 65,000 plugins in the official repository and new submissions doubling in 2025. Its plugin architecture is built on two core primitives: **actions** and **filters**.

**How it works:**

- **Action hooks** fire at specific points during execution. Plugins register callbacks via `add_action('hook_name', callback, priority)`. The callback receives context data, performs side effects, and returns nothing.
- **Filter hooks** pass data through a chain of registered callbacks via `add_filter('hook_name', callback, priority)`. Each callback receives a value, modifies it, and returns the modified value.
- **Priority system** (1-999, default 10) controls execution order across all registered callbacks.
- WordPress core defines 1,300+ hook points throughout its lifecycle.
- The pattern implements the **Mediator design pattern** -- all plugins communicate through the hook API rather than directly with each other, creating loose coupling.

**Plugin lifecycle:**

1. Plugin detected in `wp-content/plugins/` directory
2. Activation hook fires (one-time setup: DB tables, defaults)
3. Plugin loaded on every request; registers its hooks
4. Deactivation hook fires (cleanup, but preserves data)
5. Uninstall hook fires (full cleanup, removes data)

**Why it succeeded:**

- Extremely low barrier to entry -- a single PHP file with a header comment is a valid plugin
- Hooks are discoverable (well-documented, predictable naming: `save_post`, `the_content`)
- Marketplace (wordpress.org) provides free distribution with search, ratings, install counts
- Premium marketplace ecosystem (CodeCanyon, Freemius) enables monetization
- Community network (WordCamps, contributor days) drives adoption
- "Good enough" pattern -- imperfect but understood by millions of developers

**What is wrong with it:**

- **Global mutable state**: All hooks exist in a global namespace. No isolation between plugins. One plugin can break another by modifying shared data.
- **No type safety**: Hook parameters are untyped. Callbacks receive `mixed` values. No compile-time checking that a callback matches the hook signature.
- **Security model is trust-based**: Plugins run with full application privileges. A malicious plugin has unrestricted database access, filesystem access, and network access. No sandboxing whatsoever.
- **Performance**: Every hook invocation iterates all registered callbacks. Poorly written plugins on hot paths (like `the_content` which fires for every post render) cause cascading slowdowns.
- **No dependency management**: Plugins cannot declare dependencies on other plugins. Load order is alphabetical by directory name.
- **Backward compatibility burden**: WordPress's commitment to never breaking plugins means the core cannot evolve its APIs cleanly.

**Relevance to Colophony:** The hook/filter pattern is the right mental model for extensibility, but the implementation needs TypeScript typing, proper isolation, and a defined permission model. The priority system and lifecycle hooks are directly applicable.

_Sources: [WordPress Hooks Handbook](https://developer.wordpress.org/plugins/hooks/), [WordPress Hook System Analysis](https://www.sitepoint.com/wordpress-hook-system/), [Mediator Pattern in WordPress](https://carlalexander.ca/mediator-pattern-wordpress/), [WordPress Security Architecture](https://www.wordfence.com/blog/2024/07/wordpress-security-research-series-wordpress-request-architecture-and-hooks/)_

---

### B. Strapi Plugin Architecture

Strapi is a modern, TypeScript-based headless CMS with a well-structured plugin system. It is relevant because it operates in an adjacent content management domain.

**How it works:**

- Plugins are npm packages following a prescribed directory structure with two entry points: `server/` (backend) and `admin/` (frontend panel).
- The **Server API** exposes controllers, routes, services, middlewares, content-type extensions, and lifecycle hooks.
- The **Admin Panel API** exposes `register()`, `bootstrap()`, and `registerTrads()` methods to inject UI components into Strapi's admin.
- Plugins can extend existing content types programmatically or by overriding schemas.

**Plugin lifecycle (initialization order):**

1. **Plugins loaded** -- Interfaces exposed
2. **Extensions loaded** -- Files in `./src/extensions` override plugin behavior
3. **`register()`** -- First lifecycle call. No access to database, routes, or policies yet. Used to register new APIs, content types, or middleware with the Strapi app.
4. **`bootstrap()`** -- Second lifecycle call. Full access to Strapi APIs. Used for seeding data, attaching webhooks, scheduling cron jobs.
5. **`destroy()`** -- Teardown when the application stops.

**Plugin SDK and distribution:**

- The Plugin SDK (`@strapi/sdk-plugin`) provides `init`, `build`, `verify`, and `watch:link` commands.
- Plugins are distributed as npm packages and/or submitted to the Strapi Marketplace.
- Local plugin development uses `watch:link` for hot-reloading during development.

**Strengths:**

- Clean separation of server and admin concerns
- TypeScript throughout (though typing of lifecycle hooks has known issues in v5)
- The `register` then `bootstrap` two-phase initialization is well-designed -- it ensures all plugins declare their interfaces before any plugin tries to use another's APIs
- Plugin extensions allow overriding another plugin's content types and behavior without forking

**Weaknesses:**

- Plugin system is tightly coupled to Strapi's internal architecture (content-type system, admin panel React app)
- Known bugs with lifecycle hooks in v5 (afterUpdate/afterCreate trigger ordering issues)
- Less modular than it appears -- extending plugins requires understanding Strapi internals deeply

**Relevance to Colophony:** The two-phase lifecycle (`register` then `bootstrap`) is directly applicable. The Plugin SDK tooling (init, build, verify, watch:link) is an excellent model for Colophony's plugin development experience. The admin panel extension pattern (injection zones, menu items, settings pages) maps well to Colophony's editorial UI extensibility needs.

_Sources: [Strapi Plugin Creation](https://docs.strapi.io/cms/plugins-development/create-a-plugin), [Strapi Plugin Structure](https://docs.strapi.io/cms/plugins-development/plugin-structure), [Strapi Server API](https://docs.strapi.io/cms/plugins-development/server-api), [Strapi Admin Panel API](https://docs.strapi.io/cms/plugins-development/admin-panel-api), [Strapi Lifecycle Functions](https://docs.strapi.io/cms/configurations/functions)_

---

### C. Ghost Integrations Model

Ghost is a publishing platform focused on membership and newsletters. It takes a deliberately minimal approach to extensibility.

**How it works:**

- **Custom Integrations** are API key pairs (Content API + Admin API) created in the Ghost admin panel. Each integration gets unique credentials for making authenticated API calls.
- **Webhooks** are HTTP POST notifications triggered by specific events. Setup requires only a trigger event and a target URL.
- **Supported webhook events:** `post.published`, `post.published.edited`, `post.unpublished`, `post.deleted`, `page.published`, `page.published.edited`, `page.unpublished`, `page.deleted`, `member.added`, `member.updated`, `member.deleted`.
- Success is a 2xx HTTP response. No retry mechanism is built in.
- **Zapier integration** connects Ghost to 1,000+ services via a webhook relay.

**Theme system:**

- Themes are Handlebars templates that control the public-facing site.
- Themes are installed via upload (zip) or GitHub integration.
- No plugin-level code execution -- themes are strictly presentation.

**Architecture philosophy:**

Ghost deliberately does NOT have a plugin system. Instead:

- Core features are built into Ghost directly
- External integrations use webhooks + API keys
- Complex workflows use Zapier/Make/n8n as the integration layer
- The JSON API + webhooks + full frontend control enables building anything via external code

**Strengths:**

- Security through simplicity -- no third-party code runs inside Ghost
- API keys per integration provide fine-grained access control
- Webhooks are easy to understand and implement
- The Zapier/no-code approach reaches non-developer users

**Weaknesses:**

- No way to extend Ghost's internal behavior (no hooks into the editorial workflow)
- Limited webhook events (only post, page, member -- no workflow or payment events)
- No retry/guaranteed delivery for webhooks
- Cannot modify the admin panel or editorial experience
- Non-developers hit a wall when Zapier templates do not cover their use case

**Relevance to Colophony:** Ghost's webhook + API key model is the right approach for external integrations (CRM sync, notification relay, analytics). But Colophony needs deeper extensibility (adapter pattern for email/payment/auth, editorial workflow hooks, UI extensions) that Ghost deliberately avoids. Colophony should provide Ghost-style webhooks as the simplest integration tier while offering richer plugin APIs for deeper integration.

_Sources: [Ghost Webhooks](https://docs.ghost.org/webhooks), [Ghost Custom Integrations](https://ghost.org/integrations/custom-integrations/), [Ghost on AWS Webhook Architecture](https://subaud.io/blog/ghost-on-aws-webhook-architecture-and-time-gated-content/)_

---

### D. OJS (Open Journal Systems) Plugin System

OJS is the closest domain match -- open-source software for managing scholarly journals, maintained by the Public Knowledge Project (PKP). Over 25,000 journals use it globally.

**How it works:**

- Plugins extend OJS through a **HookRegistry** pattern. Hooks are named with a namespace + action convention (e.g., `Publication::publish`, `TemplateManager::display`).
- Plugins register callbacks via `HookRegistry::register('HookName', callback)`. Multiple callbacks per hook, fired in registration order.
- A priority system (`HOOK_SEQUENCE_CORE`, `HOOK_SEQUENCE_NORMAL`, `HOOK_SEQUENCE_LATE`) controls callback ordering.
- Callbacks receive data by reference -- they can modify it in place. Returning a truthy value prevents subsequent callbacks from running (short-circuiting).
- Plugins are organized in `plugins/` subdirectories by category.

**Plugin categories:**

- `plugins.generic` -- General-purpose plugins (most common)
- `plugins.importExport` -- Import/export formats (DOAJ, Crossref, DataCite, JATS XML)
- `plugins.themes` -- Visual themes
- `plugins.blocks` -- Sidebar content blocks
- `plugins.reports` -- Report generation
- `plugins.paymethod` -- Payment method adapters
- `plugins.pubIds` -- DOI, URN, and other persistent identifier services
- `plugins.oaiMetadataFormats` -- OAI-PMH metadata formats

**Plugin Gallery:**

- Built-in Plugin Gallery in the admin panel allows discovering and installing plugins from a central registry.
- Plugins declare compatibility with specific OJS versions in `version.xml`.
- Installation is one-click from the gallery.

**Deprecation note:** The `HookRegistry` class was deprecated in OJS 3.4, with a migration to a new event-based system. This is instructive -- even the academic publishing community found the hook registry pattern limiting and moved toward events.

**Strengths:**

- Plugin categories provide clear organizational structure and discoverability
- Import/export plugin category is directly relevant to Colophony (submission format adapters)
- Payment method adapters demonstrate the adapter pattern for financial integrations
- Plugin Gallery demonstrates self-hosted marketplace within the application
- Strong community contribution model in academic circles

**Weaknesses:**

- PHP-based, no type safety
- Hook system was ultimately deprecated (too rigid, hard to evolve)
- Complex callback signature conventions (pass-by-reference modification)
- Plugin compatibility across versions is a constant pain point
- No sandboxing -- plugins have full application access

**Relevance to Colophony:** The plugin category system is directly applicable -- Colophony should define clear categories (adapters, workflows, import/export, themes, reports, notification channels). The Plugin Gallery model (in-app discovery + one-click install) is the right UX for self-hosted instances. The import/export and payment method categories map directly to Colophony's needs. The deprecation of HookRegistry validates moving toward an event-based system rather than a pure hook registry.

_Sources: [OJS Hook Registration](https://docs.pkp.sfu.ca/ojs-2-technical-reference/en/hook_registration_and_callback.html), [OJS Hooks Documentation](https://docs.pkp.sfu.ca/dev/documentation/3.3/en/utilities-hooks.html), [OJS Plugin Categories](https://pkp.sfu.ca/ojs/doxygen/master/html/group__plugins.html), [OJS Hook List](https://docs.pkp.sfu.ca/ojs-2-technical-reference/en/hook_list)_

---

### E. Grafana Plugin Architecture

Grafana has a modern, React-based plugin system with strong security controls and a thriving marketplace.

**Plugin types:**

- **Panel plugins**: Custom visualizations (React components)
- **Data source plugins**: Connectors to external data (databases, APIs, log systems)
- **App plugins**: Bundle panels + data sources + dashboards + custom pages into a cohesive experience

**Architecture:**

- Frontend plugins are TypeScript/React, built with `@grafana/create-plugin`.
- Backend plugins are Go binaries communicating via gRPC with the Grafana server. They handle server-side queries, authentication, and resource proxying.
- Plugin manifest (`plugin.json`) declares metadata, dependencies, plugin type, and required permissions.
- Frontend and backend are developed in parallel through well-defined interfaces.

**Frontend Sandbox (public preview in Grafana 11.5+):**

- Isolates plugin frontend code in a separate JavaScript execution context.
- Prevents plugins from modifying the Grafana interface outside their designated areas.
- Prevents plugins from interfering with other plugins.
- Protects core features from alteration.
- Prevents modification of global browser objects.
- Requires `Content-Security-Policy: unsafe-eval` (Grafana default).
- Uses a feature flag (`pluginsFrontendSandbox`) for gradual rollout.

**Plugin signing and verification:**

- All Grafana Labs plugins are cryptographically signed.
- By default, Grafana requires all plugins to be signed to load.
- Signature levels: private (internal), community (unsigned but allowed), commercial (Grafana Labs signed).
- Self-hosted instances can configure `allow_loading_unsigned_plugins` for development.

**Marketplace:**

- grafana.com/plugins hosts the central catalog.
- Plugins installed via CLI (`grafana cli plugins install`) or UI.
- Version compatibility checked at install time.

**Strengths:**

- Frontend sandbox is state-of-the-art for plugin isolation in a web application
- Plugin signing prevents supply chain attacks
- Three plugin types cover different extension surfaces clearly
- Backend plugins as separate processes (Go binaries) provide strong server-side isolation
- Mature marketplace with search, ratings, and compatibility information

**Weaknesses:**

- Backend plugins require Go (different language from the TypeScript frontend), raising the contributor barrier
- Plugin development tooling is complex (scaffolding, signing, publishing)
- The sandbox is still in preview and requires CSP `unsafe-eval`
- Plugin signing requires going through Grafana Labs (centralized trust)

**Relevance to Colophony:** The plugin signing model is relevant for managed hosting where Colophony needs to control which plugins run. The three plugin types (panel/data source/app) map loosely to Colophony's needs (UI extensions/adapters/full-featured plugins). The frontend sandbox approach is worth implementing for community-contributed UI plugins. However, Colophony should keep everything in TypeScript (not require Go for backend plugins) to maintain a single-language contributor experience.

_Sources: [Grafana Plugin System](https://deepwiki.com/grafana/grafana/11-plugin-system), [Grafana Plugin Types](https://grafana.com/developers/plugin-tools/key-concepts/plugin-types-usage), [Grafana Frontend Sandbox](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-frontend-sandbox/), [Grafana Plugin Signing](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-sign/)_

---

### F. VS Code Extension Model

VS Code has the gold standard for sandboxed, performant extension systems with a thriving marketplace of 50,000+ extensions.

**Core architecture:**

- Extensions run in a dedicated **Extension Host** process -- a separate Node.js process isolated from the main editor process.
- Communication between the editor and Extension Host uses a JSON-RPC-like protocol.
- This process-level isolation means a crashing or slow extension cannot freeze the editor UI.

**Contribution points (declarative extension):**

- Extensions declare UI contributions in `package.json` under a `contributes` field -- commands, menus, keybindings, themes, languages, views, settings, etc.
- VS Code reads these declarations at startup and prepares the UI accordingly, without loading the extension code.
- This is purely declarative -- no code runs until an activation event fires.

**Activation events (lazy loading):**

- Extensions define when they should be activated: `onCommand:*`, `onLanguage:*`, `onView:*`, `workspaceContains:*`, etc.
- Extensions that are not needed during a session are never loaded, saving memory and startup time.
- This is critical for performance -- thousands of installed extensions do not slow startup.

**Extension API:**

- A well-defined `vscode` API module that extensions import.
- The API surface is versioned and follows strict backward compatibility.
- Extensions declare their minimum VS Code version requirement in `package.json`.

**Marketplace:**

- Visual Studio Marketplace provides search, ratings, downloads, publisher verification.
- Publishers are verified through a Microsoft account.
- Extensions are scanned for malware.

**Strengths:**

- Process-level isolation prevents extensions from crashing the host application
- Declarative contribution points allow UI extension without code execution
- Lazy activation keeps the system fast regardless of installed extension count
- The API surface is well-versioned with clear deprecation policies
- Publisher verification and malware scanning provide baseline security

**Weaknesses:**

- The extension host model requires a serialization boundary (JSON-RPC), adding complexity
- Extensions can still consume excessive CPU/memory in the extension host
- No fine-grained permission model -- extensions can access the full VS Code API
- The marketplace has had supply chain attacks (malicious extensions mimicking popular ones)

**Relevance to Colophony:** The contribution points pattern (declarative UI extension via manifest) is directly applicable for Colophony's admin panel extensibility. The activation events pattern (lazy loading) is important for keeping Colophony fast when many plugins are installed. Process-level isolation is overkill for Colophony's use case (we are not running untrusted code from anonymous publishers), but the manifest-based declaration pattern is the right model.

_Sources: [VS Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host), [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points), [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events), [VS Code Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)_

---

### G. Backstage (Spotify) Plugin Architecture

Backstage is Spotify's open-source developer portal platform, built with TypeScript and React. Its "new backend system" (2024+) is one of the most thoughtful modern plugin architectures.

**Core concepts:**

- **Plugins** are created with `createBackendPlugin({ pluginId, register })`. All plugins have an ID and a register method.
- **Services** provide utilities (logging, database access, configuration, HTTP routing) so plugins do not reimplement common concerns.
- **Extension Points** are typed contracts that plugins expose for other plugins/modules to extend. Created with `createExtensionPoint<T>({ id })` where `T` is a TypeScript interface.
- **Modules** use Extension Points to add features to plugins. For example, a catalog module adds an entity provider to the catalog plugin via `catalogProcessingExtensionPoint`.

**Extension point pattern:**

```typescript
// Plugin defines an extension point
export interface ScaffolderActionsExtensionPoint {
  addAction(action: ScaffolderAction): void;
}
export const scaffolderActionsExtensionPoint =
  createExtensionPoint<ScaffolderActionsExtensionPoint>({
    id: "scaffolder.actions",
  });

// Module uses the extension point
export const myModule = createBackendModule({
  pluginId: "scaffolder",
  moduleId: "my-custom-actions",
  register(env) {
    env.registerInit({
      deps: { scaffolder: scaffolderActionsExtensionPoint },
      async init({ scaffolder }) {
        scaffolder.addAction(new MyCustomAction());
      },
    });
  },
});
```

**Frontend plugins:**

- React components packaged as npm modules
- Composable via `createPlugin()` with routes, navigation items, and extension points
- Utility APIs (typed interfaces with reference IDs) provide shared services to frontend plugins

**Package naming convention:**

- `plugin-<id>` -- Frontend plugin
- `plugin-<id>-backend` -- Backend plugin
- `plugin-<id>-node` -- Extension points and utilities for modules
- `plugin-<id>-backend-module-<moduleId>` -- Backend module extending a plugin

**Strengths:**

- Extension points are the most sophisticated typed extensibility pattern studied. They are individually versioned, making it possible to deprecate specific extension surfaces without breaking unrelated plugins.
- The dependency injection via `deps` in `registerInit` is clean and testable.
- Clear separation between plugins (own features) and modules (extend other plugins).
- Services for cross-cutting concerns (logging, config, database) prevent each plugin from reinventing infrastructure.

**Weaknesses:**

- High abstraction level -- the learning curve is steep for new contributors.
- Package naming conventions result in many small packages.
- The "new backend system" is a rewrite that community plugins are still migrating to.
- Frontend plugin composition requires understanding Backstage's routing and extension model deeply.

**Relevance to Colophony:** Backstage's extension point pattern is the most directly applicable model for Colophony's adapter system. The typed `createExtensionPoint<T>` pattern maps perfectly to adapter interfaces (email, payment, auth, storage). The module pattern (extending a plugin via its extension point) enables community-contributed adapter implementations. The services pattern (built-in logging, config, database) should be replicated in Colophony's Plugin SDK.

_Sources: [Backstage New Backend System](https://backstage.io/docs/plugins/new-backend-system/), [Backstage Extension Points](https://backstage.io/docs/backend-system/architecture/extension-points/), [Backstage Building Plugins and Modules](https://backstage.io/docs/backend-system/building-plugins-and-modules/index/), [Backstage Architecture Overview](https://backstage.io/docs/overview/architecture-overview/)_

---

## 2. Design Patterns Evaluation

| Pattern                                | Description                                                              | Strengths                                                       | Weaknesses                                                              | Best For                                                      |
| -------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Hook-based** (WordPress)             | Define hook points in core, plugins register callbacks with priorities   | Simple mental model, flexible, proven at massive scale          | Global state, ordering complexity, no typing in traditional form        | Lifecycle events, data transformation pipelines               |
| **Adapter-based** (Strategy)           | Define interfaces, implementations are swappable                         | Type-safe contracts, single active implementation, easy testing | Only one implementation active at a time, less flexible for composition | Infrastructure services (email, payment, auth, storage)       |
| **Event-based** (pub/sub)              | Plugins subscribe to events, react asynchronously                        | Fully decoupled, naturally async, scales well                   | Harder to debug, no guaranteed ordering, eventual consistency           | Notifications, audit logging, external integrations, webhooks |
| **Middleware-based** (Express/Fastify) | Plugins are middleware in a request pipeline                             | Well-understood, composable, ordered execution                  | Only applies to request/response lifecycle, not general extensibility   | Request processing, auth, validation, rate limiting           |
| **Module-based** (NestJS)              | Plugins are modules that extend the application via DI                   | Testable, strongly typed, clear dependency graph                | Requires understanding DI framework, higher contributor barrier         | Internal service composition, platform features               |
| **Extension Point-based** (Backstage)  | Plugins declare typed extension points; modules register implementations | Most type-safe, individually versionable, clean contracts       | Highest abstraction, steepest learning curve                            | Typed adapter registration, composable feature extension      |

**Evaluation for Colophony's needs:**

No single pattern is sufficient. Colophony needs a **layered approach** combining multiple patterns for different extension surfaces:

1. **Adapter pattern** for infrastructure services (email, payment, auth, storage) -- these need exactly one active implementation with a clear interface contract.
2. **Event/hook pattern** for workflow extensibility (submission lifecycle events, editorial actions) -- multiple listeners can react to the same event.
3. **Contribution point pattern** (VS Code-inspired) for UI extensions -- declarative manifest entries that extend menus, pages, settings panels.
4. **Webhook pattern** (Ghost-inspired) for external integrations -- the simplest possible integration tier for connecting to external systems.

---

## 3. Plugin Categories for Colophony

Based on the analysis of OJS categories, Grafana plugin types, and Colophony's specific needs:

| Category                       | Pattern            | Description                              | Examples                                                                             |
| ------------------------------ | ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| **Adapters: Email**            | Adapter            | Email sending implementation             | SMTP (built-in), SendGrid, Mailgun, Postmark, Amazon SES                             |
| **Adapters: Payment**          | Adapter            | Payment processing implementation        | Stripe (built-in), PayPal, Square, Mollie                                            |
| **Adapters: Auth**             | Adapter            | Authentication service connector         | Keycloak, Zitadel, Logto, SuperTokens                                                |
| **Adapters: Storage**          | Adapter            | File storage backend                     | S3/MinIO (built-in), Google Cloud Storage, Azure Blob, local filesystem              |
| **Adapters: Search**           | Adapter            | Full-text search backend                 | PostgreSQL FTS (built-in), Meilisearch, Typesense, Elasticsearch                     |
| **Integrations: CMS**          | Event + Adapter    | Content management system sync           | WordPress, Ghost, Hugo, custom webhooks                                              |
| **Integrations: CRM**          | Event              | Customer relationship management sync    | HubSpot, Salesforce, custom webhooks                                                 |
| **Integrations: Newsletter**   | Event + Adapter    | Newsletter/mailing list sync             | Listmonk (built-in default), Mailchimp, Buttondown, ConvertKit                       |
| **Integrations: Notification** | Event              | Notification channel delivery            | Slack, Discord, Microsoft Teams, webhooks                                            |
| **Workflow**                   | Hook/Event         | Custom actions in the editorial pipeline | Auto-assign reviewers, genre classification, plagiarism check, word count validation |
| **Import/Export**              | Adapter            | Submission format converters             | Submittable CSV import, OJS XML, JATS, Shunn manuscript format                       |
| **Reports**                    | Hook               | Custom analytics and reporting           | Acceptance rate trends, reviewer workload, demographic analysis                      |
| **Themes**                     | Contribution Point | Branding and visual customization        | Public submission form themes, email templates, embeddable widget themes             |
| **Blocks**                     | Contribution Point | UI panel/widget extensions               | Dashboard widgets, sidebar panels, submission detail sections                        |

---

## 4. Recommended Architecture

### Overview

Colophony's plugin system uses a **five-tier extensibility model**, combining patterns from the systems studied above. The tiers are ordered from simplest (lowest contributor barrier) to most complex (deepest integration).

```
Tier 4: Full Plugins       (Modules that add entire features)
Tier 3: UI Extensions       (Contribution points for admin panel)
Tier 2: Workflow Hooks       (Event listeners for lifecycle events)
Tier 1: Adapters             (Interface implementations for infrastructure)
Tier 0: Webhooks             (External HTTP notifications -- no code in Colophony)
```

Each tier builds on the previous. A contributor can start at Tier 0 (configuring a webhook URL) and progressively adopt deeper integration as their needs grow.

---

### Tier 0: Webhooks (Ghost-inspired)

The simplest integration tier. Zero code inside Colophony. External systems receive HTTP POST notifications when events occur.

**Events emitted:**

```
submission.created, submission.submitted, submission.status_changed
submission.accepted, submission.rejected, submission.withdrawn
payment.completed, payment.failed, payment.refunded
member.added, member.removed, member.role_changed
review.assigned, review.completed
publication.published, publication.scheduled
file.uploaded, file.scan_completed
```

**Configuration:** Per-organization webhook URLs configured in the admin panel. Each webhook gets a unique secret for HMAC signature verification.

**Delivery:** Via BullMQ job queue with exponential backoff retry (1s, 5s, 30s, 2m, 10m, 1h). Dead letter queue for persistent failures.

```typescript
// Webhook event payload structure
interface WebhookPayload {
  id: string; // Unique event ID (for idempotency)
  event: string; // e.g., "submission.status_changed"
  timestamp: string; // ISO 8601
  organizationId: string;
  data: Record<string, unknown>; // Event-specific payload
  previousData?: Record<string, unknown>; // For change events
}
```

---

### Tier 1: Adapters (Backstage Extension Point-inspired)

Adapters implement infrastructure service interfaces. Exactly one adapter is active per service per deployment (configurable). Adapters are the most important plugin type for Colophony's "integration hub" philosophy.

**Core adapter interfaces:**

```typescript
// packages/plugin-sdk/src/adapters/email.ts

import { z } from "zod";

/**
 * Email adapter interface.
 * Implementations: SMTP (built-in), SendGrid, Mailgun, Postmark, SES.
 */
export interface EmailAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  /**
   * Zod schema for adapter-specific configuration.
   * Rendered as a form in the admin panel.
   */
  readonly configSchema: z.ZodObject<z.ZodRawShape>;

  /** Initialize the adapter with validated configuration */
  initialize(config: Record<string, unknown>): Promise<void>;

  /** Send a single email */
  send(options: SendEmailOptions): Promise<SendEmailResult>;

  /** Send to multiple recipients (BCC for privacy) */
  sendBulk?(
    recipients: string[],
    options: Omit<SendEmailOptions, "to">,
  ): Promise<SendEmailResult[]>;

  /** Verify that the adapter's configuration is valid and connectivity works */
  healthCheck(): Promise<AdapterHealthResult>;

  /** Teardown (close connections, flush buffers) */
  destroy(): Promise<void>;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  /** Adapter-specific options (e.g., SendGrid categories, Mailgun tags) */
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface AdapterHealthResult {
  healthy: boolean;
  message: string;
  latencyMs?: number;
}
```

```typescript
// packages/plugin-sdk/src/adapters/payment.ts

/**
 * Payment adapter interface.
 * Implementations: Stripe (built-in), PayPal, Square, Mollie.
 */
export interface PaymentAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly configSchema: z.ZodObject<z.ZodRawShape>;

  initialize(config: Record<string, unknown>): Promise<void>;

  /** Create a checkout session (redirect-based, for PCI compliance) */
  createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSessionResult>;

  /** Verify and parse an incoming webhook payload */
  verifyWebhook(
    headers: Record<string, string>,
    body: string,
  ): Promise<WebhookEvent>;

  /** Handle a verified webhook event (idempotent) */
  handleWebhookEvent(event: WebhookEvent): Promise<WebhookHandleResult>;

  /** Initiate a refund */
  refund(paymentId: string, amount?: number): Promise<RefundResult>;

  healthCheck(): Promise<AdapterHealthResult>;
  destroy(): Promise<void>;
}
```

```typescript
// packages/plugin-sdk/src/adapters/storage.ts

/**
 * Storage adapter interface.
 * Implementations: S3/MinIO (built-in), GCS, Azure Blob, local filesystem.
 */
export interface StorageAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly configSchema: z.ZodObject<z.ZodRawShape>;

  initialize(config: Record<string, unknown>): Promise<void>;

  upload(options: UploadOptions): Promise<UploadResult>;
  download(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  move(sourceKey: string, destinationKey: string): Promise<void>;

  healthCheck(): Promise<AdapterHealthResult>;
  destroy(): Promise<void>;
}
```

```typescript
// packages/plugin-sdk/src/adapters/search.ts

/**
 * Search adapter interface.
 * Implementations: PostgreSQL FTS (built-in), Meilisearch, Typesense.
 */
export interface SearchAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly configSchema: z.ZodObject<z.ZodRawShape>;

  initialize(config: Record<string, unknown>): Promise<void>;

  index(document: SearchDocument): Promise<void>;
  indexBulk(documents: SearchDocument[]): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
  remove(documentId: string): Promise<void>;

  healthCheck(): Promise<AdapterHealthResult>;
  destroy(): Promise<void>;
}
```

**Adapter registration and resolution:**

```typescript
// packages/plugin-sdk/src/registry.ts

/**
 * Adapter registry -- manages adapter registration and resolution.
 * Inspired by Backstage's createExtensionPoint pattern.
 */
export interface AdapterRegistry {
  /**
   * Register an adapter implementation.
   * Multiple implementations can be registered; only one is active per type.
   */
  registerAdapter<T>(type: AdapterType, adapter: T): void;

  /**
   * Resolve the active adapter for a given type.
   * Throws if no adapter is registered for the type.
   */
  resolveAdapter<T>(type: AdapterType): T;

  /**
   * List all registered adapters for a type (active and inactive).
   * Used by the admin panel to show available options.
   */
  listAdapters(type: AdapterType): AdapterInfo[];
}

export type AdapterType =
  | "email"
  | "payment"
  | "storage"
  | "search"
  | "auth"
  | "newsletter";

export interface AdapterInfo {
  id: string;
  name: string;
  version: string;
  type: AdapterType;
  active: boolean;
  configSchema: z.ZodObject<z.ZodRawShape>;
}
```

**Example adapter implementation (packages/adapters/email-sendgrid/):**

```typescript
// packages/adapters/email-sendgrid/src/index.ts

import { z } from "zod";
import type {
  EmailAdapter,
  SendEmailOptions,
  SendEmailResult,
  AdapterHealthResult,
} from "@colophony/plugin-sdk";

const SendGridConfigSchema = z.object({
  apiKey: z.string().min(1, "SendGrid API key is required"),
  sandboxMode: z.boolean().default(false),
  defaultFromEmail: z.string().email(),
  defaultFromName: z.string().optional(),
});

type SendGridConfig = z.infer<typeof SendGridConfigSchema>;

export class SendGridEmailAdapter implements EmailAdapter {
  readonly id = "email-sendgrid";
  readonly name = "SendGrid";
  readonly version = "1.0.0";
  readonly configSchema = SendGridConfigSchema;

  private client: MailService | null = null;
  private config: SendGridConfig | null = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = SendGridConfigSchema.parse(config);
    const sgMail = await import("@sendgrid/mail");
    sgMail.default.setApiKey(this.config.apiKey);
    this.client = sgMail.default;
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.client || !this.config) {
      throw new Error("SendGrid adapter not initialized");
    }
    try {
      const [response] = await this.client.send({
        to: options.to,
        from: {
          email: this.config.defaultFromEmail,
          name: this.config.defaultFromName,
        },
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return {
        success: true,
        messageId: response.headers["x-message-id"],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    try {
      const start = Date.now();
      await fetch("https://api.sendgrid.com/v3/user/credits", {
        headers: { Authorization: `Bearer ${this.config?.apiKey}` },
      });
      return {
        healthy: true,
        message: "SendGrid API key is valid",
        latencyMs: Date.now() - start,
      };
    } catch {
      return { healthy: false, message: "SendGrid API key is invalid" };
    }
  }

  async destroy(): Promise<void> {
    this.client = null;
    this.config = null;
  }
}

export default SendGridEmailAdapter;
```

---

### Tier 2: Workflow Hooks (WordPress-inspired, typed)

Workflow hooks allow plugins to react to and modify the editorial pipeline. Unlike WordPress's untyped hooks, Colophony's hooks are fully typed with discriminated union event payloads.

```typescript
// packages/plugin-sdk/src/hooks/types.ts

/**
 * Hook types:
 * - "action" hooks fire-and-forget (multiple listeners, no return value)
 * - "filter" hooks pass data through a chain (each listener modifies and returns)
 */
export type HookType = "action" | "filter";

/**
 * Hook definition -- declares a hook point that plugins can listen to.
 */
export interface HookDefinition<TPayload = unknown, TResult = void> {
  /** Unique identifier, namespaced: 'submission.beforeStatusChange' */
  id: string;
  type: HookType;
  description: string;
  /** TypeScript type of the payload (for SDK documentation generation) */
  payloadType: string;
}

/**
 * Hook listener registration.
 */
export interface HookListener<TPayload = unknown, TResult = void> {
  hookId: string;
  /** Execution priority (lower = earlier). Default: 100. */
  priority?: number;
  /** The callback function */
  handler: (payload: TPayload) => Promise<TResult>;
}
```

```typescript
// packages/plugin-sdk/src/hooks/definitions.ts

import type { HookDefinition } from "./types";

// ---- Action hooks (fire-and-forget, multiple listeners) ----

export const HOOKS = {
  // Submission lifecycle
  "submission.afterCreate": {
    id: "submission.afterCreate",
    type: "action" as const,
    description: "Fired after a new submission is created",
    payloadType: "SubmissionCreatedPayload",
  },
  "submission.afterStatusChange": {
    id: "submission.afterStatusChange",
    type: "action" as const,
    description: "Fired after a submission status changes",
    payloadType: "SubmissionStatusChangedPayload",
  },
  "submission.afterSubmit": {
    id: "submission.afterSubmit",
    type: "action" as const,
    description: "Fired after a submission is submitted for review",
    payloadType: "SubmissionSubmittedPayload",
  },

  // Review lifecycle
  "review.afterAssign": {
    id: "review.afterAssign",
    type: "action" as const,
    description: "Fired after a reviewer is assigned",
    payloadType: "ReviewAssignedPayload",
  },
  "review.afterComplete": {
    id: "review.afterComplete",
    type: "action" as const,
    description: "Fired after a review is completed",
    payloadType: "ReviewCompletedPayload",
  },

  // Payment lifecycle
  "payment.afterComplete": {
    id: "payment.afterComplete",
    type: "action" as const,
    description: "Fired after a payment is completed",
    payloadType: "PaymentCompletedPayload",
  },

  // Member lifecycle
  "member.afterJoin": {
    id: "member.afterJoin",
    type: "action" as const,
    description: "Fired after a user joins an organization",
    payloadType: "MemberJoinedPayload",
  },

  // ---- Filter hooks (data transformation chain) ----

  "submission.validateBeforeSubmit": {
    id: "submission.validateBeforeSubmit",
    type: "filter" as const,
    description:
      "Validate/modify submission data before it is submitted. Return validation errors to block submission.",
    payloadType: "SubmissionValidationPayload",
  },
  "email.beforeSend": {
    id: "email.beforeSend",
    type: "filter" as const,
    description:
      "Modify email content before sending (e.g., add tracking, modify template)",
    payloadType: "EmailBeforeSendPayload",
  },
  "submission.transformExport": {
    id: "submission.transformExport",
    type: "filter" as const,
    description:
      "Transform submission data during export (e.g., format conversion)",
    payloadType: "SubmissionExportPayload",
  },
} as const satisfies Record<string, HookDefinition>;

export type HookId = keyof typeof HOOKS;
```

```typescript
// packages/plugin-sdk/src/hooks/engine.ts

/**
 * Hook engine -- WordPress-inspired but fully typed.
 * Manages hook registration and execution.
 */
export class HookEngine {
  private listeners = new Map<
    string,
    Array<{ priority: number; handler: Function }>
  >();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a listener for a hook.
   */
  on<T extends HookId>(
    hookId: T,
    handler: (payload: HookPayloadMap[T]) => Promise<HookResultMap[T]>,
    priority: number = 100,
  ): () => void {
    const list = this.listeners.get(hookId) ?? [];
    const entry = { priority, handler };
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    this.listeners.set(hookId, list);

    // Return unsubscribe function
    return () => {
      const current = this.listeners.get(hookId);
      if (current) {
        const idx = current.indexOf(entry);
        if (idx >= 0) current.splice(idx, 1);
      }
    };
  }

  /**
   * Execute an action hook (fire-and-forget, all listeners run).
   */
  async executeAction<T extends HookId>(
    hookId: T,
    payload: HookPayloadMap[T],
  ): Promise<void> {
    const list = this.listeners.get(hookId) ?? [];
    for (const { handler } of list) {
      try {
        await handler(payload);
      } catch (error) {
        // Action hooks never block the pipeline -- log and continue
        this.logger.error(`Hook listener error for ${hookId}:`, error);
      }
    }
  }

  /**
   * Execute a filter hook (chain -- each listener receives previous result).
   */
  async executeFilter<T extends HookId>(
    hookId: T,
    payload: HookPayloadMap[T],
  ): Promise<HookPayloadMap[T]> {
    const list = this.listeners.get(hookId) ?? [];
    let current = payload;
    for (const { handler } of list) {
      try {
        current = await handler(current);
      } catch (error) {
        this.logger.error(`Filter hook error for ${hookId}:`, error);
        // Filter hooks: on error, pass through unmodified
      }
    }
    return current;
  }
}
```

---

### Tier 3: UI Extensions (VS Code Contribution Points-inspired)

UI extensions use a declarative manifest to register components into the Colophony admin panel without requiring deep knowledge of the React application structure.

```typescript
// packages/plugin-sdk/src/ui/types.ts

/**
 * UI contribution points -- locations in the admin panel where plugins
 * can inject components.
 */
export type UIContributionPoint =
  | "dashboard.widget" // Dashboard grid widgets
  | "submission.detail.section" // Extra sections on submission detail page
  | "submission.detail.action" // Extra action buttons on submission detail
  | "editor.sidebar.panel" // Sidebar panels in the editor view
  | "settings.page" // Settings pages (organization-level config)
  | "navigation.item" // Main navigation items
  | "submission.form.field" // Custom fields in the submission form
  | "report.page"; // Custom report pages

/**
 * UI extension declaration in the plugin manifest.
 */
export interface UIExtensionDeclaration {
  /** Which contribution point this extends */
  point: UIContributionPoint;
  /** Unique identifier for this extension */
  id: string;
  /** Display label */
  label: string;
  /** Icon (from a predefined icon set, e.g., Lucide) */
  icon?: string;
  /** Required permissions to see this extension */
  requiredPermissions?: string[];
  /**
   * Path to the React component (lazy-loaded).
   * Relative to the plugin's dist/ directory.
   */
  component: string;
  /** Sort order within the contribution point */
  order?: number;
}
```

```typescript
// packages/plugin-sdk/src/ui/extension-host.ts

/**
 * Extension host -- manages lazy loading and rendering of plugin UI components.
 * Inspired by VS Code's activation events pattern.
 */
export class UIExtensionHost {
  private extensions = new Map<UIContributionPoint, UIExtensionDeclaration[]>();

  registerExtension(declaration: UIExtensionDeclaration): void {
    const list = this.extensions.get(declaration.point) ?? [];
    list.push(declaration);
    list.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    this.extensions.set(declaration.point, list);
  }

  /**
   * Get all extensions for a contribution point.
   * Components are NOT loaded here -- they are lazy-loaded when rendered.
   */
  getExtensions(point: UIContributionPoint): UIExtensionDeclaration[] {
    return this.extensions.get(point) ?? [];
  }
}
```

---

### Tier 4: Full Plugins (Strapi + Backstage-inspired)

Full plugins combine adapters, hooks, and UI extensions into a cohesive feature module. They follow a structured manifest and lifecycle pattern.

```typescript
// packages/plugin-sdk/src/plugin.ts

import type { z } from "zod";
import type { HookListener } from "./hooks/types";
import type { UIExtensionDeclaration } from "./ui/types";
import type { AdapterType } from "./registry";

/**
 * Plugin manifest -- the package.json "colophony" field.
 * Inspired by VS Code's package.json contributes + Strapi plugin structure.
 */
export interface PluginManifest {
  /** Unique plugin ID (scoped: @org/plugin-name or plugin-name) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Minimum Colophony version required */
  colophonyVersion: string;
  /** Plugin description */
  description: string;
  /** Plugin author */
  author: string;
  /** License */
  license: string;
  /** Plugin category */
  category: PluginCategory;
  /** Plugin homepage URL */
  homepage?: string;

  /** Adapter registrations (Tier 1) */
  adapters?: Array<{
    type: AdapterType;
    /** Path to the adapter class (relative to dist/) */
    implementation: string;
  }>;

  /** UI extensions (Tier 3) */
  ui?: UIExtensionDeclaration[];

  /** Permissions this plugin requires */
  permissions?: PluginPermission[];

  /** Other plugins this plugin depends on */
  dependencies?: Record<string, string>; // pluginId -> semver range
}

export type PluginCategory =
  | "adapter"
  | "integration"
  | "workflow"
  | "import-export"
  | "report"
  | "theme"
  | "block"
  | "notification";

/**
 * Plugin permission -- declares what the plugin needs access to.
 * Managed hosting can reject plugins requesting dangerous permissions.
 */
export type PluginPermission =
  | "submissions:read"
  | "submissions:write"
  | "members:read"
  | "members:write"
  | "payments:read"
  | "payments:write"
  | "files:read"
  | "files:write"
  | "settings:read"
  | "settings:write"
  | "email:send"
  | "http:outbound" // Can make external HTTP requests
  | "database:read" // Direct database read access
  | "database:write"; // Direct database write access
```

```typescript
// packages/plugin-sdk/src/plugin-base.ts

/**
 * Base class for Colophony plugins.
 * Inspired by Strapi's register/bootstrap/destroy lifecycle.
 *
 * Plugins extend this class and override lifecycle methods.
 */
export abstract class ColophonyPlugin {
  abstract readonly manifest: PluginManifest;

  /**
   * Phase 1: Register.
   * Called during application startup, before any service is available.
   * Use this to register adapters, declare hooks, and register UI extensions.
   *
   * DO NOT access the database, send emails, or call external services here.
   */
  abstract register(context: PluginRegisterContext): Promise<void>;

  /**
   * Phase 2: Bootstrap.
   * Called after all plugins have registered and all services are available.
   * Use this for initialization that requires Colophony's APIs (seeding data,
   * verifying configuration, starting background tasks).
   */
  async bootstrap(context: PluginBootstrapContext): Promise<void> {
    // Default: no-op. Override if needed.
  }

  /**
   * Phase 3: Destroy.
   * Called when the application is shutting down.
   * Use this for cleanup (close connections, flush buffers).
   */
  async destroy(): Promise<void> {
    // Default: no-op. Override if needed.
  }
}

/**
 * Context provided during the register phase.
 */
export interface PluginRegisterContext {
  /** Register an adapter implementation */
  registerAdapter<T>(type: AdapterType, adapter: T): void;
  /** Register hook listeners */
  registerHook<T extends HookId>(
    listener: HookListener<HookPayloadMap[T]>,
  ): void;
  /** Register UI extensions */
  registerUIExtension(declaration: UIExtensionDeclaration): void;
  /** Access plugin configuration (from Colophony config or env vars) */
  getConfig<T>(schema: z.ZodType<T>): T;
  /** Logger scoped to this plugin */
  logger: Logger;
}

/**
 * Context provided during the bootstrap phase.
 * Adds access to Colophony's services.
 */
export interface PluginBootstrapContext extends PluginRegisterContext {
  /** Resolved email adapter (whichever is active) */
  email: EmailAdapter;
  /** Resolved storage adapter */
  storage: StorageAdapter;
  /** Database access (scoped by RLS -- plugin receives the same withOrgContext) */
  db: {
    withOrgContext: typeof withOrgContext;
    withUserContext: typeof withUserContext;
  };
  /** BullMQ queue access for background jobs */
  queues: {
    add(queueName: string, jobName: string, data: unknown): Promise<void>;
  };
}
```

**Plugin loading and initialization sequence (Strapi-inspired):**

```
1. Discover plugins (node_modules + local plugins directory)
2. Validate manifests (check colophonyVersion compatibility)
3. Resolve dependency graph (topological sort)
4. Phase 1 -- Register (all plugins, in dependency order)
   - Adapters registered
   - Hooks registered
   - UI extensions registered
5. Resolve active adapters (from organization/deployment config)
6. Phase 2 -- Bootstrap (all plugins, in dependency order)
   - Full service access available
   - Plugins can verify connectivity, seed data, start tasks
7. Application ready -- begin serving requests
```

---

## 5. Plugin SDK Package Structure

```
packages/plugin-sdk/
  src/
    index.ts                    # Public API re-exports
    plugin.ts                   # PluginManifest, PluginCategory, PluginPermission
    plugin-base.ts              # ColophonyPlugin base class
    adapters/
      index.ts                  # Re-exports all adapter interfaces
      email.ts                  # EmailAdapter interface
      payment.ts                # PaymentAdapter interface
      storage.ts                # StorageAdapter interface
      search.ts                 # SearchAdapter interface
      auth.ts                   # AuthAdapter interface
      newsletter.ts             # NewsletterAdapter interface
      common.ts                 # AdapterHealthResult, shared types
    hooks/
      index.ts
      types.ts                  # HookDefinition, HookListener
      definitions.ts            # All hook point definitions (HOOKS const)
      payloads.ts               # Typed payloads for each hook
      engine.ts                 # HookEngine implementation
    ui/
      index.ts
      types.ts                  # UIContributionPoint, UIExtensionDeclaration
      extension-host.ts         # UIExtensionHost
    registry.ts                 # AdapterRegistry, AdapterType, AdapterInfo
    testing/
      index.ts
      mock-context.ts           # createMockRegisterContext, createMockBootstrapContext
      mock-adapters.ts          # MockEmailAdapter, MockStorageAdapter, etc.
      test-plugin-harness.ts    # Load and test a plugin in isolation
  package.json
  tsconfig.json
```

---

## 6. Security Model

### Principle: Trust tiers based on plugin source

| Trust Level            | Source                                            | Restrictions                                     | Use Case                                      |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| **Core**               | Ships with Colophony (monorepo)                   | None -- full access                              | Built-in adapters (SMTP, Stripe, S3)          |
| **First-party**        | Published by the Colophony project                | Full access, signed                              | Official adapter packages                     |
| **Verified community** | Community-published, reviewed by maintainers      | Permission-scoped, signed                        | Community adapters in the plugin registry     |
| **Unverified**         | Any npm package claiming to be a Colophony plugin | Only allowed on self-hosted with explicit opt-in | Experimental plugins, self-hosted custom code |

### Permission enforcement

- Plugins declare required permissions in their manifest (`permissions` field).
- During the register phase, the plugin loader checks the manifest permissions against the deployment's policy.
- Managed hosting deployments reject plugins requesting `database:write` or `http:outbound` unless they are first-party or verified.
- Self-hosted deployments default to allowing all permissions (the operator is the trust authority).

### Plugin signing (Grafana-inspired, future)

- First-party and verified community plugins are signed with the Colophony project's key.
- Managed hosting instances only load signed plugins by default.
- Self-hosted instances can opt into `allow_unsigned_plugins` mode.
- Signing covers the npm package tarball hash, not individual file signatures.

### Adapter isolation

- Adapters interact with the system ONLY through their defined interface. They receive a scoped `Logger` and configuration, not the full application context.
- Adapters cannot access the database directly (no Prisma client). They receive data through their interface methods.
- The one exception: full plugins (Tier 4) in the `bootstrap` phase receive scoped database access via `withOrgContext`, which enforces RLS. Plugins never see cross-tenant data.

### Frontend sandboxing (Grafana-inspired, future)

- UI extension components from community plugins can be loaded in an iframe sandbox with `postMessage` communication.
- Core and first-party UI extensions render directly in the React tree (no sandbox overhead).
- This is a future enhancement -- initially, all plugins are trusted and render directly.

---

## 7. Plugin Distribution

### Primary channel: npm packages

- Plugins are standard npm packages with a `colophony` field in `package.json` containing the `PluginManifest`.
- npm is the distribution mechanism (publishing, versioning, dependency resolution are already solved).
- No custom plugin registry infrastructure is needed initially.

### Discovery

- **Phase 1 (launch):** A curated `awesome-colophony` list on GitHub documenting known plugins by category.
- **Phase 2 (growth):** An in-app Plugin Gallery (OJS-inspired) that queries a lightweight JSON registry (hosted as a static file or simple API). Self-hosted instances can search and install plugins from the admin panel.
- **Phase 3 (scale):** A full plugin marketplace website with search, ratings, compatibility information, and download counts.

### Naming convention

```
@colophony/adapter-email-sendgrid     # First-party adapter
@colophony/adapter-payment-paypal     # First-party adapter
@colophony/integration-wordpress      # First-party integration
colophony-plugin-slack-notifications  # Community plugin
colophony-plugin-plagiarism-check     # Community plugin
```

### Version compatibility

- Plugins declare `colophonyVersion` in their manifest using semver ranges (e.g., `"^2.0.0"`).
- The Plugin SDK version follows semver. Breaking changes to adapter interfaces or hook payloads increment the major version.
- Colophony checks manifest compatibility at plugin load time and logs warnings for mismatches.
- The plugin loading step in the initialization sequence rejects plugins incompatible with the running Colophony version.

### Plugin API versioning strategy

- The Plugin SDK package (`@colophony/plugin-sdk`) is the single versioned contract.
- New adapter methods are added as optional interface members (backward compatible).
- Deprecated hooks/adapter methods are marked with `@deprecated` JSDoc tags and supported for at least one major version.
- Breaking changes (removed methods, changed signatures) trigger a major version bump of the SDK.
- A compatibility matrix is maintained in the Plugin SDK documentation showing which SDK versions work with which Colophony versions.

---

## 8. Plugin Development Experience

### Creating a new plugin

```bash
# Scaffold a new adapter plugin
npx @colophony/create-plugin --type adapter --adapter-type email --name sendgrid

# Scaffold a workflow plugin
npx @colophony/create-plugin --type workflow --name auto-reviewer

# Scaffold a full plugin with UI
npx @colophony/create-plugin --type full --name analytics-dashboard
```

### Local development workflow (Strapi-inspired)

```bash
# In the plugin directory
pnpm dev          # Watch mode -- recompiles on changes

# In the Colophony app directory
# colophony.config.ts includes the local plugin path
pnpm dev          # Hot-reloads when plugin rebuilds
```

### Testing plugins

```typescript
// Using the Plugin SDK test harness
import { createTestHarness } from "@colophony/plugin-sdk/testing";
import { SendGridEmailAdapter } from "../src";

describe("SendGridEmailAdapter", () => {
  const harness = createTestHarness();

  it("sends an email", async () => {
    const adapter = new SendGridEmailAdapter();
    await adapter.initialize({
      apiKey: "SG.test-key",
      defaultFromEmail: "test@example.com",
    });

    const result = await adapter.send({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
  });

  it("reports health check failure with invalid API key", async () => {
    const adapter = new SendGridEmailAdapter();
    await adapter.initialize({
      apiKey: "invalid",
      defaultFromEmail: "test@example.com",
    });

    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
  });
});
```

---

## 9. Configuration

Plugins are configured at two levels:

### Deployment-level (which adapters are active, static configuration)

```typescript
// colophony.config.ts (root of the Colophony installation)

import { defineConfig } from "@colophony/plugin-sdk";
import { SmtpEmailAdapter } from "@colophony/adapter-email-smtp";
import { StripePaymentAdapter } from "@colophony/adapter-payment-stripe";
import { S3StorageAdapter } from "@colophony/adapter-storage-s3";
import { SlackNotificationPlugin } from "colophony-plugin-slack-notifications";

export default defineConfig({
  adapters: {
    email: SmtpEmailAdapter, // or SendGridEmailAdapter, etc.
    payment: StripePaymentAdapter,
    storage: S3StorageAdapter,
  },
  plugins: [new SlackNotificationPlugin()],
});
```

### Organization-level (per-tenant configuration in the admin panel)

- Adapter configuration (API keys, endpoints) stored encrypted in the database per organization.
- Plugin settings rendered from the adapter's `configSchema` (Zod schema -> form).
- Webhook URLs configured per organization.

---

## 10. Comparison Summary

| Aspect                  | WordPress           | Strapi                     | Ghost              | OJS            | Grafana                        | VS Code             | Backstage        | **Colophony (recommended)**                |
| ----------------------- | ------------------- | -------------------------- | ------------------ | -------------- | ------------------------------ | ------------------- | ---------------- | ------------------------------------------ |
| **Extension model**     | Hook/filter         | Module lifecycle           | Webhooks + API     | HookRegistry   | Plugin types                   | Extension host      | Extension points | Layered (adapters + hooks + UI + webhooks) |
| **Type safety**         | None                | Partial                    | N/A (external)     | None           | TypeScript                     | TypeScript          | TypeScript       | Full TypeScript (Zod + interfaces)         |
| **Isolation**           | None                | None                       | Full (external)    | None           | Frontend sandbox + Go binaries | Process-level       | Module-level     | Permission-scoped + RLS-enforced DB        |
| **Lifecycle**           | activate/deactivate | register/bootstrap/destroy | N/A                | register       | N/A                            | activate/deactivate | register/init    | register/bootstrap/destroy                 |
| **Distribution**        | Directory + wp.org  | npm + marketplace          | N/A                | Plugin Gallery | CLI + grafana.com              | Marketplace         | npm              | npm + registry + in-app gallery            |
| **Language**            | PHP                 | TypeScript                 | External           | PHP            | TypeScript + Go                | TypeScript          | TypeScript       | TypeScript only                            |
| **Signing**             | No                  | No                         | N/A                | No             | Required                       | Publisher verified  | No               | Optional (required for managed hosting)    |
| **Config model**        | wp_options DB       | Plugin config              | API keys           | settings       | plugin.json + provisioning     | settings.json       | app-config.yaml  | Zod schema -> admin panel form             |
| **Contributor barrier** | Very low            | Medium                     | Very low (webhook) | Medium         | High                           | Medium              | High             | Low (webhook) to Medium (plugin)           |

---

## 11. Implementation Roadmap

| Phase                           | Scope                                                                                                                                                     | Timeline  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **Phase 1: Adapter foundation** | `@colophony/plugin-sdk` with EmailAdapter, PaymentAdapter, StorageAdapter interfaces. Built-in adapters (SMTP, Stripe, S3). `colophony.config.ts` loader. | v2 launch |
| **Phase 2: Hooks + webhooks**   | HookEngine with typed hooks for submission lifecycle. Webhook delivery via BullMQ. Webhook configuration UI.                                              | v2 launch |
| **Phase 3: UI extensions**      | Contribution point system. Dashboard widgets. Settings page extensions. Submission detail sections.                                                       | v2.1      |
| **Phase 4: Plugin gallery**     | In-app plugin discovery (JSON registry). One-click install for self-hosted. `create-plugin` scaffolding CLI.                                              | v2.2      |
| **Phase 5: Security hardening** | Plugin signing. Permission enforcement. Frontend sandboxing for community UI plugins. Managed hosting allow-list.                                         | v2.3      |
| **Phase 6: Marketplace**        | Full marketplace website. Ratings, reviews, compatibility matrix. Community contribution guidelines.                                                      | v2.4+     |

---

## 12. Key Design Decisions

| #   | Decision                                                          | Rationale                                                                                                                                                                                 | Alternatives Considered                                                                                               |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | **Layered architecture (5 tiers)** over single extension model    | Different extension surfaces have different needs. Adapters need exactly-one semantics; workflow hooks need many-listener semantics; external integrations need zero-code webhooks.       | WordPress-style single hook system (too flat), Grafana-style typed plugins only (too rigid)                           |
| 2   | **TypeScript-only** (no Go, no WASM)                              | Single-language contributor experience. The target audience is web developers contributing to an open-source project, not Go or Rust engineers.                                           | Grafana's Go backend plugins (raises barrier), WASM sandboxing (premature complexity)                                 |
| 3   | **npm distribution** over custom registry                         | npm solves publishing, versioning, dependency resolution, and authentication. No need to build registry infrastructure.                                                                   | Custom registry (OJS Plugin Gallery), git submodules (poor DX), Docker images per plugin (heavyweight)                |
| 4   | **Zod config schemas rendered as forms**                          | Adapters already use Zod. Rendering Zod schemas as form UIs means adapter authors define config once and get admin panel forms for free.                                                  | JSON Schema (requires separate form renderer), manual admin panel forms per adapter (too much work)                   |
| 5   | **Two-phase lifecycle (register then bootstrap)**                 | Prevents circular dependency issues. All plugins declare their interfaces before any plugin tries to use another's APIs. Strapi's proven pattern.                                         | Single-phase init (ordering problems), three-phase (unnecessary complexity)                                           |
| 6   | **Permission-scoped rather than sandboxed** for initial release   | True sandboxing (process isolation, WASM) adds enormous complexity. Permission declaration + RLS-enforced database access provides meaningful security without the engineering cost.      | Full process isolation like VS Code (overkill for npm plugins), no security model (irresponsible for managed hosting) |
| 7   | **Adapters are classes implementing interfaces** (not functional) | Adapters have lifecycle (initialize, destroy), state (connections, clients), and configuration. Classes model this naturally. Interfaces ensure the contract is enforced at compile time. | Functional adapters (no lifecycle management), dependency injection (requires framework coupling)                     |
| 8   | **Plugin categories** (OJS-inspired)                              | Categories make plugins discoverable and help users understand what a plugin does. They also enable category-specific validation (e.g., adapters must implement healthCheck).             | Flat list (poor discoverability), tags only (too unstructured)                                                        |

---

## 13. Open Questions

1. **Plugin configuration storage:** Should adapter API keys be stored in the database (per-org, encrypted) or in environment variables (per-deployment)? The answer affects whether organizations on managed hosting can choose their own email provider or if it is a deployment-level decision.

2. **Hot-reload in production:** Should plugins be loadable/unloadable without restarting the server? Strapi and NestJS both require restarts. Hot-reload adds complexity but improves the managed hosting experience.

3. **Plugin marketplace governance:** Who reviews community plugins for the verified tier? What are the review criteria? How is the signing key managed?

4. **Database access for plugins:** Should Tier 4 plugins get direct Prisma/database access (with RLS), or should all data access go through a higher-level service API? Direct access is more powerful but harder to version.

5. **Frontend plugin bundling:** Should UI extensions be separate bundles loaded at runtime (dynamic import), or compiled into the main application at build time? Runtime loading enables true plugin installation without rebuilds but adds bundle complexity.

6. **Webhook vs event bus:** For Tier 0, should webhooks be the only external integration mechanism, or should Colophony also offer a Redis pub/sub or NATS event bus that external services can subscribe to?
