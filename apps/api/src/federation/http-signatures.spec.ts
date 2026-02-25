import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  signFederationRequest,
  verifyFederationSignature,
  computeContentDigest,
} from './http-signatures.js';

// Generate a real Ed25519 keypair for testing
const { publicKey: testPublicKey, privateKey: testPrivateKey } =
  crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

const testKeyId = 'test.example.com#main';

describe('http-signatures', () => {
  describe('sign and verify round-trip', () => {
    it('sign and verify round-trip with Ed25519', async () => {
      const body = JSON.stringify({ hello: 'world' });
      const result = signFederationRequest({
        method: 'POST',
        url: 'https://remote.example.com/federation/trust',
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: testPrivateKey,
        keyId: testKeyId,
      });

      expect(result.headers['signature']).toBeDefined();
      expect(result.headers['signature-input']).toBeDefined();
      expect(result.headers['content-digest']).toBeDefined();
      expect(result.headers['date']).toBeDefined();

      const verification = await verifyFederationSignature(
        {
          keyLookup: async (kid) => (kid === testKeyId ? testPublicKey : null),
        },
        {
          method: 'POST',
          url: 'https://remote.example.com/federation/trust',
          headers: result.headers,
          body,
        },
      );

      expect(verification.valid).toBe(true);
      expect(verification.keyId).toBe(testKeyId);
    });
  });

  describe('verification failures', () => {
    it('rejects expired signature', async () => {
      const body = JSON.stringify({ test: true });
      const result = signFederationRequest({
        method: 'POST',
        url: 'https://remote.example.com/federation/trust',
        headers: {
          'content-type': 'application/json',
          date: new Date(Date.now() - 600_000).toUTCString(), // 10 min ago
        },
        body,
        privateKey: testPrivateKey,
        keyId: testKeyId,
      });

      await expect(
        verifyFederationSignature(
          {
            maxAge: 0,
            keyLookup: async () => testPublicKey,
          },
          {
            method: 'POST',
            url: 'https://remote.example.com/federation/trust',
            headers: result.headers,
            body,
          },
        ),
      ).rejects.toThrow('Signature expired');
    });

    it('rejects tampered body', async () => {
      const body = JSON.stringify({ original: true });
      const result = signFederationRequest({
        method: 'POST',
        url: 'https://remote.example.com/federation/trust',
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: testPrivateKey,
        keyId: testKeyId,
      });

      await expect(
        verifyFederationSignature(
          {
            keyLookup: async () => testPublicKey,
          },
          {
            method: 'POST',
            url: 'https://remote.example.com/federation/trust',
            headers: result.headers,
            body: JSON.stringify({ tampered: true }),
          },
        ),
      ).rejects.toThrow('Content-Digest mismatch');
    });

    it('rejects unknown keyId', async () => {
      const body = JSON.stringify({ test: true });
      const result = signFederationRequest({
        method: 'POST',
        url: 'https://remote.example.com/federation/trust',
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: testPrivateKey,
        keyId: testKeyId,
      });

      await expect(
        verifyFederationSignature(
          {
            keyLookup: async () => null,
          },
          {
            method: 'POST',
            url: 'https://remote.example.com/federation/trust',
            headers: result.headers,
            body,
          },
        ),
      ).rejects.toThrow('Unknown keyId');
    });

    it('rejects wrong public key', async () => {
      const { publicKey: wrongPublicKey } = crypto.generateKeyPairSync(
        'ed25519',
        {
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        },
      );

      const body = JSON.stringify({ test: true });
      const result = signFederationRequest({
        method: 'POST',
        url: 'https://remote.example.com/federation/trust',
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: testPrivateKey,
        keyId: testKeyId,
      });

      const verification = await verifyFederationSignature(
        {
          keyLookup: async () => wrongPublicKey,
        },
        {
          method: 'POST',
          url: 'https://remote.example.com/federation/trust',
          headers: result.headers,
          body,
        },
      );

      expect(verification.valid).toBe(false);
    });

    it('rejects missing Signature headers', async () => {
      await expect(
        verifyFederationSignature(
          {
            keyLookup: async () => testPublicKey,
          },
          {
            method: 'POST',
            url: 'https://remote.example.com/federation/trust',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          },
        ),
      ).rejects.toThrow('Missing Signature or Signature-Input headers');
    });
  });

  describe('requests without body', () => {
    it('handles request without body (GET, no Content-Digest)', async () => {
      const result = signFederationRequest({
        method: 'GET',
        url: 'https://remote.example.com/.well-known/colophony',
        headers: {},
        privateKey: testPrivateKey,
        keyId: testKeyId,
      });

      expect(result.headers['content-digest']).toBeUndefined();
      expect(result.headers['signature']).toBeDefined();

      const verification = await verifyFederationSignature(
        {
          keyLookup: async () => testPublicKey,
        },
        {
          method: 'GET',
          url: 'https://remote.example.com/.well-known/colophony',
          headers: result.headers,
        },
      );

      expect(verification.valid).toBe(true);
    });
  });

  describe('Content-Digest', () => {
    it('Content-Digest uses SHA-256 format', () => {
      const body = '{"test": "data"}';
      const digest = computeContentDigest(body);
      expect(digest).toMatch(/^sha-256=:[A-Za-z0-9+/=]+:$/);

      // Verify it's deterministic
      const digest2 = computeContentDigest(body);
      expect(digest).toBe(digest2);
    });
  });
});
