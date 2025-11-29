/**
 * TensorFlow.js Deepfake Detection Module
 * 
 * Classifies faces as real or deepfake using:
 * - Pre-trained models
 * - Custom feature-based classification
 * - Ensemble methods
 */

import * as tf from '@tensorflow/tfjs';
import { DeepfakeFeatures } from '../mediapipe/features';
import { calculateConfidence } from '@/utils/mathUtils';

export interface DetectionResult {
  isDeepfake: boolean;
  confidence: number;
  scores: {
    faceMesh?: number;
    texture?: number;
    lighting?: number;
    temporal?: number;
    features?: number;
  };
  anomalies: string[];
}

export class DeepfakeDetector {
  private model: tf.LayersModel | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize TensorFlow.js and load model
   */
  private async initialize(): Promise<void> {
    try {
      // Wait for TensorFlow.js to be ready
      await tf.ready();

      // For now, we'll use a simple feature-based classifier
      // In production, you would load a pre-trained model:
      // this.model = await tf.loadLayersModel('/models/deepfake_detector.json');

      this.isInitialized = true;
      console.log('Deepfake detector initialized');
    } catch (error) {
      console.error('Failed to initialize detector:', error);
      throw error;
    }
  }

  /**
   * Wait for initialization
   */
  async waitForInitialization(): Promise<void> {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Detect deepfake from features
   */
  async detectFromFeatures(features: DeepfakeFeatures): Promise<DetectionResult> {
    await this.waitForInitialization();

    const anomalies: string[] = [];
    const scores: DetectionResult['scores'] = {};

    // Analyze blink rate (normal: 15-20 blinks/min)
    if (features.blinkRate < 5 || features.blinkRate > 30) {
      anomalies.push('abnormal_blink_rate');
      scores.features = (scores.features || 0) + 0.3;
    }

    // Analyze eye aspect ratio (normal: ~0.25)
    if (features.eyeAspectRatio < 0.15 || features.eyeAspectRatio > 0.35) {
      anomalies.push('unusual_eye_opening');
      scores.features = (scores.features || 0) + 0.2;
    }

    // Analyze landmark jitter (high jitter = suspicious)
    if (features.landmarkJitter > 0.05) {
      anomalies.push('high_landmark_instability');
      scores.features = (scores.features || 0) + 0.3;
    }

    // Analyze face symmetry (should be high)
    if (features.faceSymmetry < 0.7) {
      anomalies.push('face_asymmetry');
      scores.features = (scores.features || 0) + 0.2;
    }

    // Analyze head pose stability (should be moderate)
    if (features.headPoseStability < 0.5) {
      anomalies.push('unstable_head_pose');
      scores.features = (scores.features || 0) + 0.15;
    }

    // Calculate overall deepfake score
    const featureScore = scores.features || 0;
    const isDeepfake = featureScore > 0.5;
    const confidence = Math.min(featureScore / 0.8, 1);

    return {
      isDeepfake,
      confidence,
      scores,
      anomalies,
    };
  }

  /**
   * Detect deepfake from image tensor
   */
  async detectFromImage(imageTensor: tf.Tensor): Promise<DetectionResult> {
    await this.waitForInitialization();

    // If model is loaded, use it
    if (this.model) {
      const prediction = this.model.predict(imageTensor) as tf.Tensor;
      const data = await prediction.data();
      const deepfakeScore = data[0];

      return {
        isDeepfake: deepfakeScore > 0.5,
        confidence: deepfakeScore,
        scores: {
          texture: deepfakeScore,
        },
        anomalies: deepfakeScore > 0.5 ? ['texture_anomalies'] : [],
      };
    }

    // Fallback: Simple texture analysis
    return this.analyzeTexture(imageTensor);
  }

  /**
   * Analyze texture using TensorFlow operations
   */
  private async analyzeTexture(imageTensor: tf.Tensor): Promise<DetectionResult> {
    return tf.tidy(() => {
      // Calculate image statistics
      const mean = tf.mean(imageTensor);
      const variance = tf.moments(imageTensor).variance;

      // Simple heuristic: deepfakes tend to have smoother textures
      const smoothness = tf.div(variance, tf.add(mean, 1e-7));
      const smoothnessValue = smoothness.dataSync()[0];

      const isSmooth = smoothnessValue < 0.1;

      return {
        isDeepfake: isSmooth,
        confidence: isSmooth ? 0.6 : 0.4,
        scores: {
          texture: isSmooth ? 0.7 : 0.3,
        },
        anomalies: isSmooth ? ['smooth_texture'] : [],
      };
    });
  }

  /**
   * Combine multiple detection results
   */
  combineResults(results: DetectionResult[]): DetectionResult {
    if (results.length === 0) {
      return {
        isDeepfake: false,
        confidence: 0,
        scores: {},
        anomalies: [],
      };
    }

    const deepfakeCount = results.filter(r => r.isDeepfake).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    const allAnomalies = Array.from(
      new Set(results.flatMap(r => r.anomalies))
    );

    const combinedScores: DetectionResult['scores'] = {};
    const scoreKeys = ['faceMesh', 'texture', 'lighting', 'temporal', 'features'] as const;

    scoreKeys.forEach(key => {
      const scores = results
        .map(r => r.scores[key])
        .filter((s): s is number => s !== undefined);

      if (scores.length > 0) {
        combinedScores[key] = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    });

    return {
      isDeepfake: deepfakeCount > results.length / 2,
      confidence: calculateConfidence(combinedScores as Parameters<typeof calculateConfidence>[0]),
      scores: combinedScores,
      anomalies: allAnomalies,
    };
  }

  /**
   * Process video frames
   */
  async processVideoFrames(
    frames: tf.Tensor[],
    features: DeepfakeFeatures[]
  ): Promise<DetectionResult> {
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

  /**
   * Dispose model and cleanup
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
}

// Singleton instance
let detectorInstance: DeepfakeDetector | null = null;

export const getDeepfakeDetector = (): DeepfakeDetector => {
  if (!detectorInstance) {
    detectorInstance = new DeepfakeDetector();
  }
  return detectorInstance;
};

/**
 * Convert canvas to TensorFlow tensor
 */
export const canvasToTensor = (canvas: HTMLCanvasElement): tf.Tensor => {
  return tf.tidy(() => {
    const tensor = tf.browser.fromPixels(canvas);
    // Normalize to 0-1
    return tf.div(tensor, 255.0);
  });
};

/**
 * Batch convert canvases to tensors
 */
export const canvasesToTensors = (canvases: HTMLCanvasElement[]): tf.Tensor[] => {
  return canvases.map(canvas => canvasToTensor(canvas));
};
