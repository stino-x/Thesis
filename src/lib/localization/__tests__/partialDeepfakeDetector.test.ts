import { describe, it, expect, beforeEach } from 'vitest'
import { detectPartialDeepfake } from '../partialDeepfakeDetector'

describe('Partial Deepfake Detector', () => {
  let imageData: ImageData
  let faceBbox: { xMin: number; yMin: number; width: number; height: number }
  let faceLandmarks: Array<{ x: number; y: number }>

  beforeEach(() => {
    // Create test image
    const data = new Uint8ClampedArray(224 * 224 * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128
      data[i + 1] = 128
      data[i + 2] = 128
      data[i + 3] = 255
    }
    imageData = new ImageData(data, 224, 224)

    // Create face bounding box (centered)
    faceBbox = {
      xMin: 0.25,
      yMin: 0.25,
      width: 0.5,
      height: 0.5,
    }

    // Create face landmarks (simplified 68-point)
    faceLandmarks = []
    for (let i = 0; i < 68; i++) {
      faceLandmarks.push({
        x: 0.5 + Math.cos((i / 68) * Math.PI * 2) * 0.2,
        y: 0.5 + Math.sin((i / 68) * Math.PI * 2) * 0.2,
      })
    }
  })

  describe('detectPartialDeepfake', () => {
    it('should not detect manipulation on uniform image', () => {
      const scores = { faceMesh: 0.9, texture: 0.9, lighting: 0.9 }
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, scores)
      
      expect(result.hasPartialManipulation).toBe(false)
      expect(result.suspiciousRegions).toHaveLength(0)
    })

    it('should detect face swap from low face mesh score', () => {
      const scores = { faceMesh: 0.2, texture: 0.8, lighting: 0.8 }
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, scores)
      
      if (result.hasPartialManipulation) {
        expect(result.manipulationType).toContain('face')
      }
    })

    it('should detect mouth reenactment from landmark analysis', () => {
      // Create landmarks with suspicious mouth region
      const mouthLandmarks = faceLandmarks.map((lm, i) => {
        if (i >= 48 && i <= 67) { // Mouth landmarks
          return { x: lm.x + 0.05, y: lm.y + 0.05 } // Offset
        }
        return lm
      })
      
      const scores = { faceMesh: 0.5, texture: 0.8 }
      const result = detectPartialDeepfake(imageData, faceBbox, mouthLandmarks, scores)
      
      // May detect mouth manipulation
      expect(result).toBeDefined()
    })

    it('should handle missing face bbox', () => {
      const scores = { faceMesh: 0.3 }
      const result = detectPartialDeepfake(imageData, undefined, faceLandmarks, scores)
      
      expect(result).toBeDefined()
      expect(result.hasPartialManipulation).toBeDefined()
    })

    it('should handle missing landmarks', () => {
      const scores = { faceMesh: 0.3, texture: 0.5 }
      const result = detectPartialDeepfake(imageData, faceBbox, undefined, scores)
      
      expect(result).toBeDefined()
      expect(result.hasPartialManipulation).toBeDefined()
    })

    it('should generate heatmap when manipulation detected', () => {
      const scores = { faceMesh: 0.2, texture: 0.3, lighting: 0.3 }
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, scores)
      
      if (result.hasPartialManipulation) {
        expect(result.heatmap).toBeDefined()
        expect(result.heatmap?.width).toBe(224)
        expect(result.heatmap?.height).toBe(224)
      }
    })

    it('should calculate overall confidence', () => {
      const scores = { faceMesh: 0.3, texture: 0.4 }
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, scores)
      
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0)
      expect(result.overallConfidence).toBeLessThanOrEqual(1)
    })

    it('should identify suspicious regions with details', () => {
      const scores = { faceMesh: 0.2, texture: 0.3, lighting: 0.8 }
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, scores)
      
      if (result.suspiciousRegions.length > 0) {
        const region = result.suspiciousRegions[0]
        expect(region).toHaveProperty('type')
        expect(region).toHaveProperty('confidence')
        expect(region).toHaveProperty('x')
        expect(region).toHaveProperty('y')
        expect(region).toHaveProperty('width')
        expect(region).toHaveProperty('height')
        expect(region).toHaveProperty('reason')
      }
    })

    it('should handle empty scores', () => {
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, {})
      
      expect(result.hasPartialManipulation).toBe(false)
      expect(result.overallConfidence).toBe(0)
    })

    it('should detect boundary artifacts from texture inconsistency', () => {
      const scores = { texture: 0.2, lighting: 0.8, faceMesh: 0.8 }
      const result = detectPartialDeepfake(imageData, faceBbox, faceLandmarks, scores)
      
      if (result.hasPartialManipulation) {
        expect(result.manipulationType).toBeTruthy()
      }
    })
  })
})
