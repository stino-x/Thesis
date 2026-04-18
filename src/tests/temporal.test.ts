/**
 * Unit tests — Temporal consistency analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemporalConsistencyAnalyzer } from '../lib/temporal/temporalConsistency';

describe('TemporalConsistencyAnalyzer', () => {
  let analyzer: TemporalConsistencyAnalyzer;

  beforeEach(() => {
    analyzer = new TemporalConsistencyAnalyzer();
  });

  it('returns low confidence with fewer than 3 frames', () => {
    analyzer.addFrame({ score: 0.8, isDeepfake: true, timestamp: 0 });
    const result = analyzer.addFrame({ score: 0.7, isDeepfake: true, timestamp: 500 });
    expect(result.confidence).toBe(0);
    expect(result.anomalies).toContain('insufficient_frames');
  });

  it('detects high variance as suspicious', () => {
    // Alternating high/low scores = high variance
    [0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1].forEach((score, i) => {
      analyzer.addFrame({ score, isDeepfake: score > 0.5, timestamp: i * 500 });
    });
    const result = analyzer.analyze();
    expect(result.anomalies).toContain('high_temporal_variance');
    expect(result.score).toBeGreaterThan(0.3);
  });

  it('detects frequent verdict flips', () => {
    [true, false, true, false, true, false, true, false].forEach((fake, i) => {
      analyzer.addFrame({ score: fake ? 0.8 : 0.2, isDeepfake: fake, timestamp: i * 500 });
    });
    const result = analyzer.analyze();
    expect(result.anomalies).toContain('frequent_verdict_flips');
  });

  it('consistent real content scores low', () => {
    for (let i = 0; i < 12; i++) {
      analyzer.addFrame({ score: 0.05 + Math.random() * 0.05, isDeepfake: false, timestamp: i * 500 });
    }
    const result = analyzer.analyze();
    expect(result.score).toBeLessThan(0.3);
  });

  it('consistent deepfake scores high', () => {
    for (let i = 0; i < 12; i++) {
      analyzer.addFrame({ score: 0.85 + Math.random() * 0.1, isDeepfake: true, timestamp: i * 500 });
    }
    const result = analyzer.analyze();
    expect(result.score).toBeGreaterThanOrEqual(0.2); // mean > 0.65 triggers score boost
  });

  it('reset clears history', () => {
    for (let i = 0; i < 10; i++) {
      analyzer.addFrame({ score: 0.9, isDeepfake: true, timestamp: i * 500 });
    }
    analyzer.reset();
    const result = analyzer.addFrame({ score: 0.9, isDeepfake: true, timestamp: 0 });
    expect(result.confidence).toBe(0); // only 1 frame after reset
  });

  it('adaptive window grows with history', () => {
    // Add 20 frames — window should use more than 8
    for (let i = 0; i < 20; i++) {
      analyzer.addFrame({ score: 0.5, isDeepfake: false, timestamp: i * 500 });
    }
    const result = analyzer.analyze();
    expect(result.details.windowSize).toBeGreaterThan(8);
  });
});
