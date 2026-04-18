/**
 * Temporal Consistency Analyzer
 *
 * Frame-level models (ViT, MesoNet) analyze each frame independently and
 * miss artifacts that only appear across time — flickering identity, unstable
 * blending boundaries, and inconsistent lighting between frames.
 *
 * This module maintains a sliding window of the last N frame scores and
 * computes several temporal signals:
 *
 *  1. Score variance  — real faces are consistent; deepfakes flicker
 *  2. Flip rate       — how often the verdict flips real↔fake
 *  3. Trend detection — a rising score trend suggests progressive degradation
 *  4. Outlier frames  — single frames that spike far above the window mean
 *
 * The output is a 0-1 deepfake probability that can be fed into the ensemble
 * as an additional Group C signal.
 */

export interface TemporalFrame {
  score: number;       // raw deepfake probability from any model (0-1)
  isDeepfake: boolean;
  timestamp: number;
}

export interface TemporalAnalysisResult {
  score: number;       // 0-1, higher = more likely deepfake
  confidence: number;
  anomalies: string[];
  details: {
    windowSize: number;
    scoreVariance: number;
    flipRate: number;
    outlierCount: number;
    trendSlope: number;   // positive = scores rising over time
    meanScore: number;
  };
}

export class TemporalConsistencyAnalyzer {
  private readonly windowSize: number;
  private window: TemporalFrame[] = [];

  constructor(windowSize = 8) {
    this.windowSize = windowSize;
  }

  /** Add a frame result and get the current temporal analysis */
  addFrame(frame: TemporalFrame): TemporalAnalysisResult {
    this.window.push(frame);
    if (this.window.length > this.windowSize) this.window.shift();
    return this.analyze();
  }

  /** Analyze the current window */
  analyze(): TemporalAnalysisResult {
    const n = this.window.length;

    if (n < 3) {
      return {
        score: 0, confidence: 0,
        anomalies: ['insufficient_frames'],
        details: { windowSize: n, scoreVariance: 0, flipRate: 0, outlierCount: 0, trendSlope: 0, meanScore: 0 },
      };
    }

    const scores   = this.window.map(f => f.score);
    const verdicts = this.window.map(f => f.isDeepfake);

    // ── 1. Score variance ──────────────────────────────────────────────────
    const mean     = scores.reduce((s, v) => s + v, 0) / n;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

    // ── 2. Flip rate ───────────────────────────────────────────────────────
    let flips = 0;
    for (let i = 1; i < n; i++) {
      if (verdicts[i] !== verdicts[i - 1]) flips++;
    }
    const flipRate = flips / (n - 1);

    // ── 3. Outlier frames ──────────────────────────────────────────────────
    const std = Math.sqrt(variance);
    const outlierCount = scores.filter(s => Math.abs(s - mean) > 2 * std).length;

    // ── 4. Linear trend (least-squares slope) ─────────────────────────────
    const xs = scores.map((_, i) => i);
    const xMean = (n - 1) / 2;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (scores[i] - mean);
      den += (xs[i] - xMean) ** 2;
    }
    const trendSlope = den === 0 ? 0 : num / den;

    // ── Scoring ────────────────────────────────────────────────────────────
    const anomalies: string[] = [];
    let deepfakeScore = 0;

    // High variance = flickering = deepfake artifact
    if (variance > 0.08) {
      anomalies.push('high_temporal_variance');
      deepfakeScore += 0.35;
    } else if (variance > 0.04) {
      anomalies.push('moderate_temporal_variance');
      deepfakeScore += 0.15;
    }

    // Frequent verdict flips = unstable detection = likely deepfake
    if (flipRate > 0.5) {
      anomalies.push('frequent_verdict_flips');
      deepfakeScore += 0.3;
    } else if (flipRate > 0.3) {
      anomalies.push('occasional_verdict_flips');
      deepfakeScore += 0.15;
    }

    // Outlier frames spike = blending boundary artifact
    if (outlierCount >= 2) {
      anomalies.push('temporal_outlier_frames');
      deepfakeScore += 0.2;
    }

    // Rising trend = degrading over time (common in long deepfake videos)
    if (trendSlope > 0.03) {
      anomalies.push('rising_deepfake_score_trend');
      deepfakeScore += 0.15;
    }

    // High mean score across the window
    if (mean > 0.65) {
      deepfakeScore += 0.2;
    }

    const confidence = Math.min(n / this.windowSize, 1.0) * 0.9; // grows as window fills

    return {
      score: Math.min(deepfakeScore, 1.0),
      confidence,
      anomalies,
      details: { windowSize: n, scoreVariance: variance, flipRate, outlierCount, trendSlope, meanScore: mean },
    };
  }

  reset(): void {
    this.window = [];
  }
}

// Singleton
let instance: TemporalConsistencyAnalyzer | null = null;
export const getTemporalAnalyzer = (): TemporalConsistencyAnalyzer => {
  if (!instance) instance = new TemporalConsistencyAnalyzer(8);
  return instance;
};
