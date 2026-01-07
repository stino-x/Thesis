/**
 * Voice Artifact Detection Module
 * 
 * Detects AI-generated or cloned voices by analyzing audio characteristics.
 * Synthetic voices often have:
 * - Unnatural frequency patterns
 * - Consistent spectral characteristics (too perfect)
 * - Missing micro-variations in pitch/tone
 * - Artifacts in high-frequency bands
 * 
 * Note: This is a simplified implementation using Web Audio API.
 * For production, consider using TensorFlow.js audio models or external APIs.
 */

export interface VoiceAnalysisResult {
  score: number; // 0-1, higher = more likely synthetic
  confidence: number;
  anomalies: string[];
  details: {
    spectralConsistency: number; // Too consistent = suspicious
    highFrequencyArtifacts: boolean;
    pitchVariability: number; // Too low = suspicious
    energyDistribution: number;
  };
}

export class VoiceAnalyzer {
  private audioContext: AudioContext | null = null;

  /**
   * Analyze audio for synthetic voice artifacts
   */
  async analyzeVoice(audioBuffer: AudioBuffer): Promise<VoiceAnalysisResult> {
    const anomalies: string[] = [];
    let score = 0;

    try {
      if (!this.audioContext) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Analyze spectral characteristics
      const spectralAnalysis = await this.analyzeSpectrum(audioBuffer);
      
      // Check 1: Too consistent spectrum (AI voices are often too clean)
      if (spectralAnalysis.consistency > 0.8) {
        anomalies.push('overly_consistent_spectrum');
        score += 0.4;
      }

      // Check 2: Missing high-frequency content (compression artifact or AI)
      if (spectralAnalysis.highFrequencyRatio < 0.1) {
        anomalies.push('missing_high_frequencies');
        score += 0.3;
      }

      // Check 3: Unnatural energy distribution
      if (spectralAnalysis.energyDistribution < 0.2) {
        anomalies.push('unnatural_energy_distribution');
        score += 0.3;
      }

      // Analyze temporal characteristics
      const temporalAnalysis = this.analyzeTemporalFeatures(audioBuffer);

      // Check 4: Too little pitch variation (robotic)
      if (temporalAnalysis.pitchVariability < 0.1) {
        anomalies.push('low_pitch_variability');
        score += 0.4;
      }

      // Check 5: Unnatural amplitude envelope
      if (temporalAnalysis.envelopeConsistency > 0.9) {
        anomalies.push('overly_consistent_amplitude');
        score += 0.2;
      }

      // Check 6: Spectral artifacts in specific frequency bands
      if (spectralAnalysis.hasArtifacts) {
        anomalies.push('frequency_band_artifacts');
        score += 0.5;
      }

      return {
        score: Math.min(score, 1.0),
        confidence: 0.6, // Moderate confidence (this is simplified analysis)
        anomalies,
        details: {
          spectralConsistency: spectralAnalysis.consistency,
          highFrequencyArtifacts: spectralAnalysis.hasArtifacts,
          pitchVariability: temporalAnalysis.pitchVariability,
          energyDistribution: spectralAnalysis.energyDistribution,
        },
      };
    } catch (error) {
      console.error('Voice analysis error:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Analyze frequency spectrum for artifacts
   */
  private async analyzeSpectrum(audioBuffer: AudioBuffer): Promise<{
    consistency: number;
    highFrequencyRatio: number;
    energyDistribution: number;
    hasArtifacts: boolean;
  }> {
    const channelData = audioBuffer.getChannelData(0);
    const fftSize = 2048;
    const spectrums: number[][] = [];

    // Analyze multiple windows
    const windowCount = Math.floor(channelData.length / fftSize);
    
    for (let i = 0; i < windowCount; i++) {
      const start = i * fftSize;
      const window = channelData.slice(start, start + fftSize);
      const spectrum = this.computeFFT(window);
      spectrums.push(spectrum);
    }

    if (spectrums.length === 0) {
      return {
        consistency: 0,
        highFrequencyRatio: 0,
        energyDistribution: 0,
        hasArtifacts: false,
      };
    }

    // Calculate consistency across windows
    const consistency = this.calculateSpectralConsistency(spectrums);

    // Calculate high-frequency ratio
    const avgSpectrum = this.averageSpectrums(spectrums);
    const totalEnergy = avgSpectrum.reduce((sum, val) => sum + val, 0);
    const highFreqStart = Math.floor(avgSpectrum.length * 0.7); // Top 30% of frequencies
    const highFreqEnergy = avgSpectrum.slice(highFreqStart).reduce((sum, val) => sum + val, 0);
    const highFrequencyRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;

    // Check energy distribution (should be relatively spread out)
    const energyDistribution = this.calculateEnergyDistribution(avgSpectrum);

    // Detect artifacts (unusual peaks or valleys)
    const hasArtifacts = this.detectSpectralArtifacts(avgSpectrum);

    return {
      consistency,
      highFrequencyRatio,
      energyDistribution,
      hasArtifacts,
    };
  }

  /**
   * Analyze temporal features (amplitude envelope, etc.)
   */
  private analyzeTemporalFeatures(audioBuffer: AudioBuffer): {
    pitchVariability: number;
    envelopeConsistency: number;
  } {
    const channelData = audioBuffer.getChannelData(0);
    const windowSize = 1024;
    const hopSize = 512;

    const energies: number[] = [];

    // Calculate energy in each window
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      energies.push(Math.sqrt(energy / windowSize));
    }

    // Calculate pitch variability (using zero-crossing rate as proxy)
    const zcrVariability = this.calculateZCRVariability(channelData, windowSize, hopSize);

    // Calculate envelope consistency
    const envMean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
    const envVariance = energies.reduce((sum, e) => sum + Math.pow(e - envMean, 2), 0) / energies.length;
    const envStdDev = Math.sqrt(envVariance);
    const envelopeConsistency = envMean > 0 ? 1 - Math.min(envStdDev / envMean, 1) : 0;

    return {
      pitchVariability: zcrVariability,
      envelopeConsistency,
    };
  }

  /**
   * Simple FFT computation (magnitude only)
   */
  private computeFFT(signal: Float32Array | number[]): number[] {
    const N = signal.length;
    const magnitudes: number[] = [];

    for (let k = 0; k < N / 2; k++) {
      let re = 0;
      let im = 0;

      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        re += signal[n] * Math.cos(angle);
        im += signal[n] * Math.sin(angle);
      }

      magnitudes.push(Math.sqrt(re * re + im * im));
    }

    return magnitudes;
  }

  /**
   * Calculate spectral consistency across windows
   */
  private calculateSpectralConsistency(spectrums: number[][]): number {
    if (spectrums.length < 2) return 0;

    // Calculate correlation between consecutive spectrums
    let totalCorrelation = 0;

    for (let i = 0; i < spectrums.length - 1; i++) {
      const corr = this.correlate(spectrums[i], spectrums[i + 1]);
      totalCorrelation += corr;
    }

    return totalCorrelation / (spectrums.length - 1);
  }

  /**
   * Calculate correlation between two arrays
   */
  private correlate(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    
    const meanA = a.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
    const meanB = b.slice(0, n).reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let sumASq = 0;
    let sumBSq = 0;

    for (let i = 0; i < n; i++) {
      const aVal = a[i] - meanA;
      const bVal = b[i] - meanB;
      numerator += aVal * bVal;
      sumASq += aVal * aVal;
      sumBSq += bVal * bVal;
    }

    const denominator = Math.sqrt(sumASq * sumBSq);
    return denominator > 0 ? Math.abs(numerator / denominator) : 0;
  }

  /**
   * Average multiple spectrums
   */
  private averageSpectrums(spectrums: number[][]): number[] {
    if (spectrums.length === 0) return [];

    const length = spectrums[0].length;
    const avg = new Array(length).fill(0);

    for (const spectrum of spectrums) {
      for (let i = 0; i < length; i++) {
        avg[i] += spectrum[i];
      }
    }

    return avg.map(v => v / spectrums.length);
  }

  /**
   * Calculate energy distribution metric
   */
  private calculateEnergyDistribution(spectrum: number[]): number {
    const totalEnergy = spectrum.reduce((sum, v) => sum + v, 0);
    if (totalEnergy === 0) return 0;

    // Calculate entropy of energy distribution
    let entropy = 0;
    for (const value of spectrum) {
      if (value > 0) {
        const p = value / totalEnergy;
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize by max possible entropy
    const maxEntropy = Math.log2(spectrum.length);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  /**
   * Detect spectral artifacts (unusual peaks)
   */
  private detectSpectralArtifacts(spectrum: number[]): boolean {
    const mean = spectrum.reduce((sum, v) => sum + v, 0) / spectrum.length;
    const stdDev = Math.sqrt(
      spectrum.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / spectrum.length
    );

    // Look for values more than 3 standard deviations from mean
    const threshold = mean + 3 * stdDev;
    return spectrum.some(v => v > threshold);
  }

  /**
   * Calculate zero-crossing rate variability (pitch proxy)
   */
  private calculateZCRVariability(
    signal: Float32Array,
    windowSize: number,
    hopSize: number
  ): number {
    const zcrs: number[] = [];

    for (let i = 0; i < signal.length - windowSize; i += hopSize) {
      let crossings = 0;
      for (let j = i; j < i + windowSize - 1; j++) {
        if ((signal[j] >= 0 && signal[j + 1] < 0) || (signal[j] < 0 && signal[j + 1] >= 0)) {
          crossings++;
        }
      }
      zcrs.push(crossings / windowSize);
    }

    // Calculate variance of ZCR
    const mean = zcrs.reduce((sum, v) => sum + v, 0) / zcrs.length;
    const variance = zcrs.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / zcrs.length;

    return Math.sqrt(variance);
  }

  /**
   * Default result when analysis fails
   */
  private getDefaultResult(): VoiceAnalysisResult {
    return {
      score: 0,
      confidence: 0,
      anomalies: ['analysis_failed'],
      details: {
        spectralConsistency: 0,
        highFrequencyArtifacts: false,
        pitchVariability: 0,
        energyDistribution: 0,
      },
    };
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Singleton instance
let voiceAnalyzerInstance: VoiceAnalyzer | null = null;

export const getVoiceAnalyzer = (): VoiceAnalyzer => {
  if (!voiceAnalyzerInstance) {
    voiceAnalyzerInstance = new VoiceAnalyzer();
  }
  return voiceAnalyzerInstance;
};
