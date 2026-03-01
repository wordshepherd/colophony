import { describe, it, expect, vi, beforeEach } from 'vitest';
import dns from 'node:dns';
import {
  isPrivateIPv4,
  isPrivateIPv6,
  resolveAndCheckPrivateIp,
  validateOutboundUrl,
  SsrfValidationError,
} from './url-validation.js';

vi.mock('node:dns', () => ({
  default: {
    promises: {
      resolve4: vi.fn(),
      resolve6: vi.fn(),
    },
  },
}));

const mockResolve4 = dns.promises.resolve4 as ReturnType<typeof vi.fn>;
const mockResolve6 = dns.promises.resolve6 as ReturnType<typeof vi.fn>;

describe('url-validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue([]);
  });

  describe('isPrivateIPv4', () => {
    it('detects 10.x.x.x', () => {
      expect(isPrivateIPv4('10.0.0.1')).toBe(true);
      expect(isPrivateIPv4('10.255.255.255')).toBe(true);
    });

    it('detects 172.16-31.x.x', () => {
      expect(isPrivateIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateIPv4('172.15.0.1')).toBe(false);
      expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    });

    it('detects 192.168.x.x', () => {
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
    });

    it('detects 127.x.x.x loopback', () => {
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
    });

    it('detects 169.254.x.x link-local/metadata', () => {
      expect(isPrivateIPv4('169.254.169.254')).toBe(true);
    });

    it('allows public IPs', () => {
      expect(isPrivateIPv4('93.184.216.34')).toBe(false);
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    });
  });

  describe('isPrivateIPv6', () => {
    it('detects ::1 loopback', () => {
      expect(isPrivateIPv6('::1')).toBe(true);
    });

    it('detects fc/fd (ULA)', () => {
      expect(isPrivateIPv6('fd12::1')).toBe(true);
      expect(isPrivateIPv6('fc00::1')).toBe(true);
    });

    it('detects fe80 (link-local)', () => {
      expect(isPrivateIPv6('fe80::1')).toBe(true);
    });

    it('allows public IPv6', () => {
      expect(isPrivateIPv6('2001:db8::1')).toBe(false);
    });
  });

  describe('resolveAndCheckPrivateIp', () => {
    it('rejects when resolve4 returns private IP', async () => {
      mockResolve4.mockResolvedValue(['10.0.0.1']);
      await expect(resolveAndCheckPrivateIp('example.com')).rejects.toThrow(
        SsrfValidationError,
      );
    });

    it('rejects when resolve6 returns private IP', async () => {
      mockResolve6.mockResolvedValue(['::1']);
      await expect(resolveAndCheckPrivateIp('example.com')).rejects.toThrow(
        SsrfValidationError,
      );
    });

    it('allows public IPs', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34']);
      mockResolve6.mockResolvedValue([]);
      await expect(
        resolveAndCheckPrivateIp('example.com'),
      ).resolves.toBeUndefined();
    });

    it('rejects IP literals directly (no DNS needed)', async () => {
      await expect(resolveAndCheckPrivateIp('10.0.0.1')).rejects.toThrow(
        SsrfValidationError,
      );
      expect(mockResolve4).not.toHaveBeenCalled();
    });
  });

  describe('validateOutboundUrl', () => {
    it('rejects HTTP URLs in production mode', async () => {
      await expect(
        validateOutboundUrl('http://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
      await expect(
        validateOutboundUrl('http://example.com/hook'),
      ).rejects.toThrow(/HTTPS required/);
    });

    it('allows HTTP in dev mode', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34']);
      await expect(
        validateOutboundUrl('http://example.com/hook', { devMode: true }),
      ).resolves.toBeUndefined();
    });

    it('rejects 10.x.x.x', async () => {
      mockResolve4.mockResolvedValue(['10.0.0.1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects 172.16.x.x', async () => {
      mockResolve4.mockResolvedValue(['172.16.0.1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects 192.168.x.x', async () => {
      mockResolve4.mockResolvedValue(['192.168.1.1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects 127.x.x.x (loopback)', async () => {
      mockResolve4.mockResolvedValue(['127.0.0.1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects 169.254.x.x (metadata)', async () => {
      mockResolve4.mockResolvedValue(['169.254.169.254']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects ::1 (IPv6 loopback)', async () => {
      mockResolve6.mockResolvedValue(['::1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects fc/fd (ULA)', async () => {
      mockResolve6.mockResolvedValue(['fd12::1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('rejects fe80 (link-local)', async () => {
      mockResolve6.mockResolvedValue(['fe80::1']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('allows public IPs', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34']);
      await expect(
        validateOutboundUrl('https://example.com/hook'),
      ).resolves.toBeUndefined();
    });

    it('rejects IP literals directly (no DNS needed)', async () => {
      await expect(
        validateOutboundUrl('https://10.0.0.1/hook'),
      ).rejects.toThrow(SsrfValidationError);
    });

    it('skips all checks in dev mode', async () => {
      // Private IP + HTTP — should pass in dev mode
      await expect(
        validateOutboundUrl('http://10.0.0.1/hook', { devMode: true }),
      ).resolves.toBeUndefined();
      expect(mockResolve4).not.toHaveBeenCalled();
    });

    it('allows HTTPS + private IP in dev mode', async () => {
      // HTTPS with private IP — should still pass in dev mode
      await expect(
        validateOutboundUrl('https://192.168.1.1/hook', { devMode: true }),
      ).resolves.toBeUndefined();
      expect(mockResolve4).not.toHaveBeenCalled();
    });

    it('rejects invalid URLs', async () => {
      await expect(validateOutboundUrl('not-a-url')).rejects.toThrow(
        SsrfValidationError,
      );
    });
  });
});
