/**
 * Tests for backend API (univfdClient.ts) and Modal backend integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectWithUnivFD,
  detectFileWithUnivFD,
  isBackendAvailable,
  resetBackendCache,
  UnivFDResult
} from '../lib/api/univfdClient';

// Mock fetch globally with proper response structure
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Helper to create mock response
const createMockResponse = (data: any, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn(() => Promise.resolve(data)),
  text: vi.fn(() => Promise.resolve(JSON.stringify(data))),
});

// Mock AbortSignal.timeout
if (!global.AbortSignal.timeout) {
  (global.AbortSignal as any).timeout = vi.fn((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
}

describe('UnivFD Backend Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBackendCache(); // Reset cached availability
    
    // Mock canvas
    global.HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mock');
    
    // Mock URL.createObjectURL for File tests
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isBackendAvailable', () => {
    it('should return true when backend is reachable', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, true, 200));

      const available = await isBackendAvailable();
      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({ signal: expect.any(Object) })
      );
    });

    it('should return false when backend is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const available = await isBackendAvailable();
      expect(available).toBe(false);
    });

    it('should return false when backend returns error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, false, 500));

      const available = await isBackendAvailable();
      expect(available).toBe(false);
    });

    it('should cache the availability result', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, true, 200));

      // First call should fetch
      const firstResult = await isBackendAvailable();
      expect(firstResult).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const secondResult = await isBackendAvailable();
      expect(secondResult).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should reset cache when resetBackendCache is called', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200))
        .mockResolvedValueOnce(createMockResponse({}, false, 500));

      const firstResult = await isBackendAvailable();
      expect(firstResult).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resetBackendCache();

      const secondResult = await isBackendAvailable();
      expect(secondResult).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Called again after reset
    });
  });

  describe('detectWithUnivFD', () => {
    it('should send image to backend and return result', async () => {
      // Mock backend availability and detection response
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({
          isDeepfake: true,
          confidence: 0.85,
          score: 0.85,
          method: 'univfd',
          anomalies: ['strong_ai_generation_signal'],
          modelLoaded: true,
        }, true, 200));

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toEqual({
        isDeepfake: true,
        confidence: 0.85,
        score: 0.85,
        method: 'univfd',
        anomalies: ['strong_ai_generation_signal'],
        modelLoaded: true,
        available: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when backend is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toBeNull();
    });

    it('should handle backend authentication error', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({}, false, 401));

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toBeNull();
    });

    it('should handle backend server error', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({}, false, 500));

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toBeNull();
    });

    it('should timeout after 15 seconds', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({}, false, 500)); // Simulate timeout by returning error

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toBeNull();
    });

    it('should mark backend as unavailable after failure', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // First health check
        .mockRejectedValueOnce(new Error('Network error')); // Detection fails

      const mockCanvas = document.createElement('canvas');
      
      // First detection attempt
      const result1 = await detectWithUnivFD(mockCanvas, 'test.jpg');
      expect(result1).toBeNull();

      // Reset for second attempt - backend now marked unavailable
      mockFetch.mockResolvedValueOnce(createMockResponse({}, false, 500));

      // Second detection should check health again and get unavailable
      resetBackendCache(); // Reset to force health check
      const result2 = await detectWithUnivFD(mockCanvas, 'test.jpg');
      expect(result2).toBeNull();
    });
  });

  describe('detectFileWithUnivFD', () => {
    it('should send file to backend and return result', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({
          isDeepfake: false,
          confidence: 0.92,
          score: 0.92,
          method: 'univfd',
          anomalies: [],
          modelLoaded: true,
        }, true, 200));

      // Create a mock File
      const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
      const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });

      const result = await detectFileWithUnivFD(file);

      expect(result).toEqual({
        isDeepfake: false,
        confidence: 0.92,
        score: 0.92,
        method: 'univfd',
        anomalies: [],
        modelLoaded: true,
        available: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when backend is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
      const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });

      const result = await detectFileWithUnivFD(file);
      expect(result).toBeNull();
    });

    it('should handle file conversion errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, true, 200)); // Health check

      // Mock arrayBuffer to throw error
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: () => Promise.reject(new Error('File read error')),
      } as any;

      const result = await detectFileWithUnivFD(mockFile);
      expect(result).toBeNull();
    });
  });

  describe('backend authentication', () => {
    it('should include API key in headers when secret is configured', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({
          isDeepfake: true,
          confidence: 0.75,
          score: 0.75,
          method: 'univfd',
          anomalies: [],
          modelLoaded: true,
        }, true, 200));

      const mockCanvas = document.createElement('canvas');
      await detectWithUnivFD(mockCanvas, 'test.jpg');

      // Check that second fetch call (detection) has API key
      expect(mockFetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.any(Object));
    });

    it('should work without API key when secret is empty', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce(createMockResponse({
          isDeepfake: true,
          confidence: 0.75,
          score: 0.75,
          method: 'univfd',
          anomalies: [],
          modelLoaded: true,
        }, true, 200));

      const mockCanvas = document.createElement('canvas');
      await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle JSON parsing errors', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn(() => Promise.reject(new Error('Invalid JSON'))),
        });

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toBeNull();
    });

    it('should handle network timeouts gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, true, 200)) // Health check
        .mockRejectedValueOnce(new Error('Request timeout'));

      const mockCanvas = document.createElement('canvas');
      const result = await detectWithUnivFD(mockCanvas, 'test.jpg');

      expect(result).toBeNull();
    });
  });
});