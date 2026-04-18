/**
 * Audio-Visual Lip-Sync Analysis Module
 *
 * Detects deepfakes by correlating lip movements with phoneme boundaries
 * rather than raw audio energy. Dubbed content where energy timing happens
 * to match will fool an RMS-only approach; phoneme onset detection is
 * significantly harder to accidentally satisfy.
 *
 * Pipeline:
 *  1. Extract lip openness time-series from MediaPipe landmarks
 *  2. Detect phoneme onsets from audio via spectral flux + zero-crossing rate
 *  3. Detect lip-movement onsets (local maxima in openness derivative)
 *  4. Align onset sequences and compute a match score
 *  5. Flag mismatches as deepfake indicators
 */

type NormalizedLandmark = { x: number; y: number; z: number };
type NormalizedLandmarkList = NormalizedLandmark[];

export interface LipSyncAnalysisResult {
  score: number;       // 0-1, higher = more suspicious
  confidence: number;
  anomalies: string[];
  details: {
    syncScore: number;
    audioPresent: boolean;
    lipMovementDetected: boolean;
    correlationScore: number;
    phonemeOnsets: number;
    lipOnsets: number;
    matchedOnsets: number;
  };
}

interface LipMovement {
  openness: number;
  width: number;
  timestamp: number;
}

interface AudioFeature {
  energy: number;
  spectralFlux: number;  // frame-to-frame spectral change — phoneme onset proxy
  zcr: number;           // zero-crossing rate — voiced/unvoiced boundary
  timestamp: number;
}

export class LipSyncAnalyzer {
  private lipHistory: LipMovement[]   = [];
  private audioHistory: AudioFeature[] = [];
  private audioContext: AudioContext | null = null;
  private readonly maxSamples = 150;
  private readonly fftSize = 2048;

