import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as net from 'net';
import { VIRUS_SCAN_QUEUE } from '../constants';

export interface VirusScanJobData {
  fileId: string;
  storageKey: string;
  submissionId: string;
  organizationId: string;
}

export interface VirusScanResult {
  isClean: boolean;
  virusName?: string;
  error?: string;
}

export interface ClamAVConfig {
  host: string;
  port: number;
  timeout: number;
}

@Injectable()
export class VirusScanService implements OnModuleInit {
  private config!: ClamAVConfig;
  private enabled: boolean = true;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(VIRUS_SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  onModuleInit() {
    this.config = {
      host: this.configService.get<string>('CLAMAV_HOST', 'localhost'),
      port: this.configService.get<number>('CLAMAV_PORT', 3310),
      timeout: this.configService.get<number>('CLAMAV_TIMEOUT', 30000),
    };

    // Disable ClamAV in development if not configured
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const clamavHost = this.configService.get<string>('CLAMAV_HOST');
    if (nodeEnv === 'development' && !clamavHost) {
      this.enabled = false;
      console.log('ClamAV disabled in development (CLAMAV_HOST not set)');
    }
  }

  /**
   * Check if ClamAV scanning is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Queue a file for virus scanning
   */
  async queueScan(data: VirusScanJobData): Promise<string> {
    const job = await this.scanQueue.add('scan', data, {
      priority: 1, // Higher priority for user-uploaded files
    });
    return job.id!;
  }

  /**
   * Ping ClamAV to check if it's available
   */
  async ping(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.sendCommand('PING');
      return response.trim() === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get ClamAV version
   */
  async getVersion(): Promise<string> {
    if (!this.enabled) {
      return 'ClamAV disabled';
    }

    try {
      return await this.sendCommand('VERSION');
    } catch (error) {
      throw new Error(`Failed to get ClamAV version: ${error}`);
    }
  }

  /**
   * Scan a file stream using INSTREAM command
   *
   * Protocol:
   * 1. Send "zINSTREAM\0"
   * 2. Send chunks as [4-byte length][data]
   * 3. Send [0x00000000] to signal end
   * 4. Read response
   */
  async scanStream(stream: NodeJS.ReadableStream): Promise<VirusScanResult> {
    if (!this.enabled) {
      // In development without ClamAV, assume files are clean
      console.log('ClamAV disabled, skipping scan (assuming clean)');
      return { isClean: true };
    }

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let response = '';
      let connected = false;

      const cleanup = () => {
        socket.destroy();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('ClamAV scan timeout'));
      }, this.config.timeout);

      socket.on('connect', () => {
        connected = true;
        // Send INSTREAM command (null-terminated)
        socket.write('zINSTREAM\0');
      });

      socket.on('data', (data) => {
        response += data.toString();
      });

      socket.on('end', () => {
        clearTimeout(timeout);
        resolve(this.parseResponse(response));
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        cleanup();
        if (!connected) {
          reject(new Error(`ClamAV connection failed: ${error.message}`));
        } else {
          reject(new Error(`ClamAV scan error: ${error.message}`));
        }
      });

      socket.on('close', () => {
        clearTimeout(timeout);
      });

      // Connect to ClamAV
      socket.connect(this.config.port, this.config.host);

      // Pipe the stream in chunks
      stream.on('data', (chunk: Buffer) => {
        // Send chunk length as 4-byte big-endian, then chunk data
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length, 0);
        socket.write(length);
        socket.write(chunk);
      });

      stream.on('end', () => {
        // Send zero-length chunk to signal end
        const endMarker = Buffer.alloc(4);
        endMarker.writeUInt32BE(0, 0);
        socket.write(endMarker);
      });

      stream.on('error', (error) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`Stream error during scan: ${error.message}`));
      });
    });
  }

  /**
   * Scan a buffer directly
   */
  async scanBuffer(buffer: Buffer): Promise<VirusScanResult> {
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    return this.scanStream(stream);
  }

  /**
   * Parse ClamAV response
   *
   * Response formats:
   * - Clean: "stream: OK"
   * - Infected: "stream: VirusName FOUND"
   * - Error: "stream: Error message ERROR"
   */
  private parseResponse(response: string): VirusScanResult {
    const trimmed = response.trim();

    if (trimmed.endsWith('OK')) {
      return { isClean: true };
    }

    if (trimmed.endsWith('FOUND')) {
      // Extract virus name: "stream: VirusName FOUND"
      const match = trimmed.match(/^stream: (.+) FOUND$/);
      const virusName = match ? match[1] : 'Unknown';
      return { isClean: false, virusName };
    }

    if (trimmed.endsWith('ERROR')) {
      // Extract error: "stream: Error message ERROR"
      const match = trimmed.match(/^stream: (.+) ERROR$/);
      const error = match ? match[1] : trimmed;
      return { isClean: false, error };
    }

    // Unknown response
    return { isClean: false, error: `Unknown ClamAV response: ${trimmed}` };
  }

  /**
   * Send a simple command to ClamAV and get response
   */
  private sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let response = '';

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('ClamAV command timeout'));
      }, 5000);

      socket.on('connect', () => {
        socket.write(`${command}\n`);
      });

      socket.on('data', (data) => {
        response += data.toString();
      });

      socket.on('end', () => {
        clearTimeout(timeout);
        resolve(response);
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      socket.connect(this.config.port, this.config.host);
    });
  }
}
