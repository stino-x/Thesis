/**
 * OpenCV Preprocessing Module
 * 
 * Handles all image preprocessing tasks:
 * - Color space conversions
 * - Noise reduction
 * - Histogram equalization
 * - Resizing and cropping
 * - Edge detection
 * - Real-world condition simulation
 */

// Note: This assumes opencv.js is loaded globally
// Add to index.html: <script async src="https://docs.opencv.org/master/opencv.js"></script>

declare const cv: any;

/**
 * Wait for OpenCV to be ready (with timeout)
 */
export const waitForOpenCV = (timeoutMs = 15000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof cv !== 'undefined' && cv.Mat) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error('OpenCV.js failed to load within timeout. Check your network connection.'));
      }
    }, 100);
  });
};

/**
 * Convert canvas to OpenCV Mat
 */
export const canvasToMat = (canvas: HTMLCanvasElement): any => {
  return cv.imread(canvas);
};

/**
 * Convert OpenCV Mat to canvas
 */
export const matToCanvas = (mat: any, canvas: HTMLCanvasElement): void => {
  cv.imshow(canvas, mat);
};

/**
 * Convert BGR to RGB
 */
export const bgrToRgb = (src: any): any => {
  const dst = new cv.Mat();
  cv.cvtColor(src, dst, cv.COLOR_BGR2RGB);
  return dst;
};

/**
 * Convert RGB to BGR
 */
export const rgbToBgr = (src: any): any => {
  const dst = new cv.Mat();
  cv.cvtColor(src, dst, cv.COLOR_RGB2BGR);
  return dst;
};

/**
 * Resize image
 */
export const resizeImage = (
  src: any,
  width: number,
  height: number
): any => {
  const dst = new cv.Mat();
  const dsize = new cv.Size(width, height);
  cv.resize(src, dst, dsize, 0, 0, cv.INTER_LINEAR);
  return dst;
};

/**
 * Apply Gaussian blur (noise reduction)
 */
export const gaussianBlur = (
  src: any,
  kernelSize: number = 5,
  sigma: number = 0
): any => {
  const dst = new cv.Mat();
  const ksize = new cv.Size(kernelSize, kernelSize);
  cv.GaussianBlur(src, dst, ksize, sigma, sigma, cv.BORDER_DEFAULT);
  return dst;
};

/**
 * Histogram equalization (improve contrast)
 */
export const equalizeHistogram = (src: any): any => {
  let gray = new cv.Mat();
  const dst = new cv.Mat();
  
  // Convert to grayscale if needed
  if (src.channels() === 3) {
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);
  } else {
    gray = src.clone();
  }
  
  cv.equalizeHist(gray, dst);
  
  gray.delete();
  return dst;
};

/**
 * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
 */
export const applyCLAHE = (
  src: any,
  clipLimit: number = 2.0,
  tileGridSize: number = 8
): any => {
  const clahe = new cv.CLAHE(clipLimit, new cv.Size(tileGridSize, tileGridSize));
  const dst = new cv.Mat();
  
  if (src.channels() === 3) {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);
    clahe.apply(gray, dst);
    gray.delete();
  } else {
    clahe.apply(src, dst);
  }
  
  clahe.delete();
  return dst;
};

/**
 * Edge detection using Canny
 */
export const cannyEdgeDetection = (
  src: any,
  threshold1: number = 50,
  threshold2: number = 150
): any => {
  let gray = new cv.Mat();
  const edges = new cv.Mat();
  
  // Convert to grayscale if needed
  if (src.channels() === 3) {
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);
  } else {
    gray = src.clone();
  }
  
  cv.Canny(gray, edges, threshold1, threshold2);
  
  gray.delete();
  return edges;
};

/**
 * Sharpen image
 */
export const sharpenImage = (src: any): any => {
  const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ]);
  
  const dst = new cv.Mat();
  cv.filter2D(src, dst, cv.CV_8U, kernel);
  
  kernel.delete();
  return dst;
};

/**
 * Crop image to face region
 */
export const cropToFace = (
  src: any,
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = 0.2
): any => {
  // Add padding
  const padX = Math.floor(width * padding);
  const padY = Math.floor(height * padding);
  
  const cropX = Math.max(0, x - padX);
  const cropY = Math.max(0, y - padY);
  const cropWidth = Math.min(src.cols - cropX, width + 2 * padX);
  const cropHeight = Math.min(src.rows - cropY, height + 2 * padY);
  
  const rect = new cv.Rect(cropX, cropY, cropWidth, cropHeight);
  const cropped = src.roi(rect);
  
  return cropped;
};

/**
 * Normalize image (0-1 range)
 */
export const normalizeImage = (src: any): any => {
  const dst = new cv.Mat();
  cv.normalize(src, dst, 0, 1, cv.NORM_MINMAX, cv.CV_32F);
  return dst;
};

/**
 * Simulate compression artifacts (for robustness training)
 */
export const simulateCompression = (
  src: any,
  quality: number = 50
): any => {
  // This would require encoding/decoding
  // For now, return a slightly blurred version
  return gaussianBlur(src, 3, 0.5);
};

/**
 * Add noise (for robustness training)
 */
export const addNoise = (
  src: any,
  noiseLevel: number = 10
): any => {
  const noise = new cv.Mat(src.rows, src.cols, src.type());
  cv.randn(noise, 0, noiseLevel);
  
  const dst = new cv.Mat();
  cv.add(src, noise, dst);
  
  noise.delete();
  return dst;
};

/**
 * Adjust brightness
 */
export const adjustBrightness = (
  src: any,
  alpha: number = 1.0,
  beta: number = 0
): any => {
  const dst = new cv.Mat();
  src.convertTo(dst, -1, alpha, beta);
  return dst;
};

/**
 * Detect face using Haar Cascade (fallback)
 */
export const detectFaceHaar = async (src: any): Promise<any[]> => {
  // This requires loading Haar Cascade XML
  // For now, return empty array (MediaPipe will handle face detection)
  return [];
};

/**
 * Preprocess image for ML model
 */
export const preprocessForML = (
  src: any,
  targetSize: number = 224
): any => {
  // 1. Resize to target size
  let processed = resizeImage(src, targetSize, targetSize);
  
  // 2. Convert to RGB if needed
  if (processed.channels() === 4) {
    const rgb = new cv.Mat();
    cv.cvtColor(processed, rgb, cv.COLOR_BGRA2RGB);
    processed.delete();
    processed = rgb;
  } else if (processed.channels() === 1) {
    const rgb = new cv.Mat();
    cv.cvtColor(processed, rgb, cv.COLOR_GRAY2RGB);
    processed.delete();
    processed = rgb;
  }
  
  // 3. Normalize to 0-1
  const normalized = normalizeImage(processed);
  processed.delete();
  
  return normalized;
};

/**
 * Batch preprocessing for video frames
 */
export const preprocessFrames = (
  frames: HTMLCanvasElement[],
  targetSize: number = 224
): any[] => {
  return frames.map(frame => {
    const mat = canvasToMat(frame);
    const processed = preprocessForML(mat, targetSize);
    mat.delete();
    return processed;
  });
};

/**
 * Clean up OpenCV Mat
 */
export const deleteMat = (mat: any): void => {
  if (mat && !mat.isDeleted()) {
    mat.delete();
  }
};

/**
 * Clean up multiple Mats
 */
export const deleteMats = (mats: any[]): void => {
  mats.forEach(mat => deleteMat(mat));
};
