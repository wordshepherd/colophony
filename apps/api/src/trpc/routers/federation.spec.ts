import { describe, it, expect, vi } from 'vitest';

// Mock services
vi.mock('../../services/federation.service.js', () => ({
  federationService: {
    getPublicConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

vi.mock('../../services/trust.service.js', () => ({
  trustService: {
    fetchRemoteMetadata: vi.fn(),
    listPeers: vi.fn(),
    getPeerById: vi.fn(),
    initiateTrust: vi.fn(),
    acceptInboundTrust: vi.fn(),
    rejectTrust: vi.fn(),
    revokeTrust: vi.fn(),
  },
  TrustPeerNotFoundError: class extends Error {
    override name = 'TrustPeerNotFoundError';
  },
  TrustPeerAlreadyExistsError: class extends Error {
    override name = 'TrustPeerAlreadyExistsError';
  },
  TrustPeerInvalidStateError: class extends Error {
    override name = 'TrustPeerInvalidStateError';
  },
  RemoteMetadataFetchError: class extends Error {
    override name = 'RemoteMetadataFetchError';
  },
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    FEDERATION_DOMAIN: 'test.example.com',
  }),
}));

vi.mock('../init.js', () => {
  const passthrough = {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  };
  return {
    adminProcedure: passthrough,
    createRouter: vi.fn((routes) => routes),
  };
});

vi.mock('../error-mapper.js', () => ({
  mapServiceError: vi.fn(),
}));

vi.mock('zod', () => ({
  z: {
    object: vi.fn().mockReturnValue({
      merge: vi.fn().mockReturnValue({}),
    }),
    string: vi.fn().mockReturnValue({
      uuid: vi.fn().mockReturnValue({}),
    }),
  },
}));

vi.mock('@colophony/types', () => ({
  updateFederationConfigSchema: {},
  domainParamSchema: {},
  initiateTrustSchema: {},
  peerActionSchema: {},
}));

// Must import after mocks
import { federationRouter } from './federation.js';

describe('federationRouter', () => {
  it('exports all expected procedures', () => {
    expect(federationRouter).toHaveProperty('getConfig');
    expect(federationRouter).toHaveProperty('updateConfig');
    expect(federationRouter).toHaveProperty('previewRemote');
    expect(federationRouter).toHaveProperty('listPeers');
    expect(federationRouter).toHaveProperty('getPeer');
    expect(federationRouter).toHaveProperty('initiateTrust');
    expect(federationRouter).toHaveProperty('acceptPeer');
    expect(federationRouter).toHaveProperty('rejectPeer');
    expect(federationRouter).toHaveProperty('revokePeer');
  });

  it('has exactly 9 procedures', () => {
    expect(Object.keys(federationRouter)).toHaveLength(9);
  });

  it('query procedures include getConfig, previewRemote, listPeers, getPeer', () => {
    // These are the 4 query procedures — the passthrough mock verifies
    // they were defined by checking the router keys exist
    const queryProcedures = [
      'getConfig',
      'previewRemote',
      'listPeers',
      'getPeer',
    ];
    for (const name of queryProcedures) {
      expect(federationRouter).toHaveProperty(name);
    }
  });

  it('mutation procedures include updateConfig, initiateTrust, acceptPeer, rejectPeer, revokePeer', () => {
    const mutationProcedures = [
      'updateConfig',
      'initiateTrust',
      'acceptPeer',
      'rejectPeer',
      'revokePeer',
    ];
    for (const name of mutationProcedures) {
      expect(federationRouter).toHaveProperty(name);
    }
  });
});
