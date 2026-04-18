/**
 * Partial Deepfake Detection
 * 
 * Detects localized manipulations where only part of the image/video is fake.
 * Examples: face reenactment (only mouth), face swap (only face region),
 * inpainting (specific objects removed/added).
 * 
 * Approach:
 * 1. Spatial analysis - divide image into regions and analyze separately
 * 2. Boundary detection - find inconsistencies at manipulation boundaries
 * 3. Frequency analysis - detect frequency domain mismatches
 * 4. Attention maps - use model attention to find suspicious regions
 */

export interface SuspiciousRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  reason: string;
  type: 'face_swap' | 'face_reenactment' | 'inpainting' | 'splicing' | 'unknown';
}

export interface PartialDeepfakeResult {
  hasPartialManipulation: boolean;
  overallConfidence: number;
  suspiciousRegions: SuspiciousRegion[];
  manipulationType: string;
  heatmap?: ImageData;
}

/**
 * Divide image into grid and analyze each region
 */
function analyzeRegionalConsistency(
  imageData: ImageData,
  gridSize: number = 8
): number[][] {
  const { data, width, height } = imageData;
  const cellWidth = Math.floor(width / gridSize);
  const cellHeight = Math.floor(height / gridSize);
  
  const scores: number[][] = [];
  
  for (let row = 0; row < gridSize; row++) {
    scores[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      
      // Analyze this cell
      let totalVariance = 0;
      let pixelCount = 0;
      
      for (let dy = 0; dy < cellHeight; dy++) {
        for (let dx = 0; dx < cellWidth; dx++) {
          const px = x + dx;
          const py = y + dy;
          
          if (px >= width || py >= height) continue;
          
          const idx = (py * width + px) * 4;
          
          // Compute local variance (texture measure)
          if (px > 0 && py > 0) {
            const curr = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const left = (data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3;
            const top = (data[((py - 1) * width + px) * 4] + 
                        data[((py - 1) * width + px) * 4 + 1] + 
                        data[((py - 1) * width + px) * 4 + 2]) / 3;
            
            totalVariance += Math.abs(curr - left) + Math.abs(curr - top);
            pixelCount++;
          }
        }
      }
      
      scores[row][col] = pixelCount > 0 ? totalVariance / pixelCount : 0;
    }
  }
  
  return scores;
}

/**
 * Detect boundary inconsistencies (common at manipulation edges)
 */
function detectBoundaryArtifacts(
  imageData: ImageData,
  faceRegion?: { x: number; y: number; width: number; height: number }
): SuspiciousRegion[] {
  const { data, width, height } = imageData;
  const regions: SuspiciousRegion[] = [];
  
  // If face region provided, check its boundaries
  if (faceRegion) {
    const { x, y, width: fw, height: fh } = faceRegion;
    
    // Sample points along face boundary
    const boundaryPoints: Array<{ x: number; y: number }> = [];
    
    // Top edge
    for (let i = 0; i < fw; i += 10) {
      boundaryPoints.push({ x: x + i, y });
    }
    // Bottom edge
    for (let i = 0; i < fw; i += 10) {
      boundaryPoints.push({ x: x + i, y: y + fh });
    }
    // Left edge
    for (let i = 0; i < fh; i += 10) {
      boundaryPoints.push({ x, y: y + i });
    }
    // Right edge
    for (let i = 0; i < fh; i += 10) {
      boundaryPoints.push({ x: x + fw, y: y + i });
    }
    
    // Check for discontinuities at boundary
    let discontinuityCount = 0;
    let totalDiscontinuity = 0;
    
    for (const point of boundaryPoints) {
      if (point.x < 1 || point.x >= width - 1 || point.y < 1 || point.y >= height - 1) {
        continue;
      }
      
      const idx = (point.y * width + point.x) * 4;
      
      // Compare inside vs outside face region
      const inside = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // Sample outside (5 pixels away)
      const dx = point.x < x + fw / 2 ? -5 : 5;
      const dy = point.y < y + fh / 2 ? -5 : 5;
      const outsideIdx = ((point.y + dy) * width + (point.x + dx)) * 4;
      const outside = (data[outsideIdx] + data[outsideIdx + 1] + data[outsideIdx + 2]) / 3;
      
      const discontinuity = Math.abs(inside - outside);
      if (discontinuity > 30) {
        discontinuityCount++;
        totalDiscontinuity += discontinuity;
      }
    }
    
    const avgDiscontinuity = boundaryPoints.length > 0 ? 
      totalDiscontinuity / boundaryPoints.length : 0;
    
    if (discontinuityCount > boundaryPoints.length * 0.3 && avgDiscontinuity > 20) {
      regions.push({
        x,
        y,
        width: fw,
        height: fh,
        confidence: Math.min(1, avgDiscontinuity / 50),
        reason: 'Sharp discontinuity at face boundary - possible face swap',
        type: 'face_swap',
      });
    }
  }
  
  return regions;
}

/**
 * Detect frequency domain inconsistencies
 */
function detectFrequencyMismatches(
  imageData: ImageData,
  gridSize: number = 4
): SuspiciousRegion[] {
  const regions: SuspiciousRegion[] = [];
  const { width, height } = imageData;
  const cellWidth = Math.floor(width / gridSize);
  const cellHeight = Math.floor(height / gridSize);
  
  // Analyze frequency content in each region
  const regionalScores = analyzeRegionalConsistency(imageData, gridSize);
  
  // Find outlier regions (significantly different frequency content)
  const allScores = regionalScores.flat();
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const stdDev = Math.sqrt(
    allScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allScores.length
  );
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const score = regionalScores[row][col];
      const zScore = Math.abs((score - mean) / stdDev);
      
      if (zScore > 2.5) {
        // This region is a statistical outlier
        regions.push({
          x: col * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight,
          confidence: Math.min(1, zScore / 5),
          reason: 'Frequency content mismatch - possible localized manipulation',
          type: 'unknown',
        });
      }
    }
  }
  
  return regions;
}

