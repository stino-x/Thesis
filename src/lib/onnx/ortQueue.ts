/**
 * Global inference queue for ONNX Runtime Web
 * 
 * ONNX Runtime Web's JSEP layer only allows one session.run() at a time
 * across ALL sessions globally. This mutex serializes all inference calls.
 */

let tail: Promise<unknown> = Promise.resolve();
let active = 0; // Runtime lock violation detector

/**
 * Run a function exclusively - only one at a time across the entire app
 */
export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = tail.then(async () => {
    if (++active > 1) {
      console.error('❌ LOCK VIOLATION: concurrent run detected!', active);
    }
    try {
      return await fn();
    } finally {
      active--;
    }
  }, async () => {
    // Run even if previous task failed
    if (++active > 1) {
      console.error('❌ LOCK VIOLATION: concurrent run detected!', active);
    }
    try {
      return await fn();
    } finally {
      active--;
    }
  });
  
  // Keep the chain alive after both success and rejection
  tail = result.then(() => {}, () => {});
  return result;
}
