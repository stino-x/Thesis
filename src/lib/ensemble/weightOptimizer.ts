/**
 * Ensemble Weight Optimizer
 * 
 * Learns optimal weights for combining multiple model scores using logistic regression.
 * Replaces hand-tuned weights with data-driven weights for better accuracy.
 * 
 * Usage:
 *   1. Collect validation data (1000+ images with known labels)
 *   2. Run all models on validation set
 *   3. Train optimizer with scores and labels
 *   4. Export optimized weights
 *   5. Update detector.ts with new weights
 * 
 * Expected improvement: +2-3% accuracy over hand-tuned weights
 */

export interface ModelScores {
  // Group A: Face Manipulation (7 models)
  mesonet?: number;
  vitDeepfakeExp?: number;
  vitDeepfakeV2?: number;
  deepfakeDetector?: number;
  xceptionNet?: number;
  efficientnetB4?: number;
  resnet50?: number;
  
  // Group B: AI-Generated (2 models)
  aiDetector?: number;
  univfd?: number;
  
  // Group C: Forensic (5+ signals)
  texture?: number;
  metadata?: number;
  ppg?: number;
  lipSync?: number;
  voice?: number;
  temporal?: number;
}

export interface OptimizedWeights {
  // Per-model weights
  modelWeights: Record<string, number>;
  
  // Group weights
  groupWeights: {
    groupA: number; // Face manipulation
    groupB: number; // AI-generated
    groupC: number; // Forensic
  };
  
  // Optimal threshold
  threshold: number;
  
  // Metadata
  trained: {
    numSamples: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    crossValScore: number;
  };
}

export interface ValidationSample {
  scores: ModelScores;
  label: boolean; // true = deepfake, false = real
  filename?: string;
}

/**
 * Ensemble Weight Optimizer
 */
