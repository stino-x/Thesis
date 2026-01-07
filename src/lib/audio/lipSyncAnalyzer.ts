/**
 * Audio-Visual Lip-Sync Analysis Module
 * 
 * Detects deepfakes by analyzing correlation between lip movements and audio.
 * Deepfakes often have mismatched or poorly synchronized audio-visual elements.
 * 
 * Uses:
 * - Face mesh lip landmarks for visual analysis
 * - Web Audio API for audio feature extraction
 * - Cross-correlation to detect sync issues
 */

// MediaPipe type (using generic array type for compatibility)
type NormalizedLandmark = { x: number; y: number; z: number };
type NormalizedLandmarkList = NormalizedLandmark[];

export interface LipSyncAnalysisResult {
  score: number; // 0-1, higher = more suspicious
  confidence: number;
  anomalies: string[];
  details: {
    syncScore: number; // 0-1, how well synchronized
    audioPresent: boolean;
    lipMovementDetected: boolean;
    correlationScore: number;
  };
}

interface LipMovement {
  openness: number; // 0-1, how open the mouth is
  width: number; // mouth width
  timestamp: number;
}

interface AudioFeature {
  energy: number; // Audio energy/loudness
  timestamp: number;
}

export class LipSyncAnalyzer {
  private lipHistory: LipMovement[] = [];
  private audioHistory: AudioFeature[] = [];
  private audioContext: AudioContext | null = null;
  private readonly maxSamples = 150; // ~5 seconds at 30fps

