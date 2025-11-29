/**
 * MediaPipe Face Detection Module
 * 
 * Detects faces and provides bounding boxes
 * First step in the detection pipeline
 */

import { FaceDetection } from '@mediapipe/face_detection';

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
  private faceDetection: FaceDetection | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize MediaPipe Face Detection
   */
  private async initialize(): Promise<void> {
    try {
      this.faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        },
      });

      this.faceDetection.setOptions({
        model: 'short', // 'short' for close-range, 'full' for longer range
        minDetectionConfidence: 0.5,
      });

      await this.faceDetection.initialize();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Face Detection:', error);
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
   * Detect faces in image
   */
  async detect(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<FaceDetectionResult[]> {
    if (!this.faceDetection || !this.isInitialized) {
      await this.waitForInitialization();
    }

    return new Promise((resolve) => {
      this.faceDetection!.onResults((results: any) => {
        if (!results.detections || results.detections.length === 0) {
          resolve([{ detected: false }]);
          return;
        }

        const detections = results.detections.map((detection: any) => {
          const bbox = detection.boundingBox;
          return {
            detected: true,
            boundingBox: {
              xMin: bbox.xMin,
              yMin: bbox.yMin,
              width: bbox.width,
              height: bbox.height,
            },
            score: detection.score[0],
          };
        });

        resolve(detections);
      });

      this.faceDetection!.send({ image: input }).catch((error: any) => {
        console.error('Face detection error:', error);
        resolve([{ detected: false }]);
      });
    });
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.faceDetection) {
      this.faceDetection.close();
      this.faceDetection = null;
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