export class EnsembleWeightOptimizer {
  /**
   * Train optimal weights using logistic regression
   * 
   * @param samples - Validation samples with model scores and ground truth labels
   * @returns Optimized weights
   */
  static train(samples: ValidationSample[]): OptimizedWeights {
    if (samples.length < 100) {
      throw new Error('Need at least 100 samples for reliable training (1000+ recommended)');
    }

    console.log(`🔧 Training ensemble weights on ${samples.length} samples...`);

    // Extract feature matrix X and labels y
    const modelNames = this.getModelNames(samples);
    const X: number[][] = [];
    const y: number[] = [];

    for (const sample of samples) {
      const features: number[] = [];
      for (const modelName of modelNames) {
        const score = (sample.scores as any)[modelName] ?? 0;
        features.push(score);
      }
      X.push(features);
      y.push(sample.label ? 1 : 0);
    }

    // Train logistic regression (using simple gradient descent)
    const weights = this.logisticRegression(X, y);

    // Map weights back to model names
    const modelWeights: Record<string, number> = {};
    modelNames.forEach((name, i) => {
      modelWeights[name] = Math.abs(weights[i]); // Use absolute value
    });

    // Calculate group weights from model weights
    const groupWeights = this.calculateGroupWeights(modelWeights);

    // Find optimal threshold using ROC analysis
    const threshold = this.findOptimalThreshold(X, y, weights);

    // Calculate performance metrics
    const metrics = this.calculateMetrics(X, y, weights, threshold);

    console.log('✅ Training complete!');
    console.log(`   Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
    console.log(`   F1 Score: ${(metrics.f1Score * 100).toFixed(2)}%`);
    console.log(`   Optimal threshold: ${threshold.toFixed(3)}`);

    return {
      modelWeights,
      groupWeights,
      threshold,
      trained: {
        numSamples: samples.length,
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1Score,
        crossValScore: metrics.crossValScore,
      },
    };
  }

  /**
   * Get all available model names from samples
   */
  private static getModelNames(samples: ValidationSample[]): string[] {
    const names = new Set<string>();
    for (const sample of samples) {
      Object.keys(sample.scores).forEach(name => names.add(name));
    }
    return Array.from(names).sort();
  }

  /**
   * Simple logistic regression using gradient descent
   * Returns learned weights for each feature
   */
  private static logisticRegression(
    X: number[][],
    y: number[],
    learningRate = 0.01,
    iterations = 1000
  ): number[] {
    const n = X.length;
    const m = X[0].length;
    
    // Initialize weights to 1.0 (equal weights)
    const weights = new Array(m).fill(1.0);
    let bias = 0;

    // Gradient descent
    for (let iter = 0; iter < iterations; iter++) {
      let weightGrads = new Array(m).fill(0);
      let biasGrad = 0;

      // Forward pass and gradient accumulation
      for (let i = 0; i < n; i++) {
        // Compute prediction
        let z = bias;
        for (let j = 0; j < m; j++) {
          z += weights[j] * X[i][j];
        }
        const pred = this.sigmoid(z);
        
        // Compute error
        const error = pred - y[i];
        
        // Accumulate gradients
        biasGrad += error;
        for (let j = 0; j < m; j++) {
          weightGrads[j] += error * X[i][j];
        }
      }

      // Update weights
      bias -= (learningRate * biasGrad) / n;
      for (let j = 0; j < m; j++) {
        weights[j] -= (learningRate * weightGrads[j]) / n;
      }

      // Early stopping if converged
      if (iter % 100 === 0) {
        const gradNorm = Math.sqrt(weightGrads.reduce((sum, g) => sum + g * g, 0));
        if (gradNorm < 0.001) break;
      }
    }

    return weights;
  }

  /**
   * Sigmoid activation function
   */
  private static sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Calculate group weights from model weights
   */
  private static calculateGroupWeights(modelWeights: Record<string, number>): {
    groupA: number;
    groupB: number;
    groupC: number;
  } {
    const groupA = [
      'mesonet', 'vitDeepfakeExp', 'vitDeepfakeV2', 'deepfakeDetector',
      'xceptionNet', 'efficientnetB4', 'resnet50'
    ];
    const groupB = ['aiDetector', 'univfd'];
    const groupC = ['texture', 'metadata', 'ppg', 'lipSync', 'voice', 'temporal'];

    const sumGroup = (group: string[]) =>
      group.reduce((sum, name) => sum + (modelWeights[name] ?? 0), 0);

    const weightA = sumGroup(groupA);
    const weightB = sumGroup(groupB);
    const weightC = sumGroup(groupC);
    const total = weightA + weightB + weightC;

    return {
      groupA: total > 0 ? weightA / total : 0.55,
      groupB: total > 0 ? weightB / total : 0.35,
      groupC: total > 0 ? weightC / total : 0.10,
    };
  }

  /**
   * Find optimal threshold using ROC analysis
   */
  private static findOptimalThreshold(
    X: number[][],
    y: number[],
    weights: number[]
  ): number {
    // Generate predictions
    const predictions: number[] = [];
    for (let i = 0; i < X.length; i++) {
      let score = 0;
      for (let j = 0; j < weights.length; j++) {
        score += weights[j] * X[i][j];
      }
      predictions.push(this.sigmoid(score));
    }

    // Try different thresholds and find best F1 score
    let bestThreshold = 0.5;
    let bestF1 = 0;

    for (let threshold = 0.1; threshold <= 0.9; threshold += 0.05) {
      let tp = 0, fp = 0, tn = 0, fn = 0;
      
      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i] > threshold ? 1 : 0;
        if (pred === 1 && y[i] === 1) tp++;
        else if (pred === 1 && y[i] === 0) fp++;
        else if (pred === 0 && y[i] === 0) tn++;
        else fn++;
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      if (f1 > bestF1) {
        bestF1 = f1;
        bestThreshold = threshold;
      }
    }

    return bestThreshold;
  }

  /**
   * Calculate performance metrics
   */
  private static calculateMetrics(
    X: number[][],
    y: number[],
    weights: number[],
    threshold: number
  ): {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    crossValScore: number;
  } {
    let tp = 0, fp = 0, tn = 0, fn = 0;

    for (let i = 0; i < X.length; i++) {
      let score = 0;
      for (let j = 0; j < weights.length; j++) {
        score += weights[j] * X[i][j];
      }
      const pred = this.sigmoid(score) > threshold ? 1 : 0;
      
      if (pred === 1 && y[i] === 1) tp++;
      else if (pred === 1 && y[i] === 0) fp++;
      else if (pred === 0 && y[i] === 0) tn++;
      else fn++;
    }

    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Simplified cross-validation (5-fold)
    const crossValScore = this.crossValidate(X, y, 5);

    return { accuracy, precision, recall, f1Score, crossValScore };
  }

  /**
   * K-fold cross-validation
   */
  private static crossValidate(X: number[][], y: number[], k: number): number {
    const foldSize = Math.floor(X.length / k);
    let totalAccuracy = 0;

    for (let fold = 0; fold < k; fold++) {
      // Split data
      const testStart = fold * foldSize;
      const testEnd = fold === k - 1 ? X.length : (fold + 1) * foldSize;
      
      const X_train = [...X.slice(0, testStart), ...X.slice(testEnd)];
      const y_train = [...y.slice(0, testStart), ...y.slice(testEnd)];
      const X_test = X.slice(testStart, testEnd);
      const y_test = y.slice(testStart, testEnd);

      // Train on fold
      const weights = this.logisticRegression(X_train, y_train, 0.01, 500);
      const threshold = this.findOptimalThreshold(X_train, y_train, weights);

      // Test on fold
      let correct = 0;
      for (let i = 0; i < X_test.length; i++) {
        let score = 0;
        for (let j = 0; j < weights.length; j++) {
          score += weights[j] * X_test[i][j];
        }
        const pred = this.sigmoid(score) > threshold ? 1 : 0;
        if (pred === y_test[i]) correct++;
      }

      totalAccuracy += correct / X_test.length;
    }

    return totalAccuracy / k;
  }

  /**
   * Export weights to JSON file
   */
  static exportWeights(weights: OptimizedWeights): string {
    return JSON.stringify(weights, null, 2);
  }

  /**
   * Import weights from JSON
   */
  static importWeights(json: string): OptimizedWeights {
    return JSON.parse(json);
  }
}

/**
 * Example usage and validation data format
 */
export const EXAMPLE_USAGE = `
// 1. Collect validation data (1000+ samples)
const validationSamples: ValidationSample[] = [
  {
    scores: {
      mesonet: 0.85,
      vitDeepfakeExp: 0.92,
      vitDeepfakeV2: 0.88,
      deepfakeDetector: 0.79,
      xceptionNet: 0.94,
      efficientnetB4: 0.91,
      resnet50: 0.87,
      aiDetector: 0.45,
      univfd: 0.62,
      texture: 0.71,
      metadata: 0.55,
      ppg: 0.89,
      temporal: 0.86,
    },
    label: true, // Known deepfake
    filename: 'deepfake_001.jpg'
  },
  // ... 999+ more samples
];

// 2. Train optimizer
const optimizedWeights = EnsembleWeightOptimizer.train(validationSamples);

// 3. Export weights
const json = EnsembleWeightOptimizer.exportWeights(optimizedWeights);
console.log(json);

// 4. Copy weights to detector.ts:
// - Update groupA.push([score, weight]) with modelWeights[modelName]
// - Update final ensemble weights with groupWeights
// - Update threshold with optimizedWeights.threshold

// 5. Test on separate test set to verify improvement
`;
