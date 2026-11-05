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
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

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
const loadErrors: Partial<Record<ModelKey, boolean>>              = {};

// Proper mutex implementation with queue to prevent concurrent session usage
interface QueuedInference {
  resolve: (result: OnnxModelResult) => void;
  reject: (error: any) => void;
  canvas: HTMLCanvasElement;
  size: number;
  normalize: 'imagenet' | 'range1';
}

const inferenceQueues: Partial<Record<ModelKey, QueuedInference[]>> = {};
const isProcessing: Partial<Record<ModelKey, boolean>> = {};

/**
 * Returns a cached ONNX session, downloading from Hugging Face
 * and caching in IndexedDB on first use for instant subsequent loads.
 */
async function getSession(key: ModelKey): Promise<ort.InferenceSession | null> {
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
              
              // Update progress percentage
              const progress = Math.round((downloaded / total) * 100);
              updateModelStatus(key, 'downloading', progress);
              console.log(`   ${key}: ${progress}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
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

    sessions[key] = await ort.InferenceSession.create(buffer, {
      executionProviders: ['wasm'],
    });
    
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

async function processInferenceQueue(key: ModelKey) {
  if (isProcessing[key] || !inferenceQueues[key]?.length) return;
  
  isProcessing[key] = true;
  
  while (inferenceQueues[key]?.length) {
    const job = inferenceQueues[key]!.shift()!;
    
    try {
      const session = await getSession(key);
      if (!session) {
        job.resolve({ score: 0, available: false });
        continue;
      }

      const tensor = canvasToTensor(job.canvas, job.size, job.normalize);
      const inputName = session.inputNames[0];
      const output = await session.run({ [inputName]: tensor });
      const outputData = output[session.outputNames[0]].data as Float32Array;

      // Handle both 2-logit (softmax) and single sigmoid outputs
      let score: number;
      if (outputData.length === 2) {
        const expReal = Math.exp(outputData[0]);
        const expFake = Math.exp(outputData[1]);
        score = expFake / (expReal + expFake);
      } else {
        score = Math.max(0, Math.min(1, outputData[0]));
      }

      job.resolve({ score, available: true });
    } catch (e) {
      console.warn(`ONNX inference error (${key}):`, e);
      job.reject(e);
    }
  }
  
  isProcessing[key] = false;
}

async function runModel(
  key: ModelKey,
  canvas: HTMLCanvasElement,
  size: number,
  normalize: 'imagenet' | 'range1' = 'imagenet'
): Promise<OnnxModelResult> {
  return new Promise((resolve, reject) => {
    // Add to queue
    if (!inferenceQueues[key]) {
      inferenceQueues[key] = [];
    }
    
    inferenceQueues[key]!.push({
      resolve,
      reject: (e) => {
        // On error, return unavailable instead of rejecting
        console.warn(`ONNX inference error (${key}):`, e);
        resolve({ score: 0, available: false });
      },
      canvas,
      size,
      normalize,
    });
    
    // Start processing queue
    processInferenceQueue(key);
  });
}

/** Run all ONNX models on a canvas and return per-model scores */
export async function detectWithOnnx(
  canvas: HTMLCanvasElement,
  faceBbox: FaceBoundingBox | null = null,
  eyePoints?: EyePoints
): Promise<OnnxDetectionResult> {
  const anomalies: string[] = [];

  // Crop + align face before running ViT models
  const faceCanvas = cropFaceFromCanvas(canvas, faceBbox, 0.20, eyePoints);

  // Run all 7 ONNX models (now including embedded versions of efficientnetB4, xceptionNet, resnet50)
  const [vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, efficientnetB4, xceptionNet, resnet50] = await Promise.all([
    runModel('vitDeepfakeExp',   faceCanvas, 224),
    runModel('vitDeepfakeV2',    faceCanvas, 224),
    runModel('deepfakeDetector', faceCanvas, 224),
    runModel('aiDetector',       canvas,     224),
    runModel('efficientnetB4',   faceCanvas, 224),
    runModel('xceptionNet',      faceCanvas, 224),
    runModel('resnet50',         faceCanvas, 224),
  ]);

  if (vitDeepfakeExp.available   && vitDeepfakeExp.score   > 0.7) anomalies.push('vit_deepfake_signal');
  if (vitDeepfakeV2.available    && vitDeepfakeV2.score    > 0.7) anomalies.push('vit_deepfake_v2_signal');
  if (deepfakeDetector.available && deepfakeDetector.score > 0.7) anomalies.push('deepfake_signal');
  if (aiDetector.available       && aiDetector.score       > 0.7) anomalies.push('ai_generation_signal');
  if (efficientnetB4.available   && efficientnetB4.score   > 0.7) anomalies.push('efficientnet_signal');
  if (xceptionNet.available      && xceptionNet.score      > 0.7) anomalies.push('xception_signal');
  if (resnet50.available         && resnet50.score         > 0.7) anomalies.push('resnet_signal');

  return { vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, xceptionNet, efficientnetB4, resnet50, anomalies };
}
