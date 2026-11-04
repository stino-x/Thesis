/**
 * MediaPipe Face Mesh Module
 * 
 * Provides 468 facial landmarks for detailed analysis
 * Core component for deepfake detection
 * 
 * Using MediaPipe Tasks Vision API (new, stable)
 */

import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceMeshResult {
  detected: boolean;
  landmarks?: Landmark[];
  multiFaceLandmarks?: Landmark[][];
}

export class FaceMeshDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitialized = false;
  private initError: Error | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize MediaPipe Face Landmarker (Tasks Vision API)
   */
  private async initialize(): Promise<void> {
    try {
      // Load WASM files from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create face landmarker
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      this.isInitialized = true;
      console.log('✅ MediaPipe Face Landmarker (Tasks API) initialized');
    } catch (error) {
      console.error('Failed to initialize Face Mesh:', error);
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
   * Detect face mesh landmarks
   */
  async detect(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<FaceMeshResult> {
    if (!this.faceLandmarker || !this.isInitialized) {
      await this.waitForInitialization();
    }

    if (!this.faceLandmarker) {
      return { detected: false };
    }

    try {
      const results: FaceLandmarkerResult = this.faceLandmarker.detect(input);

      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        return { detected: false };
      }

      // Convert to the expected format
      const landmarks: Landmark[] = results.faceLandmarks[0].map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z || 0,
      }));

      const multiFaceLandmarks: Landmark[][] = results.faceLandmarks.map(face =>
        face.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 }))
      );

      return {
        detected: true,
        landmarks,
        multiFaceLandmarks,
      };
    } catch (error) {
      console.error('Face mesh detection error:', error);
      return { detected: false };
    }
  }

  /**
   * Get specific landmark indices
   */
  getLandmarkIndices(): {
    leftEye: number[];
    rightEye: number[];
    nose: number[];
    mouth: number[];
    faceOval: number[];
    leftIris: number[];
    rightIris: number[];
  } {
    return {
      leftEye: [33, 160, 158, 133, 153, 144],
      rightEye: [362, 385, 387, 263, 373, 380],
      nose: [1, 2, 98, 327],
      mouth: [61, 291, 0, 17, 269, 405],
      faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
      leftIris: [468, 469, 470, 471, 472],
      rightIris: [473, 474, 475, 476, 477],
    };
  }

  /**
   * Extract eye landmarks
   */
  getEyeLandmarks(landmarks: Landmark[]): {
    leftEye: Landmark[];
    rightEye: Landmark[];
    leftIris: Landmark[];
    rightIris: Landmark[];
  } {
    const indices = this.getLandmarkIndices();
    return {
      leftEye: indices.leftEye.map(i => landmarks[i]),
      rightEye: indices.rightEye.map(i => landmarks[i]),
      leftIris: indices.leftIris.map(i => landmarks[i]),
      rightIris: indices.rightIris.map(i => landmarks[i]),
    };
  }

  /**
   * Calculate eye aspect ratio (for blink detection)
   */
  calculateEyeAspectRatio(eyeLandmarks: Landmark[]): number {
    // Vertical eye distances
    const v1 = Math.hypot(
      eyeLandmarks[1].x - eyeLandmarks[5].x,
      eyeLandmarks[1].y - eyeLandmarks[5].y
    );
    const v2 = Math.hypot(
      eyeLandmarks[2].x - eyeLandmarks[4].x,
      eyeLandmarks[2].y - eyeLandmarks[4].y
    );
    
    // Horizontal eye distance
    const h = Math.hypot(
      eyeLandmarks[0].x - eyeLandmarks[3].x,
      eyeLandmarks[0].y - eyeLandmarks[3].y
    );
    
    return (v1 + v2) / (2.0 * h);
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance
let faceMeshInstance: FaceMeshDetector | null = null;

export const getFaceMesh = (): FaceMeshDetector => {
  if (!faceMeshInstance) {
    faceMeshInstance = new FaceMeshDetector();
  }
  return faceMeshInstance;
};
