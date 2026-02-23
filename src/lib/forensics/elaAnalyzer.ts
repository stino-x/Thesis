/**
 * Error Level Analysis (ELA) Module
 * 
 * Detects image manipulation by re-compressing at a known quality
 * and comparing the error levels. Manipulated regions show higher
 * error levels because they were saved at a different quality.
 * 
 * Also includes:
 * - Noise inconsistency analysis
 * - Frequency domain analysis via DCT approximation
 */

export interface ELAResult {
  score: number;          // 0-1, higher = more suspicious
  confidence: number;
  anomalies: string[];
  details: {
    meanError: number;
    maxError: number;
    stdDevError: number;
    suspiciousRegionCount: number;
    suspiciousRegions: { x: number; y: number; intensity: number }[];
    noiseScore: number;
    frequencyScore: number;
  };
}

/**
 * Perform Error Level Analysis on an image canvas.
 * 
 * 1. Re-compress the image as JPEG at quality=75
 * 2. Compute pixel-level difference between original and recompressed
 * 3. Regions with unusually high difference likely were manipulated
 */
export async function performELA(
  canvas: HTMLCanvasElement,
  quality: number = 0.75,
  amplification: number = 10
): Promise<ELAResult> {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return emptyResult();
  }

  const width = canvas.width;
  const height = canvas.height;

  // Get original pixel data
  const originalData = ctx.getImageData(0, 0, width, height);

  // Step 1: Re-compress as JPEG at specified quality
  const recompressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });

  if (!recompressedBlob) {
    return emptyResult();
  }

  // Step 2: Load re-compressed image back
  const recompressedImg = await loadBlobAsImage(recompressedBlob);
  
  // Draw recompressed to offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d')!;
  offCtx.drawImage(recompressedImg, 0, 0, width, height);
  const recompressedData = offCtx.getImageData(0, 0, width, height);

  // Step 3: Compute error levels (pixel-level difference)
  const errorPixels = new Float32Array(width * height);
  let totalError = 0;
  let maxError = 0;

  for (let i = 0; i < originalData.data.length; i += 4) {
    const pixelIdx = i / 4;
    const rDiff = Math.abs(originalData.data[i] - recompressedData.data[i]);
    const gDiff = Math.abs(originalData.data[i + 1] - recompressedData.data[i + 1]);
    const bDiff = Math.abs(originalData.data[i + 2] - recompressedData.data[i + 2]);
    
    // Average error across channels, amplified
    const error = ((rDiff + gDiff + bDiff) / 3) * amplification;
    const clampedError = Math.min(error, 255);
    
    errorPixels[pixelIdx] = clampedError;
    totalError += clampedError;
    if (clampedError > maxError) maxError = clampedError;
  }

  const pixelCount = width * height;
  const meanError = totalError / pixelCount;

  // Compute standard deviation
  let variance = 0;
  for (let i = 0; i < pixelCount; i++) {
    const diff = errorPixels[i] - meanError;
    variance += diff * diff;
  }
  const stdDevError = Math.sqrt(variance / pixelCount);

  // Step 4: Find suspicious regions (error significantly above mean)
  const threshold = meanError + 2 * stdDevError;
  const gridSize = 32;
  const gridCols = Math.ceil(width / gridSize);
  const gridRows = Math.ceil(height / gridSize);
  const suspiciousRegions: { x: number; y: number; intensity: number }[] = [];

  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      let regionError = 0;
      let regionCount = 0;

      for (let py = gy * gridSize; py < Math.min((gy + 1) * gridSize, height); py++) {
        for (let px = gx * gridSize; px < Math.min((gx + 1) * gridSize, width); px++) {
          regionError += errorPixels[py * width + px];
          regionCount++;
        }
      }

      const avgRegionError = regionError / regionCount;
      if (avgRegionError > threshold) {
        suspiciousRegions.push({
          x: gx * gridSize + gridSize / 2,
          y: gy * gridSize + gridSize / 2,
          intensity: Math.min(avgRegionError / 255, 1),
        });
      }
    }
  }

  // Step 5: Noise inconsistency analysis
  const noiseScore = analyzeNoiseConsistency(originalData, width, height);

  // Step 6: Frequency domain analysis (DCT approximation)
  const frequencyScore = analyzeFrequencyDomain(originalData, width, height);

  // Compute overall score
  const anomalies: string[] = [];
  let score = 0;

  // High mean error suggests recompression artifacts
  const normalizedMeanError = Math.min(meanError / 128, 1);
  score += normalizedMeanError * 0.3;

  // High std dev means inconsistent compression across regions
  const normalizedStdDev = Math.min(stdDevError / 64, 1);
  score += normalizedStdDev * 0.2;

  if (suspiciousRegions.length > (gridCols * gridRows) * 0.1) {
    anomalies.push('ela_high_error_regions');
    score += 0.15;
  }

  if (noiseScore > 0.5) {
    anomalies.push('noise_inconsistency');
    score += noiseScore * 0.2;
  }

  if (frequencyScore > 0.5) {
    anomalies.push('frequency_anomaly');
    score += frequencyScore * 0.15;
  }

  score = Math.min(score, 1.0);

  return {
    score,
    confidence: score > 0.3 ? 0.7 : 0.4,
    anomalies,
    details: {
      meanError,
      maxError,
      stdDevError,
      suspiciousRegionCount: suspiciousRegions.length,
      suspiciousRegions,
      noiseScore,
      frequencyScore,
    },
  };
}

