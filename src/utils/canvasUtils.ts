/**
 * Canvas Utilities for Drawing and Rendering
 * 
 * Provides utilities for:
 * - Drawing bounding boxes
 * - Rendering landmarks
 * - Creating overlays
 * - Heatmap generation
 */

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draw bounding box on canvas
 */
export const drawBoundingBox = (
  ctx: CanvasRenderingContext2D,
  box: BoundingBox,
  color: string = '#00ff00',
  lineWidth: number = 2,
  label?: string
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  
  // Draw label if provided
  if (label) {
    ctx.fillStyle = color;
    ctx.font = '16px Arial';
    ctx.fillText(label, box.x, box.y - 5);
  }
};

/**
 * Draw facial landmarks
 */
export const drawLandmarks = (
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  color: string = '#ff0000',
  radius: number = 2
): void => {
  ctx.fillStyle = color;
  landmarks.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fill();
  });
};

/**
 * Draw lines connecting landmarks
 */
export const drawConnections = (
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  connections: [number, number][],
  color: string = '#00ff00',
  lineWidth: number = 1
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  
  connections.forEach(([start, end]) => {
    if (landmarks[start] && landmarks[end]) {
      ctx.beginPath();
      ctx.moveTo(landmarks[start].x, landmarks[start].y);
      ctx.lineTo(landmarks[end].x, landmarks[end].y);
      ctx.stroke();
    }
  });
};

/**
 * Draw confidence score overlay
 */
export const drawConfidenceOverlay = (
  ctx: CanvasRenderingContext2D,
  confidence: number,
  isDeepfake: boolean,
  x: number = 10,
  y: number = 30
): void => {
  const color = isDeepfake ? '#ff0000' : '#00ff00';
  const text = `${isDeepfake ? 'DEEPFAKE' : 'REAL'}: ${(confidence * 100).toFixed(1)}%`;
  
  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 5, y - 25, 250, 35);
  
  // Draw text
  ctx.fillStyle = color;
  ctx.font = 'bold 20px Arial';
  ctx.fillText(text, x, y);
};

/**
 * Create heatmap overlay
 */
export const createHeatmap = (
  canvas: HTMLCanvasElement,
  suspiciousRegions: { x: number; y: number; intensity: number }[]
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  suspiciousRegions.forEach(region => {
    const gradient = ctx.createRadialGradient(
      region.x, region.y, 0,
      region.x, region.y, 50
    );
    
    const intensity = Math.min(region.intensity, 1);
    gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(region.x - 50, region.y - 50, 100, 100);
  });
};

/**
 * Clear canvas
 */
export const clearCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};

/**
 * Draw video frame to canvas
 */
export const drawVideoFrame = (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
};

/**
 * Draw image to canvas with scaling
 */
export const drawImageScaled = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | HTMLCanvasElement,
  targetWidth?: number,
  targetHeight?: number
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const width = targetWidth || image.width;
  const height = targetHeight || image.height;
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
};

/**
 * Convert canvas to blob
 */
export const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.95
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      },
      type,
      quality
    );
  });
};

/**
 * Get image data from canvas
 */
export const getImageData = (
  canvas: HTMLCanvasElement
): ImageData | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Put image data to canvas
 */
export const putImageData = (
  canvas: HTMLCanvasElement,
  imageData: ImageData
): void => {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.putImageData(imageData, 0, 0);
  }
};
