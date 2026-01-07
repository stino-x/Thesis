/**
 * Photoplethysmography (PPG) Analysis Module
 * 
 * Analyzes subtle blood-flow patterns in facial skin to detect deepfakes.
 * Based on Intel FakeCatcher approach - real faces show consistent pulse signals
 * in RGB color channels, while deepfakes often lack these physiological cues.
 * 
 * References:
 * - Intel FakeCatcher: https://www.intel.com/content/www/us/en/newsroom/news/intel-introduces-real-time-deepfake-detector.html
 * - PPG from video: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6426305/
 */

// MediaPipe type (using generic array type for compatibility)
type NormalizedLandmark = { x: number; y: number; z: number };
type NormalizedLandmarkList = NormalizedLandmark[];

export interface PPGAnalysisResult {
  score: number; // 0-1, higher = more likely deepfake
  confidence: number; // 0-1, confidence in the analysis
  anomalies: string[];
  details: {
    pulseDetected: boolean;
    signalQuality: number; // 0-1
    signalConsistency: number; // 0-1
    skinRegionQuality: number; // 0-1
  };
}

interface RGBSample {
  r: number;
  g: number;
  b: number;
  timestamp: number;
}

interface SkinRegion {
  name: string;
  landmarks: number[]; // Indices into face mesh
}

export class PPGAnalyzer {
  private rgbHistory: Map<string, RGBSample[]> = new Map();
  private readonly minSamples = 30; // Need ~1 second of data at 30fps
  private readonly maxSamples = 150; // Keep ~5 seconds max

  // Skin regions for PPG analysis (based on MediaPipe 468 landmarks)
  private readonly skinRegions: SkinRegion[] = [
    { name: 'forehead', landmarks: [10, 67, 69, 104, 108, 151, 337, 299] },
    { name: 'left_cheek', landmarks: [205, 50, 117, 118, 101, 36, 120, 119] },
    { name: 'right_cheek', landmarks: [425, 280, 346, 347, 330, 266, 349, 348] },
    { name: 'nose_bridge', landmarks: [6, 168, 197, 195] },
  ];

