/**
 * Adversarial Attack Detection
 * 
 * Detects potential adversarial attacks on the deepfake detection system.
 * While we can't make models fully robust to adversarial examples,
 * we can detect suspicious patterns that indicate an attack.
 * 
 * Detection strategies:
 * 1. Input validation - check for unusual image properties
 * 2. Prediction consistency - check if models disagree suspiciously
 * 3. Gradient-based detection - look for high-frequency noise patterns
 * 4. Statistical outliers - detect inputs that are far from training distribution
 */

export interface AdversarialDetectionResult {
  isAdversarial: boolean;
  confidence: number;
  indicators: string[];
  recommendation: string;
}

/**
 * Check for suspicious image properties that might indicate adversarial perturbations
 */
export function detectImageAnomalies(
  imageData: ImageData
): {
  hasHighFrequencyNoise: boolean;
  hasUnusualColorDistribution: boolean;
  hasExtremePixelValues: boolean;
  noiseLevel: number;
} {
  const { data, width, height } = imageData;
  const pixels = width * height;
  
  // 1. High-frequency noise detection (adversarial perturbations are often high-frequency)
  let highFreqEnergy = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Compute Laplacian (second derivative) for each channel
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const top = data[((y - 1) * width + x) * 4 + c];
        const bottom = data[((y + 1) * width + x) * 4 + c];
        const left = data[(y * width + (x - 1)) * 4 + c];
        const right = data[(y * width + (x + 1)) * 4 + c];
        
        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        highFreqEnergy += laplacian;
      }
    }
  }
  
  const avgHighFreq = highFreqEnergy / (pixels * 3);
  const hasHighFrequencyNoise = avgHighFreq > 50; // Threshold based on typical images
  
  // 2. Color distribution analysis
  const colorBins = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
    colorBins[gray]++;
  }
  
  // Check for unusual spikes or gaps in histogram
  let maxBin = 0;
  let emptyBins = 0;
  for (let i = 0; i < 256; i++) {
    maxBin = Math.max(maxBin, colorBins[i]);
    if (colorBins[i] === 0) emptyBins++;
  }
  
  const hasUnusualColorDistribution = (maxBin / pixels > 0.3) || (emptyBins > 200);
  
  // 3. Extreme pixel values (clipping artifacts from adversarial attacks)
  let extremeCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      if (data[i + c] === 0 || data[i + c] === 255) {
        extremeCount++;
      }
    }
  }
  
  const extremeRatio = extremeCount / (pixels * 3);
  const hasExtremePixelValues = extremeRatio > 0.15; // More than 15% extreme values
  
  return {
    hasHighFrequencyNoise,
    hasUnusualColorDistribution,
    hasExtremePixelValues,
    noiseLevel: avgHighFreq,
  };
}

/**
 * Check for suspicious model disagreement patterns
 */
export function detectModelDisagreement(
  scores: Record<string, number>
): {
  hasSuspiciousDisagreement: boolean;
  disagreementScore: number;
  explanation: string;
} {
  const values = Object.values(scores).filter(v => v !== undefined && !isNaN(v));
  
  if (values.length < 2) {
    return {
      hasSuspiciousDisagreement: false,
      disagreementScore: 0,
      explanation: 'Not enough models for disagreement analysis',
    };
  }
  
  // Calculate variance and range
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const range = Math.max(...values) - Math.min(...values);
  
  // High variance + high range suggests adversarial attack
  // (models trained on different data should agree on natural images)
  const disagreementScore = Math.sqrt(variance) * range;
  
  // Check for suspicious patterns:
  // 1. One model very confident, others uncertain
  const maxScore = Math.max(...values);
  const minScore = Math.min(...values);
  const hasOutlier = (maxScore > 0.9 && minScore < 0.5) || (minScore < 0.1 && maxScore > 0.5);
  
  // 2. Bimodal distribution (some models say real, others say fake)
  const realCount = values.filter(v => v < 0.5).length;
  const fakeCount = values.filter(v => v > 0.5).length;
  const isBimodal = realCount > 0 && fakeCount > 0 && Math.abs(realCount - fakeCount) <= 1;
  
  const hasSuspiciousDisagreement = disagreementScore > 0.3 || hasOutlier || isBimodal;
  
  let explanation = '';
  if (hasOutlier) {
    explanation = 'One model strongly disagrees with others - possible adversarial attack';
  } else if (isBimodal) {
    explanation = 'Models split between real/fake - input may be adversarially perturbed';
  } else if (disagreementScore > 0.3) {
    explanation = 'High variance in model predictions - unusual input characteristics';
  }
  
  return {
    hasSuspiciousDisagreement,
    disagreementScore,
    explanation,
  };
}

/**
 * Detect adversarial attacks using multiple signals
 */
