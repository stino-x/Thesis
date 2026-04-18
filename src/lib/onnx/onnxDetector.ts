/**
 * ONNX Model Detector
 * Loads and runs ONNX models hosted on Hugging Face CDN.
 * Models: https://huggingface.co/stino214/deepfake-onnx-models
 */

import * as ort from 'onnxruntime-web';

const HF_BASE = 'https://huggingface.co/stino214/deepfake-onnx-models/resolve/main';

const MODEL_URLS = {
  vitDeepfakeExp:  `${HF_BASE}/vit_deepfake_exp.onnx`,
  vitDeepfakeV2:   `${HF_BASE}/vit_deepfake_v2.onnx`,
  deepfakeDetector:`${HF_BASE}/deepfake_detector.onnx`,
  aiDetector:      `${HF_BASE}/ai_detector_int8.onnx`,
} as const;

// Configure ONNX Runtime to use the wasm backend
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

type ModelKey = keyof typeof MODEL_URLS;

interface OnnxModelResult {
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

// Lazy-loaded session cache
const sessions: Partial<Record<ModelKey, ort.InferenceSession>> = {};
const loadErrors: Partial<Record<ModelKey, boolean>> = {};

async function getSession(key: ModelKey): Promise<ort.InferenceSession | null> {
  if (loadErrors[key]) return null;
  if (sessions[key]) return sessions[key]!;
  try {
    sessions[key] = await ort.InferenceSession.create(MODEL_URLS[key], {
      executionProviders: ['wasm'],
    });
    console.log(`✅ ONNX loaded: ${key}`);
    return sessions[key]!;
  } catch (e) {
    console.warn(`⚠️ ONNX failed to load ${key}:`, e);
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

/** Preprocess canvas to a flat Float32 tensor [1, 3, H, W] */
function canvasToTensor(canvas: HTMLCanvasElement, size: number): ort.Tensor {
  const ctx = canvas.getContext('2d')!;
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = size;
  tmp.getContext('2d')!.drawImage(canvas, 0, 0, size, size);
  const { data } = tmp.getContext('2d')!.getImageData(0, 0, size, size);

  const float32 = new Float32Array(3 * size * size);
  const mean = [0.485, 0.456, 0.406];
  const std  = [0.229, 0.224, 0.225];

  for (let i = 0; i < size * size; i++) {
    float32[i]                 = (data[i * 4]     / 255 - mean[0]) / std[0]; // R
    float32[size * size + i]   = (data[i * 4 + 1] / 255 - mean[1]) / std[1]; // G
    float32[size * size * 2 + i] = (data[i * 4 + 2] / 255 - mean[2]) / std[2]; // B
  }

  return new ort.Tensor('float32', float32, [1, 3, size, size]);
}

/** Run a single model and return a 0-1 deepfake probability */
async function runModel(key: ModelKey, canvas: HTMLCanvasElement, size: number): Promise<OnnxModelResult> {
  const session = await getSession(key);
  if (!session) return { score: 0, available: false };

  try {
    const tensor = canvasToTensor(canvas, size);
    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: tensor });
    const outputName = session.outputNames[0];
    const output = results[outputName].data as Float32Array;

    // If output has 2 logits apply softmax, else treat as raw probability
    let score: number;
    if (output.length === 2) {
      const expReal = Math.exp(output[0]);
      const expFake = Math.exp(output[1]);
      score = expFake / (expReal + expFake);
    } else {
      score = Math.max(0, Math.min(1, output[0]));
    }

    return { score, available: true };
  } catch (e) {
    console.warn(`ONNX inference error (${key}):`, e);
    return { score: 0, available: false };
  }
}

/** Run all available ONNX models on a canvas and return combined results */
export async function detectWithOnnx(
  canvas: HTMLCanvasElement,
  _threshold = 0.5
): Promise<OnnxDetectionResult> {
  const anomalies: string[] = [];

  const [vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector] = await Promise.all([
    runModel('vitDeepfakeExp',   canvas, 224),
    runModel('vitDeepfakeV2',    canvas, 224),
    runModel('deepfakeDetector', canvas, 224),
    runModel('aiDetector',       canvas, 224),
  ]);

  if (vitDeepfakeExp.available  && vitDeepfakeExp.score  > 0.7) anomalies.push('vit_deepfake_signal');
  if (vitDeepfakeV2.available   && vitDeepfakeV2.score   > 0.7) anomalies.push('vit_deepfake_v2_signal');
  if (deepfakeDetector.available && deepfakeDetector.score > 0.7) anomalies.push('deepfake_signal');
  if (aiDetector.available      && aiDetector.score      > 0.7) anomalies.push('ai_generation_signal');

  return { vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector, aiDetector, anomalies };
}
