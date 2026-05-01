/**
 * TensorFlow.js Deepfake Detection Module
 *
 * Ensemble strategy — three specialist groups, each votes independently:
 *
 *  Group A — Face manipulation (face-swaps, reenactment)
 *    MesoNet4, ViT-Deepfake-Exp (98.8%), ViT-Deepfake-v2 (92.1%), DeepfakeDetector-ONNX
 *
 *  Group B — AI-generated content (diffusion, GAN)
 *    SwinV2-AI-Detector (98.1%), UnivFD/CLIP backend
 *
 *  Group C — Physiological / forensic signals
 *    PPG, ELA, metadata, lip-sync, voice, landmark features
 *
 *  Final score = weighted vote across groups, adapting to which are available.
 *  A single strong signal from any group can tip the verdict.
 */

import * as tf from '@tensorflow/tfjs';
import { DeepfakeFeatures } from '../mediapipe/features';
import { calculateConfidence } from '@/utils/mathUtils';
import { getMetadataAnalyzer, type MetadataAnalysisResult } from '../forensics/metadataAnalyzer';
import { getPPGAnalyzer, type PPGAnalysisResult } from '../physiological/ppgAnalyzer';
import { getLipSyncAnalyzer, type LipSyncAnalysisResult } from '../audio/lipSyncAnalyzer';
import { getVoiceAnalyzer, type VoiceAnalysisResult } from '../audio/voiceAnalyzer';
import { detectWithOnnx, initOnnxDetector } from '../onnx/onnxDetector';
import { mediapipeBboxToFaceBbox, eyePointsFromLandmarks } from '../onnx/faceLocalizer';
import { getTemporalAnalyzer, type TemporalAnalysisResult } from '../temporal/temporalConsistency';

type NormalizedLandmark = { x: number; y: number; z: number };

// ─── Result Types ────────────────────────────────────────────────────────────

export interface ModelAvailability {
  mesonet: boolean;
  mobilenet: boolean;
}

export interface DetectionResult {
  isDeepfake: boolean;
  confidence: number;
  scores: {
    mesonet?: number;
    mobilenet?: number;
    faceMesh?: number;
    texture?: number;
    lighting?: number;
    temporal?: number;
    features?: number;
    metadata?: number;
    physiological?: number;
    lipSync?: number;
    voice?: number;
    frequency?: number;
    noise?: number;
    compression?: number;
    consistency?: number;
    [key: string]: number | undefined;
  };
  anomalies: string[];
  modelsUsed: string[];
  multiModalDetails?: {
    metadata?: MetadataAnalysisResult;
    ppg?: PPGAnalysisResult;
    lipSync?: LipSyncAnalysisResult;
    voice?: VoiceAnalysisResult;
    temporal?: TemporalAnalysisResult;
  };
}

// ─── Detector Class ──────────────────────────────────────────────────────────

export class DeepfakeDetector {
  // MesoNet4 — specialized for classic face-swaps
  private mesonet: tf.LayersModel | null = null;


  // MobileNetV2 fallback — general feature extraction
  private mobileNet: tf.GraphModel | null = null;

  private isInitialized = false;
  private threshold = 0.5;

  readonly availability: ModelAvailability = {
    mesonet: false,
    mobilenet: false,
  };

  constructor() {
    this.initialize();
    // Warm up ONNX models in parallel with TFJS models
    initOnnxDetector().catch(e => console.warn('ONNX init error:', e));
  }

  setThreshold(threshold: number): void {
    this.threshold = Math.max(0.1, Math.min(0.95, threshold));
  }

  getThreshold(): number {
    return this.threshold;
  }

