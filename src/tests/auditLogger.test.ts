/**
 * Comprehensive tests for auditLogger service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { auditLogger, AuditLoggerService } from '../lib/auditLogger';

// Mock global objects
global.navigator = {
  userAgent: 'Mozilla/5.0 Test Browser',
} as any;

global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();
global.Blob = vi.fn();
// Mock document methods
const mockElement = {
  setAttribute: vi.fn(),
  click: vi.fn(),
  style: {},
  href: '',
  download: '',
  remove: vi.fn(),
};

global.document.createElement = vi.fn(() => mockElement);
// Mock appendChild and removeChild on document.body
Object.defineProperty(global.document, 'body', {
  value: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  writable: true,
});

// Create a mock query chain
const createMockQueryChain = () => {
  const chain = {
    select: vi.fn((columns = '*') => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => ({ data: [], error: null })),
    single: vi.fn(() => ({ data: null, error: null })),
  };
  return chain;
};

// Mock module
vi.mock('../lib/supabase', () => {
  // Mock that tracks calls and returns appropriate chain
  const mockFrom = vi.fn((tableName: string) => {
    // Create a fresh chain for each call
    const chain = createMockQueryChain();
    
    return {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      select: vi.fn((columns = '*') => chain), // select('*') should return chain
      delete: vi.fn(() => ({
        lt: vi.fn(() => ({ error: null })),
      })),
    };
  });
  
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Import the mocked module to access mock functions
import { supabase } from '../lib/supabase';

describe('AuditLoggerService', () => {
  let logger: AuditLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new AuditLoggerService();
    
    // Reset the mock
    supabase.from.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should generate a unique session ID', () => {
      expect(logger['sessionId']).toMatch(/^session_\d+_[a-z0-9]{9}$/);
    });

    it('should generate different session IDs for different instances', () => {
      const logger2 = new AuditLoggerService();
      expect(logger['sessionId']).not.toBe(logger2['sessionId']);
    });
  });

  describe('logDetection', () => {
    it('should log detection successfully', async () => {
      const mockInsertResult = {
        id: 'test-uuid-123',
        user_id: 'user-123',
        detection_type: 'image',
        media_type: 'image/jpeg',
        file_name: 'test.jpg',
        file_size: 1024 * 1024,
        detection_result: 'real',
        confidence_score: 0.85,
        processing_time_ms: 1234,
        metadata: { face_detected: true },
        session_id: logger['sessionId'],
        user_agent: 'Mozilla/5.0 Test Browser',
        ip_address: undefined,
        created_at: expect.any(String),
      };

      supabase.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockInsertResult,
              error: null,
            })),
          })),
        })),
      } as any);

      const result = await logger.logDetection({
        user_id: 'user-123',
        detection_type: 'image',
        media_type: 'image/jpeg',
        file_name: 'test.jpg',
        file_size: 1024 * 1024,
        detection_result: 'real',
        confidence_score: 0.85,
        processing_time_ms: 1234,
        metadata: { face_detected: true },
      });

      expect(result).toEqual(mockInsertResult);
      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    });

    it('should return null on database error', async () => {
      supabase.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: 'Database error' },
            })),
          })),
        })),
      } as any);

      const result = await logger.logDetection({
        user_id: 'user-123',
        detection_type: 'image',
        media_type: 'image/jpeg',
        file_name: 'test.jpg',
        file_size: 1024 * 1024,
        detection_result: 'real',
        confidence_score: 0.85,
        processing_time_ms: 1234,
        metadata: {},
      });

      expect(result).toBeNull();
    });

    it('should handle exceptions gracefully', async () => {
      supabase.from.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const result = await logger.logDetection({
        user_id: 'user-123',
        detection_type: 'image',
        media_type: 'image/jpeg',
        file_name: 'test.jpg',
        file_size: 1024 * 1024,
        detection_result: 'real',
        confidence_score: 0.85,
        processing_time_ms: 1234,
        metadata: {},
      });

      expect(result).toBeNull();
    });

    it('should include session ID and user agent', async () => {
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test' },
            error: null,
          })),
        })),
      }));

      supabase.from.mockReturnValueOnce({
        insert: mockInsert,
      } as any);

      await logger.logDetection({
        user_id: 'user-123',
        detection_type: 'image',
        media_type: 'image/jpeg',
        file_name: 'test.jpg',
        file_size: 1024 * 1024,
        detection_result: 'real',
        confidence_score: 0.85,
        processing_time_ms: 1234,
        metadata: {},
      });

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          session_id: logger['sessionId'],
          user_agent: 'Mozilla/5.0 Test Browser',
        }),
      ]);
    });
  });

  describe('getLogs', () => {
    it('should fetch logs with default limit', async () => {
      const mockLogs = [
        { id: '1', detection_type: 'image', created_at: '2024-01-01T00:00:00Z' },
        { id: '2', detection_type: 'video', created_at: '2024-01-02T00:00:00Z' },
      ];

      // Create a mock query chain that returns our mock data
      let capturedChain: any;
      supabase.from.mockImplementationOnce((tableName: string) => {
        const chain = createMockQueryChain();
        chain.limit = vi.fn(() => ({ data: mockLogs, error: null }));
        capturedChain = chain;
        
        return {
          insert: vi.fn(),
          select: vi.fn((columns = '*') => chain),
          delete: vi.fn(),
        };
      });

      const logs = await logger.getLogs();
      expect(logs).toEqual(mockLogs);
      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    });

    it('should apply filters correctly', async () => {
      const filters = {
        user_id: 'user-123',
        detection_type: 'image' as const,
        detection_result: 'real' as const,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        min_confidence: 0.5,
        max_confidence: 1.0,
      };

      // Create a complete mock chain with all methods returning the chain
      const mockData = [{ id: '1', user_id: 'user-123', detection_type: 'image' }];
      
      const chain: any = {
        eq: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        select: vi.fn(),
      };
      
      // Make each method return the chain (for chaining)
      chain.eq.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);
      chain.order.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      
      // Make the chain awaitable (Promise-like) - return mockData when awaited
      chain.then = vi.fn((resolve) => resolve({ data: mockData, error: null }));
      
      supabase.from.mockImplementationOnce((tableName: string) => chain);

      const logs = await logger.getLogs(filters);
      
      expect(logs).toEqual(mockData);
      expect(chain.eq).toHaveBeenCalled();
      expect(chain.gte).toHaveBeenCalled();
      expect(chain.lte).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: null,
                error: { message: 'Query failed' },
              })),
            })),
          })),
        })),
      } as any);

      const logs = await logger.getLogs();
      expect(logs).toEqual([]);
    });

    it('should handle exceptions', async () => {
      supabase.from.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const logs = await logger.getLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should calculate statistics correctly', async () => {
      const mockLogs = [
        {
          detection_type: 'image',
          detection_result: 'real',
          confidence_score: 0.9,
          processing_time_ms: 1000,
        },
        {
          detection_type: 'video',
          detection_result: 'deepfake',
          confidence_score: 0.7,
          processing_time_ms: 2000,
        },
        {
          detection_type: 'image',
          detection_result: 'uncertain',
          confidence_score: 0.5,
          processing_time_ms: 1500,
        },
        {
          detection_type: 'webcam',
          detection_result: 'real',
          confidence_score: 0.8,
          processing_time_ms: 500,
        },
      ];

      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: mockLogs,
                error: null,
              })),
            })),
          })),
        })),
      } as any);

      const stats = await logger.getStats('user-123', '2024-01-01', '2024-01-31');

      expect(stats).toEqual({
        total_detections: 4,
        deepfake_count: 1,
        real_count: 2,
        uncertain_count: 1,
        avg_confidence: (0.9 + 0.7 + 0.5 + 0.8) / 4,
        avg_processing_time: (1000 + 2000 + 1500 + 500) / 4,
        detection_by_type: {
          image: 2,
          video: 1,
          webcam: 1,
        },
      });
    });

    it('should handle empty logs', async () => {
      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          data: [],
          error: null,
        })),
      } as any);

      const stats = await logger.getStats();
      
      expect(stats).toEqual({
        total_detections: 0,
        deepfake_count: 0,
        real_count: 0,
        uncertain_count: 0,
        avg_confidence: 0,
        avg_processing_time: 0,
        detection_by_type: {
          image: 0,
          video: 0,
          webcam: 0,
        },
      });
    });

    it('should return null on error', async () => {
      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          data: null,
          error: { message: 'Query failed' },
        })),
      } as any);

      const stats = await logger.getStats();
      expect(stats).toBeNull();
    });
  });

  describe('deleteOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      supabase.from.mockReturnValueOnce({
        delete: vi.fn(() => ({
          lt: vi.fn(() => ({
            error: null,
          })),
        })),
      } as any);

      const result = await logger.deleteOldLogs(30);
      expect(result).toBe(true);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const expectedDate = cutoffDate.toISOString();
      
      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    });

    it('should return false on error', async () => {
      supabase.from.mockReturnValueOnce({
        delete: vi.fn(() => ({
          lt: vi.fn(() => ({
            error: { message: 'Delete failed' },
          })),
        })),
      } as any);

      const result = await logger.deleteOldLogs(30);
      expect(result).toBe(false);
    });
  });

  describe('exportToCSV', () => {
    it('should export logs to CSV format', async () => {
      const mockLogs = [
        {
          id: '1',
          user_id: 'user-123',
          detection_type: 'image',
          media_type: 'image/jpeg',
          file_name: 'test.jpg',
          file_size: 1024 * 1024,
          detection_result: 'real',
          confidence_score: 0.85,
          processing_time_ms: 1234,
          ip_address: '192.168.1.1',
          session_id: 'session-123',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      // Mock getLogs to return test data
      vi.spyOn(logger, 'getLogs').mockResolvedValue(mockLogs as any);

      const csv = await logger.exportToCSV();
      
      expect(csv).toContain('ID,User ID,Detection Type,Media Type,File Name');
      expect(csv).toContain('"1","user-123","image","image/jpeg","test.jpg"');
      expect(csv).toContain('"real","0.85","1234","192.168.1.1","session-123","2024-01-01T00:00:00Z"');
    });

    it('should handle empty logs', async () => {
      vi.spyOn(logger, 'getLogs').mockResolvedValue([]);

      const csv = await logger.exportToCSV();
      expect(csv).toContain('ID,User ID,Detection Type,Media Type,File Name');
      // With empty logs, we only have the header line
      expect(csv.split('\n').length).toBe(1);
    });

    it('should return empty string on error', async () => {
      vi.spyOn(logger, 'getLogs').mockRejectedValue(new Error('Failed'));

      const csv = await logger.exportToCSV();
      expect(csv).toBe('');
    });
  });

  describe('downloadLogsAsCSV', () => {
    it('should create and trigger download', async () => {
      const mockLogs = [{ id: '1' }];
      vi.spyOn(logger, 'exportToCSV').mockResolvedValue('CSV content');
      
      await logger.downloadLogsAsCSV();

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(global.Blob).toHaveBeenCalledWith(
        ['CSV content'],
        { type: 'text/csv;charset=utf-8;' }
      );
    });

    it('should handle empty CSV content', async () => {
      vi.spyOn(logger, 'exportToCSV').mockResolvedValue('');

      await logger.downloadLogsAsCSV();
      // Should not throw, just return early
    });
  });

  describe('downloadLogsAsJSON', () => {
    it('should create and trigger JSON download', async () => {
      const mockLogs = [{ id: '1', name: 'test' }];
      vi.spyOn(logger, 'getLogs').mockResolvedValue(mockLogs as any);
      
      await logger.downloadLogsAsJSON();

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(global.Blob).toHaveBeenCalledWith(
        [JSON.stringify(mockLogs, null, 2)],
        { type: 'application/json;charset=utf-8;' }
      );
    });
  });

  describe('getLogById', () => {
    it('should fetch single log by ID', async () => {
      const mockLog = { id: 'test-id', detection_type: 'image' };

      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockLog,
              error: null,
            })),
          })),
        })),
      } as any);

      const log = await logger.getLogById('test-id');
      expect(log).toEqual(mockLog);
      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    });

    it('should return null on error', async () => {
      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: 'Not found' },
            })),
          })),
        })),
      } as any);

      const log = await logger.getLogById('test-id');
      expect(log).toBeNull();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      // auditLogger is the singleton instance exported from the module
      // logger is a new instance created in beforeEach
      // They should be different instances but both of the same class
      expect(auditLogger).toBeInstanceOf(AuditLoggerService);
      expect(logger).toBeInstanceOf(AuditLoggerService);
      // They should be different instances
      expect(auditLogger).not.toBe(logger);
    });
  });
});
