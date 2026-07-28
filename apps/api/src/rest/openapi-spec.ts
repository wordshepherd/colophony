import { OpenAPIGenerator } from '@orpc/openapi';
import type { OpenAPIGeneratorGenerateOptions } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { organizationsRouter } from './routers/organizations.js';
import { submissionsRouter } from './routers/submissions.js';
import { filesRouter } from './routers/files.js';
import { usersRouter } from './routers/users.js';
import { apiKeysRouter } from './routers/api-keys.js';
import { auditRouter } from './routers/audit.js';
import { formsRouter } from './routers/forms.js';
import { periodsRouter } from './routers/periods.js';
import { manuscriptsRouter } from './routers/manuscripts.js';
import { publicationsRouter } from './routers/publications.js';
import { pipelineRouter } from './routers/pipeline.js';
import { contractTemplatesRouter } from './routers/contract-templates.js';
import { contractsRouter } from './routers/contracts.js';
import { issuesRouter } from './routers/issues.js';
import { cmsConnectionsRouter } from './routers/cms-connections.js';
import { csrRouter } from './routers/csr.js';
import { collectionsRouter } from './routers/collections.js';

/**
 * The oRPC routers composing the `/v1` REST surface.
 *
 * Lives here rather than in `router.ts` so that the spec can be generated
 * without importing the Fastify adapter — see `generateOpenApiDocument()`.
 * Key order determines operation order in the generated document.
 */
export const restRouter = {
  organizations: organizationsRouter,
  submissions: submissionsRouter,
  manuscripts: manuscriptsRouter,
  files: filesRouter,
  users: usersRouter,
  apiKeys: apiKeysRouter,
  forms: formsRouter,
  periods: periodsRouter,
  audit: auditRouter,
  publications: publicationsRouter,
  pipeline: pipelineRouter,
  contractTemplates: contractTemplatesRouter,
  contracts: contractsRouter,
  issues: issuesRouter,
  cmsConnections: cmsConnectionsRouter,
  csr: csrRouter,
  collections: collectionsRouter,
};

/**
 * OpenAPI document metadata — info, servers, tags, externalDocs.
 *
 * Single source of truth: `router.ts` passes this to `OpenAPIReferencePlugin`
 * as `specGenerateOptions`, and `generateOpenApiDocument()` passes it to
 * `OpenAPIGenerator.generate()`. Both consume the same
 * `OpenAPIGeneratorGenerateOptions` type and run the same generator
 * underneath, so the served spec and the exported spec cannot drift.
 */
export const openApiDocumentConfig: OpenAPIGeneratorGenerateOptions = {
  info: {
    title: 'Colophony API',
    version: '2.0.0',
    description:
      'REST API for Colophony, the open-source infrastructure suite for literary magazines. ' +
      'Covers submission intake, review pipelines, file management, and organization administration.\n\n' +
      '## Authentication\n\n' +
      'All endpoints require authentication via one of:\n' +
      '- **Bearer token** — Zitadel OIDC access token in the `Authorization` header\n' +
      '- **API key** — Organization-scoped key in the `X-Api-Key` header\n\n' +
      'Most endpoints also require the `X-Organization-Id` header to set the organization context.',
    contact: {
      name: 'Colophony',
      url: 'https://github.com/colophony/colophony',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [{ url: '/v1', description: 'Current version' }],
  tags: [
    {
      name: 'Organizations',
      description:
        'Manage organizations and their members. Organizations are the top-level tenant in Colophony.',
    },
    {
      name: 'Invitations',
      description:
        'Manage organization membership invitations — list pending, revoke, resend, and accept.',
    },
    {
      name: 'Manuscripts',
      description:
        'Manage manuscripts — personal library of creative works with versioning.',
    },
    {
      name: 'Submissions',
      description:
        'Create, review, and manage literary submissions through the editorial workflow.',
    },
    {
      name: 'Files',
      description:
        'List, download, and delete files attached to submissions. Uploads use the tus protocol.',
    },
    {
      name: 'Users',
      description:
        'User profile and account information. User lifecycle is managed via Zitadel.',
    },
    {
      name: 'API Keys',
      description:
        'Create and manage organization-scoped API keys for programmatic access.',
    },
    {
      name: 'Forms',
      description:
        'Create and manage dynamic form definitions for submission intake. Forms define the fields submitters fill out.',
    },
    {
      name: 'Periods',
      description:
        'Manage submission periods — time windows during which submissions are accepted.',
    },
    {
      name: 'Publications',
      description:
        'Manage publications — named publishing venues within an organization (Slate pipeline).',
    },
    {
      name: 'Pipeline',
      description:
        'Manage the post-acceptance publication pipeline — copyedit, proofread, and publish workflow (Slate).',
    },
    {
      name: 'Contract Templates',
      description:
        'Manage contract templates with merge field placeholders for generating contracts (Slate).',
    },
    {
      name: 'Contracts',
      description:
        'Generate, send, and manage contracts for pipeline items (Slate).',
    },
    {
      name: 'Issues',
      description:
        'Assemble and manage publication issues — collections of pipeline items (Slate).',
    },
    {
      name: 'CMS Connections',
      description:
        'Manage CMS connections for publishing issues to WordPress or Ghost (Slate).',
    },
    {
      name: 'CSR',
      description:
        'Export and import Colophony Submission Records — personal data portability for writers.',
    },
    {
      name: 'Audit',
      description:
        'Query the audit log for security and compliance. Admin-only.',
    },
  ],
  externalDocs: {
    description: 'Colophony source code and documentation',
    url: 'https://github.com/colophony/colophony',
  },
};

/**
 * Build the OpenAPI 3.1 document in-process.
 *
 * Requires no running server, database, or Redis — the routers construct their
 * BullMQ queues lazily and `pg.Pool` does not connect until first query. This
 * is what lets `scripts/export-openapi.ts` run in CI.
 *
 * The generator emits `3.1.1`; we pin to `3.1.0` for broader tool
 * compatibility (the two are functionally identical).
 */
export async function generateOpenApiDocument(): Promise<
  Record<string, unknown>
> {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const spec = (await generator.generate(
    restRouter,
    openApiDocumentConfig,
  )) as Record<string, unknown>;

  if (typeof spec.openapi === 'string' && spec.openapi.startsWith('3.1.')) {
    spec.openapi = '3.1.0';
  }

  return spec;
}
