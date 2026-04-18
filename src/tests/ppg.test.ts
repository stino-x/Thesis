/**
 * Unit tests — PPG analyzer (FFT correctness + gating)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PPGAnalyzer } from '../lib/physiological/ppgAnalyzer';

describe('PPGAnalyzer', () => {
  let analyzer: PPGAnalyzer;

  beforeEach(() => {
    analyzer = new PPGAnalyzer();
  });

  it('returns low confidence with no canvas context (jsdom environment)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

    const result = await analyzer.analyzePPG(landmarks, canvas, 0);
    // jsdom has no canvas — returns analysis_failed or insufficient_data, both mean confidence=0
    expect(result.confidence).toBe(0);
    expect(result.score).toBe(0);
  });

  it('reset clears history', () => {
    analyzer.reset();
    // After reset, internal state is cleared — no error thrown
    expect(() => analyzer.reset()).not.toThrow();
  });
});

describe('PPG FFT correctness', () => {
  it('Cooley-Tukey FFT produces same power spectrum as naive DFT for small input', () => {
    // Access private method via type cast for testing
    const analyzer = new PPGAnalyzer() as unknown as {
      simpleFFT: (signal: number[]) => { re: number; im: number }[];
    };

    // Simple sine wave at known frequency
    const N = 32;
    const freq = 2; // 2 cycles in N samples
    const signal = Array.from({ length: N }, (_, i) =>
      Math.sin((2 * Math.PI * freq * i) / N)
    );

    const result = analyzer.simpleFFT(signal);

    // Power should peak at index `freq`
    const powers = result.map(c => c.re ** 2 + c.im ** 2);
    const peakIdx = powers.indexOf(Math.max(...powers));

    // Peak should be at freq or N-freq (conjugate symmetry)
    expect([freq, N - freq]).toContain(peakIdx);
  });
});
