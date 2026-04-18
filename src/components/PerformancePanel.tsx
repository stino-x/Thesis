/**
 * Performance Panel Component
 * 
 * Displays real-time performance metrics for deepfake detection
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw, Trash2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import performanceMonitor from '@/lib/performance/performanceMonitor';

export const PerformancePanel = () => {
  const [summary, setSummary] = useState(performanceMonitor.getSummary());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = () => {
    setIsRefreshing(true);
    setSummary(performanceMonitor.getSummary());
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    const csv = performanceMonitor.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance_metrics_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Performance metrics exported');
  };

  const handleClear = () => {
    performanceMonitor.clear();
    refresh();
    toast.success('Performance metrics cleared');
  };

  const getPerformanceLevel = (time: number): 'good' | 'medium' | 'slow' => {
    if (time < 500) return 'good';
    if (time < 1500) return 'medium';
    return 'slow';
  };

  const performanceLevel = getPerformanceLevel(summary.averageTotalTime);
  const performanceColor = {
    good: 'text-green-500',
    medium: 'text-yellow-500',
    slow: 'text-red-500',
  }[performanceLevel];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Performance Metrics</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={summary.totalOperations === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={summary.totalOperations === 0}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Real-time performance monitoring for detection operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.totalOperations === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No performance data yet</p>
            <p className="text-sm mt-1">Run a detection to see metrics</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Operations</p>
                <p className="text-2xl font-bold">{summary.totalOperations}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Total Time</p>
                <p className={`text-2xl font-bold ${performanceColor}`}>
                  {summary.averageTotalTime.toFixed(0)}ms
                </p>
              </div>
            </div>

            {/* Performance Level */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Performance:</span>
              <Badge
                variant={
                  performanceLevel === 'good'
                    ? 'default'
                    : performanceLevel === 'medium'
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {performanceLevel === 'good' && '🚀 Excellent'}
                {performanceLevel === 'medium' && '⚡ Good'}
                {performanceLevel === 'slow' && '🐌 Slow'}
              </Badge>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Base Detection</span>
                  <span className="font-medium">
                    {summary.averageDetectionTime.toFixed(0)}ms
                  </span>
                </div>
                <Progress
                  value={(summary.averageDetectionTime / summary.averageTotalTime) * 100}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Research Features</span>
                  <span className="font-medium">
                    {summary.averageResearchFeaturesTime.toFixed(0)}ms
                  </span>
                </div>
                <Progress
                  value={(summary.averageResearchFeaturesTime / summary.averageTotalTime) * 100}
                  className="h-2"
                />
              </div>
            </div>

            {/* Memory Usage */}
            {summary.memoryUsage !== undefined && (
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Memory Usage</span>
                  <span className="font-medium">{summary.memoryUsage.toFixed(1)} MB</span>
                </div>
              </div>
            )}

            {/* Tips */}
            {performanceLevel === 'slow' && (
              <div className="pt-2 border-t text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Performance Tips:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Disable unused research-grade features in Settings</li>
                  <li>• Use "Fast" processing speed for real-time analysis</li>
                  <li>• Close other browser tabs to free up memory</li>
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
