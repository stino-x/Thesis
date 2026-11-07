/**
 * ONNX Model Detector
 * 
 * Models are loaded from Hugging Face to avoid Git LFS deployment issues.
 * Cached in IndexedDB after first download for fast subsequent loads.
 * 
 * Hugging Face Repository: https://huggingface.co/stino214/deepfake-onnx-models
 *
 * Caching strategy: models are stored in IndexedDB after first download
 * so subsequent page loads skip the ~1.1 GB network fetch entirely.
 */

import * as ort from 'onnxruntime-web';
import { cropFaceFromCanvas, type FaceBoundingBox, type EyePoints } from './faceLocalizer';
import { updateModelStatus } from '@/components/ModelLoadingStatus';
import { runExclusive } from './ortQueue';

// Load models from Hugging Face (deployed via Git LFS on HF)
const HF_BASE = 'https://huggingface.co/stino214/deepfake-onnx-models/resolve/main';

const MODEL_URLS = {
  vitDeepfakeExp:   `${HF_BASE}/vit_deepfake_exp.onnx`,
  vitDeepfakeV2:    `${HF_BASE}/vit_deepfake_v2.onnx`,
  deepfakeDetector: `${HF_BASE}/deepfake_detector.onnx`,
  aiDetector:       `${HF_BASE}/ai_detector_int8.onnx`,
  efficientnetB4:   `${HF_BASE}/efficientnet_b4_embedded.onnx`,
  xceptionNet:      `${HF_BASE}/xception_net_embedded.onnx`,
  resnet50:         `${HF_BASE}/resnet50_embedded.onnx`,
} as const;

// Required for ONNX Runtime multi-threaded WASM
// (COOP/COEP headers must also be set in vercel.json + vite.config.ts)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';

// Enable multi-threading only if cross-origin isolated
// Multi-threading requires COOP/COEP headers to be properly set
ort.env.wasm.numThreads = self.crossOriginIsolated 
  ? Math.min(navigator.hardwareConcurrency ?? 4, 8) 
  : 1;

// Move inference off main thread (only works with cross-origin isolation)
ort.env.wasm.proxy = self.crossOriginIsolated;

console.log(
  `🔧 ONNX Runtime: ${ort.env.wasm.numThreads} threads, ` +
  `proxy: ${ort.env.wasm.proxy}, cross-origin isolated: ${self.crossOriginIsolated}`
);

type ModelKey = keyof typeof MODEL_URLS;

export interface OnnxModelResult {
  score: number;
  available: boolean;
}

export interface OnnxDetectionResult {
  vitDeepfakeExp?:   OnnxModelResult;
  vitDeepfakeV2?:    OnnxModelResult;
  deepfakeDetector?: OnnxModelResult;
  aiDetector?:       OnnxModelResult;
  efficientnetB4?:   OnnxModelResult;
  xceptionNet?:      OnnxModelResult;
  resnet50?:         OnnxModelResult;
  anomalies: string[];
}

// ─── IndexedDB cache ──────────────────────────────────────────────────────────

const IDB_NAME  = 'onnx-model-cache';
const IDB_STORE = 'models';
const CACHE_VERSION = 'v4-embedded'; // v4: Using single-file embedded ONNX models (all 7 models working)

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const versionedKey = `${CACHE_VERSION}:${key}`;
      const req = tx.objectStore(IDB_STORE).get(versionedKey);
      req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
      req.onerror   = () => {
        console.warn(`⚠️  IndexedDB read failed for ${key}:`, req.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.warn(`⚠️  IndexedDB access failed for ${key}:`, error);
    return null;
  }
}

async function idbSet(key: string, value: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const versionedKey = `${CACHE_VERSION}:${key}`;
      tx.objectStore(IDB_STORE).put(value, versionedKey);
      tx.oncomplete = () => {
        console.log(`✅ Cached ONNX model: ${key}`);
        resolve();
      };
      tx.onerror = () => {
        console.warn(`⚠️  IndexedDB write failed for ${key}:`, tx.error);
        reject(tx.error);
      };
    });
  } catch (error) {
    console.warn(`⚠️  Failed to cache ONNX model ${key}:`, error);
    // Non-fatal - model will work but won't be cached
  }
}

