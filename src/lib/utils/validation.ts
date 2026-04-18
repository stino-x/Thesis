/**
 * Validation Utilities
 * 
 * Validate data structures to prevent crashes from malformed data
 */

export interface BoundingBox {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
}

/**
 * Validate face bounding box format
 */
export function isValidBoundingBox(bbox: any): bbox is BoundingBox {
  if (!bbox || typeof bbox !== 'object') return false;

  const { xMin, yMin, width, height } = bbox;

  // Check all required properties exist and are numbers
  if (
    typeof xMin !== 'number' ||
    typeof yMin !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return false;
  }

  // Check for valid ranges (normalized 0-1 or pixel coordinates)
  if (
    !isFinite(xMin) ||
    !isFinite(yMin) ||
    !isFinite(width) ||
    !isFinite(height)
  ) {
    return false;
  }

  // Check for positive dimensions
  if (width <= 0 || height <= 0) {
    return false;
  }

  // Check for reasonable bounds (not negative, not too large)
  if (xMin < 0 || yMin < 0) {
    return false;
  }

  return true;
}

/**
 * Sanitize bounding box to ensure valid values
 */
export function sanitizeBoundingBox(bbox: any): BoundingBox | null {
  if (!isValidBoundingBox(bbox)) {
    console.warn('Invalid bounding box detected:', bbox);
    return null;
  }

  // Clamp values to reasonable ranges
  return {
    xMin: Math.max(0, Math.min(1, bbox.xMin)),
    yMin: Math.max(0, Math.min(1, bbox.yMin)),
    width: Math.max(0, Math.min(1, bbox.width)),
    height: Math.max(0, Math.min(1, bbox.height)),
  };
}

/**
 * Validate landmarks array
 */
export function isValidLandmarks(landmarks: any): boolean {
  if (!Array.isArray(landmarks)) return false;
  if (landmarks.length === 0) return false;

  // Check first few landmarks have x, y properties
  for (let i = 0; i < Math.min(3, landmarks.length); i++) {
    const lm = landmarks[i];
    if (
      !lm ||
      typeof lm.x !== 'number' ||
      typeof lm.y !== 'number' ||
      !isFinite(lm.x) ||
      !isFinite(lm.y)
    ) {
      return false;
    }
  }

  return true;
}
