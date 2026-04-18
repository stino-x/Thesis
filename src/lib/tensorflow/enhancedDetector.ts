/**
 * Enhanced Deepfake Detector
 * 
 * Wraps the base detector with advanced features:
 * - Confidence calibration (Platt scaling)
 * - Adversarial attack detection
 * - Partial deepfake localization
 */

import { DetectionResult } from './detector';
import { calibrateEnsemble, getConfidenceInterval, isWellCalibrated, formatCalibratedResult } from '../calibration/confidenceCalibrator';
import { detectAdversarialAttack, getAdversarialRobustnessScore, type AdversarialDetectionResult } from '../adversarial/adversarialDetector';
import { detectPartialDeepfake, type PartialDeepfakeResult } from '../localization/partialDeepfakeDetector';

export interface EnhancedDetectionResult extends DetectionResult {
  // Calibrated confidence
  calibrated: {
    probability: number;
    confidenceInterval: [number, number];
    reliability: number;
    isWellCalibrated: boolean;
    calibrationWarning?: string;
    formattedResult: string;
  };
  
  // Adversarial detection
  adversarial: AdversarialDetectionResult & {
    robustnessScore: number;
    robustnessLevel: 'low' | 'medium' | 'high';
  };
  
  // Partial deepfake detection
  partial: PartialDeepfakeResult;
}

/**
 * Enhance a basic detection result with calibration, adversarial detection, and localization
 */
export function enhanceDetectionResult(
  baseResult: DetectionResult,
  imageData: ImageData,
  faceBbox?: { xMin: number; yMin: number; width: number; height: number },
  faceLandmarks?: Array<{ x: number; y: number }>
): EnhancedDetectionResult {
  // 1. Confidence Calibration
  const calibrationResult = calibrateEnsemble(baseResult.scores);
  const confidenceInterval = getConfidenceInterval(
    calibrationResult.ensembleProbability,
    calibrationResult.reliability
  );
  const calibrationCheck = isWellCalibrated(
    calibrationResult.ensembleProbability,
    calibrationResult.reliability
  );
  
  const calibrated = {
    probability: calibrationResult.ensembleProbability,
    confidenceInterval,
    reliability: calibrationResult.reliability,
    isWellCalibrated: calibrationCheck.isWellCalibrated,
    calibrationWarning: calibrationCheck.reason,
    formattedResult: formatCalibratedResult(
      calibrationResult.ensembleProbability,
      calibrationResult.reliability,
      confidenceInterval
    ),
  };
  
  // 2. Adversarial Attack Detection
  const multiModalAvailable = !!(
    baseResult.multiModalDetails?.ppg ||
    baseResult.multiModalDetails?.lipSync ||
    baseResult.multiModalDetails?.voice
  );
  
  const adversarialResult = detectAdversarialAttack(
    imageData,
    baseResult.scores,
    multiModalAvailable
  );
  
  const robustnessInfo = getAdversarialRobustnessScore(
    baseResult.modelsUsed,
    multiModalAvailable,
    false // defensive transforms not applied by default
  );
  
  const adversarial = {
    ...adversarialResult,
    robustnessScore: robustnessInfo.score,
    robustnessLevel: robustnessInfo.level,
  };
  
  // 3. Partial Deepfake Detection
  const partial = detectPartialDeepfake(
    imageData,
    faceBbox,
    faceLandmarks,
    baseResult.scores
  );
  
  // Combine results
  return {
    ...baseResult,
    calibrated,
    adversarial,
    partial,
  };
}

/**
 * Get a human-readable summary of the enhanced detection
 */
export function getEnhancedSummary(result: EnhancedDetectionResult): string {
  const lines: string[] = [];
  
  // Main verdict
  const verdict = result.isDeepfake ? 'DEEPFAKE' : 'AUTHENTIC';
  lines.push(`Verdict: ${verdict}`);
  lines.push(`Calibrated Probability: ${result.calibrated.formattedResult}`);
  
  // Calibration warnings
  if (!result.calibrated.isWellCalibrated && result.calibrated.calibrationWarning) {
    lines.push(`⚠️ ${result.calibrated.calibrationWarning}`);
  }
  
  // Adversarial warnings
  if (result.adversarial.isAdversarial) {
    lines.push(`⚠️ ADVERSARIAL ATTACK DETECTED (${(result.adversarial.confidence * 100).toFixed(0)}% confidence)`);
    lines.push(`   ${result.adversarial.recommendation}`);
  }
  
  // Partial manipulation
  if (result.partial.hasPartialManipulation) {
    lines.push(`⚠️ PARTIAL MANIPULATION DETECTED: ${result.partial.manipulationType}`);
    lines.push(`   Found ${result.partial.suspiciousRegions.length} suspicious region(s)`);
  }
  
  // Robustness
  lines.push(`Adversarial Robustness: ${result.adversarial.robustnessLevel.toUpperCase()} (${(result.adversarial.robustnessScore * 100).toFixed(0)}%)`);
  
  return lines.join('\n');
}

/**
 * Determine if the detection is trustworthy
 */
export function isTrustworthyDetection(result: EnhancedDetectionResult): {
  trustworthy: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  // Check calibration
  if (!result.calibrated.isWellCalibrated) {
    reasons.push('Confidence not well-calibrated');
  }
  
  // Check for adversarial attack
  if (result.adversarial.isAdversarial) {
    reasons.push('Possible adversarial attack detected');
  }
  
  // Check reliability
  if (result.calibrated.reliability < 0.5) {
    reasons.push('Low model agreement (reliability < 50%)');
  }
  
  // Check robustness
  if (result.adversarial.robustnessLevel === 'low') {
    reasons.push('Low adversarial robustness - single model type');
  }
  
  const trustworthy = reasons.length === 0;
  
  return { trustworthy, reasons };
}
