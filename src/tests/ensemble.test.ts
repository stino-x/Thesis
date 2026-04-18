/**
 * Unit tests — Ensemble combiner logic
 *
 * Tests the core scoring logic in detector.ts without loading any ML models.
 * Focuses on: group weighting, strong signal override, adaptive weight redistribution.
 */

import { describe, it, expect } from 'vitest';

// ── Pure helper functions extracted for testing ────────────────────────────

function groupScore(group: [number, number][]): number | null {
  if (group.length === 0) return null;
  const num = group.reduce((s, [score, w]) => s + score * w, 0);
  const den = group.reduce((s, [, w]) => s + w, 0);
  return num / den;
}

function combineGroups(
  scoreA: number | null,
  scoreB: number | null,
  scoreC: number | null
): number {
  const parts: [number, number][] = [];
  if (scoreA !== null) parts.push([scoreA, 0.55]);
  if (scoreB !== null) parts.push([scoreB, 0.35]);
  if (scoreC !== null) parts.push([scoreC, 0.10]);

  if (parts.length === 0) return 0.5;

  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  return parts.reduce((s, [sc, w]) => s + sc * (w / totalW), 0);
}

function applyStrongSignalOverride(ensemble: number, allScores: number[]): number {
  const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  if (maxScore > 0.92) {
    return ensemble * 0.6 + maxScore * 0.4;
  }
  return ensemble;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('groupScore', () => {
  it('returns null for empty group', () => {
    expect(groupScore([])).toBeNull();
  });

  it('returns single score for single model', () => {
    expect(groupScore([[0.8, 1.0]])).toBeCloseTo(0.8);
  });

  it('weights higher-weight model more', () => {
    // weight 3.0 model at 0.9 vs weight 1.0 model at 0.1
    const score = groupScore([[0.9, 3.0], [0.1, 1.0]])!;
    expect(score).toBeGreaterThan(0.5); // should be dominated by 0.9
    expect(score).toBeCloseTo((0.9 * 3 + 0.1 * 1) / 4); // = 0.7
  });
});

describe('combineGroups', () => {
  it('returns 0.5 when no groups available', () => {
    expect(combineGroups(null, null, null)).toBe(0.5);
  });

  it('uses only available groups and renormalizes weights', () => {
    // Only group A available — should return group A score directly
    const result = combineGroups(0.8, null, null);
    expect(result).toBeCloseTo(0.8);
  });

  it('group A dominates when all groups present', () => {
    // A=0.9 (55%), B=0.1 (35%), C=0.1 (10%)
    const result = combineGroups(0.9, 0.1, 0.1);
    expect(result).toBeGreaterThan(0.5); // A dominates
    expect(result).toBeCloseTo(0.9 * 0.55 + 0.1 * 0.35 + 0.1 * 0.10);
  });

  it('real content scores low even with some forensic noise', () => {
    const result = combineGroups(0.05, 0.08, 0.3);
    expect(result).toBeLessThan(0.15);
  });
});

describe('strongSignalOverride', () => {
  it('does not trigger below 0.92', () => {
    const ensemble = 0.6;
    expect(applyStrongSignalOverride(ensemble, [0.91])).toBeCloseTo(0.6);
  });

  it('triggers at 0.93 and boosts ensemble', () => {
    const ensemble = 0.6;
    const result = applyStrongSignalOverride(ensemble, [0.93]);
    expect(result).toBeGreaterThan(0.6);
    expect(result).toBeCloseTo(0.6 * 0.6 + 0.93 * 0.4);
  });

  it('handles empty scores array', () => {
    expect(applyStrongSignalOverride(0.7, [])).toBeCloseTo(0.7);
  });
});

describe('end-to-end ensemble scenarios', () => {
  it('clear deepfake: all models agree high', () => {
    const a = groupScore([[0.95, 3.0], [0.90, 2.0], [0.85, 1.5], [0.88, 1.0]])!;
    const b = groupScore([[0.92, 2.0]])!;
    const c = groupScore([[0.7, 3.0], [0.6, 2.5]])!;
    const ensemble = applyStrongSignalOverride(combineGroups(a, b, c), [0.95, 0.90, 0.92]);
    expect(ensemble).toBeGreaterThan(0.85);
  });

  it('clear real: all models agree low', () => {
    const a = groupScore([[0.05, 3.0], [0.08, 2.0], [0.06, 1.5]])!;
    const b = groupScore([[0.04, 2.0]])!;
    const ensemble = combineGroups(a, b, null);
    expect(ensemble).toBeLessThan(0.15);
  });

  it('uncertain: models disagree', () => {
    const a = groupScore([[0.7, 3.0], [0.3, 2.0]])!;
    const b = groupScore([[0.4, 2.0]])!;
    const ensemble = combineGroups(a, b, null);
    expect(ensemble).toBeGreaterThan(0.3);
    expect(ensemble).toBeLessThan(0.7);
  });
});
