import {
  isAllowedMimeType,
  sanitizeFilename,
  getFileExtension,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES_PER_SUBMISSION,
  MAX_TOTAL_UPLOAD_SIZE,
} from '@prospector/types';

describe('File Utilities', () => {
  describe('isAllowedMimeType', () => {
    it('should allow PDF files', () => {
      expect(isAllowedMimeType('application/pdf')).toBe(true);
    });

    it('should allow Word documents', () => {
      expect(isAllowedMimeType('application/msword')).toBe(true);
      expect(
        isAllowedMimeType(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe(true);
    });

    it('should allow images', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true);
      expect(isAllowedMimeType('image/png')).toBe(true);
      expect(isAllowedMimeType('image/gif')).toBe(true);
      expect(isAllowedMimeType('image/webp')).toBe(true);
    });

    it('should allow audio files', () => {
      expect(isAllowedMimeType('audio/mpeg')).toBe(true);
      expect(isAllowedMimeType('audio/wav')).toBe(true);
      expect(isAllowedMimeType('audio/ogg')).toBe(true);
    });

    it('should allow video files', () => {
      expect(isAllowedMimeType('video/mp4')).toBe(true);
      expect(isAllowedMimeType('video/webm')).toBe(true);
    });

    it('should allow plain text and markdown', () => {
      expect(isAllowedMimeType('text/plain')).toBe(true);
      expect(isAllowedMimeType('text/markdown')).toBe(true);
    });

    it('should reject executables', () => {
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
      expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
    });

    it('should reject unknown types', () => {
      expect(isAllowedMimeType('application/octet-stream')).toBe(false);
      expect(isAllowedMimeType('application/x-unknown')).toBe(false);
    });

    it('should reject HTML and JavaScript', () => {
      expect(isAllowedMimeType('text/html')).toBe(false);
      expect(isAllowedMimeType('application/javascript')).toBe(false);
      expect(isAllowedMimeType('text/javascript')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should keep simple filenames unchanged', () => {
      expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
      expect(sanitizeFilename('my-file_v1.txt')).toBe('my-file_v1.txt');
    });

    it('should remove path separators', () => {
      // Path separators removed, dots preserved
      expect(sanitizeFilename('../../../etc/passwd')).toBe('......etcpasswd');
      expect(sanitizeFilename('folder\\file.txt')).toBe('folderfile.txt');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('my document.pdf')).toBe('my_document.pdf');
      expect(sanitizeFilename('file   name.txt')).toBe('file_name.txt');
    });

    it('should remove special characters', () => {
      expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file.txt');
      expect(sanitizeFilename("test'file.pdf")).toBe('testfile.pdf');
    });

    it('should handle empty or invalid filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('...')).toBe('...');
      expect(sanitizeFilename('<>:"|?*')).toBe('unnamed');
    });

    it('should truncate very long filenames while preserving extension', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized.endsWith('.pdf')).toBe(true);
    });

    it('should handle filenames without extensions', () => {
      expect(sanitizeFilename('README')).toBe('README');
      const longName = 'a'.repeat(250);
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });

    it('should remove null bytes', () => {
      expect(sanitizeFilename('file\x00.txt')).toBe('file.txt');
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.PNG')).toBe('png');
      expect(getFileExtension('file.tar.gz')).toBe('gz');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('should handle dotfiles', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
      expect(getFileExtension('.env.local')).toBe('local');
    });
  });

  describe('Constants', () => {
    it('should have correct MAX_FILE_SIZE (50MB)', () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    });

    it('should have correct MAX_TOTAL_UPLOAD_SIZE (200MB)', () => {
      expect(MAX_TOTAL_UPLOAD_SIZE).toBe(200 * 1024 * 1024);
    });

    it('should have correct MAX_FILES_PER_SUBMISSION (10)', () => {
      expect(MAX_FILES_PER_SUBMISSION).toBe(10);
    });

    it('should have allowed MIME types array', () => {
      expect(Array.isArray(ALLOWED_MIME_TYPES)).toBe(true);
      expect(ALLOWED_MIME_TYPES.length).toBeGreaterThan(0);
    });
  });
});
