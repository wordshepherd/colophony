/**
 * SSRF validation security invariant tests.
 *
 * Verifies that all outbound fetch() calls to user-influenced URLs
 * pass through validateOutboundUrl() before the request is made.
 *
 * Two-layer check:
 * 1. Import check — file must import validateOutboundUrl
 * 2. Proximity check — each fetch() must have validateOutboundUrl
 *    within a reasonable window above it (same function scope)
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const servicesDir = path.resolve(__dirname, '../../services');
const workersDir = path.resolve(__dirname, '../../workers');

/**
 * Find all non-comment lines containing fetch( and return their 1-indexed
 * line numbers along with the surrounding context.
 */
function findFetchCallLines(filePath: string): number[] {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const result: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    )
      continue;
    if (/(?<![.\w])fetch\(/.test(trimmed)) {
      result.push(i + 1);
    }
  }
  return result;
}

/**
 * Check if validateOutboundUrl appears within `windowSize` lines before
 * the given line number.
 */
function hasUpstreamSsrfCheck(
  filePath: string,
  fetchLineNo: number,
  windowSize = 60,
): boolean {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const start = Math.max(0, fetchLineNo - 1 - windowSize);
  const end = fetchLineNo - 1;
  const window = lines.slice(start, end).join('\n');
  return window.includes('validateOutboundUrl');
}

function importsValidation(filePath: string): boolean {
  const source = fs.readFileSync(filePath, 'utf8');
  return source.includes('import') && source.includes('validateOutboundUrl');
}

describe('SSRF validation — federation services', () => {
  describe('trust.service.ts', () => {
    const fp = path.join(servicesDir, 'trust.service.ts');

    it('imports validateOutboundUrl', () => {
      expect(importsValidation(fp)).toBe(true);
    });

    it('all user-controlled fetch() sites have upstream SSRF check', () => {
      const fetchLines = findFetchCallLines(fp);
      // trust.service has: fetchAndValidateMetadata (uses resolveAndCheckPrivateIp),
      // initiateTrust, acceptInboundTrust — at minimum 3 fetch calls
      expect(fetchLines.length).toBeGreaterThanOrEqual(3);

      // fetchAndValidateMetadata uses resolveAndCheckPrivateIp directly
      // (its own SSRF check) — identify it by the /.well-known/colophony URL
      const source = fs.readFileSync(fp, 'utf8');
      const lines = source.split('\n');

      for (const lineNo of fetchLines) {
        const surrounding = lines
          .slice(Math.max(0, lineNo - 6), lineNo + 3)
          .join(' ');

        // fetchAndValidateMetadata uses resolveAndCheckPrivateIp — acceptable
        if (surrounding.includes('.well-known/colophony')) {
          const window = lines
            .slice(Math.max(0, lineNo - 20), lineNo)
            .join('\n');
          expect(
            window.includes('resolveAndCheckPrivateIp'),
            `fetch at line ${lineNo} (.well-known) should have resolveAndCheckPrivateIp`,
          ).toBe(true);
          continue;
        }

        expect(
          hasUpstreamSsrfCheck(fp, lineNo),
          `fetch() at line ${lineNo} has no upstream validateOutboundUrl`,
        ).toBe(true);
      }
    });
  });

  describe('transfer.service.ts', () => {
    const fp = path.join(servicesDir, 'transfer.service.ts');

    it('imports validateOutboundUrl', () => {
      expect(importsValidation(fp)).toBe(true);
    });

    it('all fetch() sites have upstream SSRF check', () => {
      const fetchLines = findFetchCallLines(fp);
      // initiateTransfer + fetchTransferFiles = at least 2
      expect(fetchLines.length).toBeGreaterThanOrEqual(2);

      for (const lineNo of fetchLines) {
        expect(
          hasUpstreamSsrfCheck(fp, lineNo, 80),
          `fetch() at line ${lineNo} has no upstream validateOutboundUrl`,
        ).toBe(true);
      }
    });
  });

  describe('migration.service.ts', () => {
    const fp = path.join(servicesDir, 'migration.service.ts');

    it('imports validateOutboundUrl', () => {
      expect(importsValidation(fp)).toBe(true);
    });

    it('all fetch() sites have upstream SSRF check', () => {
      const fetchLines = findFetchCallLines(fp);
      // requestMigration, sendCompletionNotification, approveMigration,
      // broadcastMigration = at least 4
      expect(fetchLines.length).toBeGreaterThanOrEqual(4);

      for (const lineNo of fetchLines) {
        expect(
          hasUpstreamSsrfCheck(fp, lineNo, 80),
          `fetch() at line ${lineNo} has no upstream validateOutboundUrl`,
        ).toBe(true);
      }
    });
  });

  describe('hub-client.service.ts', () => {
    const fp = path.join(servicesDir, 'hub-client.service.ts');

    it('imports validateOutboundUrl', () => {
      expect(importsValidation(fp)).toBe(true);
    });

    it('initiateHubAttestedTrust fetch has upstream SSRF check', () => {
      const fetchLines = findFetchCallLines(fp);
      const source = fs.readFileSync(fp, 'utf8').split('\n');

      // Find the fetch for hub-attested (user-controlled targetDomain)
      const hubAttestedFetches = fetchLines.filter((lineNo) => {
        const ctx = source
          .slice(Math.max(0, lineNo - 15), lineNo + 3)
          .join(' ');
        return ctx.includes('hub-attested');
      });

      expect(hubAttestedFetches.length).toBeGreaterThanOrEqual(1);
      for (const lineNo of hubAttestedFetches) {
        expect(
          hasUpstreamSsrfCheck(fp, lineNo),
          `hub-attested fetch at line ${lineNo} has no upstream validateOutboundUrl`,
        ).toBe(true);
      }
    });
  });

  describe('transfer-fetch.worker.ts', () => {
    const fp = path.join(workersDir, 'transfer-fetch.worker.ts');

    it('imports validateOutboundUrl', () => {
      expect(importsValidation(fp)).toBe(true);
    });

    it('file fetch has upstream SSRF check', () => {
      const source = fs.readFileSync(fp, 'utf8');
      // validateOutboundUrl must appear before the first fetch
      const validateIdx = source.indexOf('validateOutboundUrl');
      const fetchIdx = source.indexOf('fetch(url');
      expect(validateIdx).toBeGreaterThan(-1);
      expect(fetchIdx).toBeGreaterThan(-1);
      expect(validateIdx).toBeLessThan(fetchIdx);
    });
  });
});
