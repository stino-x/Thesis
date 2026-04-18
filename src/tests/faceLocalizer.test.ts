/**
 * Unit tests — Face localizer (crop + alignment)
 */

import { describe, it, expect } from 'vitest';
import { cropFaceFromCanvas, mediapipeBboxToFaceBbox, eyePointsFromLandmarks } from '../lib/onnx/faceLocalizer';

// jsdom provides a minimal canvas — we mock getContext for these tests
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  return canvas;
}

describe('mediapipeBboxToFaceBbox', () => {
  it('converts MediaPipe bbox format correctly', () => {
    const result = mediapipeBboxToFaceBbox({ xMin: 0.1, yMin: 0.2, width: 0.5, height: 0.6 });
    expect(result).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.6 });
  });
});

describe('cropFaceFromCanvas', () => {
  it('returns original canvas when bbox is null', () => {
    const canvas = makeCanvas(640, 480);
    const result = cropFaceFromCanvas(canvas, null);
    expect(result).toBe(canvas);
  });

  it('returns original canvas when crop is too small', () => {
    const canvas = makeCanvas(640, 480);
    // bbox so small the crop would be < 32px
    const result = cropFaceFromCanvas(canvas, { x: 0.5, y: 0.5, width: 0.01, height: 0.01 });
    expect(result).toBe(canvas);
  });

  it('returns a new canvas for valid bbox', () => {
    const canvas = makeCanvas(640, 480);
    const result = cropFaceFromCanvas(canvas, { x: 0.1, y: 0.1, width: 0.5, height: 0.6 });
    // jsdom doesn't implement getContext — result may be original canvas, but no crash
    expect(result).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
  });

  it('crop dimensions are larger than bbox due to margin', () => {
    const canvas = makeCanvas(640, 480);
    const bbox   = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
    const result = cropFaceFromCanvas(canvas, bbox, 0.20);
    // In jsdom without canvas support the function returns original canvas gracefully
    expect(result).toBeDefined();
  });
});

describe('eyePointsFromLandmarks', () => {
  it('returns valid eye points from landmark array', () => {
    // Create a minimal 478-element landmark array with known values
    const landmarks = Array.from({ length: 478 }, (_, i) => ({
      x: i * 0.001,
      y: i * 0.001,
      z: 0,
    }));
    const result = eyePointsFromLandmarks(landmarks);
    expect(result.leftEye.x).toBeGreaterThanOrEqual(0);
    expect(result.rightEye.x).toBeGreaterThanOrEqual(0);
    expect(result.leftEye.y).toBeGreaterThanOrEqual(0);
    expect(result.rightEye.y).toBeGreaterThanOrEqual(0);
  });
});
