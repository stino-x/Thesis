/**
 * Performance Monitoring
 * 
 * Tracks performance metrics for deepfake detection operations
 * Uses Performance API for accurate timing
 */

export interface PerformanceMetrics {
  detectionTime: number;
  modelLoadingTime: number;
  faceDetectionTime: number;
  calibrationTime: number;
  adversarialTime: number;
  partialDetectionTime: number;
  totalTime: number;
  memoryUsage?: number;
}

export interface PerformanceEntry {
  timestamp: Date;
  operation: string;
  metrics: PerformanceMetrics;
}

class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private maxEntries = 100;
  private marks: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startMark(name: string): void {
    const markName = `${name}-start`;
    performance.mark(markName);
    this.marks.set(name, performance.now());
  }

  /**
   * End timing an operation and return duration
   */
  endMark(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No start mark found for: ${name}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const markName = `${name}-start`;
    const measureName = `${name}-duration`;
    
    try {
      performance.measure(measureName, markName);
    } catch (e) {
      // Mark might not exist, that's okay
    }

    this.marks.delete(name);
    return duration;
  }

  /**
   * Get duration without ending the mark
   */
  getDuration(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) return 0;
    return performance.now() - startTime;
  }

  /**
   * Record a complete performance entry
   */
  recordEntry(operation: string, metrics: PerformanceMetrics): void {
    const entry: PerformanceEntry = {
      timestamp: new Date(),
      operation,
      metrics,
    };

    this.entries.push(entry);

    // Keep only last N entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * Get all performance entries
   */
  getEntries(): PerformanceEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries for a specific operation
   */
  getEntriesForOperation(operation: string): PerformanceEntry[] {
    return this.entries.filter(e => e.operation === operation);
  }

  /**
   * Get average metrics for an operation
   */
  getAverageMetrics(operation: string): PerformanceMetrics | null {
    const entries = this.getEntriesForOperation(operation);
    if (entries.length === 0) return null;

    const sum: PerformanceMetrics = {
      detectionTime: 0,
      modelLoadingTime: 0,
      faceDetectionTime: 0,
      calibrationTime: 0,
      adversarialTime: 0,
      partialDetectionTime: 0,
      totalTime: 0,
    };

    for (const entry of entries) {
      sum.detectionTime += entry.metrics.detectionTime;
      sum.modelLoadingTime += entry.metrics.modelLoadingTime;
      sum.faceDetectionTime += entry.metrics.faceDetectionTime;
      sum.calibrationTime += entry.metrics.calibrationTime;
      sum.adversarialTime += entry.metrics.adversarialTime;
      sum.partialDetectionTime += entry.metrics.partialDetectionTime;
      sum.totalTime += entry.metrics.totalTime;
    }

    const count = entries.length;
    return {
      detectionTime: sum.detectionTime / count,
      modelLoadingTime: sum.modelLoadingTime / count,
      faceDetectionTime: sum.faceDetectionTime / count,
      calibrationTime: sum.calibrationTime / count,
      adversarialTime: sum.adversarialTime / count,
      partialDetectionTime: sum.partialDetectionTime / count,
      totalTime: sum.totalTime / count,
    };
  }

  /**
   * Get memory usage if available
   */
  getMemoryUsage(): number | undefined {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // MB
    }
    return undefined;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    this.marks.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Export metrics as CSV
   */
  exportCSV(): string {
    const headers = [
      'Timestamp',
      'Operation',
      'Total Time (ms)',
      'Detection Time (ms)',
      'Face Detection (ms)',
      'Calibration (ms)',
      'Adversarial (ms)',
      'Partial Detection (ms)',
      'Model Loading (ms)',
      'Memory (MB)',
    ];

    const rows = this.entries.map(entry => [
      entry.timestamp.toISOString(),
      entry.operation,
      entry.metrics.totalTime.toFixed(2),
      entry.metrics.detectionTime.toFixed(2),
      entry.metrics.faceDetectionTime.toFixed(2),
      entry.metrics.calibrationTime.toFixed(2),
      entry.metrics.adversarialTime.toFixed(2),
      entry.metrics.partialDetectionTime.toFixed(2),
      entry.metrics.modelLoadingTime.toFixed(2),
      entry.metrics.memoryUsage?.toFixed(2) || 'N/A',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalOperations: number;
    averageTotalTime: number;
    averageDetectionTime: number;
    averageResearchFeaturesTime: number;
    memoryUsage?: number;
  } {
    if (this.entries.length === 0) {
      return {
        totalOperations: 0,
        averageTotalTime: 0,
        averageDetectionTime: 0,
        averageResearchFeaturesTime: 0,
      };
    }

    const totalTime = this.entries.reduce((sum, e) => sum + e.metrics.totalTime, 0);
    const detectionTime = this.entries.reduce((sum, e) => sum + e.metrics.detectionTime, 0);
    const researchTime = this.entries.reduce(
      (sum, e) =>
        sum +
        e.metrics.calibrationTime +
        e.metrics.adversarialTime +
        e.metrics.partialDetectionTime,
      0
    );

    return {
      totalOperations: this.entries.length,
      averageTotalTime: totalTime / this.entries.length,
      averageDetectionTime: detectionTime / this.entries.length,
      averageResearchFeaturesTime: researchTime / this.entries.length,
      memoryUsage: this.getMemoryUsage(),
    };
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;

/**
 * Helper hook for easy performance tracking
 */
export function usePerformanceTracking(operationName: string) {
  const start = () => performanceMonitor.startMark(operationName);
  const end = () => performanceMonitor.endMark(operationName);
  const getDuration = () => performanceMonitor.getDuration(operationName);

  return { start, end, getDuration };
}