// ─── Session management ───────────────────────────────────────────────────────

const sessions:   Partial<Record<ModelKey, ort.InferenceSession>> = {};
const loadErrors: Partial<Record<ModelKey, boolean>>              = {
  // Untrained models with random heads - disable to prevent noise
  efficientnetB4: true,  // ImageNet backbone + untrained head
  xceptionNet: true,      // Custom tiny network, random weights (3.8 MB)
  resnet50: true,         // ImageNet backbone + untrained head
};
const runErrors:  Partial<Record<ModelKey, boolean>>              = {}; // Skip models that fail at runtime
const pending:    Partial<Record<ModelKey, Promise<ort.InferenceSession | null>>> = {};

/**
 * Returns a cached ONNX session, downloading from Hugging Face
 * and caching in IndexedDB on first use for instant subsequent loads.
 * Deduplicates concurrent calls to avoid double-downloading.
 */
async function getSession(key: ModelKey): Promise<ort.InferenceSession | null> {
  if (loadErrors[key]) return null;
  if (sessions[key])   return sessions[key]!;
  
  // Dedupe in-flight loads
  if (pending[key]) return pending[key]!;
  
  pending[key] = loadSession(key).finally(() => {
    delete pending[key];
  });
  
  return pending[key]!;
}

/**
 * Load a session from HuggingFace or IndexedDB cache
 */
async function loadSession(key: ModelKey): Promise<ort.InferenceSession | null> {
  if (loadErrors[key]) return null;
  if (sessions[key])   return sessions[key]!;

  try {
    // All models use IndexedDB caching
    let buffer = await idbGet(key);

    if (!buffer) {
      console.log(`⬇️  Downloading ONNX model from HuggingFace: ${key} (first time only)`);
      updateModelStatus(key, 'downloading', 0);
      
      // Retry logic for large files (vitDeepfakeV2 had network issues)
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(MODEL_URLS[key]);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          // Get total size for progress tracking
          const contentLength = res.headers.get('content-length');
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          
          if (total && res.body) {
            // Track download progress with streaming
            const reader = res.body.getReader();
            const chunks: Uint8Array[] = [];
            let downloaded = 0;
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              chunks.push(value);
              downloaded += value.length;
              
              // Update progress percentage (UI only)
              const progress = Math.round((downloaded / total) * 100);
              updateModelStatus(key, 'downloading', progress);
            }
            
            // Combine chunks into single ArrayBuffer
            const allChunks = new Uint8Array(downloaded);
            let position = 0;
            for (const chunk of chunks) {
              allChunks.set(chunk, position);
              position += chunk.length;
            }
            buffer = allChunks.buffer;
          } else {
            // Fallback for servers without content-length
            buffer = await res.arrayBuffer();
            updateModelStatus(key, 'downloading', 100);
          }
          
          break; // Success!
        } catch (e) {
          lastError = e as Error;
          if (attempt < maxRetries) {
            console.log(`   Retry ${attempt}/${maxRetries} for ${key}...`);
            updateModelStatus(key, 'downloading', 0);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          }
        }
      }
      
      if (!buffer) {
        throw lastError || new Error('Failed to download after retries');
      }
      
      console.log(`💾 Caching ${key} to IndexedDB...`);
      idbSet(key, buffer);
    } else {
      console.log(`✅ Cached ONNX model: ${key}`);
      updateModelStatus(key, 'cached');
    }

    sessions[key] = await runExclusive(async () => {
      // Try WebGPU first if available, fall back to WASM
      const executionProviders = (navigator as { gpu?: unknown }).gpu 
        ? (['webgpu', 'wasm'] as const)
        : (['wasm'] as const);
        
      const session = await ort.InferenceSession.create(buffer, {
        executionProviders: executionProviders as unknown as ort.InferenceSession.ExecutionProviderConfig[],
      });
      
      // Log which provider was actually used
      const provider = (session as { handler?: { _backend?: { _backendName?: string } } }).handler?._backend?._backendName || 'unknown';
      if (provider !== 'unknown') {
        console.log(`   Provider: ${provider}`);
      }
      
      return session;
    }, { label: `create-${key}` });
    
    // Warmup: run dummy inference to trigger kernel compilation and allocation
    // Avoids first-frame JIT cost (can add seconds to first frame)
    try {
      const { size } = MODEL_INPUT[key];
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = dummyCanvas.height = size;
      const dummyCtx = dummyCanvas.getContext('2d')!;
      dummyCtx.fillRect(0, 0, size, size); // Black square
      
      await runExclusive(async () => {
        const tensor = canvasToTensor(dummyCanvas, size, MODEL_INPUT[key].norm);
        const inputName = sessions[key]!.inputNames[0];
        const output = await sessions[key]!.run({ [inputName]: tensor });
        Object.values(output).forEach(t => (t as ort.Tensor).dispose?.());
      }, { label: `warmup-${key}` });
      
      console.log(`🔥 Warmed up ${key}`);
    } catch (e) {
      console.warn(`⚠️  Warmup failed for ${key} (non-fatal):`, e);
    }
    
    console.log(`✅ ONNX ready: ${key}`);
    updateModelStatus(key, 'ready');
    return sessions[key]!;
  } catch (e) {
    console.warn(`⚠️  ONNX failed to load ${key}:`, e);
    updateModelStatus(key, 'error');
    loadErrors[key] = true;
    return null;
  }
}