  getAvailability(): ModelAvailability {
    return { ...this.availability };
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  private async initialize(): Promise<void> {
    try {
      await tf.ready();
      console.log('TensorFlow.js ready — loading models...');

      await Promise.allSettled([
        this.loadMesoNet(),
        this.loadMobileNet(),
      ]);

      const loaded = Object.values(this.availability).filter(Boolean).length;
      console.log(`✅ Detector ready — ${loaded}/2 TF.js models loaded (ONNX models load separately)`, this.availability);
      this.isInitialized = true;
    } catch (error) {
      console.error('Detector initialization error:', error);
      this.isInitialized = true; // still mark ready so callers don't hang
    }
  }

  private async loadMesoNet(): Promise<void> {
    try {
      this.mesonet = await tf.loadLayersModel('/models/mesonet/model.json');
      this.availability.mesonet = true;
      console.log('✅ MesoNet4 loaded (256×256, classic face-swaps)');
    } catch {
      console.warn('⚠️  MesoNet not found at /models/mesonet/model.json');
    }
  }


  private async loadMobileNet(): Promise<void> {
    try {
      this.mobileNet = await tf.loadGraphModel(
        'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1',
        { fromTFHub: true }
      );
      this.availability.mobilenet = true;
      console.log('✅ MobileNetV2 loaded (224×224, feature extraction fallback)');
    } catch {
      console.warn('⚠️  MobileNetV2 unavailable (offline or TFHub blocked)');
    }
  }

  async waitForInitialization(): Promise<void> {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ─── Public Detection API ──────────────────────────────────────────────────

  /**
   * Grouped ensemble — runs all available models, groups them by specialty,
   * then combines group scores. Adapts automatically to which models loaded.
   *
   * Group A (face manipulation): MesoNet, ViT-Exp, ViT-v2, DeepfakeDetector, Xception, EfficientNet-B4, ResNet50
   * Group B (AI-generated):      SwinV2-AI-Detector
   * Group C (forensic/texture):  TextureHeuristic, MobileNet fallback
   */
  async detectFromImage(imageTensor: tf.Tensor, canvas?: HTMLCanvasElement, faceBbox?: { xMin: number; yMin: number; width: number; height: number }, faceLandmarks?: { x: number; y: number; z: number }[]): Promise<DetectionResult> {
    await this.waitForInitialization();

    const scores: DetectionResult['scores'] = {};
    const anomalies: string[] = [];
    const modelsUsed: string[] = [];

    // Scores per group — each entry is [score, weight]
    const groupA: [number, number][] = []; // face manipulation
    const groupB: [number, number][] = []; // AI-generated content
    const groupC: [number, number][] = []; // forensic/texture

    // ── Group A: face manipulation models ────────────────────────────────────

    if (this.mesonet) {
      try {
        const score = await this.runMesoNet(imageTensor);
        scores.mesonet = score * 100;
        groupA.push([score, 1.0]); // baseline, lower weight
        modelsUsed.push('MesoNet4');
        if (score > 0.7) anomalies.push('mesonet_high_score');
      } catch (e) { console.error('MesoNet error:', e); }
    }


    // ── ONNX models — split into groups by specialty ──────────────────────────

    if (canvas) {
      try {
        const bbox      = faceBbox ? mediapipeBboxToFaceBbox(faceBbox) : null;
        const eyePoints = faceLandmarks ? eyePointsFromLandmarks(faceLandmarks) : undefined;
        const onnx = await detectWithOnnx(canvas, bbox, eyePoints);

        // Group A: face-specific detectors (7 models total)
        if (onnx.vitDeepfakeExp?.available) {
          scores.vitDeepfakeExp = onnx.vitDeepfakeExp.score * 100;
          groupA.push([onnx.vitDeepfakeExp.score, 3.0]); // best single model, highest weight
          modelsUsed.push('ViT-Deepfake-Exp');
          if (onnx.vitDeepfakeExp.score > 0.7) anomalies.push('vit_deepfake_signal');
        }
        if (onnx.vitDeepfakeV2?.available) {
          scores.vitDeepfakeV2 = onnx.vitDeepfakeV2.score * 100;
          groupA.push([onnx.vitDeepfakeV2.score, 2.0]); // different training set = diversity
          modelsUsed.push('ViT-Deepfake-v2');
          if (onnx.vitDeepfakeV2.score > 0.7) anomalies.push('vit_deepfake_v2_signal');
        }
        if (onnx.deepfakeDetector?.available) {
          scores.deepfakeDetector = onnx.deepfakeDetector.score * 100;
          groupA.push([onnx.deepfakeDetector.score, 1.5]);
          modelsUsed.push('DeepfakeDetector-ONNX');
          if (onnx.deepfakeDetector.score > 0.7) anomalies.push('deepfake_signal');
        }
        if (onnx.xceptionNet?.available) {
          scores.xceptionNet = onnx.xceptionNet.score * 100;
          groupA.push([onnx.xceptionNet.score, 2.5]); // FaceForensics++ champion
          modelsUsed.push('Xception');
          if (onnx.xceptionNet.score > 0.7) anomalies.push('xception_signal');
        }
        if (onnx.efficientnetB4?.available) {
          scores.efficientnetB4 = onnx.efficientnetB4.score * 100;
          groupA.push([onnx.efficientnetB4.score, 2.5]); // powerful model, high accuracy
          modelsUsed.push('EfficientNet-B4');
          if (onnx.efficientnetB4.score > 0.7) anomalies.push('efficientnet_signal');
        }
        if (onnx.resnet50?.available) {
          scores.resnet50 = onnx.resnet50.score * 100;
          groupA.push([onnx.resnet50.score, 2.0]); // balanced model
          modelsUsed.push('ResNet50');
          if (onnx.resnet50.score > 0.7) anomalies.push('resnet_signal');
        }

        // Group B: AI-generated content detector
        if (onnx.aiDetector?.available) {
          scores.aiDetector = onnx.aiDetector.score * 100;
          groupB.push([onnx.aiDetector.score, 2.0]);
          modelsUsed.push('SwinV2-AI-Detector');
          if (onnx.aiDetector.score > 0.7) anomalies.push('ai_generation_signal');
        }

        anomalies.push(...onnx.anomalies);
      } catch (e) { console.warn('ONNX inference skipped:', e); }
    }

    // ── Group C: forensic / texture fallback ─────────────────────────────────

    const textureResult = await this.analyzeTexture(imageTensor);
    scores.texture = textureResult.scores.texture ?? 0;
    anomalies.push(...textureResult.anomalies);
    groupC.push([(scores.texture) / 100, 0.5]); // low weight — heuristic only

    // MobileNet only if nothing else loaded
    if (groupA.length === 0 && groupB.length === 0 && this.mobileNet) {
      try {
        const score = await this.runMobileNet(imageTensor);
        scores.mobilenet = score * 100;
        groupC.push([score, 1.0]);
        modelsUsed.push('MobileNetV2');
      } catch (e) { console.error('MobileNet error:', e); }
    }

    // ── Combine groups ────────────────────────────────────────────────────────

    const groupScore = (group: [number, number][]) => {
      if (group.length === 0) return null;
      const num = group.reduce((s, [score, w]) => s + score * w, 0);
      const den = group.reduce((s, [, w]) => s + w, 0);
      return num / den;
    };

    const scoreA = groupScore(groupA);
    const scoreB = groupScore(groupB);
    const scoreC = groupScore(groupC);

    // Group weights — A and B are real ML models, C is heuristic
    // If a group is missing, redistribute its weight to the others
    const parts: [number, number][] = [];
    if (scoreA !== null) parts.push([scoreA, 0.55]);
    if (scoreB !== null) parts.push([scoreB, 0.35]);
    if (scoreC !== null) parts.push([scoreC, 0.10]);

    let ensembleScore: number;
    if (parts.length === 0) {
      ensembleScore = 0.5; // no signal at all
    } else {
      const totalW = parts.reduce((s, [, w]) => s + w, 0);
      ensembleScore = parts.reduce((s, [sc, w]) => s + sc * (w / totalW), 0);
    }

    // Strong signal override: if any single model is very confident, boost
    const allScores = [...groupA, ...groupB].map(([s]) => s);
    const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;
    if (maxScore > 0.92) {
      // One model is extremely confident — blend it in more strongly
      ensembleScore = ensembleScore * 0.6 + maxScore * 0.4;
    }

    const confidence = Math.min(Math.max(Math.abs(ensembleScore - 0.5) * 2, 0.05), 0.99);

    return {
      isDeepfake: ensembleScore > this.threshold,
      confidence,
      scores,
      anomalies: Array.from(new Set(anomalies)),
      modelsUsed,
    };
  }

  /**
   * Feature-based detection from MediaPipe landmarks (no image tensor needed).
   *
   * Thresholds are based on published deepfake detection literature:
   *  - Blink rate: 10-20 BPM is normal (Li et al. 2018 showed deepfakes blink ~3 BPM)
   *  - Eye aspect ratio: 0.20-0.40 is normal range for open eyes
   *  - Landmark jitter: >0.03 normalized units is suspicious (real faces are stable)
   *  - Face symmetry: <0.75 is suspicious (deepfakes often have asymmetric blending)
   *  - Head pose stability: <0.4 is suspicious
   *
   * Each signal is weighted by its empirical reliability. Scores are summed
   * and capped at 1.0. Confidence scales with the number of signals that fired.
   */
  async detectFromFeatures(features: DeepfakeFeatures): Promise<DetectionResult> {
    await this.waitForInitialization();

    const anomalies: string[] = [];
    let featureScore = 0;
    let signalsFired = 0;

    // Blink rate — deepfakes often have very low or absent blinking
    // Normal: 10-20 BPM. Suspicious: <8 or >35 (Li et al. 2018)
    if (features.blinkRate < 8 || features.blinkRate > 35) {
      anomalies.push('abnormal_blink_rate');
      featureScore += 0.25;
      signalsFired++;
    }

    // Eye aspect ratio — very low = eyes nearly closed (unnatural for alert face)
    // Very high = unnaturally wide open. Normal: 0.20-0.40
    if (features.eyeAspectRatio < 0.18 || features.eyeAspectRatio > 0.42) {
      anomalies.push('unusual_eye_opening');
      featureScore += 0.15;
      signalsFired++;
    }

    // Landmark jitter — deepfake face meshes are less stable than real faces
    // Threshold lowered from 0.05 to 0.03 — more sensitive to subtle instability
    if (features.landmarkJitter > 0.03) {
      anomalies.push('high_landmark_instability');
      featureScore += 0.30;
      signalsFired++;
    }

    // Face symmetry — deepfake blending often creates asymmetric artifacts
    // Threshold raised from 0.7 to 0.75 — more sensitive
    if (features.faceSymmetry < 0.75) {
      anomalies.push('face_asymmetry');
      featureScore += 0.20;
      signalsFired++;
    }

    // Head pose stability
    if (features.headPoseStability < 0.4) {
      anomalies.push('unstable_head_pose');
      featureScore += 0.10;
      signalsFired++;
    }

    featureScore = Math.min(featureScore, 1.0);

    // Confidence scales with corroboration — single signals are unreliable
    const confidence = signalsFired === 0 ? 0
      : signalsFired === 1 ? Math.abs(featureScore - 0.5) * 0.8
      : Math.abs(featureScore - 0.5) * 2;

    return {
      isDeepfake: featureScore > 0.5,
      confidence: Math.min(confidence, 0.99),
      scores: { features: featureScore * 100 },
      anomalies,
      modelsUsed: ['LandmarkFeatures'],
    };
  }

  /**
   * Ensemble: CNN image result + landmark features combined.
   */
  async detectEnsemble(imageData: ImageData, features?: DeepfakeFeatures, canvas?: HTMLCanvasElement, faceBbox?: { xMin: number; yMin: number; width: number; height: number }, faceLandmarks?: { x: number; y: number; z: number }[]): Promise<DetectionResult> {
    const imageTensor = tf.browser.fromPixels(imageData).div(255.0);

    try {
      const imageResult = await this.detectFromImage(imageTensor, canvas, faceBbox, faceLandmarks);

      if (!features) return imageResult;

      const featureResult = await this.detectFromFeatures(features);

      // Visual models get more weight when real models are loaded
      const cnnWeight = imageResult.modelsUsed.some(m => ['MesoNet4', 'ViT-Deepfake-Exp', 'ViT-Deepfake-v2', 'SwinV2-AI-Detector', 'DeepfakeDetector-ONNX'].includes(m)) ? 0.75 : 0.5;
      const ensembleScore = (imageResult.confidence * cnnWeight) + (featureResult.confidence * (1 - cnnWeight));

      return {
        isDeepfake: ensembleScore > this.threshold,
        confidence: ensembleScore,
        scores: { ...imageResult.scores, ...featureResult.scores },
        anomalies: Array.from(new Set([...imageResult.anomalies, ...featureResult.anomalies])),
        modelsUsed: Array.from(new Set([...imageResult.modelsUsed, ...featureResult.modelsUsed])),
      };
    } finally {
      imageTensor.dispose();
    }
  }

  /**
   * Full multi-modal detection — visual + physiological + audio + metadata.
   */
  async detectMultiModal(options: {
    imageData?: ImageData;
    features?: DeepfakeFeatures;
    faceMesh?: NormalizedLandmark[];
    canvas?: HTMLCanvasElement;
    faceBbox?: { xMin: number; yMin: number; width: number; height: number };
    audioBuffer?: AudioBuffer;
    file?: File;
    timestamp?: number;
    isVideoFrame?: boolean;
    univfd?: { score: number; confidence: number; isDeepfake: boolean; anomalies: string[]; modelLoaded: boolean };
  }): Promise<DetectionResult> {
    const { imageData, features, faceMesh, canvas, faceBbox, audioBuffer, file, timestamp, univfd } = options;

    const results: Parameters<typeof this.combineMultiModalResults>[0] = {};

    if (imageData) {
      results.visual = await this.detectEnsemble(imageData, features, canvas, faceBbox, options.faceMesh);
    }
    if (file) {
      results.metadata = await getMetadataAnalyzer().analyzeFile(file);
    }
    if (faceMesh && canvas && timestamp !== undefined) {
      // PPG requires temporal data — only run when we have a frame sequence
      // (webcam/video). For single images the analyzer will return
      // insufficient_data anyway, but we skip the call to avoid noise.
      const isVideoOrWebcam = options.isVideoFrame === true;
      if (isVideoOrWebcam) {
        results.ppg = await getPPGAnalyzer().analyzePPG(faceMesh, canvas, timestamp);
      }
    }
    if (faceMesh && audioBuffer && timestamp !== undefined) {
      results.lipSync = await getLipSyncAnalyzer().analyzeLipSync(faceMesh, audioBuffer, timestamp);
    }
    if (audioBuffer) {
      results.voice = await getVoiceAnalyzer().analyzeVoice(audioBuffer);
    }
    if (univfd) {
      results.univfd = univfd;
    }

    // Feed visual result into temporal sliding window (video/webcam only)
    let temporalResult: TemporalAnalysisResult | undefined;
    if (results.visual && options.isVideoFrame) {
      const visualScore = results.visual.confidence * (results.visual.isDeepfake ? 1 : 0);
      temporalResult = getTemporalAnalyzer().addFrame({
        score: visualScore,
        isDeepfake: results.visual.isDeepfake,
        timestamp: options.timestamp ?? Date.now(),
      });
      results.temporal = temporalResult;
    }

    return this.combineMultiModalResults(results);
  }

  // ─── Model Runners ─────────────────────────────────────────────────────────

  private async runMesoNet(imageTensor: tf.Tensor): Promise<number> {
    const preprocessed = this.preprocessForModel(imageTensor, [256, 256]);
    try {
      const prediction = this.mesonet!.predict(preprocessed) as tf.Tensor;
      const data = await prediction.data();
      prediction.dispose();
      return data[0]; // sigmoid output: 0=real, 1=fake
    } finally {
      preprocessed.dispose();
    }
  }


  private async runMobileNet(imageTensor: tf.Tensor): Promise<number> {
    const preprocessed = this.preprocessForModel(imageTensor, [224, 224]);
    try {
      const features = this.mobileNet!.predict(preprocessed) as tf.Tensor;
      const featureVector = await features.data();
      features.dispose();
      return this.analyzeFeatureVector(featureVector);
    } finally {
      preprocessed.dispose();
    }
  }

  // ─── Preprocessing ─────────────────────────────────────────────────────────

  private preprocessForModel(imageTensor: tf.Tensor, targetSize: [number, number]): tf.Tensor4D {
    return tf.tidy(() => {
      let t = imageTensor;
      if (t.shape.length === 4) t = tf.squeeze(t, [0]) as tf.Tensor3D;
      const resized = tf.image.resizeBilinear(t as tf.Tensor3D, targetSize);
      const max = tf.max(resized);
      const normalized = max.dataSync()[0] > 1 ? tf.div(resized, 255.0) : resized;
      return (normalized as tf.Tensor3D).expandDims(0) as tf.Tensor4D;
    });
  }

  // ─── Texture Heuristic ─────────────────────────────────────────────────────

  private async analyzeTexture(imageTensor: tf.Tensor): Promise<DetectionResult> {
    return tf.tidy(() => {
      const anomalies: string[] = [];
      let score = 0;

      const gray = tf.image.rgbToGrayscale(imageTensor as tf.Tensor3D);
      const { mean, variance } = tf.moments(gray);
      const meanVal = mean.dataSync()[0];
      const varVal = variance.dataSync()[0];
      const smoothness = varVal / (meanVal + 1e-7);

      if (smoothness < 0.08) {
        anomalies.push('overly_smooth_texture');
        score += 0.4;
      }

      if (imageTensor.shape[imageTensor.shape.length - 1] === 3) {
        const channels = tf.split(imageTensor as tf.Tensor3D, 3, 2);
        const rMean = tf.mean(channels[0]).dataSync()[0];
        const gMean = tf.mean(channels[1]).dataSync()[0];
        const bMean = tf.mean(channels[2]).dataSync()[0];
        const colorBalance = Math.max(rMean, gMean, bMean) / (Math.min(rMean, gMean, bMean) + 1e-7);
        if (colorBalance > 2.0) {
          anomalies.push('unusual_color_distribution');
          score += 0.3;
        }
        const rVar = tf.moments(channels[0]).variance.dataSync()[0];
        const gVar = tf.moments(channels[1]).variance.dataSync()[0];
        const bVar = tf.moments(channels[2]).variance.dataSync()[0];
        if ((rVar + gVar + bVar) / 3 < 0.005) {
          anomalies.push('low_color_variance');
          score += 0.3;
        }
      }

      score = Math.min(score, 1.0);
      return {
        isDeepfake: score > 0.5,
        confidence: Math.abs(score - 0.5) * 2,
        scores: { texture: score * 100 },
        anomalies,
        modelsUsed: ['TextureHeuristic'],
      };
    });
  }

  // ─── Feature Vector Analysis (MobileNet fallback) ─────────────────────────

  private analyzeFeatureVector(features: Float32Array | Int32Array | Uint8Array): number {
    const arr = Array.from(features);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    const stdDev = Math.sqrt(variance);
    const entropy = this.calculateEntropy(arr);
    const sparsity = arr.filter(f => Math.abs(f) < 0.01).length / arr.length;
    const cv = stdDev / (Math.abs(mean) + 1e-7);

    let score = 0;
    if (entropy < 0.3) score += 0.3;
    if (sparsity > 0.7) score += 0.25;
    if (cv > 2.0) score += 0.25;
    return Math.min(score, 1.0);
  }

  private calculateEntropy(features: number[]): number {
    const bins = 50;
    const min = Math.min(...features);
    const max = Math.max(...features);
    const binSize = (max - min) / bins || 1;
    const histogram = new Array(bins).fill(0);
    features.forEach(f => {
      histogram[Math.min(Math.floor((f - min) / binSize), bins - 1)]++;
    });
    const total = features.length;
    let entropy = 0;
    histogram.forEach(count => {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    });
    return entropy / Math.log2(bins);
  }

  // ─── Multi-Modal Combiner ──────────────────────────────────────────────────

  private combineMultiModalResults(results: {
    visual?: DetectionResult;
    metadata?: MetadataAnalysisResult;
    ppg?: PPGAnalysisResult;
    lipSync?: LipSyncAnalysisResult;
    voice?: VoiceAnalysisResult;
    temporal?: TemporalAnalysisResult;
    univfd?: { score: number; confidence: number; isDeepfake: boolean; anomalies: string[]; modelLoaded: boolean };
  }): DetectionResult {
    const scores: DetectionResult['scores'] = {};
    const allAnomalies: string[] = [];
    const modelsUsed: string[] = [];

    // Group A+B visual score (already a grouped ensemble from detectFromImage)
    let visualScore: number | null = null;
    if (results.visual) {
      visualScore = results.visual.confidence * (results.visual.isDeepfake ? 1 : -1) * 0.5 + 0.5;
      Object.assign(scores, results.visual.scores);
      allAnomalies.push(...results.visual.anomalies);
      modelsUsed.push(...results.visual.modelsUsed);
    }

    // CLIP/UnivFD — best signal for AI-generated content, goes into Group B
    let univfdScore: number | null = null;
    if (results.univfd) {
      univfdScore = results.univfd.score;
      scores.univfd = univfdScore * 100;
      allAnomalies.push(...(results.univfd.isDeepfake ? results.univfd.anomalies : []));
      modelsUsed.push(results.univfd.modelLoaded ? 'UnivFD-CLIP' : 'CLIP-ZeroShot');
    }

    // Group C: physiological + forensic signals
    const forensicParts: [number, number][] = [];

    if (results.metadata) {
      forensicParts.push([results.metadata.score, 1.0]);
      scores.metadata = results.metadata.score * 100;
      allAnomalies.push(...results.metadata.anomalies);
      modelsUsed.push('MetadataForensics');
    }
    if (results.ppg) {
      forensicParts.push([results.ppg.score, 2.5]); // strong biological signal
      scores.physiological = results.ppg.score * 100;
      allAnomalies.push(...results.ppg.anomalies);
      modelsUsed.push('PPGAnalysis');
    }
    if (results.lipSync) {
      forensicParts.push([results.lipSync.score, 2.5]);
      scores.lipSync = results.lipSync.score * 100;
      allAnomalies.push(...results.lipSync.anomalies);
      modelsUsed.push('LipSyncAnalysis');
    }
    if (results.voice) {
      // Voice heuristic has high false-positive rate on compressed/non-English audio.
      // Only include in ensemble when confidence is high (requires 2+ corroborating signals).
      // Weight is 0 for low-confidence results — voice anomalies still surface in the UI
      // but don't influence the verdict until a trained model (RawNet2/AASIST) is available.
      const voiceWeight = results.voice.confidence >= 0.5 ? 1.0 : 0;
      if (voiceWeight > 0) {
        forensicParts.push([results.voice.score, voiceWeight]);
      }
      scores.voice = results.voice.score * 100;
      allAnomalies.push(...results.voice.anomalies);
      modelsUsed.push('VoiceAnalysis');
    }

    // Temporal consistency — strong signal for video deepfakes
    if (results.temporal && results.temporal.confidence > 0.3) {
      forensicParts.push([results.temporal.score, 3.0]); // high weight — hard to fake
      scores.temporal = results.temporal.score * 100;
      allAnomalies.push(...results.temporal.anomalies);
      modelsUsed.push('TemporalConsistency');
    }

    const forensicScore = forensicParts.length > 0
      ? forensicParts.reduce((s, [sc, w]) => s + sc * w, 0) / forensicParts.reduce((s, [, w]) => s + w, 0)
      : null;

    // Combine: visual (A+B) + CLIP (B boost) + forensic (C)
    // Weights adapt to what's available
    const parts: [number, number][] = [];
    if (visualScore !== null)  parts.push([visualScore,  0.50]);
    if (univfdScore !== null)  parts.push([univfdScore,  0.35]); // CLIP is the best for new generators
    if (forensicScore !== null) parts.push([forensicScore, 0.15]);

    let finalScore: number;
    if (parts.length === 0) {
      finalScore = 0.5;
    } else {
      const totalW = parts.reduce((s, [, w]) => s + w, 0);
      finalScore = parts.reduce((s, [sc, w]) => s + sc * (w / totalW), 0);
    }

    const confidence = Math.abs(finalScore - 0.5) * 2;

    return {
      isDeepfake: finalScore > this.threshold,
      confidence,
      scores,
      anomalies: Array.from(new Set(allAnomalies)),
      modelsUsed: Array.from(new Set(modelsUsed)),
      multiModalDetails: {
        metadata: results.metadata,
        ppg: results.ppg,
        lipSync: results.lipSync,
        voice: results.voice,
        temporal: results.temporal,
      },
    };
  }

  // ─── Video Processing ──────────────────────────────────────────────────────

  async processVideoFrames(frames: tf.Tensor[], features: DeepfakeFeatures[]): Promise<DetectionResult> {
    const results: DetectionResult[] = [];
    for (let i = 0; i < frames.length; i++) {
      const frameResult = await this.detectFromImage(frames[i]);
      if (features[i]) {
        const featureResult = await this.detectFromFeatures(features[i]);
        results.push(this.combineResults([frameResult, featureResult]));
      } else {
        results.push(frameResult);
      }
    }
    return this.combineResults(results);
  }

  combineResults(results: DetectionResult[]): DetectionResult {
    if (results.length === 0) {
      return { isDeepfake: false, confidence: 0, scores: {}, anomalies: [], modelsUsed: [] };
    }
    const deepfakeCount = results.filter(r => r.isDeepfake).length;
    const allAnomalies = Array.from(new Set(results.flatMap(r => r.anomalies)));
    const allModels = Array.from(new Set(results.flatMap(r => r.modelsUsed)));
    const combinedScores: DetectionResult['scores'] = {};
    const allKeys = Array.from(new Set(results.flatMap(r => Object.keys(r.scores))));
    allKeys.forEach(key => {
      const vals = results.map(r => r.scores[key]).filter((v): v is number => v !== undefined);
      if (vals.length > 0) combinedScores[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    return {
      isDeepfake: deepfakeCount > results.length / 2,
      confidence: calculateConfidence(combinedScores as Parameters<typeof calculateConfidence>[0]),
      scores: combinedScores,
      anomalies: allAnomalies,
      modelsUsed: allModels,
    };
  }

  dispose(): void {
    this.mesonet?.dispose();
    this.mobileNet?.dispose();
    this.isInitialized = false;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let detectorInstance: DeepfakeDetector | null = null;

export const getDeepfakeDetector = (): DeepfakeDetector => {
  if (!detectorInstance) detectorInstance = new DeepfakeDetector();
  return detectorInstance;
};

export const canvasToTensor = (canvas: HTMLCanvasElement): tf.Tensor => {
  return tf.tidy(() => tf.div(tf.browser.fromPixels(canvas), 255.0));
};

export const canvasesToTensors = (canvases: HTMLCanvasElement[]): tf.Tensor[] => {
  return canvases.map(canvasToTensor);
};
