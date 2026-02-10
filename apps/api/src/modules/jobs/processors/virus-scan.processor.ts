import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { prisma } from '@prospector/db';
import { StorageService } from '../../storage/storage.service';
import {
  VirusScanService,
  VirusScanJobData,
  VirusScanResult,
} from '../services/virus-scan.service';
import { VIRUS_SCAN_QUEUE } from '../constants';
import { Readable } from 'stream';

@Injectable()
@Processor(VIRUS_SCAN_QUEUE)
export class VirusScanProcessor extends WorkerHost {
  private readonly logger = new Logger(VirusScanProcessor.name);

  constructor(
    private readonly virusScanService: VirusScanService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<VirusScanJobData>): Promise<VirusScanResult> {
    const { fileId, storageKey, submissionId, organizationId } = job.data;

    this.logger.log(`Processing virus scan for file ${fileId}`);

    try {
      // Update status to SCANNING
      await this.updateFileStatus(fileId, 'SCANNING');

      // Check if ClamAV is enabled
      if (!this.virusScanService.isEnabled()) {
        this.logger.warn(`ClamAV disabled, marking file ${fileId} as clean`);
        await this.handleCleanFile(fileId, storageKey);
        return { isClean: true };
      }

      // Get the file from quarantine bucket
      const fileStream = await this.getFileFromQuarantine(storageKey);
      if (!fileStream) {
        throw new Error(`File not found in quarantine: ${storageKey}`);
      }

      // Scan the file
      const result = await this.virusScanService.scanStream(fileStream);

      // Handle the result
      if (result.isClean) {
        await this.handleCleanFile(fileId, storageKey);
        this.logger.log(`File ${fileId} is clean`);
      } else if (result.virusName) {
        await this.handleInfectedFile(
          fileId,
          result.virusName,
          submissionId,
          organizationId,
        );
        this.logger.warn(
          `File ${fileId} is infected with: ${result.virusName}`,
        );
      } else if (result.error) {
        await this.handleScanError(fileId, result.error);
        this.logger.error(`Scan error for file ${fileId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.handleScanError(fileId, errorMessage);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<VirusScanJobData>) {
    this.logger.log(`Job ${job.id} completed for file ${job.data.fileId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<VirusScanJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for file ${job.data.fileId}: ${error.message}`,
    );
  }

  /**
   * Get file from quarantine bucket for scanning
   */
  private async getFileFromQuarantine(
    storageKey: string,
  ): Promise<NodeJS.ReadableStream | null> {
    // Use S3 client to get from quarantine bucket
    const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');

    // We need to access quarantine bucket directly
    // StorageService.getFile uses main bucket, so we create a direct request
    const endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'http://localhost:9000',
    );
    const quarantineBucket = this.configService.get<string>(
      'S3_QUARANTINE_BUCKET',
      'quarantine',
    );
    const accessKey = this.configService.get<string>(
      'S3_ACCESS_KEY',
      'minioadmin',
    );
    const secretKey = this.configService.get<string>(
      'S3_SECRET_KEY',
      'minioadmin',
    );
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s3Client: any = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    try {
      const command = new GetObjectCommand({
        Bucket: quarantineBucket,
        Key: storageKey,
      });

      const response = await s3Client.send(command);
      // Convert Web ReadableStream to Node.js Readable if needed
      if (
        response.Body &&
        typeof (response.Body as NodeJS.ReadableStream).pipe === 'function'
      ) {
        return response.Body as NodeJS.ReadableStream;
      }
      // Handle case where Body is a Web ReadableStream (convert to Node stream)
      if (response.Body) {
        const webStream =
          response.Body as unknown as ReadableStream<Uint8Array>;
        return Readable.fromWeb(
          webStream as import('stream/web').ReadableStream<Uint8Array>,
        );
      }
      return null;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Handle a clean file - move from quarantine to production bucket
   */
  private async handleCleanFile(
    fileId: string,
    storageKey: string,
  ): Promise<void> {
    // Move file from quarantine to main bucket
    await this.storageService.moveFromQuarantine(storageKey);

    // Update file status
    await this.updateFileStatus(fileId, 'CLEAN');
  }

  /**
   * Handle an infected file - keep in quarantine, update status
   */
  private async handleInfectedFile(
    fileId: string,
    virusName: string,
    submissionId: string,
    organizationId: string,
  ): Promise<void> {
    // Update file status
    await prisma.submissionFile.update({
      where: { id: fileId },
      data: {
        scanStatus: 'INFECTED',
        scanResult: virusName,
        scannedAt: new Date(),
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        eventType: 'FILE_INFECTED',
        actorType: 'SYSTEM',
        resourceType: 'submission_file',
        resourceId: fileId,
        organizationId,
        metadata: {
          virusName,
          submissionId,
          storageKey: (
            await prisma.submissionFile.findUnique({ where: { id: fileId } })
          )?.storageKey,
        },
      },
    });

    // TODO: Queue notification email to user
    // TODO: Consider auto-rejecting submission or flagging for review
  }

  /**
   * Handle scan error - mark as failed
   */
  private async handleScanError(fileId: string, error: string): Promise<void> {
    await prisma.submissionFile.update({
      where: { id: fileId },
      data: {
        scanStatus: 'FAILED',
        scanResult: error,
        scannedAt: new Date(),
      },
    });
  }

  /**
   * Update file scan status
   */
  private async updateFileStatus(
    fileId: string,
    status: 'PENDING' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'FAILED',
  ): Promise<void> {
    const data: { scanStatus: string; scannedAt?: Date } = {
      scanStatus: status,
    };
    if (status === 'CLEAN' || status === 'INFECTED' || status === 'FAILED') {
      data.scannedAt = new Date();
    }

    await prisma.submissionFile.update({
      where: { id: fileId },
      data,
    });
  }
}
