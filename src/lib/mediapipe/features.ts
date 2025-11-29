/**
 * MediaPipe Feature Extraction
 * 
 * Extracts deepfake detection features from MediaPipe landmarks:
 * - Blink rate analysis
 * - Micro-movement detection
 * - Landmark consistency
 * - Temporal anomalies
 */

import { Landmark } from './faceMesh';
import { euclideanDistance, mean, standardDeviation } from '@/utils/mathUtils';

export interface DeepfakeFeatures {
  blinkRate: number;
  eyeAspectRatio: number;
  landmarkJitter: number;
  faceSymmetry: number;
  mouthMovement: number;
  headPoseStability: number;
}

/**
 * Calculate blink rate from eye landmarks over time
 */
export class BlinkDetector {
  private earHistory: number[] = [];
  private blinkCount: number = 0;
  private readonly EAR_THRESHOLD = 0.21;
  private readonly CONSECUTIVE_FRAMES = 2;
  private framesBelowThreshold = 0;

  addFrame(leftEyeEAR: number, rightEyeEAR: number): void {
    const avgEAR = (leftEyeEAR + rightEyeEAR) / 2;
    this.earHistory.push(avgEAR);

    // Keep only last 300 frames (10 seconds at 30fps)
    if (this.earHistory.length > 300) {
      this.earHistory.shift();
    }

    // Detect blink
    if (avgEAR < this.EAR_THRESHOLD) {
      this.framesBelowThreshold++;
    } else {
      if (this.framesBelowThreshold >= this.CONSECUTIVE_FRAMES) {
        this.blinkCount++;
      }
      this.framesBelowThreshold = 0;
    }
  }

  getBlinkRate(): number {
    // Blinks per minute
    const timeInMinutes = this.earHistory.length / (30 * 60); // Assuming 30 fps
    return timeInMinutes > 0 ? this.blinkCount / timeInMinutes : 0;
  }

  getAverageEAR(): number {
    return mean(this.earHistory);
  }

  reset(): void {
    this.earHistory = [];
    this.blinkCount = 0;
    this.framesBelowThreshold = 0;
  }
}

/**
 * Detect landmark jitter (instability in landmarks)
 */
export class JitterDetector {
  private landmarkHistory: Landmark[][] = [];
  private readonly MAX_HISTORY = 30; // Last 30 frames

  addFrame(landmarks: Landmark[]): void {
    this.landmarkHistory.push([...landmarks]);

    if (this.landmarkHistory.length > this.MAX_HISTORY) {
      this.landmarkHistory.shift();
    }
  }

  calculateJitter(): number {
    if (this.landmarkHistory.length < 2) return 0;

    const movements: number[] = [];

    for (let i = 1; i < this.landmarkHistory.length; i++) {
      const prev = this.landmarkHistory[i - 1];
      const curr = this.landmarkHistory[i];

      let totalMovement = 0;
      for (let j = 0; j < prev.length; j++) {
        totalMovement += euclideanDistance(
          { x: prev[j].x, y: prev[j].y },
          { x: curr[j].x, y: curr[j].y }
        );
      }

      movements.push(totalMovement / prev.length);
    }

    return standardDeviation(movements);
  }

  reset(): void {
    this.landmarkHistory = [];
  }
}

/**
 * Analyze face symmetry
 */
export const analyzeFaceSymmetry = (landmarks: Landmark[]): number => {
  // Compare left and right sides of face
  const leftSide = [33, 160, 158, 133, 153, 144]; // Left eye
  const rightSide = [362, 385, 387, 263, 373, 380]; // Right eye

  const leftPoints = leftSide.map(i => landmarks[i]);
  const rightPoints = rightSide.map(i => landmarks[i]);

  // Calculate center of face (nose tip)
  const center = landmarks[1];

  let asymmetryScore = 0;

  for (let i = 0; i < leftPoints.length; i++) {
    const leftDist = euclideanDistance(
      { x: leftPoints[i].x, y: leftPoints[i].y },
      { x: center.x, y: center.y }
    );
    const rightDist = euclideanDistance(
      { x: rightPoints[i].x, y: rightPoints[i].y },
      { x: center.x, y: center.y }
    );

    asymmetryScore += Math.abs(leftDist - rightDist);
  }

  // Normalize (lower score = more symmetric)
  return 1 - Math.min(asymmetryScore / leftPoints.length, 1);
};

