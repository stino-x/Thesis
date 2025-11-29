/**
 * Mathematical Utilities for Deepfake Detection
 * 
 * Provides common mathematical operations for:
 * - Distance calculations
 * - Confidence scoring
 * - Statistical analysis
 * - Normalization
 */

/**
 * Calculate Euclidean distance between two points
 */
export const euclideanDistance = (
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate mean of an array of numbers
 */
export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Calculate standard deviation
 */
export const standardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  return Math.sqrt(mean(squareDiffs));
};

/**
 * Normalize value to 0-1 range
 */
export const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

/**
 * Clamp value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Calculate moving average
 */
export const movingAverage = (
  values: number[],
  windowSize: number = 5
): number[] => {
  if (values.length < windowSize) return values;
  
  const result: number[] = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    result.push(mean(window));
  }
  return result;
};

/**
 * Calculate confidence score from multiple metrics
 */
export const calculateConfidence = (metrics: {
  faceMeshScore?: number;
  textureScore?: number;
  lightingScore?: number;
  temporalScore?: number;
  irisScore?: number;
}): number => {
  const scores = Object.values(metrics).filter(s => s !== undefined) as number[];
  if (scores.length === 0) return 0;
  
  // Weighted average with higher weight on face mesh
  const weights = {
    faceMeshScore: 0.3,
    textureScore: 0.25,
    lightingScore: 0.2,
    temporalScore: 0.15,
    irisScore: 0.1,
  };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  Object.entries(metrics).forEach(([key, value]) => {
    if (value !== undefined) {
      const weight = weights[key as keyof typeof weights] || 0.2;
      weightedSum += value * weight;
      totalWeight += weight;
    }
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

/**
 * Detect outliers using IQR method
 */
export const detectOutliers = (values: number[]): boolean[] => {
  if (values.length < 4) return values.map(() => false);
  
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return values.map(val => val < lowerBound || val > upperBound);
};

/**
 * Calculate variance
 */
export const variance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return mean(values.map(val => Math.pow(val - avg, 2)));
};

/**
 * Linear interpolation
 */
export const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * clamp(t, 0, 1);
};

/**
 * Smooth step interpolation
 */
export const smoothstep = (start: number, end: number, t: number): number => {
  const x = clamp((t - start) / (end - start), 0, 1);
  return x * x * (3 - 2 * x);
};
