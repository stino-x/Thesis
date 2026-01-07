/**
 * TensorFlow.js Deepfake Detection Module
 * 
 * Classifies faces as real or deepfake using:
 * - Pre-trained models (MobileNetV2, MesoNet)
 * - Custom feature-based classification
 * - Multi-modal detection (visual + physiological + audio + metadata)
 * - Ensemble methods
 */

import * as tf from '@tensorflow/tfjs';
import { DeepfakeFeatures } from '../mediapipe/features';
import { calculateConfidence } from '@/utils/mathUtils';
import { getMetadataAnalyzer, type MetadataAnalysisResult } from '../forensics/metadataAnalyzer';
import { getPPGAnalyzer, type PPGAnalysisResult } from '../physiological/ppgAnalyzer';
import { getLipSyncAnalyzer, type LipSyncAnalysisResult } from '../audio/lipSyncAnalyzer';
import { getVoiceAnalyzer, type VoiceAnalysisResult } from '../audio/voiceAnalyzer';
// MediaPipe type (using generic array type for compatibility)
type NormalizedLandmark = { x: number; y: number; z: number };

export interface DetectionResult {
  isDeepfake: boolean;
  confidence: number;
  scores: {
    faceMesh?: number;
    texture?: number;
    lighting?: number;
    temporal?: number;
    features?: number;
    metadata?: number;
    physiological?: number;
    lipSync?: number;
    voice?: number;
  };
  anomalies: string[];
  multiModalDetails?: {
    metadata?: MetadataAnalysisResult;
    ppg?: PPGAnalysisResult;
    lipSync?: LipSyncAnalysisResult;
    voice?: VoiceAnalysisResult;
  };
}

export class DeepfakeDetector {
  private model: tf.LayersModel | tf.GraphModel | null = null;
  private mobileNet: tf.GraphModel | null = null;
  private isInitialized = false;
  private modelLoadError: boolean = false;
  private modelType: 'mesonet' | 'mobilenet' | 'none' = 'none';

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
      console.log('TensorFlow.js ready');

      // Try to load models in order of preference
      
      // 1. Try MesoNet (specialized for deepfakes)
      try {
        this.model = await tf.loadLayersModel('/models/mesonet/model.json');
        this.modelType = 'mesonet';
        console.log('✅ MesoNet model loaded successfully');
      } catch {
        console.log('⚠️ MesoNet not found, trying MobileNet...');
        
        // 2. Try MobileNetV2 from TensorFlow Hub (general-purpose CNN)
        try {
          this.mobileNet = await tf.loadGraphModel(
            'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1',
            { fromTFHub: true }
          );
          this.modelType = 'mobilenet';
          console.log('✅ MobileNetV2 loaded from TensorFlow Hub');
          console.log('📊 Using MobileNet feature extraction + ensemble detection');
        } catch {
          console.warn('⚠️ Could not load MobileNet from TFHub');
          console.warn('Using enhanced feature-based detection only');
          this.modelLoadError = true;
        }
      }

      this.isInitialized = true;
      console.log(`🎯 Deepfake detector initialized (mode: ${this.modelType})`);
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
   * Detect deepfake from features (MediaPipe analysis)
   */
  async detectFromFeatures(features: DeepfakeFeatures): Promise<DetectionResult> {
    await this.waitForInitialization();

    const anomalies: string[] = [];
    let featureScore = 0;

    // Analyze blink rate (normal: 15-20 blinks/min)
    if (features.blinkRate < 5 || features.blinkRate > 30) {
      anomalies.push('abnormal_blink_rate');
      featureScore += 0.3;
    }

    // Analyze eye aspect ratio (normal: ~0.25)
    if (features.eyeAspectRatio < 0.15 || features.eyeAspectRatio > 0.35) {
      anomalies.push('unusual_eye_opening');
      featureScore += 0.2;
    }

    // Analyze landmark jitter (high jitter = suspicious)
    if (features.landmarkJitter > 0.05) {
      anomalies.push('high_landmark_instability');
      featureScore += 0.3;
    }

    // Analyze face symmetry (should be high)
    if (features.faceSymmetry < 0.7) {
      anomalies.push('face_asymmetry');
      featureScore += 0.2;
    }

    // Analyze head pose stability (should be moderate)
    if (features.headPoseStability < 0.5) {
      anomalies.push('unstable_head_pose');
      featureScore += 0.15;
    }

    // Normalize score
    featureScore = Math.min(featureScore, 1.0);
    const confidence = Math.abs(featureScore - 0.5) * 2;

    return {
      isDeepfake: featureScore > 0.5,
      confidence,
      scores: {
        features: featureScore * 100,
      },
      anomalies,
    };
  }

