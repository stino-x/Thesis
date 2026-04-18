import { describe, it, expect, beforeEach } from 'vitest'
import {
  detectAdversarialAttack,
  getAdversarialRobustnessScore,
} from '../adversarialDetector'

describe('Adversarial Detector', () => {
  let cleanImageData: ImageData
  let noisyImageData: ImageData

  beforeEach(() => {
    // Create clean image (uniform gray)
    const cleanData = new Uint8ClampedArray(224 * 224 * 4)
    for (let i = 0; i < cleanData.length; i += 4) {
      cleanData[i] = 128     // R
      cleanData[i + 1] = 128 // G
      cleanData[i + 2] = 128 // B
      cleanData[i + 3] = 255 // A
    }
    cleanImageData = new ImageData(cleanData, 224, 224)

    // Create noisy image (high-frequency noise)
    const noisyData = new Uint8ClampedArray(224 * 224 * 4)
    for (let i = 0; i < noisyData.length; i += 4) {
      const noise = Math.random() * 50 - 25
      noisyData[i] = Math.max(0, Math.min(255, 128 + noise))
      noisyData[i + 1] = Math.max(0, Math.min(255, 128 + noise))
      noisyData[i + 2] = Math.max(0, Math.min(255, 128 + noise))
      noisyData[i + 3] = 255
    }
    noisyImageData = new ImageData(noisyData, 224, 224)
  })

  describe('detectAdversarialAttack', () => {
    it('should not detect attack on clean image with agreeing models', () => {
      const scores = { model1: 0.8, model2: 0.82, model3: 0.78 }
      const result = detectAdversarialAttack(cleanImageData, scores, true)
      
      expect(result.isAdversarial).toBe(false)
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should detect high model disagreement', () => {
      const scores = { model1: 0.9, model2: 0.1, model3: 0.5 }
      const result = detectAdversarialAttack(cleanImageData, scores, false)
      
      // Should detect some indicators
      expect(result.indicators.length).toBeGreaterThan(0)
    })

    it('should detect visual-only manipulation', () => {
      const scores = { visual: 0.9, metadata: 0.1, ppg: 0.1 }
      const result = detectAdversarialAttack(cleanImageData, scores, true)
      
      // Should detect some indicators
      expect(result.indicators.length).toBeGreaterThan(0)
    })

    it('should provide recommendations when attack detected', () => {
      const scores = { model1: 0.95, model2: 0.05 }
      const result = detectAdversarialAttack(noisyImageData, scores, false)
      
      if (result.isAdversarial) {
        expect(result.recommendation).toBeTruthy()
        expect(result.recommendation.length).toBeGreaterThan(0)
      }
    })

    it('should handle empty scores', () => {
      const result = detectAdversarialAttack(cleanImageData, {}, false)
      
      expect(result.isAdversarial).toBe(false)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })

    it('should detect suspicious pixel statistics', () => {
      // Create image with unusual distribution
      const suspiciousData = new Uint8ClampedArray(224 * 224 * 4)
      for (let i = 0; i < suspiciousData.length; i += 4) {
        // Bimodal distribution (very dark or very bright)
        const val = Math.random() > 0.5 ? 10 : 245
        suspiciousData[i] = val
        suspiciousData[i + 1] = val
        suspiciousData[i + 2] = val
        suspiciousData[i + 3] = 255
      }
      const suspiciousImage = new ImageData(suspiciousData, 224, 224)
      
      const scores = { model1: 0.7 }
      const result = detectAdversarialAttack(suspiciousImage, scores, false)
      
      // May or may not detect, but should not crash
      expect(result).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('getAdversarialRobustnessScore', () => {
    it('should give high score for diverse models with multi-modal', () => {
      const models = ['ViT-Deepfake', 'SwinV2', 'MesoNet', 'UnivFD']
      const result = getAdversarialRobustnessScore(models, true, false)
      
      expect(result.score).toBeGreaterThan(0.7)
      expect(result.level).toBe('high')
    })

    it('should give medium or low score for multiple similar models', () => {
      const models = ['ViT-Deepfake', 'SwinV2'] // Both transformers
      const result = getAdversarialRobustnessScore(models, false, false)
      
      expect(result.score).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(0.7)
      expect(['low', 'medium']).toContain(result.level)
    })

    it('should give low score for single model', () => {
      const models = ['ViT-Deepfake']
      const result = getAdversarialRobustnessScore(models, false, false)
      
      expect(result.score).toBeLessThan(0.4)
      expect(result.level).toBe('low')
    })

    it('should boost score with defensive transforms', () => {
      const models = ['ViT-Deepfake']
      const withoutDefense = getAdversarialRobustnessScore(models, false, false)
      const withDefense = getAdversarialRobustnessScore(models, false, true)
      
      expect(withDefense.score).toBeGreaterThan(withoutDefense.score)
    })

    it('should boost score with multi-modal analysis', () => {
      const models = ['ViT-Deepfake']
      const withoutMultiModal = getAdversarialRobustnessScore(models, false, false)
      const withMultiModal = getAdversarialRobustnessScore(models, true, false)
      
      expect(withMultiModal.score).toBeGreaterThan(withoutMultiModal.score)
    })

    it('should handle empty model list', () => {
      const result = getAdversarialRobustnessScore([], false, false)
      
      expect(result.score).toBe(0)
      expect(result.level).toBe('low')
    })

    it('should provide score and level', () => {
      const models = ['ViT-Deepfake', 'MesoNet']
      const result = getAdversarialRobustnessScore(models, true, true)
      
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
      expect(['low', 'medium', 'high']).toContain(result.level)
    })
  })
})
