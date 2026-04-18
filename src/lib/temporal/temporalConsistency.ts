/**
 * Temporal Consistency Analyzer
 *
 * Frame-level models (ViT, MesoNet) analyze each frame independently and
 * miss artifacts that only appear across time — flickering identity, unstable
 * blending boundaries, and inconsistent lighting between frames.
 *
 * Uses an adaptive sliding window:
 *  - Default: 8 frames (4s at 0.5s intervals) — fast warmup
 *  - Extended: up to 24 frames when enough data is available — catches
 *    slow gradual degradation that an 8-frame window misses
 *
 * Signals computed over the window:
 *  1. Score variance  — real faces are consistent; deepfakes flicker
 *  2. Flip rate       — how often the verdict flips real↔fake
 *  3. Trend detection — rising score = progressive degradation
 *  4. Outlier frames  — single frames spiking far above window mean
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
  // Keep a long history; analysis uses an adaptive window over the tail
  private readonly maxHistory = 64;
  private readonly minWindow  = 8;   // minimum frames before producing a result
  private readonly maxWindow  = 24;  // maximum window for slow-degradation detection
  private history: TemporalFrame[] = [];

  /** Add a frame result and get the current temporal analysis */
  addFrame(frame: TemporalFrame): TemporalAnalysisResult {
    this.history.push(frame);
    if (this.history.length > this.maxHistory) this.history.shift();
    return this.analyze();
  }

  /** Analyze using an adaptive window over the most recent frames */
  analyze(): TemporalAnalysisResult {
    const total = this.history.length;

    if (total < 3) {
      return {
        score: 0, confidence: 0,
        anomalies: ['insufficient_frames'],
        details: { windowSize: total, scoreVariance: 0, flipRate: 0, outlierCount: 0, trendSlope: 0, meanScore: 0 },
      };
    }

    // Adaptive window: use more frames as history grows, up to maxWindow
    const windowSize = Math.min(Math.max(total, this.minWindow), this.maxWindow);
    const window     = this.history.slice(-windowSize);
    const n          = window.length;

    const scores   = window.map(f => f.score);
    const verdicts = window.map(f => f.isDeepfake);

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
    const std          = Math.sqrt(variance);
    const outlierCount = scores.filter(s => Math.abs(s - mean) > 2 * std).length;

    // ── 4. Linear trend (least-squares slope) ─────────────────────────────
    const xMean = (n - 1) / 2;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (scores[i] - mean);
      den += (i - xMean) ** 2;
    }
    const trendSlope = den === 0 ? 0 : num / den;

    // ── Scoring ────────────────────────────────────────────────────────────
    const anomalies: string[] = [];
    let deepfakeScore = 0;

    if (variance > 0.08) {
      anomalies.push('high_temporal_variance');
      deepfakeScore += 0.35;
    } else if (variance > 0.04) {
      anomalies.push('moderate_temporal_variance');
      deepfakeScore += 0.15;
    }

    if (flipRate > 0.5) {
      anomalies.push('frequent_verdict_flips');
      deepfakeScore += 0.3;
    } else if (flipRate > 0.3) {
      anomalies.push('occasional_verdict_flips');
      deepfakeScore += 0.15;
    }

    if (outlierCount >= 2) {
      anomalies.push('temporal_outlier_frames');
      deepfakeScore += 0.2;
    }

    // Rising trend — more meaningful with a longer window
    if (trendSlope > 0.03) {
      anomalies.push('rising_deepfake_score_trend');
      deepfakeScore += 0.15;
    }

    if (mean > 0.65) {
      deepfakeScore += 0.2;
    }

    // Confidence grows as window fills toward maxWindow
    const confidence = Math.min(n / this.maxWindow, 1.0) * 0.9;

    return {
      score: Math.min(deepfakeScore, 1.0),
      confidence,
      anomalies,
      details: { windowSize: n, scoreVariance: variance, flipRate, outlierCount, trendSlope, meanScore: mean },
    };
  }

  reset(): void {
    this.history = [];
  }
}

// Singleton
let instance: TemporalConsistencyAnalyzer | null = null;
export const getTemporalAnalyzer = (): TemporalConsistencyAnalyzer => {
  if (!instance) instance = new TemporalConsistencyAnalyzer();
  return instance;
};
