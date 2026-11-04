/**
 * MediaPipe Face Detection Module
 * 
 * Detects faces and provides bounding boxes
 * First step in the detection pipeline
 * 
 * Using MediaPipe Tasks Vision API (new, stable)
 */

import { FaceDetector as MediaPipeFaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceDetectionResult {
  detected: boolean;
  boundingBox?: {
    xMin: number;
    yMin: number;
    width: number;
    height: number;
  };
  score?: number;
}

export class FaceDetector {
  private faceDetector: MediaPipeFaceDetector | null = null;
  private isInitialized = false;
  private initError: Error | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize MediaPipe Face Detection (Tasks Vision API)
   */
  private async initialize(): Promise<void> {
    try {
      // Load WASM files from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create face detector
      this.faceDetector = await MediaPipeFaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.3,
      });

      this.isInitialized = true;
      console.log('✅ MediaPipe Face Detection (Tasks API) initialized');
    } catch (error) {
      console.error('Failed to initialize Face Detection:', error);
      this.initError = error as Error;
      this.isInitialized = true; // Mark as initialized to prevent hanging
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
    if (this.initError) {
      throw this.initError;
    }
  }

  /**
   * Detect faces in image
   */
  async detect(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<FaceDetectionResult[]> {
    if (!this.faceDetector || !this.isInitialized) {
      await this.waitForInitialization();
    }

    if (!this.faceDetector) {
      return [{ detected: false }];
    }

    try {
      const results = this.faceDetector.detect(input);

      if (!results.detections || results.detections.length === 0) {
        return [{ detected: false }];
      }

      return results.detections.map((detection) => {
        const bbox = detection.boundingBox;
        return {
          detected: true,
          boundingBox: {
            xMin: bbox.originX / (input.width || 1),
            yMin: bbox.originY / (input.height || 1),
            width: bbox.width / (input.width || 1),
            height: bbox.height / (input.height || 1),
          },
          score: detection.categories[0]?.score || 0,
        };
      });
    } catch (error) {
      console.error('Face detection error:', error);
      return [{ detected: false }];
    }
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.faceDetector) {
      this.faceDetector.close();
      this.faceDetector = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance
let faceDetectorInstance: FaceDetector | null = null;

export const getFaceDetector = (): FaceDetector => {
  if (!faceDetectorInstance) {
    faceDetectorInstance = new FaceDetector();
  }
  return faceDetectorInstance;
};