export function detectAdversarialAttack(
  imageData: ImageData,
  modelScores: Record<string, number>,
  multiModalAvailable: boolean
): AdversarialDetectionResult {
  const indicators: string[] = [];
  let suspicionScore = 0;
  
  // 1. Image anomaly detection
  const imageAnomalies = detectImageAnomalies(imageData);
  
  if (imageAnomalies.hasHighFrequencyNoise) {
    indicators.push('High-frequency noise detected (typical of adversarial perturbations)');
    suspicionScore += 0.3;
  }
  
  if (imageAnomalies.hasUnusualColorDistribution) {
    indicators.push('Unusual color distribution');
    suspicionScore += 0.2;
  }
  
  if (imageAnomalies.hasExtremePixelValues) {
    indicators.push('Excessive pixel clipping (possible attack artifact)');
    suspicionScore += 0.2;
  }
  
  // 2. Model disagreement analysis
  const disagreement = detectModelDisagreement(modelScores);
  
  if (disagreement.hasSuspiciousDisagreement) {
    indicators.push(disagreement.explanation);
    suspicionScore += 0.4;
  }
  
  // 3. Multi-modal consistency check
  if (!multiModalAvailable) {
    indicators.push('Multi-modal validation unavailable - adversarial attacks harder to detect');
    suspicionScore += 0.1;
  }
  
  // 4. Check for gradient masking (all models very confident in same direction)
  const values = Object.values(modelScores).filter(v => v !== undefined && !isNaN(v));
  if (values.length > 0) {
    const allHighConfidence = values.every(v => v > 0.9 || v < 0.1);
    const allAgree = Math.max(...values) - Math.min(...values) < 0.1;
    
    if (allHighConfidence && allAgree) {
      indicators.push('All models extremely confident - possible gradient masking attack');
      suspicionScore += 0.3;
    }
  }
  
  // Determine if adversarial
  const isAdversarial = suspicionScore > 0.5;
  const confidence = Math.min(1, suspicionScore);
  
  // Generate recommendation
  let recommendation = '';
  if (isAdversarial) {
    recommendation = 'CAUTION: Input shows signs of adversarial manipulation. ' +
      'Recommendation: (1) Verify with multi-modal signals (PPG, lip-sync, voice), ' +
      '(2) Apply input preprocessing (JPEG compression, resizing), ' +
      '(3) Request original unprocessed media if possible.';
  } else if (suspicionScore > 0.3) {
    recommendation = 'Input has some unusual characteristics. Consider additional validation.';
  } else {
    recommendation = 'No strong indicators of adversarial attack detected.';
  }
  
  return {
    isAdversarial,
    confidence,
    indicators,
    recommendation,
  };
}

/**
 * Apply defensive transformations to mitigate adversarial attacks
 */
export async function applyDefensiveTransformations(
  canvas: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  // Create a new canvas for the transformed image
  const defensiveCanvas = document.createElement('canvas');
  defensiveCanvas.width = canvas.width;
  defensiveCanvas.height = canvas.height;
  const defensiveCtx = defensiveCanvas.getContext('2d')!;
  
  // 1. JPEG compression (destroys high-frequency adversarial noise)
  const jpegQuality = 0.85;
  const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
  
  return new Promise<HTMLCanvasElement>((resolve) => {
    const img = new Image();
    img.onload = () => {
      // 2. Slight resize (further disrupts adversarial perturbations)
      const scale = 0.98;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.floor(canvas.width * scale);
      tempCanvas.height = Math.floor(canvas.height * scale);
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // 3. Scale back to original size
      defensiveCtx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      
      resolve(defensiveCanvas);
    };
    img.src = jpegDataUrl;
  });
}

/**
 * Get adversarial robustness score for the current detection setup
 */
export function getAdversarialRobustnessScore(
  modelsUsed: string[],
  multiModalEnabled: boolean,
  defensiveTransformsApplied: boolean
): {
  score: number;
  level: 'low' | 'medium' | 'high';
  explanation: string;
} {
  let score = 0;
  
  // Base score from model diversity
  const hasViT = modelsUsed.some(m => m.includes('ViT'));
  const hasCNN = modelsUsed.some(m => m.includes('MesoNet') || m.includes('Xception'));
  const hasCLIP = modelsUsed.some(m => m.includes('CLIP') || m.includes('UnivFD'));
  
  if (hasViT) score += 0.2;
  if (hasCNN) score += 0.2;
  if (hasCLIP) score += 0.3;
  
  // Multi-modal signals are harder to attack simultaneously
  if (multiModalEnabled) score += 0.2;
  
  // Defensive transformations
  if (defensiveTransformsApplied) score += 0.1;
  
  const level = score < 0.4 ? 'low' : score < 0.7 ? 'medium' : 'high';
  
  const explanation = 
    level === 'high' ? 'Strong adversarial robustness: diverse models + multi-modal validation' :
    level === 'medium' ? 'Moderate robustness: some model diversity, consider enabling multi-modal' :
    'Limited robustness: single model type vulnerable to targeted attacks';
  
  return { score, level, explanation };
}
