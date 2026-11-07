/**
 * Global inference queue for ONNX Runtime Web
 * 
 * ONNX Runtime Web's JSEP layer only allows one session.run() at a time
 * across ALL sessions globally. This mutex serializes all inference calls.
 * 
 * Now with AbortSignal support to cancel queued work from timed-out frames.
 */

let tail: Promise<unknown> = Promise.resolve();
let depth = 0; // Number of jobs queued (including running)

/**
 * Get current queue depth (includes the running job)
 */
export const lockDepth = () => depth;

export interface RunExclusiveOptions {
  label?: string;
  signal?: AbortSignal;
}

/**
 * Run a function exclusively - only one at a time across the entire app.
 * Jobs can be cancelled via AbortSignal before they start executing.
 */
export function runExclusive<T>(
  fn: () => Promise<T>,
  opts: RunExclusiveOptions = {}
): Promise<T> {
  const { label = 'unlabeled', signal } = opts;
  const queuedAt = performance.now();
  
  depth++;
  
  const result = tail.then(async () => {
    try {
      // Abort check: reject before execution if signal is aborted
      if (signal?.aborted) {
        throw new DOMException('Aborted before execution started', 'AbortError');
      }
      
      const waited = performance.now() - queuedAt;
      if (waited > 5000) {
        console.warn(`[ORT] ${label} waited ${Math.round(waited)}ms, depth=${depth}`);
      }
      
      const execStart = performance.now();
      const res = await fn();
      const execTime = performance.now() - execStart;
      
      if (execTime > 10000) {
        console.log(`[ORT] ${label}: waited ${Math.round(waited)}ms, executed ${Math.round(execTime)}ms`);
      }
      
      return res;
    } finally {
      depth--;
    }
  });
  
  // Keep the chain alive after both success and rejection
  tail = result.then(() => {}, () => {});
  return result;
}
