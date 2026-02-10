import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@prospector/db';
import {
  tusdPreCreateHookSchema,
  tusdPostFinishHookSchema,
  isAllowedMimeType,
  MAX_FILE_SIZE,
  type TusdPreCreateResponse,
} from '@prospector/types';
import { SkipRateLimit } from '../security/rate-limit.guard';
// Import directly from the service file to avoid circular dependency:
// jobs.module → storage (barrel) → tusd-webhook → jobs (barrel) → jobs.module
import { VirusScanService } from '../jobs/services/virus-scan.service';

/**
 * Controller for handling tusd webhook callbacks.
 *
 * tusd sends HTTP requests to these endpoints during the upload lifecycle:
 * - pre-create: Before upload starts (for validation)
 * - post-finish: After upload completes (to update database)
 *
 * These endpoints are authenticated via a shared secret in the hook-http-secret header.
 */
@Controller('hooks/tusd')
export class TusdWebhookController {
  private readonly hookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly virusScanService: VirusScanService,
  ) {
    this.hookSecret = this.configService.get<string>('TUS_HOOK_SECRET', '');
  }

  /**
   * Validate the hook secret header
   */
  private validateHookSecret(headerSecret: string | undefined): void {
    if (!this.hookSecret) {
      // In development, allow requests without secret
      if (this.configService.get('NODE_ENV') === 'production') {
        throw new UnauthorizedException('Hook secret not configured');
      }
      return;
    }

    if (headerSecret !== this.hookSecret) {
      throw new UnauthorizedException('Invalid hook secret');
    }
  }

  /**
   * Pre-create hook: Called before upload starts.
   * Validates the upload request and returns metadata.
   */
  @Post('pre-create')
  @HttpCode(HttpStatus.OK)
  @SkipRateLimit()
  async preCreate(
    @Body() body: unknown,
    @Headers('hook-secret') hookSecret: string,
  ): Promise<TusdPreCreateResponse> {
    this.validateHookSecret(hookSecret);

    const parsed = tusdPreCreateHookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid hook payload');
    }

    const { Upload } = parsed.data;
    const metadata = Upload.MetaData || {};

    // Extract required metadata
    const fileId = metadata['file-id'];
    const orgId = metadata['org-id'];
    const userId = metadata['user-id'];
    const mimeType = metadata['content-type'] || metadata['filetype'];

    // Validate required metadata
    if (!fileId || !orgId || !userId) {
      return {
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 400,
          Body: JSON.stringify({
            error: 'Missing required metadata: file-id, org-id, user-id',
          }),
        },
      };
    }

    // Validate file exists in database
    const file = await prisma.submissionFile.findUnique({
      where: { id: fileId },
      include: { submission: true },
    });

    if (!file) {
      return {
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 404,
          Body: JSON.stringify({
            error: 'File record not found. Initiate upload first.',
          }),
        },
      };
    }

    // Validate user owns the submission
    if (file.submission.submitterId !== userId) {
      return {
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 403,
          Body: JSON.stringify({
            error: 'Not authorized to upload to this submission',
          }),
        },
      };
    }

    // Validate submission is in draft status
    if (file.submission.status !== 'DRAFT') {
      return {
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 400,
          Body: JSON.stringify({
            error: 'Cannot upload to non-draft submission',
          }),
        },
      };
    }

    // Validate file type
    if (mimeType && !isAllowedMimeType(mimeType)) {
      return {
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 400,
          Body: JSON.stringify({
            error: `File type ${mimeType} is not allowed`,
          }),
        },
      };
    }

    // Validate file size
    if (Upload.Size && Upload.Size > MAX_FILE_SIZE) {
      return {
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 400,
          Body: JSON.stringify({
            error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          }),
        },
      };
    }

    // Accept the upload with custom file ID
    return {
      ChangeFileInfo: {
        ID: fileId,
        MetaData: {
          ...metadata,
          'storage-key': file.storageKey,
        },
      },
    };
  }

  /**
   * Post-finish hook: Called after upload completes.
   * Updates the database with final file info and triggers virus scan.
   */
  @Post('post-finish')
  @HttpCode(HttpStatus.OK)
  @SkipRateLimit()
  async postFinish(
    @Body() body: unknown,
    @Headers('hook-secret') hookSecret: string,
  ): Promise<{ success: boolean }> {
    this.validateHookSecret(hookSecret);

    const parsed = tusdPostFinishHookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid hook payload');
    }

    const { Upload } = parsed.data;
    const fileId = Upload.ID;

    // Find the file record
    const file = await prisma.submissionFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      // File record doesn't exist - this shouldn't happen
      console.error(`Post-finish hook: File ${fileId} not found`);
      throw new BadRequestException('File record not found');
    }

    // Get submission for organization ID
    const fileWithSubmission = await prisma.submissionFile.findUnique({
      where: { id: fileId },
      include: { submission: true },
    });

    if (!fileWithSubmission) {
      console.error(`Post-finish hook: File ${fileId} not found`);
      throw new BadRequestException('File record not found');
    }

    // Update file record with final size and mark for scanning
    await prisma.submissionFile.update({
      where: { id: fileId },
      data: {
        size: BigInt(Upload.Size),
        scanStatus: 'PENDING',
      },
    });

    // Queue virus scan job
    const jobId = await this.virusScanService.queueScan({
      fileId,
      storageKey: file.storageKey,
      submissionId: fileWithSubmission.submissionId,
      organizationId: fileWithSubmission.submission.organizationId,
    });

    console.log(
      `File upload completed: ${fileId}, size: ${Upload.Size}, scan job: ${jobId}`,
    );

    return { success: true };
  }

  /**
   * Post-terminate hook: Called when upload is cancelled.
   * Cleans up the file record.
   */
  @Post('post-terminate')
  @HttpCode(HttpStatus.OK)
  @SkipRateLimit()
  async postTerminate(
    @Body() body: unknown,
    @Headers('hook-secret') hookSecret: string,
  ): Promise<{ success: boolean }> {
    this.validateHookSecret(hookSecret);

    const parsed = tusdPostFinishHookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid hook payload');
    }

    const { Upload } = parsed.data;
    const fileId = Upload.ID;

    // Delete the file record since upload was cancelled
    try {
      await prisma.submissionFile.delete({
        where: { id: fileId },
      });
      console.log(`Upload cancelled, deleted file record: ${fileId}`);
    } catch {
      // File might already be deleted
      console.warn(
        `Post-terminate: File ${fileId} not found or already deleted`,
      );
    }

    return { success: true };
  }
}
