/**
 * Face Localizer — crop and align face region before ViT inference
 *
 * ViT deepfake models were trained on cropped, aligned face images.
 * Feeding the full frame reduces accuracy because the model's attention
 * spreads over irrelevant regions. Alignment (rotating so eyes are
 * horizontal) further improves accuracy by matching training distribution.
 */

export interface FaceBoundingBox {
  x: number;      // 0-1 normalized
  y: number;
  width: number;
  height: number;
}

export interface EyePoints {
  leftEye:  { x: number; y: number };  // 0-1 normalized
  rightEye: { x: number; y: number };
}

/**
 * Crop and optionally align a canvas to the face region.
 * Returns a new canvas containing only the (aligned) face,
 * or the original canvas if no face found.
 */
export function cropFaceFromCanvas(
  canvas: HTMLCanvasElement,
  bbox: FaceBoundingBox | null,
  margin = 0.20,
  eyes?: EyePoints
): HTMLCanvasElement {
  if (!bbox) return canvas;

  const w = canvas.width;
  const h = canvas.height;

  const mx = bbox.width  * margin;
  const my = bbox.height * margin;

  const x1 = Math.max(0, (bbox.x - mx) * w);
  const y1 = Math.max(0, (bbox.y - my) * h);
  const x2 = Math.min(w, (bbox.x + bbox.width  + mx) * w);
  const y2 = Math.min(h, (bbox.y + bbox.height + my) * h);

  const cropW = x2 - x1;
  const cropH = y2 - y1;

  if (cropW < 32 || cropH < 32) return canvas;

  // If eye points are provided, align the face (rotate so eyes are horizontal)
  if (eyes) {
    return alignFace(canvas, x1, y1, cropW, cropH, eyes, w, h);
  }

  const out = document.createElement('canvas');
  out.width  = cropW;
  out.height = cropH;
  const outCtx = out.getContext('2d');
  if (!outCtx) return canvas; // fallback if canvas not supported (e.g. test env)
  outCtx.drawImage(canvas, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

/**
 * Rotate the crop so the line between the eyes is horizontal.
 * This matches the training distribution of most face deepfake models.
 */
function alignFace(
  src: HTMLCanvasElement,
  cropX: number, cropY: number,
  cropW: number, cropH: number,
  eyes: EyePoints,
  srcW: number, srcH: number
): HTMLCanvasElement {
  const lx = eyes.leftEye.x  * srcW;
  const ly = eyes.leftEye.y  * srcH;
  const rx = eyes.rightEye.x * srcW;
  const ry = eyes.rightEye.y * srcH;

  const angle = Math.atan2(ry - ly, rx - lx); // radians to rotate

  const out = document.createElement('canvas');
  out.width  = cropW;
  out.height = cropH;
  const ctx  = out.getContext('2d');
  if (!ctx) return src; // fallback if canvas not supported

  // Translate to crop center, rotate, translate back, then draw
  const cx = cropW / 2;
  const cy = cropH / 2;
  ctx.translate(cx, cy);
  ctx.rotate(-angle);
  ctx.translate(-cx, -cy);
  ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return out;
}

/**
 * Convert a MediaPipe face detection bounding box to our normalized format.
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

/**
 * Extract eye center points from MediaPipe 468-landmark array.
 * Left eye center: average of landmarks 33, 133, 160, 144, 153, 158
 * Right eye center: average of landmarks 362, 263, 387, 373, 380, 385
 */
export function eyePointsFromLandmarks(
  landmarks: { x: number; y: number; z: number }[]
): EyePoints {
  const leftIdx  = [33, 133, 160, 144, 153, 158];
  const rightIdx = [362, 263, 387, 373, 380, 385];

  const avg = (indices: number[]) => {
    const pts = indices.map(i => landmarks[i]).filter(Boolean);
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  };

  return { leftEye: avg(leftIdx), rightEye: avg(rightIdx) };
}
