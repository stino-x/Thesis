// Type definitions for the deepfake detection app

export interface DetectionResult {
  isDeepfake: boolean;
  confidence: number;
  timestamp: number;
  faceDetected: boolean;
}

export interface FaceDetectionResult {
  detected: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: Array<{ x: number; y: number }>;
}

export interface VideoSource {
  type: 'upload' | 'webcam';
  stream?: MediaStream;
  file?: File;
}

export interface ModelConfig {
  modelPath?: string;
  threshold: number;
  minConfidence: number;
}
