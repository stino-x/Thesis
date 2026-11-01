/**
 * Tests for videoUtils.ts - COMPLETE REWRITE
 * Simplified mocking without complex timing issues
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateVideoFile,
  validateImageFile,
  formatFileSize,
  formatDuration,
  getVideoMetadata,
} from '../utils/videoUtils';

// Mock File creation
const createMockFile = (name: string, type: string, size: number): File => {
  const blob = new Blob(['test content'], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
};

describe('videoUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateVideoFile', () => {
    it('should validate supported video types', () => {
      const mp4File = createMockFile('test.mp4', 'video/mp4', 1024 * 1024);
      const webmFile = createMockFile('test.webm', 'video/webm', 1024 * 1024);
      const oggFile = createMockFile('test.ogg', 'video/ogg', 1024 * 1024);
      
      expect(validateVideoFile(mp4File)).toBe(true);
      expect(validateVideoFile(webmFile)).toBe(true);
      expect(validateVideoFile(oggFile)).toBe(true);
    });

    it('should reject unsupported video types', () => {
      const aviFile = createMockFile('test.avi', 'video/avi', 1024 * 1024);
      const textFile = createMockFile('test.txt', 'text/plain', 1024);
      
      expect(validateVideoFile(aviFile)).toBe(false);
      expect(validateVideoFile(textFile)).toBe(false);
    });

    it('should handle files with video/ MIME type', () => {
      const quicktimeFile = createMockFile('test.mov', 'video/quicktime', 1024 * 1024);
      expect(validateVideoFile(quicktimeFile)).toBe(true);
    });
  });

  describe('validateImageFile', () => {
    it('should validate supported image types', () => {
      const jpegFile = createMockFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const jpgFile = createMockFile('test.jpg', 'image/jpg', 1024 * 1024);
      const pngFile = createMockFile('test.png', 'image/png', 1024 * 1024);
      const webpFile = createMockFile('test.webp', 'image/webp', 1024 * 1024);
      
      expect(validateImageFile(jpegFile)).toBe(true);
      expect(validateImageFile(jpgFile)).toBe(true);
      expect(validateImageFile(pngFile)).toBe(true);
      expect(validateImageFile(webpFile)).toBe(true);
    });

    it('should reject unsupported image types', () => {
      const gifFile = createMockFile('test.gif', 'image/gif', 1024 * 1024);
      const bmpFile = createMockFile('test.bmp', 'image/bmp', 1024 * 1024);
      const textFile = createMockFile('test.txt', 'text/plain', 1024);
      
      expect(validateImageFile(gifFile)).toBe(false);
      expect(validateImageFile(bmpFile)).toBe(false);
      expect(validateImageFile(textFile)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatFileSize(1536 * 1024)).toBe('1.50 MB');
    });

    it('should handle decimal places correctly', () => {
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(2560 * 1024)).toBe('2.50 MB');
    });

    it('should handle very small sizes', () => {
      expect(formatFileSize(1)).toBe('1 B');
      expect(formatFileSize(10)).toBe('10 B');
      expect(formatFileSize(100)).toBe('100 B');
    });

    it('should handle very large sizes', () => {
      expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe('5.00 GB');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(30)).toBe('00:30');
      expect(formatDuration(60)).toBe('01:00');
      expect(formatDuration(90)).toBe('01:30');
      expect(formatDuration(3600)).toBe('60:00');
      expect(formatDuration(3661)).toBe('61:01');
    });

    it('should handle edge cases', () => {
      expect(formatDuration(-5)).toBe('00:00');
      expect(formatDuration(NaN)).toBe('00:00');
      expect(formatDuration(Infinity)).toBe('00:00');
    });

    it('should format seconds with leading zeros', () => {
      expect(formatDuration(5)).toBe('00:05');
      expect(formatDuration(125)).toBe('02:05');
    });

    it('should handle hours correctly', () => {
      expect(formatDuration(7200)).toBe('120:00');
      expect(formatDuration(7265)).toBe('121:05');
    });
  });

  describe('getVideoMetadata', () => {
    it('should return correct metadata from video element', () => {
      const mockVideo = {
        duration: 45,
        videoWidth: 1280,
        videoHeight: 720,
      } as HTMLVideoElement;
      
      const metadata = getVideoMetadata(mockVideo);
      
      expect(metadata).toEqual({
        duration: 45,
        width: 1280,
        height: 720,
        frameRate: 30,
        totalFrames: Math.floor(45 * 30),
      });
    });

    it('should handle standard resolutions', () => {
      const hdVideo = {
        duration: 60,
        videoWidth: 1920,
        videoHeight: 1080,
      } as HTMLVideoElement;
      
      const metadata = getVideoMetadata(hdVideo);
      
      expect(metadata.width).toBe(1920);
      expect(metadata.height).toBe(1080);
    });

    it('should calculate total frames correctly', () => {
      const video = {
        duration: 10,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;
      
      const metadata = getVideoMetadata(video);
      
      expect(metadata.totalFrames).toBe(300); // 10 seconds * 30 fps
    });
  });

  describe('File validation edge cases', () => {
    it('should handle files with mixed case extensions', () => {
      const file1 = createMockFile('test.MP4', 'video/mp4', 1024);
      const file2 = createMockFile('test.JPG', 'image/jpeg', 1024);
      
      expect(validateVideoFile(file1)).toBe(true);
      expect(validateImageFile(file2)).toBe(true);
    });

    it('should validate based on MIME type, not extension', () => {
      const videoWithWrongExt = createMockFile('test.txt', 'video/mp4', 1024);
      const imageWithWrongExt = createMockFile('test.txt', 'image/jpeg', 1024);
      
      expect(validateVideoFile(videoWithWrongExt)).toBe(true);
      expect(validateImageFile(imageWithWrongExt)).toBe(true);
    });

    it('should handle empty MIME types', () => {
      const noMimeFile = createMockFile('test.unknown', '', 1024);
      
      expect(validateVideoFile(noMimeFile)).toBe(false);
      expect(validateImageFile(noMimeFile)).toBe(false);
    });
  });

  describe('Format utilities edge cases', () => {
    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    it('should handle zero file size', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should handle negative values gracefully', () => {
      expect(formatDuration(-10)).toBe('00:00');
      expect(formatFileSize(-100)).toBe('0 B');
    });

    it('should handle very long durations', () => {
      const oneHour = 3600;
      const twoHours = 7200;
      
      expect(formatDuration(oneHour)).toBe('60:00');
      expect(formatDuration(twoHours)).toBe('120:00');
    });

    it('should handle fractional seconds', () => {
      expect(formatDuration(30.5)).toBe('00:30');
      expect(formatDuration(90.9)).toBe('01:30');
    });

    it('should handle fractional bytes', () => {
      expect(formatFileSize(1024.5)).toBe('1.00 KB');
      expect(formatFileSize(1536.7)).toBe('1.50 KB');
    });
  });
});
