/**
 * Defensive Transformations
 * 
 * Apply transformations to defend against adversarial attacks
 * These transformations can help detect adversarial perturbations
 * by removing or reducing their effect
 */

export interface DefensiveOptions {
  jpegCompression?: number; // Quality 0-100
  gaussianBlur?: number; // Sigma value
  randomCrop?: boolean;
  resize?: boolean;
}

/**
 * Apply JPEG compression to remove high-frequency adversarial noise
 */
export async function applyJPEGCompression(
  canvas: HTMLCanvasElement,
  quality: number = 90
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(canvas);
          return;
        }

        const img = new Image();
        img.onload = () => {
          const newCanvas = document.createElement('canvas');
          newCanvas.width = canvas.width;
          newCanvas.height = canvas.height;
          const ctx = newCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }
          URL.revokeObjectURL(img.src);
          resolve(newCanvas);
        };
        img.src = URL.createObjectURL(blob);
      },
      'image/jpeg',
      quality / 100
    );
  });
}

/**
 * Apply Gaussian blur to smooth out adversarial perturbations
 */
export function applyGaussianBlur(
  canvas: HTMLCanvasElement,
  sigma: number = 1.0
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  const newCtx = newCanvas.getContext('2d');
  if (!newCtx) return canvas;

  // Apply CSS filter for blur
  newCtx.filter = `blur(${sigma}px)`;
  newCtx.drawImage(canvas, 0, 0);
  newCtx.filter = 'none';

  return newCanvas;
}

/**
 * Apply random crop and resize
 */
export function applyRandomCrop(
  canvas: HTMLCanvasElement,
  cropPercent: number = 0.9
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  const newCtx = newCanvas.getContext('2d');
  if (!newCtx) return canvas;

  // Random crop
  const cropWidth = canvas.width * cropPercent;
  const cropHeight = canvas.height * cropPercent;
  const offsetX = Math.random() * (canvas.width - cropWidth);
  const offsetY = Math.random() * (canvas.height - cropHeight);

  // Draw cropped and resized
  newCtx.drawImage(
    canvas,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return newCanvas;
}

/**
 * Apply slight resize (scale down and back up)
 */
export function applyResize(
  canvas: HTMLCanvasElement,
  scaleFactor: number = 0.95
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width * scaleFactor;
  tempCanvas.height = canvas.height * scaleFactor;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return canvas;

  // Scale down
  tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

  // Scale back up
  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  const newCtx = newCanvas.getContext('2d');
  if (!newCtx) return canvas;

  newCtx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

  return newCanvas;
}

/**
 * Apply all defensive transformations
 */
export async function applyDefensiveTransforms(
  canvas: HTMLCanvasElement,
  options: DefensiveOptions
): Promise<HTMLCanvasElement> {
  let result = canvas;

  // Apply in order of effectiveness
  if (options.jpegCompression !== undefined) {
    result = await applyJPEGCompression(result, options.jpegCompression);
  }

  if (options.gaussianBlur !== undefined && options.gaussianBlur > 0) {
    result = applyGaussianBlur(result, options.gaussianBlur);
  }

  if (options.randomCrop) {
    result = applyRandomCrop(result);
  }

  if (options.resize) {
    result = applyResize(result);
  }

  return result;
}

/**
 * Get recommended defensive options based on adversarial confidence
 */
export function getRecommendedDefenses(adversarialConfidence: number): DefensiveOptions {
  if (adversarialConfidence > 0.8) {
    // Strong adversarial attack suspected
    return {
      jpegCompression: 85,
      gaussianBlur: 1.5,
      randomCrop: true,
      resize: true,
    };
  } else if (adversarialConfidence > 0.5) {
    // Moderate adversarial attack suspected
    return {
      jpegCompression: 90,
      gaussianBlur: 1.0,
      resize: true,
    };
  } else {
    // Light defense
    return {
      jpegCompression: 95,
    };
  }
}