/** Pre-warm all ONNX sessions in the background */
export async function initOnnxDetector(): Promise<void> {
  await Promise.allSettled(
    (Object.keys(MODEL_URLS) as ModelKey[]).map(k => getSession(k))
  );
}

// ─── Model Configuration ──────────────────────────────────────────────────────

const MODEL_INPUT = {
  vitDeepfakeExp:   { size: 224, norm: 'imagenet' as const },
  vitDeepfakeV2:    { size: 224, norm: 'imagenet' as const },
  deepfakeDetector: { size: 224, norm: 'imagenet' as const },
  aiDetector:       { size: 256, norm: 'imagenet' as const },  // SwinV2 needs 256 (window16)
  efficientnetB4:   { size: 380, norm: 'imagenet' as const },
  xceptionNet:      { size: 299, norm: 'range1' as const },
  resnet50:         { size: 224, norm: 'imagenet' as const },
} as const satisfies Record<ModelKey, { size: number; norm: 'imagenet' | 'range1' }>;

// ─── Preprocessing ────────────────────────────────────────────────────────────

/**
 * Preprocess canvas → Float32 tensor [1, 3, H, W] with normalization.
 */
function canvasToTensor(canvas: HTMLCanvasElement, size: number, normalize: 'imagenet' | 'range1' = 'imagenet'): ort.Tensor {
  const tmp    = document.createElement('canvas');
  tmp.width    = tmp.height = size;
  const tmpCtx = tmp.getContext('2d')!;

  // Center-crop to square
  const srcSize = Math.min(canvas.width, canvas.height);
  const srcX    = (canvas.width  - srcSize) / 2;
  const srcY    = (canvas.height - srcSize) / 2;
  tmpCtx.drawImage(canvas, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

  const { data } = tmpCtx.getImageData(0, 0, size, size);
  const float32  = new Float32Array(3 * size * size);

  if (normalize === 'range1') {
    for (let i = 0; i < size * size; i++) {
      float32[i]                   = (data[i * 4]     / 255) * 2 - 1; // R
      float32[size * size + i]     = (data[i * 4 + 1] / 255) * 2 - 1; // G
      float32[size * size * 2 + i] = (data[i * 4 + 2] / 255) * 2 - 1; // B
    }
  } else {
    // ImageNet mean/std normalization
    const mean = [0.485, 0.456, 0.406];
    const std  = [0.229, 0.224, 0.225];

    for (let i = 0; i < size * size; i++) {
      float32[i]                   = (data[i * 4]     / 255 - mean[0]) / std[0]; // R
      float32[size * size + i]     = (data[i * 4 + 1] / 255 - mean[1]) / std[1]; // G
      float32[size * size * 2 + i] = (data[i * 4 + 2] / 255 - mean[2]) / std[2]; // B
    }
  }

  return new ort.Tensor('float32', float32, [1, 3, size, size]);
}

// ─── Inference ────────────────────────────────────────────────────────────────

async function runModel(
  key: ModelKey,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal
): Promise<OnnxModelResult> {
  // Check abort signal before expensive work
  if (signal?.aborted) {
    return { score: 0, available: false };
  }
  
  // Skip models that have failed at runtime
  if (runErrors[key]) {
    return { score: 0, available: false };
  }

  const session = await getSession(key);
  if (!session) return { score: 0, available: false };

  try {
    // Use model-specific input configuration
    const { size, norm } = MODEL_INPUT[key];
    
    // Use global mutex to serialize ALL session.run() calls across all models
    // ONNX Runtime JSEP layer only allows one inference at a time globally
    const outputData = await runExclusive(async () => {
      // Check abort again inside the lock
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
      
      const tensor = canvasToTensor(canvas, size, norm);
      const inputName = session.inputNames[0];
      const output = await session.run({ [inputName]: tensor });
      
      // Copy output data synchronously inside the lock
      // WebGPU tensors can be GPU-backed and must be read before next inference
      const data = Float32Array.from(output[session.outputNames[0]].data as Float32Array);
      
      // Dispose tensors
      Object.values(output).forEach(t => (t as ort.Tensor).dispose?.());
      
      return data;
    }, { label: key, signal });

    // Handle both 2-logit (softmax) and single sigmoid outputs
    let score: number;
    if (outputData.length === 2) {
      const expReal = Math.exp(outputData[0]);
      const expFake = Math.exp(outputData[1]);
      score = expFake / (expReal + expFake);
    } else {
      score = Math.max(0, Math.min(1, outputData[0]));
    }

    return { score, available: true };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    
    // Don't log or mark as failed if it was deliberately aborted
    if (errorMsg === 'Aborted' || signal?.aborted) {
      return { score: 0, available: false };
    }
    
    console.warn(`ONNX inference error (${key}):`, e);
    
    // Mark as failed so we skip it on subsequent frames
    runErrors[key] = true;
    console.warn(`⚠️  Disabling ${key} for remaining frames due to repeated failures`);
    
    return { score: 0, available: false };
  }
}

/** Run all ONNX models on a canvas and return per-model scores */
export async function detectWithOnnx(
  canvas: HTMLCanvasElement,
  faceBbox: FaceBoundingBox | null = null,
  eyePoints?: EyePoints,
  signal?: AbortSignal
): Promise<OnnxDetectionResult> {
  const anomalies: string[] = [];

  // Crop + align face before running ViT models
  const faceCanvas = cropFaceFromCanvas(canvas, faceBbox, 0.20, eyePoints);

  // Run models SEQUENTIALLY (not Promise.all) - combined with global mutex for ONNX JSEP restriction
  const vitDeepfakeExp = await runModel('vitDeepfakeExp', faceCanvas, signal);
  const vitDeepfakeV2 = await runModel('vitDeepfakeV2', faceCanvas, signal);
  const deepfakeDetector = await runModel('deepfakeDetector', faceCanvas, signal);
  const aiDetector = await runModel('aiDetector', canvas, signal);
  const efficientnetB4 = await runModel('efficientnetB4', faceCanvas, signal);
  const xceptionNet = await runModel('xceptionNet', faceCanvas, signal);
  const resnet50 = await runModel('resnet50', faceCanvas, signal);

  if (vitDeepfakeExp.available   && vitDeepfakeExp.score   > 0.7) anomalies.push('vit_deepfake_signal');
  if (vitDeepfakeV2.available    && vitDeepfakeV2.score    > 0.7) anomalies.push('vit_deepfake_v2_signal');
  if (deepfakeDetector.available && deepfakeDetector.score > 0.7) anomalies.push('deepfake_signal');
  if (aiDetector.available       && aiDetector.score       > 0.7) anomalies.push('ai_generation_signal');
  if (efficientnetB4.available   && efficientnetB4.score   > 0.7) anomalies.push('efficientnet_signal');
  if (xceptionNet.available      && xceptionNet.score      > 0.7) anomalies.push('xception_signal');
  if (resnet50.available         && resnet50.score         > 0.7) anomalies.push('resnet_signal');

  return { vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, xceptionNet, efficientnetB4, resnet50, anomalies };
}