  /**
   * Analyze PPG signal from face mesh and canvas
   */
  async analyzePPG(
    faceMesh: NormalizedLandmarkList,
    canvas: HTMLCanvasElement,
    timestamp: number = Date.now()
  ): Promise<PPGAnalysisResult> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return this.getDefaultResult();
    }

    const anomalies: string[] = [];
    let deepfakeScore = 0;

    // Extract RGB values from each skin region
    for (const region of this.skinRegions) {
      const rgbSample = this.extractRegionRGB(faceMesh, canvas, region);
      
      if (rgbSample) {
        // Store sample with timestamp
        const history = this.rgbHistory.get(region.name) || [];
        history.push({ ...rgbSample, timestamp });

        // Keep only recent samples
        if (history.length > this.maxSamples) {
          history.shift();
        }

        this.rgbHistory.set(region.name, history);
      }
    }

    // Need enough samples for analysis
    const avgHistoryLength = Array.from(this.rgbHistory.values())
      .reduce((sum, hist) => sum + hist.length, 0) / this.skinRegions.length;

    if (avgHistoryLength < this.minSamples) {
      return {
        score: 0,
        confidence: 0,
        anomalies: ['insufficient_data'],
        details: {
          pulseDetected: false,
          signalQuality: 0,
          signalConsistency: 0,
          skinRegionQuality: 0,
        },
      };
    }

    // Analyze each region for pulse signal
    const regionResults: { quality: number; consistency: number; pulseDetected: boolean }[] = [];

    for (const [regionName, samples] of this.rgbHistory.entries()) {
      if (samples.length < this.minSamples) continue;

      const analysis = this.analyzePulseSignal(samples);
      regionResults.push(analysis);

      // Low signal quality indicates potential deepfake
      if (analysis.quality < 0.3) {
        anomalies.push(`low_ppg_quality_${regionName}`);
        deepfakeScore += 0.2;
      }

      // Inconsistent pulse across frames
      if (!analysis.pulseDetected) {
        anomalies.push(`no_pulse_detected_${regionName}`);
        deepfakeScore += 0.3;
      }

      // Low consistency between different skin regions
      if (analysis.consistency < 0.4) {
        anomalies.push(`inconsistent_signal_${regionName}`);
        deepfakeScore += 0.15;
      }
    }

    // Check consistency across regions
    if (regionResults.length >= 2) {
      const avgConsistency = regionResults.reduce((sum, r) => sum + r.consistency, 0) / regionResults.length;
      
      if (avgConsistency < 0.5) {
        anomalies.push('cross_region_inconsistency');
        deepfakeScore += 0.2;
      }
    }

    // Normalize score
    deepfakeScore = Math.min(deepfakeScore, 1.0);

    // Calculate overall metrics
    const avgSignalQuality = regionResults.reduce((sum, r) => sum + r.quality, 0) / Math.max(regionResults.length, 1);
    const avgConsistency = regionResults.reduce((sum, r) => sum + r.consistency, 0) / Math.max(regionResults.length, 1);
    const pulseDetected = regionResults.some(r => r.pulseDetected);

    return {
      score: deepfakeScore,
      confidence: avgSignalQuality * 0.5 + avgConsistency * 0.5,
      anomalies,
      details: {
        pulseDetected,
        signalQuality: avgSignalQuality,
        signalConsistency: avgConsistency,
        skinRegionQuality: regionResults.length / this.skinRegions.length,
      },
    };
  }

  /**
   * Extract average RGB values from a skin region
   */
  private extractRegionRGB(
    faceMesh: NormalizedLandmarkList,
    canvas: HTMLCanvasElement,
    region: SkinRegion
  ): { r: number; g: number; b: number } | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    let totalR = 0, totalG = 0, totalB = 0;
    let validPixels = 0;

    // Sample pixels around each landmark
    for (const landmarkIndex of region.landmarks) {
      const landmark = faceMesh[landmarkIndex];
      if (!landmark) continue;

      const x = Math.floor(landmark.x * canvasWidth);
      const y = Math.floor(landmark.y * canvasHeight);

      // Sample 3x3 area around landmark
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;

          if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight) {
            const imageData = ctx.getImageData(px, py, 1, 1);
            const [r, g, b] = imageData.data;

            totalR += r;
            totalG += g;
            totalB += b;
            validPixels++;
          }
        }
      }
    }

    if (validPixels === 0) return null;

    return {
      r: totalR / validPixels,
      g: totalG / validPixels,
      b: totalB / validPixels,
    };
  }

  /**
   * Analyze RGB time series for pulse signal
   * Real faces show periodic variations due to blood flow
   */
  private analyzePulseSignal(samples: RGBSample[]): {
    quality: number;
    consistency: number;
    pulseDetected: boolean;
  } {
    if (samples.length < this.minSamples) {
      return { quality: 0, consistency: 0, pulseDetected: false };
    }

    // Extract green channel (most sensitive to blood volume changes)
    const greenValues = samples.map(s => s.g);

    // Detrend signal (remove DC component)
    const mean = greenValues.reduce((sum, v) => sum + v, 0) / greenValues.length;
    const detrended = greenValues.map(v => v - mean);

    // Calculate signal variance (quality indicator)
    const variance = detrended.reduce((sum, v) => sum + v * v, 0) / detrended.length;
    const stdDev = Math.sqrt(variance);

    // Normalize quality (higher variance = better signal)
    const quality = Math.min(stdDev / 10, 1.0); // Normalize to 0-1

    // Detect periodicity (pulse rate should be 0.8-2 Hz, i.e., 48-120 BPM)
    const fft = this.simpleFFT(detrended);
    const powerSpectrum = fft.map(c => c.re * c.re + c.im * c.im);

    // Find dominant frequency
    const fs = 30; // Assume 30 fps
    const freqResolution = fs / samples.length;
    
    let maxPower = 0;
    let dominantFreqIndex = 0;
    
    // Only check physiological range (0.8-2 Hz)
    const minIndex = Math.floor(0.8 / freqResolution);
    const maxIndex = Math.floor(2.0 / freqResolution);

    for (let i = minIndex; i < Math.min(maxIndex, powerSpectrum.length / 2); i++) {
      if (powerSpectrum[i] > maxPower) {
        maxPower = powerSpectrum[i];
        dominantFreqIndex = i;
      }
    }

    const dominantFreq = dominantFreqIndex * freqResolution;
    const pulseDetected = dominantFreq >= 0.8 && dominantFreq <= 2.0 && maxPower > 0.1;

    // Calculate consistency (ratio of dominant peak to total power)
    const totalPower = powerSpectrum.reduce((sum, p) => sum + p, 0);
    const consistency = totalPower > 0 ? maxPower / totalPower : 0;

    return {
      quality,
      consistency: Math.min(consistency * 5, 1.0), // Normalize
      pulseDetected,
    };
  }

  /**
   * Simple FFT implementation for pulse detection
   * (Simplified DFT for our needs)
   */
  private simpleFFT(signal: number[]): { re: number; im: number }[] {
    const N = signal.length;
    const result: { re: number; im: number }[] = [];

    for (let k = 0; k < N; k++) {
      let re = 0;
      let im = 0;

      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        re += signal[n] * Math.cos(angle);
        im += signal[n] * Math.sin(angle);
      }

      result.push({ re, im });
    }

    return result;
  }

  /**
   * Reset history (call when analyzing new video)
   */
  reset(): void {
    this.rgbHistory.clear();
  }

  /**
   * Default result when analysis not possible
   */
  private getDefaultResult(): PPGAnalysisResult {
    return {
      score: 0,
      confidence: 0,
      anomalies: ['analysis_failed'],
      details: {
        pulseDetected: false,
        signalQuality: 0,
        signalConsistency: 0,
        skinRegionQuality: 0,
      },
    };
  }
}

// Singleton instance
let ppgAnalyzerInstance: PPGAnalyzer | null = null;

export const getPPGAnalyzer = (): PPGAnalyzer => {
  if (!ppgAnalyzerInstance) {
    ppgAnalyzerInstance = new PPGAnalyzer();
  }
  return ppgAnalyzerInstance;
};