  /**
   * Ensemble detection combining CNN + Features + Texture
   */
  async detectEnsemble(
    imageData: ImageData,
    features?: DeepfakeFeatures
  ): Promise<DetectionResult> {
    const imageTensor = tf.browser.fromPixels(imageData).div(255.0);
    
    try {
      // Get CNN/texture score
      const imageResult = await this.detectFromImage(imageTensor);
      
      // Get feature score if available
      let featureResult: DetectionResult | null = null;
      if (features) {
        featureResult = await this.detectFromFeatures(features);
      }
      
      // Combine results with weighted ensemble
      if (featureResult) {
        const weight = this.modelType !== 'none' ? 0.7 : 0.5; // More weight to CNN if available
        const ensembleScore = (imageResult.confidence * weight) + (featureResult.confidence * (1 - weight));
        
        return {
          isDeepfake: ensembleScore > 0.5,
          confidence: ensembleScore,
          scores: {
            ...imageResult.scores,
            ...featureResult.scores,
          },
          anomalies: [...new Set([...imageResult.anomalies, ...featureResult.anomalies])],
        };
      }
      
      return imageResult;
    } finally {
      imageTensor.dispose();
    }
  }

  /**
   * Preprocess image for model input
   * - MesoNet: 256x256
   * - MobileNet: 224x224
   */
  private preprocessForModel(imageTensor: tf.Tensor, targetSize: [number, number] = [256, 256]): tf.Tensor4D {
    return tf.tidy(() => {
      let processed = imageTensor;

      // Ensure 3D tensor (height, width, channels)
      if (processed.shape.length === 4) {
        processed = tf.squeeze(processed, [0]);
      }

      // Resize to target size
      processed = tf.image.resizeBilinear(processed as tf.Tensor3D, targetSize);

      // Normalize to [0, 1] range if not already
      const max = tf.max(processed);
      if (max.dataSync()[0] > 1) {
        processed = tf.div(processed, 255.0);
      }

      // Add batch dimension
      return processed.expandDims(0) as tf.Tensor4D;
    });
  }

  /**
   * Detect deepfake from image tensor
   */
  async detectFromImage(imageTensor: tf.Tensor): Promise<DetectionResult> {
    await this.waitForInitialization();

    // Route to appropriate model
    if (this.modelType === 'mesonet' && this.model) {
      return await this.detectWithMesoNet(imageTensor);
    } else if (this.modelType === 'mobilenet' && this.mobileNet) {
      return await this.detectWithMobileNet(imageTensor);
    }

    // Fallback: Enhanced texture analysis
    return this.analyzeTexture(imageTensor);
  }

  /**
   * Detect using MesoNet model (specialized for deepfakes)
   */
  private async detectWithMesoNet(imageTensor: tf.Tensor): Promise<DetectionResult> {
    const preprocessed = this.preprocessForModel(imageTensor, [256, 256]);

    try {
      const prediction = this.model!.predict(preprocessed) as tf.Tensor;
      const score = await prediction.data();

      // MesoNet outputs probability of being fake
      const deepfakeScore = score[0];
      const confidence = Math.abs(deepfakeScore - 0.5) * 2; // Convert to confidence 0-1

      // Cleanup tensors
      preprocessed.dispose();
      prediction.dispose();

      return {
        isDeepfake: deepfakeScore > 0.5,
        confidence,
        scores: {
          texture: deepfakeScore * 100,
        },
        anomalies: deepfakeScore > 0.7 ? ['high_cnn_score', 'texture_anomalies'] : 
                   deepfakeScore > 0.5 ? ['texture_anomalies'] : [],
      };
    } catch (error) {
      console.error('MesoNet inference error:', error);
      preprocessed.dispose();
      return this.analyzeTexture(imageTensor);
    }
  }

