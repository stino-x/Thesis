"""
Ensemble Weight Calibration Script
====================================
The ensemble weights in detector.ts are currently manually tuned.
This script finds optimal weights by running the ensemble on a labeled
test set and minimizing log-loss via scipy.optimize.

Usage:
    # 1. Prepare a CSV with per-model scores and ground truth:
    #    columns: label (0=real,1=fake), groupA_score, groupB_score, groupC_score
    #    You can generate this by logging detector output to a file.

    python scripts/calibrate_weights.py --scores_csv data/test_scores.csv

    # 2. The script outputs optimal weights to paste into detector.ts

Requirements:
    pip install numpy scipy pandas scikit-learn
"""

import argparse
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import expit  # sigmoid

try:
    from sklearn.metrics import roc_auc_score, log_loss
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("Warning: scikit-learn not installed. AUC metrics unavailable.")


def weighted_ensemble(scores: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Compute weighted ensemble score from group scores."""
    w = np.abs(weights) / np.abs(weights).sum()  # normalize, force positive
    return scores @ w


def objective(weights: np.ndarray, scores: np.ndarray, labels: np.ndarray) -> float:
    """Log-loss of the weighted ensemble."""
    preds = weighted_ensemble(scores, weights)
    preds = np.clip(preds, 1e-7, 1 - 1e-7)
    return -np.mean(labels * np.log(preds) + (1 - labels) * np.log(1 - preds))


def calibrate(scores_csv: str):
    df = pd.read_csv(scores_csv)

    required = ['label', 'groupA_score', 'groupB_score', 'groupC_score']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}. CSV must have: {required}")

    labels = df['label'].values.astype(float)
    scores = df[['groupA_score', 'groupB_score', 'groupC_score']].values.astype(float)

    print(f"\nDataset: {len(df)} samples ({labels.sum():.0f} fake, {(1-labels).sum():.0f} real)")

    # Current hardcoded weights
    current_weights = np.array([0.55, 0.35, 0.10])
    current_loss = objective(current_weights, scores, labels)
    current_preds = weighted_ensemble(scores, current_weights)

    print(f"\nCurrent weights: A={current_weights[0]:.2f}, B={current_weights[1]:.2f}, C={current_weights[2]:.2f}")
    print(f"Current log-loss: {current_loss:.4f}")
    if HAS_SKLEARN:
        print(f"Current AUC:      {roc_auc_score(labels, current_preds):.4f}")

    # Optimize
    print("\nOptimizing weights...")
    best_result = None
    best_loss = float('inf')

    # Try multiple starting points to avoid local minima
    for _ in range(20):
        x0 = np.random.dirichlet([2, 2, 1])  # prior: A and B more important than C
        result = minimize(
            objective,
            x0,
            args=(scores, labels),
            method='L-BFGS-B',
            bounds=[(0.05, 0.80), (0.05, 0.70), (0.01, 0.30)],
        )
        if result.fun < best_loss:
            best_loss = result.fun
            best_result = result

    opt_weights = np.abs(best_result.x) / np.abs(best_result.x).sum()
    opt_preds   = weighted_ensemble(scores, opt_weights)

    print(f"\nOptimal weights: A={opt_weights[0]:.3f}, B={opt_weights[1]:.3f}, C={opt_weights[2]:.3f}")
    print(f"Optimal log-loss: {best_loss:.4f}  (improvement: {current_loss - best_loss:.4f})")
    if HAS_SKLEARN:
        print(f"Optimal AUC:      {roc_auc_score(labels, opt_preds):.4f}")

    print("\n── Paste into src/lib/tensorflow/detector.ts ──────────────────────")
    print(f"// Calibrated weights (run scripts/calibrate_weights.py to update)")
    print(f"if (scoreA !== null) parts.push([scoreA, {opt_weights[0]:.3f}]);")
    print(f"if (scoreB !== null) parts.push([scoreB, {opt_weights[1]:.3f}]);")
    print(f"if (scoreC !== null) parts.push([scoreC, {opt_weights[2]:.3f}]);")
    print("────────────────────────────────────────────────────────────────────")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Calibrate ensemble weights on a test set')
    parser.add_argument('--scores_csv', required=True,
                        help='CSV with columns: label, groupA_score, groupB_score, groupC_score')
    args = parser.parse_args()
    calibrate(args.scores_csv)
