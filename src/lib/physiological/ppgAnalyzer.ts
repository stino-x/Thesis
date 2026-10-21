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
    heartRate: number; // BPM
    heartRateVariability: number; // HRV in ms (SDNN)
    signalQuality: number; // 0-1
    signalConsistency: number; // 0-1
    skinRegionQuality: number; // 0-1
    spatialConsistency: number; // Consistency across face regions (0-1)
    frequencyHarmonics: boolean; // Presence of harmonics (2×, 3× base frequency)
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
   * Analyze PPG signal from face mesh and canvas.
   * Requires at least minSamples frames — returns low-confidence result
   * for single images (PPG is meaningless without temporal data).
   * 
   * Enhanced with:
   * - Heart Rate Variability (HRV/SDNN)
   * - Spatial consistency across face regions
   * - Frequency harmonics detection
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

    // Need enough samples for analysis — single images always fail this check
    // which is correct: PPG requires temporal data to detect a pulse signal
    const avgHistoryLength = Array.from(this.rgbHistory.values())
      .reduce((sum, hist) => sum + hist.length, 0) / this.skinRegions.length;

    if (avgHistoryLength < this.minSamples) {
      return {
        score: 0,
        confidence: 0,
        anomalies: ['insufficient_data'],
        details: {
          pulseDetected: false,
          heartRate: 0,
          heartRateVariability: 0,
          signalQuality: 0,
          signalConsistency: 0,
          skinRegionQuality: 0,
          spatialConsistency: 0,
          frequencyHarmonics: false,
        },
      };
    }

    // Analyze each region for pulse signal
    const regionResults: {
      quality: number;
      consistency: number;
      pulseDetected: boolean;
      heartRate: number;
      hrv: number;
      hasHarmonics: boolean;
    }[] = [];

    for (const [regionName, samples] of this.rgbHistory.entries()) {
      if (samples.length < this.minSamples) continue;

      const analysis = this.analyzePulseSignalEnhanced(samples);
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

      // NEW: Check HRV (Heart Rate Variability)
      // Real humans: HRV typically 3-8 BPM (SDNN)
      // Deepfakes: HRV often < 2 BPM (too stable) or 0 (no signal)
      if (analysis.hrv < 2.0 && analysis.pulseDetected) {
        anomalies.push(`abnormal_hrv_${regionName}`);
        deepfakeScore += 0.25;
      }

      // NEW: Check for frequency harmonics
      // Real pulse has harmonics (2×, 3× base frequency due to blood flow physics)
      // Synthetic signals often lack these
      if (!analysis.hasHarmonics && analysis.pulseDetected) {
        anomalies.push(`missing_harmonics_${regionName}`);
        deepfakeScore += 0.2;
      }
    }

    // NEW: Check spatial consistency across regions
    // Forehead PPG should correlate with cheek PPG
    const spatialConsistency = this.calculateSpatialConsistency(regionResults);
    if (spatialConsistency < 0.5 && regionResults.length >= 2) {
      anomalies.push('poor_spatial_consistency');
      deepfakeScore += 0.25;
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
    const avgHeartRate = regionResults.reduce((sum, r) => sum + r.heartRate, 0) / Math.max(regionResults.length, 1);
    const avgHRV = regionResults.reduce((sum, r) => sum + r.hrv, 0) / Math.max(regionResults.length, 1);
    const pulseDetected = regionResults.some(r => r.pulseDetected);
    const hasHarmonics = regionResults.some(r => r.hasHarmonics);

    return {
      score: deepfakeScore,
      confidence: avgSignalQuality * 0.5 + avgConsistency * 0.5,
      anomalies,
      details: {
        pulseDetected,
        heartRate: avgHeartRate,
        heartRateVariability: avgHRV,
        signalQuality: avgSignalQuality,
        signalConsistency: avgConsistency,
        skinRegionQuality: regionResults.length / this.skinRegions.length,
        spatialConsistency,
        frequencyHarmonics: hasHarmonics,
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
   * Enhanced pulse signal analysis with HRV and harmonics detection
   */
  private analyzePulseSignalEnhanced(samples: RGBSample[]): {
    quality: number;
    consistency: number;
    pulseDetected: boolean;
    heartRate: number;
    hrv: number;
    hasHarmonics: boolean;
  } {
    if (samples.length < this.minSamples) {
      return {
        quality: 0,
        consistency: 0,
        pulseDetected: false,
        heartRate: 0,
        hrv: 0,
        hasHarmonics: false,
      };
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
    
    // Only check physiological range (0.8-2 Hz = 48-120 BPM)
    const minIndex = Math.floor(0.8 / freqResolution);
    const maxIndex = Math.floor(2.0 / freqResolution);

    for (let i = minIndex; i < Math.min(maxIndex, powerSpectrum.length / 2); i++) {
      if (powerSpectrum[i] > maxPower) {
        maxPower = powerSpectrum[i];
        dominantFreqIndex = i;
      }
    }

    const dominantFreq = dominantFreqIndex * freqResolution;
    const heartRate = dominantFreq * 60; // Convert Hz to BPM
    const pulseDetected = dominantFreq >= 0.8 && dominantFreq <= 2.0 && maxPower > 0.1;

    // Calculate consistency (ratio of dominant peak to total power)
    const totalPower = powerSpectrum.reduce((sum, p) => sum + p, 0);
    const consistency = totalPower > 0 ? maxPower / totalPower : 0;

    // NEW: Calculate Heart Rate Variability (HRV)
    // Find peaks in time domain to get inter-beat intervals (IBIs)
    const hrv = this.calculateHRV(detrended, dominantFreq, fs);

    // NEW: Check for frequency harmonics (2×, 3× base frequency)
    const hasHarmonics = this.detectHarmonics(powerSpectrum, dominantFreqIndex, maxPower);

    return {
      quality,
      consistency: Math.min(consistency * 5, 1.0), // Normalize
      pulseDetected,
      heartRate,
      hrv,
      hasHarmonics,
    };
  }

  /**
   * Calculate Heart Rate Variability (HRV) using SDNN method
   * SDNN = Standard Deviation of NN (Normal-to-Normal) intervals
   * Real humans: 30-100ms typical, 3-8 BPM equivalent
   * Deepfakes: Often < 10ms (too stable) or 0 (no variation)
   */
  private calculateHRV(signal: number[], dominantFreq: number, samplingRate: number): number {
    if (dominantFreq === 0) return 0;

    // Find peaks in the signal (local maxima)
    const peaks: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > 0) {
        peaks.push(i);
      }
    }

    if (peaks.length < 3) return 0; // Need at least 3 peaks for 2 intervals

    // Calculate inter-beat intervals (IBIs) in milliseconds
    const ibis: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const ibi = ((peaks[i] - peaks[i - 1]) / samplingRate) * 1000; // Convert to ms
      // Filter out unrealistic IBIs (outside 300-2000ms = 30-200 BPM)
      if (ibi >= 300 && ibi <= 2000) {
        ibis.push(ibi);
      }
    }

    if (ibis.length < 2) return 0;

    // Calculate SDNN (standard deviation of IBIs)
    const meanIBI = ibis.reduce((sum, v) => sum + v, 0) / ibis.length;
    const variance = ibis.reduce((sum, v) => sum + (v - meanIBI) ** 2, 0) / ibis.length;
    const sdnn = Math.sqrt(variance);

    // Convert SDNN to equivalent BPM variation
    // Approximate conversion: BPM_variation ≈ (SDNN / mean_IBI) * mean_HR
    const meanHR = 60000 / meanIBI; // Convert mean IBI (ms) to BPM
    const hrvBPM = (sdnn / meanIBI) * meanHR;

    return hrvBPM;
  }

  /**
   * Detect frequency harmonics (integer multiples of base frequency)
   * Real physiological signals have harmonics due to blood flow physics
   * Synthetic signals often lack these
   */
  private detectHarmonics(
    powerSpectrum: number[],
    baseFreqIndex: number,
    basePower: number
  ): boolean {
    if (baseFreqIndex === 0 || basePower === 0) return false;

    // Check for 2× harmonic (first harmonic)
    const harmonic2Index = baseFreqIndex * 2;
    if (harmonic2Index < powerSpectrum.length) {
      const harmonic2Power = powerSpectrum[harmonic2Index];
      // Harmonic should be at least 10% of base power
      if (harmonic2Power > basePower * 0.1) {
        return true;
      }
    }

    // Check for 3× harmonic (second harmonic)
    const harmonic3Index = baseFreqIndex * 3;
    if (harmonic3Index < powerSpectrum.length) {
      const harmonic3Power = powerSpectrum[harmonic3Index];
      if (harmonic3Power > basePower * 0.05) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate spatial consistency across face regions
   * Real faces: Different regions should have correlated PPG signals
   * Deepfakes: Often uncorrelated or missing signals in some regions
   */
  private calculateSpatialConsistency(
    regionResults: Array<{ heartRate: number; hrv: number }>
  ): number {
    if (regionResults.length < 2) return 1.0; // Can't measure with < 2 regions

    // Calculate coefficient of variation for heart rate across regions
    // Lower CV = more consistent
    const heartRates = regionResults.map(r => r.heartRate).filter(hr => hr > 0);
    if (heartRates.length < 2) return 0;

    const meanHR = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
    const stdHR = Math.sqrt(
      heartRates.reduce((sum, hr) => sum + (hr - meanHR) ** 2, 0) / heartRates.length
    );
    const cvHR = meanHR > 0 ? stdHR / meanHR : 1.0;

    // Spatial consistency score (inverse of CV, normalized)
    // CV < 0.1 (10%) = good consistency
    // CV > 0.3 (30%) = poor consistency
    const consistency = Math.max(0, 1 - (cvHR / 0.3));

    return consistency;
  }

  /**
   * Legacy method for backward compatibility - calls enhanced version
   * @deprecated Use analyzePulseSignalEnhanced instead
   */
  private analyzePulseSignal(samples: RGBSample[]): {
    quality: number;
    consistency: number;
    pulseDetected: boolean;
  } {
    const enhanced = this.analyzePulseSignalEnhanced(samples);
    return {
      quality: enhanced.quality,
      consistency: enhanced.consistency,
      pulseDetected: enhanced.pulseDetected,
    };
  }

  /**
   * Cooley-Tukey radix-2 FFT (O(N log N)) replacing the previous O(N²) DFT.
   * Input length is zero-padded to the next power of two for efficiency.
   */
  private simpleFFT(signal: number[]): { re: number; im: number }[] {
    // Pad to next power of 2
    let N = 1;
    while (N < signal.length) N <<= 1;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < signal.length; i++) re[i] = signal[i];

    // Bit-reversal permutation
    let j = 0;
    for (let i = 1; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }

    // Cooley-Tukey butterfly
    for (let len = 2; len <= N; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wRe = Math.cos(ang);
      const wIm = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let curRe = 1, curIm = 0;
        for (let k = 0; k < len / 2; k++) {
          const uRe = re[i + k];
          const uIm = im[i + k];
          const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
          const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
          re[i + k]           = uRe + vRe;
          im[i + k]           = uIm + vIm;
          re[i + k + len / 2] = uRe - vRe;
          im[i + k + len / 2] = uIm - vIm;
          const nextRe = curRe * wRe - curIm * wIm;
          curIm        = curRe * wIm + curIm * wRe;
          curRe        = nextRe;
        }
      }
    }

    const result: { re: number; im: number }[] = [];
    for (let i = 0; i < N; i++) result.push({ re: re[i], im: im[i] });
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
        heartRate: 0,
        heartRateVariability: 0,
        signalQuality: 0,
        signalConsistency: 0,
        skinRegionQuality: 0,
        spatialConsistency: 0,
        frequencyHarmonics: false,
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
