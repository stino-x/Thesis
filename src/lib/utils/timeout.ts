/**
 * Timeout Protection Utility
 * 
 * Wraps long-running operations with configurable timeouts
 * to prevent hanging on large files or slow operations
 */

export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Default timeout values for different operations
 */
export const DEFAULT_TIMEOUTS = {
  IMAGE_DETECTION: 30000,      // 30 seconds
  VIDEO_FRAME: 10000,          // 10 seconds per frame
  VIDEO_TOTAL: 300000,         // 5 minutes total
  WEBCAM_FRAME: 5000,          // 5 seconds
  MODEL_LOADING: 60000,        // 1 minute
  UNIVFD_API: 15000,           // 15 seconds
} as const;
