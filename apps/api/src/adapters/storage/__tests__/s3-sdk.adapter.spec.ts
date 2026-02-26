import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3StorageAdapter } from '../s3-sdk.adapter.js';
import { Readable } from 'node:stream';

const mockSend = vi.fn();
const mockDestroy = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn().mockImplementation(function () {
      return {
        send: (...args: unknown[]) => mockSend(...args),
        destroy: () => mockDestroy(),
      };
    }),
    PutObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
      return { _type: 'PutObject', input };
    }),
    GetObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
      return { _type: 'GetObject', input };
    }),
    DeleteObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
      return { _type: 'DeleteObject', input };
    }),
    CopyObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
      return { _type: 'CopyObject', input };
    }),
    HeadObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
      return { _type: 'HeadObject', input };
    }),
    HeadBucketCommand: vi.fn().mockImplementation(function (input: unknown) {
      return { _type: 'HeadBucket', input };
    }),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com/key'),
}));

describe('S3StorageAdapter', () => {
  let adapter: S3StorageAdapter;

  const baseConfig = {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    bucket: 'submissions',
    quarantineBucket: 'quarantine',
    forcePathStyle: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter();
    await adapter.initialize(baseConfig);
  });

  it('initialize creates S3Client with correct config', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        forcePathStyle: true,
      }),
    );
  });

  it('getters return configured bucket names', () => {
    expect(adapter.defaultBucket).toBe('submissions');
    expect(adapter.quarantineBucket).toBe('quarantine');
  });

  it('upload sends PutObjectCommand to default bucket', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await adapter.upload({
      key: 'test/file.pdf',
      body: Buffer.from('data'),
      contentType: 'application/pdf',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'submissions',
          Key: 'test/file.pdf',
        }),
      }),
    );
    expect(result.key).toBe('test/file.pdf');
  });

  it('download returns readable stream from default bucket', async () => {
    const body = Readable.from(Buffer.from('file-content'));
    mockSend.mockResolvedValueOnce({ Body: body });

    const stream = await adapter.download('test/file.pdf');
    expect(stream).toBe(body);
  });

  it('download throws when Body is null', async () => {
    mockSend.mockResolvedValueOnce({ Body: null });

    await expect(adapter.download('test/file.pdf')).rejects.toThrow(
      'has no body',
    );
  });

  it('delete sends DeleteObjectCommand to default bucket', async () => {
    mockSend.mockResolvedValueOnce({});
    await adapter.delete('test/file.pdf');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'submissions',
          Key: 'test/file.pdf',
        }),
      }),
    );
  });

  it('exists returns true on HeadObject success', async () => {
    mockSend.mockResolvedValueOnce({});
    expect(await adapter.exists('test/file.pdf')).toBe(true);
  });

  it('exists returns false on NotFound error', async () => {
    const err = new Error('NotFound');
    err.name = 'NotFound';
    mockSend.mockRejectedValueOnce(err);
    expect(await adapter.exists('test/file.pdf')).toBe(false);
  });

  it('getSignedUrl returns presigned URL with default 900s expiry', async () => {
    const url = await adapter.getSignedUrl('test/file.pdf');
    expect(url).toBe('https://signed-url.example.com/key');

    const { getSignedUrl: mockGetSignedUrl } =
      await import('@aws-sdk/s3-request-presigner');
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 900 },
    );
  });

  it('move copies then deletes within default bucket', async () => {
    mockSend.mockResolvedValue({});

    await adapter.move('old/key', 'new/key');

    // Two calls: CopyObject then DeleteObject
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          CopySource: 'submissions/old/key',
          Bucket: 'submissions',
          Key: 'new/key',
        }),
      }),
    );
  });

  it('downloadFromBucket uses specified bucket', async () => {
    const body = Readable.from(Buffer.from('data'));
    mockSend.mockResolvedValueOnce({ Body: body });

    await adapter.downloadFromBucket('quarantine', 'test/key');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: 'quarantine' }),
      }),
    );
  });

  it('deleteFromBucket uses specified bucket', async () => {
    mockSend.mockResolvedValueOnce({});

    await adapter.deleteFromBucket('quarantine', 'test/key');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: 'quarantine' }),
      }),
    );
  });

  it('uploadToBucket uses specified bucket', async () => {
    mockSend.mockResolvedValueOnce({});

    await adapter.uploadToBucket(
      'quarantine',
      'test/key',
      Buffer.from('data'),
      'text/plain',
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'quarantine',
          Key: 'test/key',
          ContentType: 'text/plain',
        }),
      }),
    );
  });

  it('moveBetweenBuckets copies cross-bucket then deletes source', async () => {
    mockSend.mockResolvedValue({});

    await adapter.moveBetweenBuckets(
      'quarantine',
      'src/key',
      'submissions',
      'dest/key',
    );

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          CopySource: 'quarantine/src/key',
          Bucket: 'submissions',
          Key: 'dest/key',
        }),
      }),
    );
  });

  it('healthCheck returns healthy on HeadBucket success', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(true);
  });

  it('healthCheck returns unhealthy on HeadBucket failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('Access Denied'));

    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.message).toBe('Access Denied');
  });

  it('destroy calls client.destroy()', async () => {
    await adapter.destroy();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('configSchema rejects missing endpoint', () => {
    const result = adapter.configSchema.safeParse({
      accessKey: 'a',
      secretKey: 'b',
      bucket: 'c',
    });
    expect(result.success).toBe(false);
  });

  it('configSchema defaults region to us-east-1 and forcePathStyle to true', () => {
    const result = adapter.configSchema.parse({
      endpoint: 'http://localhost:9000',
      accessKey: 'a',
      secretKey: 'b',
      bucket: 'c',
    });
    expect(result.region).toBe('us-east-1');
    expect(result.forcePathStyle).toBe(true);
  });
});
