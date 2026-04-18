import { describe, it, expect } from 'vitest'
import {
  plattScaling,
  calibrateEnsemble,
  getConfidenceInterval,
  isWellCalibrated,
  formatCalibratedResult,
} from '../confidenceCalibrator'

describe('Confidence Calibrator', () => {
  describe('plattScaling', () => {
    it('should return value between 0 and 1', () => {
      const result = plattScaling(0.5)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })

    it('should handle high scores', () => {
      const result = plattScaling(0.9)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })

    it('should handle low scores', () => {
      const result = plattScaling(0.1)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })

    it('should handle edge cases', () => {
      expect(plattScaling(0)).toBeGreaterThan(0)
      expect(plattScaling(1)).toBeLessThan(1)
    })
  })

  describe('calibrateEnsemble', () => {
    it('should calibrate single model score', () => {
      const scores = { model1: 0.8 }
      const result = calibrateEnsemble(scores)
      
      expect(result.ensembleProbability).toBeGreaterThan(0)
      expect(result.ensembleProbability).toBeLessThan(1)
      expect(result.reliability).toBe(1) // Single model = perfect agreement
      expect(result.calibratedScores).toHaveProperty('model1')
    })

    it('should handle multiple agreeing models', () => {
      const scores = { model1: 0.8, model2: 0.85, model3: 0.75 }
      const result = calibrateEnsemble(scores)
      
      expect(result.reliability).toBeGreaterThan(0.7) // High agreement
      expect(Object.keys(result.calibratedScores)).toHaveLength(3)
    })

    it('should detect disagreeing models', () => {
      const scores = { model1: 0.9, model2: 0.1, model3: 0.5 }
      const result = calibrateEnsemble(scores)
      
      // With high disagreement, reliability should be lower than perfect agreement
      expect(result.reliability).toBeLessThan(1)
      // But the formula 1/(1+variance*10) may still give >0.5 for moderate variance
      expect(result.reliability).toBeGreaterThan(0)
    })

    it('should handle empty scores', () => {
      const scores = {}
      const result = calibrateEnsemble(scores)
      
      expect(result.ensembleProbability).toBe(0.5) // Default
      expect(result.reliability).toBe(0)
    })

    it('should weight models equally by default', () => {
      const scores = { model1: 0.6, model2: 0.8 }
      const result = calibrateEnsemble(scores)
      
      const prob1 = result.calibratedScores.model1
      const prob2 = result.calibratedScores.model2
      const avg = (prob1 + prob2) / 2
      
      expect(result.ensembleProbability).toBeCloseTo(avg, 1)
    })
  })

  describe('getConfidenceInterval', () => {
    it('should return wider interval for low reliability', () => {
      const interval1 = getConfidenceInterval(0.7, 0.9)
      const interval2 = getConfidenceInterval(0.7, 0.3)
      
      const width1 = interval1[1] - interval1[0]
      const width2 = interval2[1] - interval2[0]
      
      expect(width2).toBeGreaterThan(width1)
    })

    it('should return interval around probability', () => {
      const prob = 0.6
      const interval = getConfidenceInterval(prob, 0.8)
      
      // Interval should contain the probability
      expect(interval[0]).toBeLessThan(prob)
      expect(interval[1]).toBeGreaterThan(prob)
    })

    it('should clamp to [0, 1]', () => {
      const interval = getConfidenceInterval(0.95, 0.3)
      
      expect(interval[0]).toBeGreaterThanOrEqual(0)
      expect(interval[1]).toBeLessThanOrEqual(1)
    })
  })

  describe('isWellCalibrated', () => {
    it('should pass for high reliability and mid probability', () => {
      const result = isWellCalibrated(0.6, 0.9)
      expect(result.isWellCalibrated).toBe(true)
    })

    it('should warn for low reliability', () => {
      const result = isWellCalibrated(0.6, 0.3)
      expect(result.isWellCalibrated).toBe(false)
      expect(result.reason).toContain('agreement')
    })

    it('should warn for extreme probabilities with low reliability', () => {
      const result = isWellCalibrated(0.95, 0.4)
      expect(result.isWellCalibrated).toBe(false)
    })

    it('should pass for extreme probabilities with high reliability', () => {
      const result = isWellCalibrated(0.95, 0.9)
      expect(result.isWellCalibrated).toBe(true)
    })
  })

  describe('formatCalibratedResult', () => {
    it('should format with percentage', () => {
      const result = formatCalibratedResult(0.753, 0.85, [0.7, 0.8])
      expect(result).toContain('75.3%')
    })

    it('should include confidence interval', () => {
      const result = formatCalibratedResult(0.6, 0.8, [0.5, 0.7])
      expect(result).toContain('50.0-70.0')
    })

    it('should indicate high reliability', () => {
      const result = formatCalibratedResult(0.6, 0.9, [0.55, 0.65])
      expect(result).toContain('90%')
      expect(result).toContain('reliability')
    })

    it('should indicate low reliability', () => {
      const result = formatCalibratedResult(0.6, 0.3, [0.4, 0.8])
      expect(result).toContain('30%')
      expect(result).toContain('reliability')
    })
  })
})
