import { describe, it, expect, beforeAll } from 'vitest';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import {
  restRouter,
  openApiDocumentConfig,
  generateOpenApiDocument,
} from './openapi-spec.js';

type PathsObject = Record<string, Record<string, { tags?: string[] }>>;

interface Doc {
  openapi: string;
  servers?: { url: string }[];
  paths?: PathsObject;
}

function pathsOf(doc: Doc): PathsObject {
  return doc.paths ?? {};
}

function operationCount(doc: Doc): number {
  return Object.values(pathsOf(doc)).reduce(
    (n, methods) => n + Object.keys(methods).length,
    0,
  );
}

/** Generate a document containing exactly one router, to prove it contributes. */
async function generateForRouter(key: keyof typeof restRouter): Promise<Doc> {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });
  return (await generator.generate(
    { [key]: restRouter[key] },
    openApiDocumentConfig,
  )) as Doc;
}

describe('generateOpenApiDocument', () => {
  let doc: Doc;

  beforeAll(async () => {
    doc = (await generateOpenApiDocument()) as unknown as Doc;
  });

  it('pins the OpenAPI version to 3.1.0', () => {
    // The generator emits 3.1.1; the export script used to own this
    // normalization. Tools that reject 3.1.1 still accept 3.1.0.
    expect(doc.openapi).toBe('3.1.0');
  });

  it('carries the /v1 prefix on servers, not on paths', () => {
    expect(doc.servers?.[0]?.url).toBe('/v1');

    const prefixed = Object.keys(pathsOf(doc)).filter((p) =>
      p.startsWith('/v1'),
    );
    expect(prefixed).toEqual([]);
  });

  it('is deterministic across invocations', async () => {
    // Precondition for `export-openapi.ts --check`, which compares bytes.
    const again = (await generateOpenApiDocument()) as unknown as Doc;
    expect(JSON.stringify(again)).toBe(JSON.stringify(doc));
  });

  it('emits at least one operation for every router in restRouter', async () => {
    const keys = Object.keys(restRouter) as (keyof typeof restRouter)[];
    const allPaths = new Set(Object.keys(pathsOf(doc)));

    const contributions = await Promise.all(
      keys.map(async (key) => {
        const single = await generateForRouter(key);
        return {
          key,
          operations: operationCount(single),
          paths: Object.keys(pathsOf(single)),
        };
      }),
    );

    // A router silently dropping out of restRouter is the failure this guards.
    const empty = contributions.filter((c) => c.operations === 0);
    expect(empty.map((c) => c.key)).toEqual([]);

    // And every router's paths must actually appear in the full document.
    for (const { key, paths } of contributions) {
      const missing = paths.filter((p) => !allPaths.has(p));
      expect(missing, `router "${key}" paths missing from document`).toEqual(
        [],
      );
    }
  });

  it('documents the collections and csr routers', () => {
    // Regression: both were absent from the committed spec for five months
    // because the export required a running dev server and stopped being run.
    const paths = Object.keys(pathsOf(doc));
    expect(paths).toContain('/collections');
    expect(paths).toContain('/csr/export');
    expect(paths).toContain('/csr/import');
  });

  it('includes the API key scopes added in P0.1b', () => {
    // webhooks:read is still enforced only by its tRPC router and reaches the
    // spec solely through the create-API-key request body. notifications:read
    // and notifications:write are now also carried by real routes, so this
    // assertion no longer stands alone for them — keep it anyway, since it is
    // what catches a scope silently dropped from the enum.
    const serialized = JSON.stringify(doc);
    expect(serialized).toContain('notifications:read');
    expect(serialized).toContain('notifications:write');
    expect(serialized).toContain('webhooks:read');
  });
});