  /**
   * Detect using MobileNet (feature extraction + classification)
   */
  private async detectWithMobileNet(imageTensor: tf.Tensor): Promise<DetectionResult> {
    const preprocessed = this.preprocessForModel(imageTensor, [224, 224]);

    try {
      // Extract features using MobileNet
      const features = this.mobileNet!.predict(preprocessed) as tf.Tensor;
      const featureVector = await features.data();

      // Analyze feature patterns for deepfake indicators
      const deepfakeScore = this.analyzeFeatureVector(featureVector);
      const confidence = Math.abs(deepfakeScore - 0.5) * 2;

      // Cleanup
      preprocessed.dispose();
      features.dispose();

      return {
        isDeepfake: deepfakeScore > 0.5,
        confidence,
        scores: {
          texture: deepfakeScore * 100,
        },
        anomalies: deepfakeScore > 0.6 ? ['suspicious_feature_pattern'] : [],
      };
    } catch (error) {
      console.error('MobileNet inference error:', error);
      preprocessed.dispose();
      return this.analyzeTexture(imageTensor);
    }
  }

  /**
   * Analyze MobileNet feature vector for deepfake indicators
   * Uses statistical analysis of the 1280-dimensional feature vector
   */
  private analyzeFeatureVector(features: Float32Array | Int32Array | Uint8Array): number {
    // Convert to array for analysis
    const featureArray = Array.from(features);
    
    // Calculate statistics
    const mean = featureArray.reduce((a, b) => a + b, 0) / featureArray.length;
    const variance = featureArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / featureArray.length;
    const stdDev = Math.sqrt(variance);
    
    // Deepfake indicators in feature space:
    // 1. Unusual feature distribution (too uniform or too peaked)
    const featureEntropy = this.calculateEntropy(featureArray);
    
    // 2. Abnormal activation patterns
    const sparsity = featureArray.filter(f => Math.abs(f) < 0.01).length / featureArray.length;
    
    // 3. Feature consistency (deepfakes often have inconsistent features)
    const coefficientOfVariation = stdDev / (Math.abs(mean) + 1e-7);
    
    let deepfakeScore = 0;
    
    // Low entropy = overly smooth/uniform features (suspicious)
    if (featureEntropy < 0.3) {
      deepfakeScore += 0.3;
    }
    
    // High sparsity = many dead features (suspicious)
    if (sparsity > 0.7) {
      deepfakeScore += 0.25;
    }
    
    // High variation = inconsistent features (suspicious)
    if (coefficientOfVariation > 2.0) {
      deepfakeScore += 0.25;
    }
    
    // Normalize to 0-1
    return Math.min(deepfakeScore, 1.0);
  }

