import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VirusScanService, VirusScanJobData, VirusScanResult } from '../../src/modules/jobs/services/virus-scan.service';
import { VIRUS_SCAN_QUEUE } from '../../src/modules/jobs/constants';
import { Readable } from 'stream';

describe('VirusScanService', () => {
  let service: VirusScanService;
  let mockQueue: jest.Mocked<Queue>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          CLAMAV_HOST: undefined, // Disabled by default
          CLAMAV_PORT: 3310,
          CLAMAV_TIMEOUT: 30000,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirusScanService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken(VIRUS_SCAN_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<VirusScanService>(VirusScanService);
    service.onModuleInit();
  });

  describe('isEnabled', () => {
    it('should be disabled in development when CLAMAV_HOST is not set', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should be enabled when CLAMAV_HOST is set', async () => {
      // Recreate with CLAMAV_HOST set
      mockConfigService.get = jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          CLAMAV_HOST: 'localhost',
          CLAMAV_PORT: 3310,
          CLAMAV_TIMEOUT: 30000,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }) as unknown as typeof mockConfigService.get;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VirusScanService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: getQueueToken(VIRUS_SCAN_QUEUE), useValue: mockQueue },
        ],
      }).compile();

      const enabledService = module.get<VirusScanService>(VirusScanService);
      enabledService.onModuleInit();

      expect(enabledService.isEnabled()).toBe(true);
    });
  });

  describe('queueScan', () => {
    it('should add a scan job to the queue', async () => {
      const jobData: VirusScanJobData = {
        fileId: 'file-123',
        storageKey: 'org1/sub1/file1/test.pdf',
        submissionId: 'sub-123',
        organizationId: 'org-123',
      };

      mockQueue.add.mockResolvedValue({ id: 'job-456' } as never);

      const jobId = await service.queueScan(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('scan', jobData, { priority: 1 });
      expect(jobId).toBe('job-456');
    });
  });

  describe('scanStream (disabled)', () => {
    it('should return clean result when ClamAV is disabled', async () => {
      const stream = Readable.from(Buffer.from('test content'));
      const result = await service.scanStream(stream);

      expect(result).toEqual({ isClean: true });
    });
  });

  describe('scanBuffer (disabled)', () => {
    it('should return clean result when ClamAV is disabled', async () => {
      const buffer = Buffer.from('test content');
      const result = await service.scanBuffer(buffer);

      expect(result).toEqual({ isClean: true });
    });
  });

  describe('ping (disabled)', () => {
    it('should return false when ClamAV is disabled', async () => {
      const result = await service.ping();
      expect(result).toBe(false);
    });
  });

  describe('getVersion (disabled)', () => {
    it('should return disabled message when ClamAV is disabled', async () => {
      const result = await service.getVersion();
      expect(result).toBe('ClamAV disabled');
    });
  });

  describe('parseResponse (internal)', () => {
    // Access private method for testing response parsing
    let enabledService: VirusScanService;

    beforeEach(async () => {
      mockConfigService.get = jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          CLAMAV_HOST: 'localhost',
          CLAMAV_PORT: 3310,
          CLAMAV_TIMEOUT: 30000,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }) as unknown as typeof mockConfigService.get;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VirusScanService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: getQueueToken(VIRUS_SCAN_QUEUE), useValue: mockQueue },
        ],
      }).compile();

      enabledService = module.get<VirusScanService>(VirusScanService);
      enabledService.onModuleInit();
    });

    it('should parse clean response', () => {
      const result = (enabledService as unknown as { parseResponse: (r: string) => VirusScanResult }).parseResponse('stream: OK');
      expect(result).toEqual({ isClean: true });
    });

    it('should parse infected response', () => {
      const result = (enabledService as unknown as { parseResponse: (r: string) => VirusScanResult }).parseResponse('stream: Eicar-Test-Signature FOUND');
      expect(result).toEqual({ isClean: false, virusName: 'Eicar-Test-Signature' });
    });

    it('should parse error response', () => {
      const result = (enabledService as unknown as { parseResponse: (r: string) => VirusScanResult }).parseResponse('stream: Connection refused ERROR');
      expect(result).toEqual({ isClean: false, error: 'Connection refused' });
    });

    it('should handle unknown response', () => {
      const result = (enabledService as unknown as { parseResponse: (r: string) => VirusScanResult }).parseResponse('unknown response format');
      expect(result.isClean).toBe(false);
      expect(result.error).toContain('Unknown ClamAV response');
    });

    it('should handle trimmed whitespace', () => {
      const result = (enabledService as unknown as { parseResponse: (r: string) => VirusScanResult }).parseResponse('  stream: OK  \n');
      expect(result).toEqual({ isClean: true });
    });
  });
});

describe('VirusScanService (enabled with mocked socket)', () => {
  let service: VirusScanService;
  let mockQueue: jest.Mocked<Queue>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          CLAMAV_HOST: 'localhost',
          CLAMAV_PORT: 3310,
          CLAMAV_TIMEOUT: 1000, // Short timeout for tests
          NODE_ENV: 'test',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirusScanService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken(VIRUS_SCAN_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<VirusScanService>(VirusScanService);
    service.onModuleInit();
  });

  describe('scanStream (enabled but no ClamAV server)', () => {
    it('should reject with connection error when ClamAV is not running', async () => {
      const stream = Readable.from(Buffer.from('test content'));

      await expect(service.scanStream(stream)).rejects.toThrow(/ClamAV connection failed/);
    }, 5000);
  });

  describe('ping (enabled but no ClamAV server)', () => {
    it('should return false when ClamAV is not running', async () => {
      const result = await service.ping();
      expect(result).toBe(false);
    }, 5000);
  });
});