  // MediaPipe lip landmark indices
  private readonly lipLandmarks = {
    upper: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    lower: [146, 91, 181, 84, 17, 314, 405, 321, 375],
    outer: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88],
  };

  async analyzeLipSync(
    faceMesh: NormalizedLandmarkList,
    audioBuffer: AudioBuffer | null,
    timestamp: number = Date.now()
  ): Promise<LipSyncAnalysisResult> {
    const anomalies: string[] = [];
    let score = 0;

    // Accumulate lip movement
    const lip = this.extractLipMovement(faceMesh, timestamp);
    if (lip) {
      this.lipHistory.push(lip);
      if (this.lipHistory.length > this.maxSamples) this.lipHistory.shift();
    }

    // Accumulate audio features
    if (audioBuffer) {
      const af = this.extractAudioFeatures(audioBuffer, timestamp);
      if (af) {
        this.audioHistory.push(af);
        if (this.audioHistory.length > this.maxSamples) this.audioHistory.shift();
      }
    }

    if (this.lipHistory.length < 15) {
      return {
        score: 0, confidence: 0,
        anomalies: ['insufficient_data'],
        details: { syncScore: 0, audioPresent: !!audioBuffer, lipMovementDetected: false, correlationScore: 0, phonemeOnsets: 0, lipOnsets: 0, matchedOnsets: 0 },
      };
    }

    const lipMovementDetected = this.detectLipMovement();

    if (this.audioHistory.length >= 15 && audioBuffer) {
      // ── Phoneme-boundary sync ──────────────────────────────────────────────
      const phonemeOnsets = this.detectPhonemeOnsets();
      const lipOnsets     = this.detectLipOnsets();
      const matchedOnsets = this.matchOnsets(phonemeOnsets, lipOnsets);

      const totalOnsets = Math.max(phonemeOnsets.length, lipOnsets.length, 1);
      const onsetMatchRate = matchedOnsets / totalOnsets;

      // ── RMS correlation (secondary signal) ────────────────────────────────
      const rmsCorrelation = this.calculateRMSCorrelation();

      // Combine: phoneme match is primary, RMS is secondary
      const syncScore = onsetMatchRate * 0.7 + rmsCorrelation * 0.3;

      if (syncScore < 0.25) {
        anomalies.push('poor_phoneme_lip_sync');
        score += 0.65;
      } else if (syncScore < 0.45) {
        anomalies.push('weak_phoneme_lip_sync');
        score += 0.35;
      }

      // Lip moving but no speech onsets
      const avgLip   = this.lipHistory.reduce((s, l) => s + l.openness, 0) / this.lipHistory.length;
      const avgEnergy = this.audioHistory.reduce((s, a) => s + a.energy, 0) / this.audioHistory.length;

      if (avgLip > 0.3 && avgEnergy < 0.05) {
        anomalies.push('lip_movement_without_audio');
        score += 0.4;
      }
      if (avgEnergy > 0.3 && avgLip < 0.05) {
        anomalies.push('audio_without_lip_movement');
        score += 0.5;
      }

      // Many phoneme onsets but very few lip onsets = dubbed audio
      if (phonemeOnsets.length > 5 && lipOnsets.length < 2) {
        anomalies.push('dubbed_audio_suspected');
        score += 0.4;
      }

      return {
        score: Math.min(score, 1.0),
        confidence: 0.8,
        anomalies,
        details: {
          syncScore,
          audioPresent: true,
          lipMovementDetected,
          correlationScore: rmsCorrelation,
          phonemeOnsets: phonemeOnsets.length,
          lipOnsets: lipOnsets.length,
          matchedOnsets,
        },
      };
    }

    // No audio — check for unnatural lip movement patterns
    if (lipMovementDetected) {
      const lipVariance = this.calculateLipVariance();
      if (lipVariance < 0.01) { anomalies.push('unnaturally_smooth_lip_movement'); score += 0.3; }
      if (lipVariance > 0.5)  { anomalies.push('erratic_lip_movement'); score += 0.2; }
    }

    return {
      score: Math.min(score, 1.0),
      confidence: 0.4,
      anomalies,
      details: { syncScore: 0, audioPresent: false, lipMovementDetected, correlationScore: 0, phonemeOnsets: 0, lipOnsets: 0, matchedOnsets: 0 },
    };
  }

  // ── Lip movement extraction ────────────────────────────────────────────────

  private extractLipMovement(faceMesh: NormalizedLandmarkList, timestamp: number): LipMovement | null {
    const upper = this.lipLandmarks.upper.map(i => faceMesh[i]).filter(Boolean);
    const lower = this.lipLandmarks.lower.map(i => faceMesh[i]).filter(Boolean);
    if (!upper.length || !lower.length) return null;

    const upperY = upper.reduce((s, l) => s + l.y, 0) / upper.length;
    const lowerY = lower.reduce((s, l) => s + l.y, 0) / lower.length;
    const openness = Math.abs(lowerY - upperY);

    const outer = this.lipLandmarks.outer.map(i => faceMesh[i]).filter(Boolean);
    const xs = outer.map(l => l.x);
    const width = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;

    return { openness, width, timestamp };
  }

  // ── Audio feature extraction ───────────────────────────────────────────────

  private extractAudioFeatures(audioBuffer: AudioBuffer, timestamp: number): AudioFeature | null {
    try {
      const data = audioBuffer.getChannelData(0);
      const n    = data.length;

      // RMS energy
      let sumSq = 0;
      for (let i = 0; i < n; i++) sumSq += data[i] * data[i];
      const energy = Math.sqrt(sumSq / n);

      // Zero-crossing rate — high ZCR = fricative/unvoiced consonant onset
      let zcr = 0;
      for (let i = 1; i < n; i++) {
        if ((data[i] >= 0) !== (data[i - 1] >= 0)) zcr++;
      }
      zcr /= n;

      // Spectral flux via simple magnitude difference (DFT-free approximation)
      // Compare first half vs second half of the frame's energy distribution
      const half = Math.floor(n / 2);
      let e1 = 0, e2 = 0;
      for (let i = 0; i < half; i++) e1 += data[i] * data[i];
      for (let i = half; i < n; i++) e2 += data[i] * data[i];
      const spectralFlux = Math.abs(e2 - e1) / (n / 2);

      return { energy, spectralFlux, zcr, timestamp };
    } catch { return null; }
  }

  // ── Phoneme onset detection ────────────────────────────────────────────────
  // A phoneme onset is a frame where spectral flux OR ZCR spikes above threshold.
  // This catches both voiced (vowel) and unvoiced (consonant) boundaries.

  private detectPhonemeOnsets(): number[] {
    if (this.audioHistory.length < 5) return [];

    const fluxValues = this.audioHistory.map(a => a.spectralFlux);
    const zcrValues  = this.audioHistory.map(a => a.zcr);

    const fluxMean = fluxValues.reduce((s, v) => s + v, 0) / fluxValues.length;
    const fluxStd  = Math.sqrt(fluxValues.reduce((s, v) => s + (v - fluxMean) ** 2, 0) / fluxValues.length);
    const zcrMean  = zcrValues.reduce((s, v) => s + v, 0) / zcrValues.length;
    const zcrStd   = Math.sqrt(zcrValues.reduce((s, v) => s + (v - zcrMean) ** 2, 0) / zcrValues.length);

    const fluxThreshold = fluxMean + 1.5 * fluxStd;
    const zcrThreshold  = zcrMean  + 1.5 * zcrStd;

    const onsets: number[] = [];
    for (let i = 1; i < this.audioHistory.length; i++) {
      const a = this.audioHistory[i];
      if (a.spectralFlux > fluxThreshold || a.zcr > zcrThreshold) {
        // Minimum gap of 3 frames between onsets (avoid double-counting)
        if (!onsets.length || i - onsets[onsets.length - 1] > 3) {
          onsets.push(i);
        }
      }
    }
    return onsets;
  }

  // ── Lip onset detection ────────────────────────────────────────────────────
  // A lip onset is a frame where mouth openness increases sharply (derivative spike).

  private detectLipOnsets(): number[] {
    if (this.lipHistory.length < 5) return [];

    const openness = this.lipHistory.map(l => l.openness);
    const deltas   = openness.slice(1).map((v, i) => v - openness[i]);

    const mean = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    const std  = Math.sqrt(deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length);
    const threshold = mean + 1.5 * std;

    const onsets: number[] = [];
    for (let i = 0; i < deltas.length; i++) {
      if (deltas[i] > threshold) {
        if (!onsets.length || i - onsets[onsets.length - 1] > 3) {
          onsets.push(i + 1);
        }
      }
    }
    return onsets;
  }

  // ── Onset matching ─────────────────────────────────────────────────────────
  // Count how many phoneme onsets have a lip onset within ±3 frames.

  private matchOnsets(phonemeOnsets: number[], lipOnsets: number[]): number {
    let matched = 0;
    for (const po of phonemeOnsets) {
      if (lipOnsets.some(lo => Math.abs(lo - po) <= 3)) matched++;
    }
    return matched;
  }

  // ── RMS correlation (secondary) ────────────────────────────────────────────

  private calculateRMSCorrelation(): number {
    const n = Math.min(this.lipHistory.length, this.audioHistory.length);
    if (n < 5) return 0;

    const lip   = this.lipHistory.slice(-n).map(l => l.openness);
    const audio = this.audioHistory.slice(-n).map(a => a.energy);

    const lMean = lip.reduce((s, v) => s + v, 0) / n;
    const aMean = audio.reduce((s, v) => s + v, 0) / n;
    const lNorm = lip.map(v => v - lMean);
    const aNorm = audio.map(v => v - aMean);

    let num = 0, lSq = 0, aSq = 0;
    for (let i = 0; i < n; i++) {
      num += lNorm[i] * aNorm[i];
      lSq += lNorm[i] ** 2;
      aSq += aNorm[i] ** 2;
    }
    const denom = Math.sqrt(lSq * aSq);
    return denom === 0 ? 0 : Math.abs(num / denom);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private detectLipMovement(): boolean {
    if (this.lipHistory.length < 5) return false;
    const recent = this.lipHistory.slice(-10);
    const avg    = recent.reduce((s, l) => s + l.openness, 0) / recent.length;
    const variance = recent.reduce((s, l) => s + (l.openness - avg) ** 2, 0) / recent.length;
    return variance > 0.001;
  }

  private calculateLipVariance(): number {
    if (this.lipHistory.length < 5) return 0;
    const vals = this.lipHistory.map(l => l.openness);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  }

  async extractAudioFromVideo(videoFile: File): Promise<AudioBuffer | null> {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const arrayBuffer = await videoFile.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch { return null; }
  }

  reset(): void {
    this.lipHistory   = [];
    this.audioHistory = [];
  }

  dispose(): void {
    this.audioContext?.close();
    this.audioContext = null;
    this.reset();
  }
}

let lipSyncAnalyzerInstance: LipSyncAnalyzer | null = null;
export const getLipSyncAnalyzer = (): LipSyncAnalyzer => {
  if (!lipSyncAnalyzerInstance) lipSyncAnalyzerInstance = new LipSyncAnalyzer();
  return lipSyncAnalyzerInstance;
};
