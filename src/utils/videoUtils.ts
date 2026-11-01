/**
 * Video Utilities
 * 
 * Provides utilities for:
 * - Video loading and validation
 * - Frame extraction
 * - Video metadata
 * - Stream management
 */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  totalFrames: number;
}

/**
 * Load video from file
 */
export const loadVideo = (file: File): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      resolve(video);
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Get video metadata
 */
export const getVideoMetadata = (video: HTMLVideoElement): VideoMetadata => {
  return {
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    frameRate: 30, // Default, actual frame rate detection is complex
    totalFrames: Math.floor(video.duration * 30),
  };
};

/**
 * Extract frame at specific time with timeout
 */
export const extractFrame = async (
  video: HTMLVideoElement,
  time: number,
  timeoutMs: number = 5000
): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout;
    
    const cleanup = () => {
      video.onseeked = null;
      video.onerror = null;
      if (timeoutId) clearTimeout(timeoutId);
    };
    
    const onSuccess = () => {
      cleanup();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    
    const onError = () => {
      cleanup();
      reject(new Error('Failed to seek video'));
    };
    
    const onTimeout = () => {
      cleanup();
      reject(new Error(`Frame extraction timeout after ${timeoutMs}ms at time ${time}s`));
    };
    
    // Set timeout
    timeoutId = setTimeout(onTimeout, timeoutMs);
    
    // Set up event handlers
    video.onseeked = onSuccess;
    video.onerror = onError;
    
    // Start seeking
    video.currentTime = time;
  });
};

/**
 * Extract multiple frames from video with timeout and error handling
 */
export const extractFrames = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  intervalSeconds: number = 0.5
): Promise<Array<{ imageData: HTMLCanvasElement; timestamp: number }>> => {
  const frames: Array<{ imageData: HTMLCanvasElement; timestamp: number }> = [];
  const duration = video.duration;
  
  for (let time = 0; time < duration; time += intervalSeconds) {
    try {
      const frameCanvas = await extractFrame(video, time, 5000);
      frames.push({ imageData: frameCanvas, timestamp: time });
    } catch (error) {
      console.warn(`⚠️ Failed to extract frame at ${time}s:`, error);
      // Continue with next frame instead of stopping entire extraction
      // You could optionally push a placeholder or skip this frame
    }
  }
  
  // If no frames could be extracted at all, try one more time at 0 timestamp
  if (frames.length === 0 && duration > 0) {
    try {
      const frameCanvas = await extractFrame(video, 0, 10000);
      frames.push({ imageData: frameCanvas, timestamp: 0 });
    } catch (error) {
      console.error('❌ Could not extract any frames from video:', error);
      throw new Error('No frames could be extracted from the video');
    }
  }
  
  return frames;
};

/**
 * Get webcam stream
 */
export const getWebcamStream = async (
  constraints?: MediaStreamConstraints
): Promise<MediaStream> => {
  const defaultConstraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  };
  
  try {
    return await navigator.mediaDevices.getUserMedia(
      constraints || defaultConstraints
    );
  } catch (error) {
    throw new Error(`Failed to access webcam: ${error}`);
  }
};

/**
 * Stop media stream
 */
export const stopMediaStream = (stream: MediaStream): void => {
  stream.getTracks().forEach(track => track.stop());
};

/**
 * Validate video file
 */
export const validateVideoFile = (file: File): boolean => {
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  return validTypes.includes(file.type);
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
};

/**
 * Get file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Calculate estimated processing time
 */
export const estimateProcessingTime = (
  fileSize: number,
  isVideo: boolean
): number => {
  // Rough estimates in milliseconds
  const baseTime = 1000; // 1 second base
  const sizeMultiplier = fileSize / (1024 * 1024); // MB
  const videoMultiplier = isVideo ? 5 : 1;
  
  return baseTime + (sizeMultiplier * 100 * videoMultiplier);
};

/**
 * Create video thumbnail
 */
export const createVideoThumbnail = async (
  video: HTMLVideoElement,
  time: number = 0
): Promise<string> => {
  const canvas = await extractFrame(video, time);
  return canvas.toDataURL('image/jpeg', 0.8);
};

/**
 * Load image from file
 */
export const loadImage = (file: File, timeoutMs: number = 10000): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let timeoutId: NodeJS.Timeout;
    
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      if (timeoutId) clearTimeout(timeoutId);
    };
    
    const onSuccess = () => {
      cleanup();
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    
    const onError = () => {
      cleanup();
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    const onTimeout = () => {
      cleanup();
      URL.revokeObjectURL(img.src);
      reject(new Error(`Image loading timeout after ${timeoutMs}ms`));
    };
    
    // Set timeout
    timeoutId = setTimeout(onTimeout, timeoutMs);
    
    // Set up event handlers
    img.onload = onSuccess;
    img.onerror = onError;
    
    // Start loading
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Format duration in seconds to readable format (MM:SS)
 */
export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
