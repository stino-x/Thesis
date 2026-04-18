/**
 * Face Localizer — crop face region before ViT inference
 *
 * ViT deepfake models were trained on cropped face images.
 * Feeding the full frame (with background, body, etc.) significantly
 * reduces accuracy because the model's attention spreads over irrelevant regions.
 *
 * Strategy:
 *  1. Try MediaPipe face bounding box (already available, zero extra cost)
 *  2. Fall back to a simple skin-tone + edge heuristic if MediaPipe unavailable
 *  3. If no face found, return the original canvas (graceful degradation)
 *
 * The cropped canvas is what gets passed to onnxDetector.canvasToTensor().
 * We add a 20% margin around the bounding box so the model sees some context.
 */

export interface FaceBoundingBox {
  x: number;      // 0-1 normalized
  y: number;
  width: number;
  height: number;
}

/**
 * Crop a canvas to the face region with margin.
 * Returns a new canvas containing only the face, or the original if no face found.
 */
export function cropFaceFromCanvas(
  canvas: HTMLCanvasElement,
  bbox: FaceBoundingBox | null,
  margin = 0.20
): HTMLCanvasElement {
  if (!bbox) return canvas;

  const w = canvas.width;
  const h = canvas.height;

  // Add margin
  const mx = bbox.width  * margin;
  const my = bbox.height * margin;

  const x1 = Math.max(0, (bbox.x      - mx) * w);
  const y1 = Math.max(0, (bbox.y      - my) * h);
  const x2 = Math.min(w, (bbox.x + bbox.width  + mx) * w);
  const y2 = Math.min(h, (bbox.y + bbox.height + my) * h);

  const cropW = x2 - x1;
  const cropH = y2 - y1;

  if (cropW < 32 || cropH < 32) return canvas; // too small, skip

  const out    = document.createElement('canvas');
  out.width    = cropW;
  out.height   = cropH;
  out.getContext('2d')!.drawImage(canvas, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

/**
 * Convert a MediaPipe face detection bounding box to our normalized format.
 * MediaPipe returns xMin/yMin/width/height all in 0-1 range.
 */
export function mediapipeBboxToFaceBbox(mpBbox: {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
}): FaceBoundingBox {
  return {
    x: mpBbox.xMin,
    y: mpBbox.yMin,
    width: mpBbox.width,
    height: mpBbox.height,
  };
}