  /**
   * Calculate entropy of feature distribution
   */
  private calculateEntropy(features: number[]): number {
    // Bin features into histogram
    const bins = 50;
    const min = Math.min(...features);
    const max = Math.max(...features);
    const binSize = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    
    features.forEach(f => {
      const binIndex = Math.min(Math.floor((f - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });
    
    // Calculate entropy
    const total = features.length;
    let entropy = 0;
    
    histogram.forEach(count => {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    });
    
    // Normalize to 0-1 (max entropy for 50 bins is log2(50) ≈ 5.64)
    return entropy / Math.log2(bins);
  }

  /**
   * Detect deepfake from image tensor
   */
  async detectFromImageOld(imageTensor: tf.Tensor): Promise<DetectionResult> {
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
   * Enhanced texture analysis using TensorFlow operations
   * Simplified to avoid type issues while maintaining effectiveness
   */
  private async analyzeTexture(imageTensor: tf.Tensor): Promise<DetectionResult> {
    return tf.tidy(() => {
      const anomalies: string[] = [];
      let deepfakeScore = 0;

      // Convert to grayscale for texture analysis
      const gray = tf.image.rgbToGrayscale(imageTensor as tf.Tensor3D);

      // 1. Calculate image statistics
      const { mean, variance } = tf.moments(gray);
      const meanValue = mean.dataSync()[0];
      const varianceValue = variance.dataSync()[0];

      // 2. Texture smoothness (deepfakes are often smoother)
      const smoothness = varianceValue / (meanValue + 1e-7);
      if (smoothness < 0.08) {
        anomalies.push('overly_smooth_texture');
        deepfakeScore += 0.4;
      }

      // 3. Color distribution analysis
      if (imageTensor.shape[imageTensor.shape.length - 1] === 3) {
        const channels = tf.split(imageTensor as tf.Tensor3D, 3, 2);
        const rMean: number = tf.mean(channels[0]).dataSync()[0];
        const gMean: number = tf.mean(channels[1]).dataSync()[0];
        const bMean: number = tf.mean(channels[2]).dataSync()[0];

        // Check for unnatural color balance
        const colorBalance = Math.max(rMean, gMean, bMean) / (Math.min(rMean, gMean, bMean) + 1e-7);
        if (colorBalance > 2.0) {
          anomalies.push('unusual_color_distribution');
          deepfakeScore += 0.3;
        }
        
        // Check for color channel variance
        const rVar: number = tf.moments(channels[0]).variance.dataSync()[0];
        const gVar: number = tf.moments(channels[1]).variance.dataSync()[0];
        const bVar: number = tf.moments(channels[2]).variance.dataSync()[0];
        const avgChannelVar = (rVar + gVar + bVar) / 3;
        
        if (avgChannelVar < 0.005) {
          anomalies.push('low_color_variance');
          deepfakeScore += 0.3;
        }
      }

      // Normalize score to 0-1
      deepfakeScore = Math.min(deepfakeScore, 1.0);
      const confidence = Math.abs(deepfakeScore - 0.5) * 2;

      return {
        isDeepfake: deepfakeScore > 0.5,
        confidence,
        scores: {
          texture: deepfakeScore * 100,
        },
        anomalies,
      };
    });
  }

  /**
   * Multi-modal deepfake detection combining all available modalities
   * 
   * Analyzes 4 dimensions:
   * 1. Visual (CNN + texture + features) - 40% weight
   * 2. Physiological (blood flow/PPG) - 25% weight
   * 3. Audio-Visual (lip-sync) - 25% weight
   * 4. Metadata forensics - 10% weight
   * 
   * Optional: Voice analysis if audio-only file
   */
  async detectMultiModal(options: {
    imageData?: ImageData;
    features?: DeepfakeFeatures;
    faceMesh?: NormalizedLandmark[];
    canvas?: HTMLCanvasElement;
    audioBuffer?: AudioBuffer;
    file?: File;
    timestamp?: number;
  }): Promise<DetectionResult> {
    const { imageData, features, faceMesh, canvas, audioBuffer, file, timestamp } = options;

    const results: {
      visual?: DetectionResult;
      metadata?: MetadataAnalysisResult;
      ppg?: PPGAnalysisResult;
      lipSync?: LipSyncAnalysisResult;
      voice?: VoiceAnalysisResult;
    } = {};

    // 1. Visual Analysis (if image/video available)
    if (imageData) {
      results.visual = await this.detectEnsemble(imageData, features);
    }

    // 2. Metadata Analysis (if file available)
    if (file) {
      const metadataAnalyzer = getMetadataAnalyzer();
      results.metadata = await metadataAnalyzer.analyzeFile(file);
    }

    // 3. Physiological Analysis (if face mesh + canvas available)
    if (faceMesh && canvas && timestamp !== undefined) {
      const ppgAnalyzer = getPPGAnalyzer();
      results.ppg = await ppgAnalyzer.analyzePPG(faceMesh, canvas, timestamp);
    }

    // 4. Lip-Sync Analysis (if face mesh + audio available)
    if (faceMesh && audioBuffer && timestamp !== undefined) {
      const lipSyncAnalyzer = getLipSyncAnalyzer();
      results.lipSync = await lipSyncAnalyzer.analyzeLipSync(faceMesh, audioBuffer, timestamp);
    }

    // 5. Voice Analysis (if audio available)
    if (audioBuffer) {
      const voiceAnalyzer = getVoiceAnalyzer();
      results.voice = await voiceAnalyzer.analyzeVoice(audioBuffer);
    }

    // Combine all results with weighted ensemble
    return this.combineMultiModalResults(results);
  }

  /**
   * Combine multi-modal analysis results with weighted ensemble
   * 
   * Weights:
   * - Visual (CNN + features): 40%
   * - Physiological (PPG): 25%
   * - Audio-Visual (lip-sync): 25%
   * - Metadata: 10%
   * - Voice: 20% (if no video, adjusts weights)
   */
  private combineMultiModalResults(results: {
    visual?: DetectionResult;
    metadata?: MetadataAnalysisResult;
    ppg?: PPGAnalysisResult;
    lipSync?: LipSyncAnalysisResult;
    voice?: VoiceAnalysisResult;
  }): DetectionResult {
    let totalScore = 0;
    let totalWeight = 0;
    const allAnomalies: string[] = [];
    const scores: DetectionResult['scores'] = {};

    // Visual (CNN + texture + features)
    if (results.visual) {
      const weight = 0.4;
      totalScore += results.visual.confidence * weight;
      totalWeight += weight;
      allAnomalies.push(...results.visual.anomalies);
      Object.assign(scores, results.visual.scores);
    }

    // Metadata forensics
    if (results.metadata) {
      const weight = 0.1;
      totalScore += results.metadata.score * weight;
      totalWeight += weight;
      scores.metadata = results.metadata.score * 100;
      allAnomalies.push(...results.metadata.anomalies);
    }

    // Physiological (blood flow/PPG)
    if (results.ppg) {
      const weight = 0.25;
      totalScore += results.ppg.score * weight;
      totalWeight += weight;
      scores.physiological = results.ppg.score * 100;
      allAnomalies.push(...results.ppg.anomalies);
    }

    // Audio-Visual (lip-sync)
    if (results.lipSync) {
      const weight = 0.25;
      totalScore += results.lipSync.score * weight;
      totalWeight += weight;
      scores.lipSync = results.lipSync.score * 100;
      allAnomalies.push(...results.lipSync.anomalies);
    }

    // Voice artifacts (if available)
    if (results.voice) {
      // Adjust weight based on whether we have video
      const weight = results.visual ? 0.15 : 0.4; // Higher weight if audio-only
      totalScore += results.voice.score * weight;
      totalWeight += weight;
      scores.voice = results.voice.score * 100;
      allAnomalies.push(...results.voice.anomalies);
    }

    // Normalize score
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const confidence = Math.abs(finalScore - 0.5) * 2; // Convert to confidence 0-1

    return {
      isDeepfake: finalScore > 0.5,
      confidence,
      scores,
      anomalies: Array.from(new Set(allAnomalies)), // Remove duplicates
      multiModalDetails: {
        metadata: results.metadata,
        ppg: results.ppg,
        lipSync: results.lipSync,
        voice: results.voice,
      },
    };
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

    const allAnomalies = Array.from(
      new Set(results.flatMap(r => r.anomalies))
    );

    const combinedScores: DetectionResult['scores'] = {};
    const scoreKeys = [
      'faceMesh', 
      'texture', 
      'lighting', 
      'temporal', 
      'features',
      'metadata',
      'physiological',
      'lipSync',
      'voice'
    ] as const;

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