/**
 * Analyze mouth movement
 */
export class MouthMovementAnalyzer {
  private mouthDistanceHistory: number[] = [];
  private readonly MAX_HISTORY = 90; // 3 seconds at 30fps

  addFrame(landmarks: Landmark[]): void {
    // Upper and lower lip landmarks
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];

    const distance = euclideanDistance(
      { x: upperLip.x, y: upperLip.y },
      { x: lowerLip.x, y: lowerLip.y }
    );

    this.mouthDistanceHistory.push(distance);

    if (this.mouthDistanceHistory.length > this.MAX_HISTORY) {
      this.mouthDistanceHistory.shift();
    }
  }

  getMovementScore(): number {
    if (this.mouthDistanceHistory.length < 2) return 0;
    return standardDeviation(this.mouthDistanceHistory);
  }

  reset(): void {
    this.mouthDistanceHistory = [];
  }
}

/**
 * Analyze head pose stability
 */
export class HeadPoseAnalyzer {
  private poseHistory: { roll: number; pitch: number; yaw: number }[] = [];
  private readonly MAX_HISTORY = 60; // 2 seconds at 30fps

  addFrame(landmarks: Landmark[]): void {
    // Estimate head pose from landmarks
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    // Simple pose estimation
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const yaw = nose.x - eyeCenter.x;
    const pitch = nose.y - eyeCenter.y;

    this.poseHistory.push({ roll, pitch, yaw });

    if (this.poseHistory.length > this.MAX_HISTORY) {
      this.poseHistory.shift();
    }
  }

  getStabilityScore(): number {
    if (this.poseHistory.length < 2) return 1;

    const rollStd = standardDeviation(this.poseHistory.map(p => p.roll));
    const pitchStd = standardDeviation(this.poseHistory.map(p => p.pitch));
    const yawStd = standardDeviation(this.poseHistory.map(p => p.yaw));

    const avgStd = (rollStd + pitchStd + yawStd) / 3;

    // Lower standard deviation = more stable = higher score
    return Math.max(0, 1 - avgStd * 10);
  }

  reset(): void {
    this.poseHistory = [];
  }
}

/**
 * Feature aggregator - combines all features
 */
export class FeatureAggregator {
  private blinkDetector = new BlinkDetector();
  private jitterDetector = new JitterDetector();
  private mouthAnalyzer = new MouthMovementAnalyzer();
  private headPoseAnalyzer = new HeadPoseAnalyzer();

  processFrame(landmarks: Landmark[], leftEyeEAR: number, rightEyeEAR: number): void {
    this.blinkDetector.addFrame(leftEyeEAR, rightEyeEAR);
    this.jitterDetector.addFrame(landmarks);
    this.mouthAnalyzer.addFrame(landmarks);
    this.headPoseAnalyzer.addFrame(landmarks);
  }

  getFeatures(landmarks: Landmark[]): DeepfakeFeatures {
    return {
      blinkRate: this.blinkDetector.getBlinkRate(),
      eyeAspectRatio: this.blinkDetector.getAverageEAR(),
      landmarkJitter: this.jitterDetector.calculateJitter(),
      faceSymmetry: analyzeFaceSymmetry(landmarks),
      mouthMovement: this.mouthAnalyzer.getMovementScore(),
      headPoseStability: this.headPoseAnalyzer.getStabilityScore(),
    };
  }

  reset(): void {
    this.blinkDetector.reset();
    this.jitterDetector.reset();
    this.mouthAnalyzer.reset();
    this.headPoseAnalyzer.reset();
  }
}