/**
 * Detect mouth region manipulation (common in face reenactment)
 */
function detectMouthManipulation(
  imageData: ImageData,
  faceLandmarks?: Array<{ x: number; y: number }>
): SuspiciousRegion | null {
  if (!faceLandmarks || faceLandmarks.length < 468) {
    return null;
  }
  
  // MediaPipe face mesh mouth landmarks: indices 61-291 (simplified)
  // For simplicity, we'll use a bounding box around typical mouth region
  const mouthLandmarks = faceLandmarks.slice(61, 291);
  
  if (mouthLandmarks.length === 0) return null;
  
  const xs = mouthLandmarks.map(p => p.x * imageData.width);
  const ys = mouthLandmarks.map(p => p.y * imageData.height);
  
  const mouthRegion = {
    x: Math.floor(Math.min(...xs)),
    y: Math.floor(Math.min(...ys)),
    width: Math.ceil(Math.max(...xs) - Math.min(...xs)),
    height: Math.ceil(Math.max(...ys) - Math.min(...ys)),
  };
  
  // Check for boundary artifacts around mouth
  const boundaryArtifacts = detectBoundaryArtifacts(imageData, mouthRegion);
  
  if (boundaryArtifacts.length > 0) {
    return {
      ...mouthRegion,
      confidence: boundaryArtifacts[0].confidence,
      reason: 'Mouth region shows manipulation artifacts - possible face reenactment',
      type: 'face_reenactment',
    };
  }
  
  return null;
}

/**
 * Main partial deepfake detection function
 */
