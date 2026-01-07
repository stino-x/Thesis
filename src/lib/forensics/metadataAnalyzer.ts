/**
 * Metadata Forensics Module
 * 
 * Analyzes file and video metadata for deepfake indicators:
 * - Timestamp anomalies (future dates, impossible modifications)
 * - Encoding artifacts (unusual codecs, suspicious compression)
 * - Resolution inconsistencies (non-standard dimensions)
 * - File size anomalies
 */

export interface MetadataAnalysisResult {
  score: number; // 0-1, higher = more suspicious
  confidence: number; // 0-1, how confident we are
  anomalies: string[];
  details: {
    fileInfo?: FileMetadata;
    videoInfo?: VideoMetadata;
    suspiciousPatterns: string[];
  };
}

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  lastModifiedDate: string;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  frameRate?: number;
  bitrate?: number;
}

export class MetadataAnalyzer {
  /**
   * Analyze file metadata for suspicious patterns
   */
  async analyzeFile(file: File): Promise<MetadataAnalysisResult> {
    const anomalies: string[] = [];
    const suspiciousPatterns: string[] = [];
    let score = 0;

    // Extract file metadata
    const fileInfo: FileMetadata = {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      lastModifiedDate: new Date(file.lastModified).toISOString(),
    };

    // Check 1: Future timestamp (impossible!)
    if (file.lastModified > Date.now() + 60000) { // Allow 1 min clock skew
      anomalies.push('future_timestamp');
      suspiciousPatterns.push('File modified in the future - impossible timestamp');
      score += 0.8; // Very suspicious
    }

    // Check 2: Very old file with modern codec (suspicious)
    const fileAge = Date.now() - file.lastModified;
    const ageYears = fileAge / (1000 * 60 * 60 * 24 * 365);
    if (ageYears > 5 && (file.type.includes('av1') || file.type.includes('vp9'))) {
      anomalies.push('codec_timestamp_mismatch');
      suspiciousPatterns.push('Old file timestamp but modern codec');
      score += 0.3;
    }

    // Check 3: Suspicious file size
    if (file.type.startsWith('video/')) {
      // Video suspiciously small (might be AI-generated)
      if (file.size < 100000) { // < 100KB for video
        anomalies.push('unusually_small_video');
        suspiciousPatterns.push('Video file size too small for claimed duration');
        score += 0.2;
      }

      // Extract video metadata
      const videoInfo = await this.extractVideoMetadata(file);
      
      if (videoInfo) {
        // Check 4: Non-standard resolution (AI often generates specific sizes)
        const commonResolutions = [
          [1920, 1080], [1280, 720], [640, 480], [3840, 2160],
          [854, 480], [1280, 960], [1024, 768]
        ];
        
        const isStandardRes = commonResolutions.some(
          ([w, h]) => videoInfo.width === w && videoInfo.height === h
        );

        if (!isStandardRes) {
          // Check if dimensions are divisible by 16 (suspicious for AI)
          if (videoInfo.width % 16 === 0 && videoInfo.height % 16 === 0) {
            anomalies.push('suspicious_resolution');
            suspiciousPatterns.push('Non-standard but AI-friendly resolution (divisible by 16)');
            score += 0.4;
          }
        }

        // Check 5: Unusual aspect ratio
        const standardAspects = [16/9, 4/3, 1/1, 9/16]; // Common ratios
        const isStandardAspect = standardAspects.some(
          ratio => Math.abs(videoInfo.aspectRatio - ratio) < 0.01
        );

        if (!isStandardAspect && videoInfo.aspectRatio > 0) {
          anomalies.push('unusual_aspect_ratio');
          suspiciousPatterns.push(`Unusual aspect ratio: ${videoInfo.aspectRatio.toFixed(2)}`);
          score += 0.2;
        }

        // Check 6: Perfect resolution (AI-generated often have round numbers)
        if (videoInfo.width === 512 || videoInfo.width === 256 || 
            videoInfo.width === 1024 || videoInfo.height === 512 || 
            videoInfo.height === 256 || videoInfo.height === 1024) {
          anomalies.push('ai_common_resolution');
          suspiciousPatterns.push('Resolution matches common AI generation sizes (256, 512, 1024)');
          score += 0.5;
        }

        return {
          score: Math.min(score, 1.0),
          confidence: anomalies.length > 0 ? 0.7 : 0.3, // Higher confidence if anomalies found
          anomalies,
          details: {
            fileInfo,
            videoInfo,
            suspiciousPatterns,
          },
        };
      }
    } else if (file.type.startsWith('image/')) {
      // Image-specific checks
      const imageInfo = await this.extractImageMetadata(file);
      
      if (imageInfo) {
        // Check for AI-common resolutions
        if (imageInfo.width === 512 && imageInfo.height === 512) {
          anomalies.push('ai_common_resolution');
          suspiciousPatterns.push('512x512 is common AI image generation size');
          score += 0.6;
        }

        if (imageInfo.width === 1024 && imageInfo.height === 1024) {
          anomalies.push('ai_common_resolution');
          suspiciousPatterns.push('1024x1024 is common AI image generation size');
          score += 0.5;
        }
      }
    }

    // Normalize score
    score = Math.min(score, 1.0);

    // Confidence based on number of checks passed
    const confidence = anomalies.length > 0 ? 0.6 + (anomalies.length * 0.1) : 0.3;

    return {
      score,
      confidence: Math.min(confidence, 1.0),
      anomalies,
      details: {
        fileInfo,
        suspiciousPatterns,
      },
    };
  }

  /**
   * Extract video metadata using HTML5 video element
   */
  private async extractVideoMetadata(file: File): Promise<VideoMetadata | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const metadata: VideoMetadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
        };

        URL.revokeObjectURL(video.src);
        resolve(metadata);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };

      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract image metadata
   */
  private async extractImageMetadata(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(null);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Analyze metadata for batch of files
   */
  async analyzeBatch(files: File[]): Promise<MetadataAnalysisResult[]> {
    return Promise.all(files.map(file => this.analyzeFile(file)));
  }
}

// Singleton instance
let analyzerInstance: MetadataAnalyzer | null = null;

export const getMetadataAnalyzer = (): MetadataAnalyzer => {
  if (!analyzerInstance) {
    analyzerInstance = new MetadataAnalyzer();
  }
  return analyzerInstance;
};