  // MediaPipe lip landmark indices
  private readonly lipLandmarks = {
    outer: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88],
    upper: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    lower: [146, 91, 181, 84, 17, 314, 405, 321, 375],
  };

  /**
   * Analyze lip-sync between face mesh and audio
   */
  async analyzeLipSync(
    faceMesh: NormalizedLandmarkList,
    audioBuffer: AudioBuffer | null,
    timestamp: number = Date.now()
  ): Promise<LipSyncAnalysisResult> {
    const anomalies: string[] = [];
    let score = 0;

    // Extract lip movement
    const lipMovement = this.extractLipMovement(faceMesh, timestamp);
    if (lipMovement) {
      this.lipHistory.push(lipMovement);
      if (this.lipHistory.length > this.maxSamples) {
        this.lipHistory.shift();
      }
    }

    // Extract audio features if available
    if (audioBuffer) {
      const audioFeature = this.extractAudioFeatures(audioBuffer, timestamp);
      if (audioFeature) {
        this.audioHistory.push(audioFeature);
        if (this.audioHistory.length > this.maxSamples) {
          this.audioHistory.shift();
        }
      }
    }

    // Need enough data for analysis
    if (this.lipHistory.length < 10) {
      return {
        score: 0,
        confidence: 0,
        anomalies: ['insufficient_data'],
        details: {
          syncScore: 0,
          audioPresent: audioBuffer !== null,
          lipMovementDetected: false,
          correlationScore: 0,
        },
      };
    }

    const lipMovementDetected = this.detectLipMovement();

    // If we have audio, check correlation
    if (this.audioHistory.length >= 10 && audioBuffer) {
      const correlationScore = this.calculateCorrelation();

      // Low correlation = potential deepfake
      if (correlationScore < 0.3) {
        anomalies.push('poor_audio_visual_sync');
        score += 0.6;
      } else if (correlationScore < 0.5) {
        anomalies.push('weak_audio_visual_sync');
        score += 0.3;
      }

      // Lip movement without audio energy (or vice versa)
      const avgLipMovement = this.lipHistory.reduce((sum, l) => sum + l.openness, 0) / this.lipHistory.length;
      const avgAudioEnergy = this.audioHistory.reduce((sum, a) => sum + a.energy, 0) / this.audioHistory.length;

      if (avgLipMovement > 0.3 && avgAudioEnergy < 0.1) {
        anomalies.push('lip_movement_without_audio');
        score += 0.4;
      }

      if (avgAudioEnergy > 0.3 && avgLipMovement < 0.1) {
        anomalies.push('audio_without_lip_movement');
        score += 0.5;
      }

      return {
        score: Math.min(score, 1.0),
        confidence: 0.7,
        anomalies,
        details: {
          syncScore: correlationScore,
          audioPresent: true,
          lipMovementDetected,
          correlationScore,
        },
      };
    }

    // No audio - can still check for unnatural lip movements
    if (lipMovementDetected) {
      const lipVariance = this.calculateLipVariance();

      // Too smooth = potentially synthetic
      if (lipVariance < 0.01) {
        anomalies.push('unnaturally_smooth_lip_movement');
        score += 0.3;
      }

      // Too erratic = potentially synthetic
      if (lipVariance > 0.5) {
        anomalies.push('erratic_lip_movement');
        score += 0.2;
      }
    }

    return {
      score: Math.min(score, 1.0),
      confidence: 0.5, // Lower confidence without audio
      anomalies,
      details: {
        syncScore: 0,
        audioPresent: false,
        lipMovementDetected,
        correlationScore: 0,
      },
    };
  }

  /**
   * Extract lip movement metrics from face mesh
   */
  private extractLipMovement(
    faceMesh: NormalizedLandmarkList,
    timestamp: number
  ): LipMovement | null {
    // Get upper and lower lip landmarks
    const upperLip = this.lipLandmarks.upper.map(idx => faceMesh[idx]).filter(Boolean);
    const lowerLip = this.lipLandmarks.lower.map(idx => faceMesh[idx]).filter(Boolean);

    if (upperLip.length === 0 || lowerLip.length === 0) return null;

    // Calculate mouth openness (vertical distance between upper and lower lip)
    const upperY = upperLip.reduce((sum, l) => sum + l.y, 0) / upperLip.length;
    const lowerY = lowerLip.reduce((sum, l) => sum + l.y, 0) / lowerLip.length;
    const openness = Math.abs(lowerY - upperY);

    // Calculate mouth width
    const outerLips = this.lipLandmarks.outer.map(idx => faceMesh[idx]).filter(Boolean);
    const xCoords = outerLips.map(l => l.x);
    const width = Math.max(...xCoords) - Math.min(...xCoords);

    return {
      openness,
      width,
      timestamp,
    };
  }

  /**
   * Extract audio features from audio buffer
   */
  private extractAudioFeatures(
    audioBuffer: AudioBuffer,
    timestamp: number
  ): AudioFeature | null {
    try {
      // Calculate RMS energy across all channels
      let totalEnergy = 0;
      const channelData = audioBuffer.getChannelData(0); // Use first channel

      for (let i = 0; i < channelData.length; i++) {
        totalEnergy += channelData[i] * channelData[i];
      }

      const rms = Math.sqrt(totalEnergy / channelData.length);

      return {
        energy: rms,
        timestamp,
      };
    } catch (error) {
      console.error('Audio feature extraction error:', error);
      return null;
    }
  }

  /**
   * Calculate cross-correlation between lip movement and audio
   */
  private calculateCorrelation(): number {
    if (this.lipHistory.length === 0 || this.audioHistory.length === 0) {
      return 0;
    }

    // Normalize both signals
    const lipSignal = this.lipHistory.map(l => l.openness);
    const audioSignal = this.audioHistory.map(a => a.energy);

    // Ensure same length
    const minLength = Math.min(lipSignal.length, audioSignal.length);
    const lip = lipSignal.slice(-minLength);
    const audio = audioSignal.slice(-minLength);

    // Normalize signals
    const lipMean = lip.reduce((sum, v) => sum + v, 0) / lip.length;
    const audioMean = audio.reduce((sum, v) => sum + v, 0) / audio.length;

    const lipNorm = lip.map(v => v - lipMean);
    const audioNorm = audio.map(v => v - audioMean);

    // Calculate correlation coefficient
    let numerator = 0;
    let lipSumSq = 0;
    let audioSumSq = 0;

    for (let i = 0; i < minLength; i++) {
      numerator += lipNorm[i] * audioNorm[i];
      lipSumSq += lipNorm[i] * lipNorm[i];
      audioSumSq += audioNorm[i] * audioNorm[i];
    }

    const denominator = Math.sqrt(lipSumSq * audioSumSq);
    if (denominator === 0) return 0;

    const correlation = numerator / denominator;

    // Return absolute value (we care about correlation strength, not direction)
    return Math.abs(correlation);
  }

  /**
   * Detect if there's significant lip movement
   */
  private detectLipMovement(): boolean {
    if (this.lipHistory.length < 5) return false;

    const recentLips = this.lipHistory.slice(-10);
    const avgOpenness = recentLips.reduce((sum, l) => sum + l.openness, 0) / recentLips.length;

    // Check variance
    const variance = recentLips.reduce(
      (sum, l) => sum + Math.pow(l.openness - avgOpenness, 2),
      0
    ) / recentLips.length;

    return variance > 0.001; // Some movement detected
  }

  /**
   * Calculate variance in lip movement
   */
  private calculateLipVariance(): number {
    if (this.lipHistory.length < 5) return 0;

    const openness = this.lipHistory.map(l => l.openness);
    const mean = openness.reduce((sum, v) => sum + v, 0) / openness.length;

    const variance = openness.reduce(
      (sum, v) => sum + Math.pow(v - mean, 2),
      0
    ) / openness.length;

    return variance;
  }

  /**
   * Extract audio from video file
   */
  async extractAudioFromVideo(videoFile: File): Promise<AudioBuffer | null> {
    try {
      if (!this.audioContext) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Create video element to extract audio
      const video = document.createElement('video');
      const source = document.createElement('source');
      source.src = URL.createObjectURL(videoFile);
      video.appendChild(source);

      return new Promise((resolve) => {
        video.addEventListener('loadeddata', async () => {
          try {
            // Create audio source from video (for future implementation)
            // Note: MediaElementSourceNode can only be created once per element
            // Full implementation would need MediaRecorder or fetch + decode
            URL.revokeObjectURL(source.src);
            resolve(null);
          } catch (error) {
            console.error('Audio extraction error:', error);
            URL.revokeObjectURL(source.src);
            resolve(null);
          }
        });

        video.load();
      });
    } catch (error) {
      console.error('Audio context error:', error);
      return null;
    }
  }

  /**
   * Reset history
   */
  reset(): void {
    this.lipHistory = [];
    this.audioHistory = [];
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.reset();
  }
}

// Singleton instance
let lipSyncAnalyzerInstance: LipSyncAnalyzer | null = null;

export const getLipSyncAnalyzer = (): LipSyncAnalyzer => {
  if (!lipSyncAnalyzerInstance) {
    lipSyncAnalyzerInstance = new LipSyncAnalyzer();
  }
  return lipSyncAnalyzerInstance;
};