export function detectPartialDeepfake(
  imageData: ImageData,
  faceBbox?: { xMin: number; yMin: number; width: number; height: number },
  faceLandmarks?: Array<{ x: number; y: number }>,
  modelScores?: Record<string, number>
): PartialDeepfakeResult {
  const suspiciousRegions: SuspiciousRegion[] = [];
  
  // 1. Check face boundary if face detected
  if (faceBbox) {
    const faceRegion = {
      x: Math.floor(faceBbox.xMin * imageData.width),
      y: Math.floor(faceBbox.yMin * imageData.height),
      width: Math.floor(faceBbox.width * imageData.width),
      height: Math.floor(faceBbox.height * imageData.height),
    };
    
    const boundaryRegions = detectBoundaryArtifacts(imageData, faceRegion);
    suspiciousRegions.push(...boundaryRegions);
  }
  
  // 2. Check for mouth manipulation
  if (faceLandmarks) {
    const mouthRegion = detectMouthManipulation(imageData, faceLandmarks);
    if (mouthRegion) {
      suspiciousRegions.push(mouthRegion);
    }
  }
  
  // 3. Frequency analysis across image
  const frequencyRegions = detectFrequencyMismatches(imageData, 6);
  suspiciousRegions.push(...frequencyRegions);
  
  // 4. If models disagree, might indicate partial manipulation
  if (modelScores) {
    const values = Object.values(modelScores).filter(v => v !== undefined);
    if (values.length > 1) {
      const variance = values.reduce((sum, val) => 
        sum + Math.pow(val - values.reduce((a, b) => a + b) / values.length, 2), 0
      ) / values.length;
      
      if (variance > 0.15) {
        // High variance suggests some models see manipulation, others don't
        // This can happen with partial deepfakes
        suspiciousRegions.push({
          x: 0,
          y: 0,
          width: imageData.width,
          height: imageData.height,
          confidence: Math.min(1, variance * 3),
          reason: 'Model disagreement suggests localized manipulation',
          type: 'unknown',
        });
      }
    }
  }
  
  // Merge overlapping regions
  const mergedRegions = mergeOverlappingRegions(suspiciousRegions);
  
  // Determine manipulation type
  const types = mergedRegions.map(r => r.type);
  const manipulationType = 
    types.includes('face_reenactment') ? 'Face Reenactment (mouth region)' :
    types.includes('face_swap') ? 'Face Swap' :
    types.includes('inpainting') ? 'Inpainting' :
    types.includes('splicing') ? 'Image Splicing' :
    mergedRegions.length > 0 ? 'Localized Manipulation' :
    'No partial manipulation detected';
  
  const hasPartialManipulation = mergedRegions.length > 0;
  const overallConfidence = mergedRegions.length > 0 ?
    mergedRegions.reduce((sum, r) => sum + r.confidence, 0) / mergedRegions.length :
    0;
  
  // Generate heatmap
  const heatmap = generateHeatmap(imageData, mergedRegions);
  
  return {
    hasPartialManipulation,
    overallConfidence,
    suspiciousRegions: mergedRegions,
    manipulationType,
    heatmap,
  };
}

/**
 * Merge overlapping suspicious regions
 */
function mergeOverlappingRegions(regions: SuspiciousRegion[]): SuspiciousRegion[] {
  if (regions.length <= 1) return regions;
  
  const merged: SuspiciousRegion[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;
    
    let current = { ...regions[i] };
    used.add(i);
    
    // Find overlapping regions
    for (let j = i + 1; j < regions.length; j++) {
      if (used.has(j)) continue;
      
      const other = regions[j];
      
      // Check for overlap
      const overlapX = Math.max(0, Math.min(current.x + current.width, other.x + other.width) - 
                                    Math.max(current.x, other.x));
      const overlapY = Math.max(0, Math.min(current.y + current.height, other.y + other.height) - 
                                    Math.max(current.y, other.y));
      
      const overlapArea = overlapX * overlapY;
      const currentArea = current.width * current.height;
      const otherArea = other.width * other.height;
      
      if (overlapArea > 0.3 * Math.min(currentArea, otherArea)) {
        // Merge regions
        const newX = Math.min(current.x, other.x);
        const newY = Math.min(current.y, other.y);
        const newWidth = Math.max(current.x + current.width, other.x + other.width) - newX;
        const newHeight = Math.max(current.y + current.height, other.y + other.height) - newY;
        
        current = {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          confidence: Math.max(current.confidence, other.confidence),
          reason: `${current.reason}; ${other.reason}`,
          type: current.type !== 'unknown' ? current.type : other.type,
        };
        
        used.add(j);
      }
    }
    
    merged.push(current);
  }
  
  return merged;
}

/**
 * Generate heatmap visualization of suspicious regions
 */
function generateHeatmap(
  imageData: ImageData,
  regions: SuspiciousRegion[]
): ImageData {
  const heatmap = new ImageData(imageData.width, imageData.height);
  
  // Initialize with transparent
  for (let i = 0; i < heatmap.data.length; i += 4) {
    heatmap.data[i + 3] = 0;
  }
  
  // Draw each region with color intensity based on confidence
  for (const region of regions) {
    for (let y = region.y; y < region.y + region.height && y < imageData.height; y++) {
      for (let x = region.x; x < region.x + region.width && x < imageData.width; x++) {
        const idx = (y * imageData.width + x) * 4;
        
        // Red heatmap
        heatmap.data[idx] = 255;
        heatmap.data[idx + 1] = 0;
        heatmap.data[idx + 2] = 0;
        heatmap.data[idx + 3] = Math.floor(region.confidence * 180); // Semi-transparent
      }
    }
  }
  
  return heatmap;
}
