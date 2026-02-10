import {
  STORAGE_KEYS,
  getAccessToken,
  getCurrentOrgId,
  setCurrentOrgId,
  getTrpcClient,
} from '../trpc';

describe('trpc utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('STORAGE_KEYS', () => {
    it('should have correct key values', () => {
      expect(STORAGE_KEYS.ACCESS_TOKEN).toBe('accessToken');
      expect(STORAGE_KEYS.REFRESH_TOKEN).toBe('refreshToken');
      expect(STORAGE_KEYS.CURRENT_ORG_ID).toBe('currentOrgId');
      expect(STORAGE_KEYS.TOKEN_EXPIRES_AT).toBe('tokenExpiresAt');
    });
  });

  describe('getAccessToken', () => {
    it('should return token when stored', () => {
      localStorage.setItem('accessToken', 'my-token');
      expect(getAccessToken()).toBe('my-token');
    });

    it('should return null when no token', () => {
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('getCurrentOrgId', () => {
    it('should return org ID when stored', () => {
      localStorage.setItem('currentOrgId', 'org-123');
      expect(getCurrentOrgId()).toBe('org-123');
    });

    it('should return null when no org ID', () => {
      expect(getCurrentOrgId()).toBeNull();
    });
  });

  describe('setCurrentOrgId', () => {
    it('should store org ID', () => {
      setCurrentOrgId('org-abc');
      expect(localStorage.getItem('currentOrgId')).toBe('org-abc');
    });

    it('should remove org ID when null', () => {
      localStorage.setItem('currentOrgId', 'org-abc');
      setCurrentOrgId(null);
      expect(localStorage.getItem('currentOrgId')).toBeNull();
    });
  });

  describe('getTrpcClient', () => {
    it('should return a tRPC client object', () => {
      const client = getTrpcClient();
      expect(client).toBeDefined();
    });
  });
});
