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

const HF_BASE = 'https://huggingface.co/stino214/deepfake-onnx-models/resolve/main';

const MODEL_URLS = {
  vitDeepfakeExp:   `${HF_BASE}/vit_deepfake_exp.onnx`,
  vitDeepfakeV2:    `${HF_BASE}/vit_deepfake_v2.onnx`,
  deepfakeDetector: `${HF_BASE}/deepfake_detector.onnx`,
  aiDetector:       `${HF_BASE}/ai_detector_int8.onnx`,
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
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

async function idbSet(key: string, value: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* non-fatal */ }
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
      const res = await fetch(MODEL_URLS[key]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = await res.arrayBuffer();
      idbSet(key, buffer); // cache async, don't await
    } else {
      console.log(`📦 ONNX model from cache: ${key}`);
    }

    sessions[key] = await ort.InferenceSession.create(buffer, {
      executionProviders: ['wasm'],
    });
    console.log(`✅ ONNX ready: ${key}`);
    return sessions[key]!;
  } catch (e) {
    console.warn(`⚠️  ONNX failed to load ${key}:`, e);
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
 * Preprocess canvas → Float32 tensor [1, 3, H, W] with ImageNet normalization.
 * Center-crops to square first to preserve face geometry — stretching to
 * a non-square aspect ratio degrades ViT accuracy significantly.
 */
function canvasToTensor(canvas: HTMLCanvasElement, size: number): ort.Tensor {
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

  // ImageNet mean/std normalization
  const mean = [0.485, 0.456, 0.406];
  const std  = [0.229, 0.224, 0.225];

  for (let i = 0; i < size * size; i++) {
    float32[i]                   = (data[i * 4]     / 255 - mean[0]) / std[0]; // R
    float32[size * size + i]     = (data[i * 4 + 1] / 255 - mean[1]) / std[1]; // G
    float32[size * size * 2 + i] = (data[i * 4 + 2] / 255 - mean[2]) / std[2]; // B
  }

  return new ort.Tensor('float32', float32, [1, 3, size, size]);
}

// ─── Inference ────────────────────────────────────────────────────────────────

async function runModel(
  key: ModelKey,
  canvas: HTMLCanvasElement,
  size: number
): Promise<OnnxModelResult> {
  const session = await getSession(key);
  if (!session) return { score: 0, available: false };

  try {
    const tensor     = canvasToTensor(canvas, size);
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

  // Crop + align face before running ViT models
  const faceCanvas = cropFaceFromCanvas(canvas, faceBbox, 0.20, eyePoints);

  const [vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector] = await Promise.all([
    runModel('vitDeepfakeExp',   faceCanvas, 224),  // face-specific — use crop
    runModel('vitDeepfakeV2',    faceCanvas, 224),  // face-specific — use crop
    runModel('deepfakeDetector', faceCanvas, 224),  // face-specific — use crop
    runModel('aiDetector',       canvas,     224),  // AI-gen detector — full image is correct
  ]);

  if (vitDeepfakeExp.available   && vitDeepfakeExp.score   > 0.7) anomalies.push('vit_deepfake_signal');
  if (vitDeepfakeV2.available    && vitDeepfakeV2.score    > 0.7) anomalies.push('vit_deepfake_v2_signal');
  if (deepfakeDetector.available && deepfakeDetector.score > 0.7) anomalies.push('deepfake_signal');
  if (aiDetector.available       && aiDetector.score       > 0.7) anomalies.push('ai_generation_signal');

  return { vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, anomalies };
}
