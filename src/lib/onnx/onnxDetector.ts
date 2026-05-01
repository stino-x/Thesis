/**
 * ONNX Model Detector
 * Loads and runs ONNX models hosted on Hugging Face CDN.
 * Models: https://huggingface.co/stino214/deepfake-onnx-models
 *
 * Caching strategy: models are stored in IndexedDB after first download
 * so subsequent page loads skip the ~1.1 GB network fetch entirely.
 */

import * as ort from 'onnxruntime-web';
import { cropFaceFromCanvas, type FaceBoundingBox, type EyePoints } from './faceLocalizer';
import { updateModelStatus } from '@/components/ModelLoadingStatus';

const HF_BASE = 'https://huggingface.co/stino214/deepfake-onnx-models/resolve/main';

const MODEL_URLS = {
  vitDeepfakeExp:   `${HF_BASE}/vit_deepfake_exp.onnx`,
  vitDeepfakeV2:    `${HF_BASE}/vit_deepfake_v2.onnx`,
  deepfakeDetector: `${HF_BASE}/deepfake_detector.onnx`,
  aiDetector:       `${HF_BASE}/ai_detector_int8.onnx`,
  efficientnetB4:   `${HF_BASE}/efficientnet_b4.onnx`,    // Powerful model (95-97% accuracy)
  xceptionNet:      `${HF_BASE}/xception_net.onnx`,       // FaceForensics++ champion (97-99%)
  resnet50:         `${HF_BASE}/resnet50.onnx`,           // Balanced model (94-96%)
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
      const req = tx.objectStore(IDB_STORE).get(key);
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
      tx.objectStore(IDB_STORE).put(value, key);
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

/**
 * Returns a cached ONNX session, downloading and caching the model
 * in IndexedDB on first use so subsequent loads are instant.
 */
async function getSession(key: ModelKey): Promise<ort.InferenceSession | null> {
  if (loadErrors[key]) return null;
  if (sessions[key])   return sessions[key]!;

  try {
    let buffer = await idbGet(key);

    if (!buffer) {
      console.log(`⬇️  Downloading ONNX model: ${key} (first time only)`);
      updateModelStatus(key, 'downloading');
      const res = await fetch(MODEL_URLS[key]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = await res.arrayBuffer();
      idbSet(key, buffer);
    } else {
      console.log(`📦 ONNX model from cache: ${key}`);
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

async function runModel(
  key: ModelKey,
  canvas: HTMLCanvasElement,
  size: number,
  normalize: 'imagenet' | 'range1' = 'imagenet'
): Promise<OnnxModelResult> {
  const session = await getSession(key);
  if (!session) return { score: 0, available: false };

  try {
    const tensor     = canvasToTensor(canvas, size, normalize);
    const inputName  = session.inputNames[0];
    const output     = await session.run({ [inputName]: tensor });
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

    return { score, available: true };
  } catch (e) {
    console.warn(`ONNX inference error (${key}):`, e);
    return { score: 0, available: false };
  }
}

/** Run all ONNX models on a canvas and return per-model scores */
export async function detectWithOnnx(
  canvas: HTMLCanvasElement,
  faceBbox: FaceBoundingBox | null = null,
  eyePoints?: EyePoints
): Promise<OnnxDetectionResult> {
  const anomalies: string[] = [];

  // Crop + align face before running ViT/Xception/EfficientNet models
  const faceCanvas = cropFaceFromCanvas(canvas, faceBbox, 0.20, eyePoints);

  const [vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, xceptionNet, efficientnetB4, resnet50] = await Promise.all([
    runModel('vitDeepfakeExp',   faceCanvas, 224),
    runModel('vitDeepfakeV2',    faceCanvas, 224),
    runModel('deepfakeDetector', faceCanvas, 224),
    runModel('aiDetector',       canvas,     224),
    runModel('xceptionNet',      faceCanvas, 299, 'range1'),
    runModel('efficientnetB4',   faceCanvas, 380),
    runModel('resnet50',         faceCanvas, 224),
  ]);

  if (vitDeepfakeExp.available   && vitDeepfakeExp.score   > 0.7) anomalies.push('vit_deepfake_signal');
  if (vitDeepfakeV2.available    && vitDeepfakeV2.score    > 0.7) anomalies.push('vit_deepfake_v2_signal');
  if (deepfakeDetector.available && deepfakeDetector.score > 0.7) anomalies.push('deepfake_signal');
  if (aiDetector.available       && aiDetector.score       > 0.7) anomalies.push('ai_generation_signal');
  if (xceptionNet.available      && xceptionNet.score      > 0.7) anomalies.push('xception_signal');
  if (efficientnetB4.available   && efficientnetB4.score   > 0.7) anomalies.push('efficientnet_signal');
  if (resnet50.available         && resnet50.score         > 0.7) anomalies.push('resnet_signal');

  return { vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, xceptionNet, efficientnetB4, resnet50, anomalies };
}
