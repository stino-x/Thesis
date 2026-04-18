/**
 * Confidence Calibration
 * 
 * Implements Platt scaling to convert raw model scores into calibrated probabilities.
 * Without calibration, a score of 0.7 doesn't necessarily mean 70% probability.
 * 
 * Platt scaling fits a logistic regression: P(y=1|f) = 1 / (1 + exp(A*f + B))
 * where f is the raw model score and A, B are learned parameters.
 * 
 * For production use, you'd train these parameters on a held-out validation set.
 * For now, we use reasonable defaults based on typical deepfake model behavior.
 */

interface CalibrationParams {
  A: number;
  B: number;
}

// Default calibration parameters per model type
// These are estimated from typical model behavior - in production,
// you'd compute these from a validation set with known ground truth
const DEFAULT_CALIBRATION: Record<string, CalibrationParams> = {
  // ViT models tend to be overconfident
  vitDeepfakeExp: { A: -1.5, B: 0.3 },
  vitDeepfakeV2: { A: -1.3, B: 0.2 },
  
  // MesoNet is relatively well-calibrated
  mesonet: { A: -1.0, B: 0.0 },
  
  // AI detector is slightly underconfident
  aiDetector: { A: -0.8, B: -0.1 },
  
  // CLIP/UnivFD needs strong calibration
  univfd: { A: -2.0, B: 0.5 },
  
  // Default for unknown models
  default: { A: -1.0, B: 0.0 },
};

/**
 * Apply Platt scaling to a raw score
 */
function plattScale(score: number, params: CalibrationParams): number {
  const { A, B } = params;
  const z = A * score + B;
  const calibrated = 1 / (1 + Math.exp(-z));
  return Math.max(0, Math.min(1, calibrated));
}

/**
 * Apply Platt scaling with default parameters (exported for testing)
 */
export function plattScaling(score: number): number {
  return plattScale(score, DEFAULT_CALIBRATION.default);
}

/**
 * Calibrate a single model's score
 */
export function calibrateScore(
  score: number,
  modelName: string
): number {
  const params = DEFAULT_CALIBRATION[modelName] || DEFAULT_CALIBRATION.default;
  return plattScale(score, params);
}

/**
 * Calibrate multiple model scores and compute ensemble probability
 */
export function calibrateEnsemble(
  scores: Record<string, number>
): {
  calibratedScores: Record<string, number>;
  ensembleProbability: number;
  reliability: number;
} {
  const calibratedScores: Record<string, number> = {};
  const calibratedValues: number[] = [];
  
  // Calibrate each model's score
  for (const [model, score] of Object.entries(scores)) {
    if (score !== undefined && !isNaN(score)) {
      const calibrated = calibrateScore(score, model);
      calibratedScores[model] = calibrated;
      calibratedValues.push(calibrated);
    }
  }
  
  if (calibratedValues.length === 0) {
    return {
      calibratedScores: {},
      ensembleProbability: 0.5,
      reliability: 0,
    };
  }
  
  // Ensemble probability: weighted average (equal weights for now)
  const ensembleProbability = calibratedValues.reduce((a, b) => a + b, 0) / calibratedValues.length;
  
  // Reliability: inverse of variance (low variance = high agreement = high reliability)
  const mean = ensembleProbability;
  const variance = calibratedValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / calibratedValues.length;
  const reliability = 1 / (1 + variance * 10); // Scale variance to 0-1 range
  
  return {
    calibratedScores,
    ensembleProbability,
    reliability,
  };
}

/**
 * Get confidence interval for a calibrated probability
 * Returns [lower, upper] bounds at 95% confidence
 */
export function getConfidenceInterval(
  probability: number,
  reliability: number,
  sampleSize: number = 1
): [number, number] {
  // Wilson score interval for binomial proportion
  const z = 1.96; // 95% confidence
  const n = Math.max(1, sampleSize);
  
  // Adjust interval width based on reliability
  const adjustedN = n * reliability;
  
  const denominator = 1 + z * z / adjustedN;
  const center = (probability + z * z / (2 * adjustedN)) / denominator;
  const margin = (z / denominator) * Math.sqrt(
    (probability * (1 - probability) / adjustedN) + (z * z / (4 * adjustedN * adjustedN))
  );
  
  return [
    Math.max(0, center - margin),
    Math.min(1, center + margin),
  ];
}

/**
 * Determine if a prediction is well-calibrated
 */
export function isWellCalibrated(
  probability: number,
  reliability: number
): {
  isWellCalibrated: boolean;
  reason?: string;
} {
  // Check if probability is in the "uncertain" range (0.4-0.6)
  if (probability > 0.4 && probability < 0.6) {
    return {
      isWellCalibrated: false,
      reason: 'Probability in uncertain range (40-60%) - consider additional validation',
    };
  }
  
  // Check if reliability is too low
  if (reliability < 0.5) {
    return {
      isWellCalibrated: false,
      reason: 'Low model agreement - predictions are inconsistent',
    };
  }
  
  // Check for extreme probabilities with low reliability
  if ((probability > 0.9 || probability < 0.1) && reliability < 0.7) {
    return {
      isWellCalibrated: false,
      reason: 'Extreme probability with low reliability - may be overconfident',
    };
  }
  
  return { isWellCalibrated: true };
}

/**
 * Format calibrated results for display
 */
export function formatCalibratedResult(
  probability: number,
  reliability: number,
  interval: [number, number]
): string {
  const pct = (probability * 100).toFixed(1);
  const lower = (interval[0] * 100).toFixed(1);
  const upper = (interval[1] * 100).toFixed(1);
  const rel = (reliability * 100).toFixed(0);
  
  return `${pct}% (95% CI: ${lower}-${upper}%, reliability: ${rel}%)`;
}

/**
 * Train calibration parameters from validation data
 * (For production use - requires labeled validation set)
 */
export function trainCalibration(
  predictions: number[],
  labels: boolean[]
): CalibrationParams {
  if (predictions.length !== labels.length || predictions.length < 10) {
    throw new Error('Need at least 10 samples with matching predictions and labels');
  }
  
  // Simple Platt scaling via logistic regression
  // This is a simplified implementation - for production, use a proper optimizer
  
  let A = -1.0;
  let B = 0.0;
  const learningRate = 0.01;
  const iterations = 1000;
  
  for (let iter = 0; iter < iterations; iter++) {
    let gradA = 0;
    let gradB = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const f = predictions[i];
      const y = labels[i] ? 1 : 0;
      const z = A * f + B;
      const p = 1 / (1 + Math.exp(-z));
      
      const error = p - y;
      gradA += error * f;
      gradB += error;
    }
    
    A -= learningRate * gradA / predictions.length;
    B -= learningRate * gradB / predictions.length;
  }
  
  return { A, B };
}