/**
 * Analyze noise consistency across image regions.
 * Manipulated regions often have different noise patterns.
 */
function analyzeNoiseConsistency(
  imageData: ImageData,
  width: number,
  height: number
): number {
  const blockSize = 64;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);

  if (blocksX < 2 || blocksY < 2) return 0;

  const blockNoises: number[] = [];

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let noise = 0;
      let count = 0;

      for (let y = by * blockSize; y < (by + 1) * blockSize - 1; y++) {
        for (let x = bx * blockSize; x < (bx + 1) * blockSize - 1; x++) {
          const idx = (y * width + x) * 4;
          const idxRight = (y * width + x + 1) * 4;
          const idxDown = ((y + 1) * width + x) * 4;

          // Laplacian approximation
          for (let c = 0; c < 3; c++) {
            const center = imageData.data[idx + c];
            const right = imageData.data[idxRight + c];
            const down = imageData.data[idxDown + c];
            noise += Math.abs(2 * center - right - down);
          }
          count++;
        }
      }

      blockNoises.push(noise / (count * 3));
    }
  }

  // Calculate coefficient of variation of block noise levels
  const mean = blockNoises.reduce((a, b) => a + b, 0) / blockNoises.length;
  if (mean === 0) return 0;

  const stdDev = Math.sqrt(
    blockNoises.reduce((sum, v) => sum + (v - mean) ** 2, 0) / blockNoises.length
  );
  const cv = stdDev / mean;

  // High CV means inconsistent noise = suspicious
  return Math.min(cv / 0.5, 1);
}

/**
 * Analyze frequency domain characteristics using
 * a simplified DCT-like approach (gradient magnitude histogram).
 * AI-generated images often have distinct frequency signatures.
 */
function analyzeFrequencyDomain(
  imageData: ImageData,
  width: number,
  height: number
): number {
  // Compute gradient magnitudes as a proxy for frequency content
  const gradients: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      // Use luminance channel
      const lum = imageData.data[idx] * 0.299 +
                  imageData.data[idx + 1] * 0.587 +
                  imageData.data[idx + 2] * 0.114;

      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      const idxUp = ((y - 1) * width + x) * 4;
      const idxDown = ((y + 1) * width + x) * 4;

      const lumLeft = imageData.data[idxLeft] * 0.299 +
                      imageData.data[idxLeft + 1] * 0.587 +
                      imageData.data[idxLeft + 2] * 0.114;
      const lumRight = imageData.data[idxRight] * 0.299 +
                       imageData.data[idxRight + 1] * 0.587 +
                       imageData.data[idxRight + 2] * 0.114;
      const lumUp = imageData.data[idxUp] * 0.299 +
                    imageData.data[idxUp + 1] * 0.587 +
                    imageData.data[idxUp + 2] * 0.114;
      const lumDown = imageData.data[idxDown] * 0.299 +
                      imageData.data[idxDown + 1] * 0.587 +
                      imageData.data[idxDown + 2] * 0.114;

      const gx = lumRight - lumLeft;
      const gy = lumDown - lumUp;
      gradients.push(Math.sqrt(gx * gx + gy * gy));
    }
  }

  if (gradients.length === 0) return 0;

  // Build histogram of gradient magnitudes (10 bins)
  const bins = 10;
  const maxGrad = Math.max(...gradients);
  if (maxGrad === 0) return 0;

  const histogram = new Array(bins).fill(0);
  for (const g of gradients) {
    const bin = Math.min(Math.floor((g / maxGrad) * bins), bins - 1);
    histogram[bin]++;
  }

  // Normalize histogram
  const total = gradients.length;
  const normalizedHist = histogram.map(v => v / total);

  // Compute entropy — AI images often have lower entropy (smoother gradients)
  let entropy = 0;
  for (const p of normalizedHist) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Maximum entropy for 10 bins is log2(10) ≈ 3.32
  const normalizedEntropy = entropy / Math.log2(bins);

  // Low entropy is suspicious (AI-generated typically smoother)
  // Very low (<0.5) or very high (>0.95) are suspicious
  if (normalizedEntropy < 0.5) {
    return 1 - normalizedEntropy; // Low entropy → high score
  } else if (normalizedEntropy > 0.95) {
    return (normalizedEntropy - 0.95) * 10; // Very high → slightly suspicious
  }

  return 0;
}

function loadBlobAsImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load recompressed image'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

function emptyResult(): ELAResult {
  return {
    score: 0,
    confidence: 0,
    anomalies: [],
    details: {
      meanError: 0,
      maxError: 0,
      stdDevError: 0,
      suspiciousRegionCount: 0,
      suspiciousRegions: [],
      noiseScore: 0,
      frequencyScore: 0,
    },
  };
}
