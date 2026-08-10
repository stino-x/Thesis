import { useState, useEffect, useCallback } from 'react';
import { auditLogger } from '@/lib/auditLogger';
import { AuditLog, AuditLogFilters, AuditLogStats } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Filter, RefreshCw, FileText, Video, Webcam, Image, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Generate a human-readable explanation of the detection result
 */
const generateReadableExplanation = (log: AuditLog): string => {
  const parts: string[] = [];
  
  // Main verdict
  if (log.detection_result === 'deepfake') {
    parts.push(`🚨 DEEPFAKE DETECTED: This ${log.detection_type} content appears to be AI-generated or digitally manipulated with ${(log.confidence_score * 100).toFixed(1)}% confidence.`);
  } else if (log.detection_result === 'real') {
    parts.push(`✅ AUTHENTIC: This ${log.detection_type} content appears to be genuine with ${(log.confidence_score * 100).toFixed(1)}% confidence.`);
  } else {
    parts.push(`⚠️ UNCERTAIN: The analysis was inconclusive. Confidence: ${(log.confidence_score * 100).toFixed(1)}%.`);
  }

  // File details
  if (log.file_name) {
    parts.push(`\nFile: "${log.file_name}" (${formatFileSize(log.file_size)})`);
  }

  // Analysis details
  if (log.metadata) {
    const meta = log.metadata;
    
    if (meta.resolution) {
      parts.push(`Resolution: ${meta.resolution}`);
    }

    if (meta.duration_seconds) {
      parts.push(`Duration: ${meta.duration_seconds.toFixed(1)} seconds`);
    }

    if (meta.frames_analyzed) {
      parts.push(`Analyzed ${meta.frames_analyzed} frames`);
      if (meta.deepfake_frames && meta.real_frames) {
        parts.push(`(${meta.deepfake_frames} deepfake, ${meta.real_frames} real)`);
      }
    }

    if (meta.features_analyzed && meta.features_analyzed.length > 0) {
      const methods = meta.features_analyzed
        .map((f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
        .join(', ');
      parts.push(`\n\n🔍 Detection Methods Used: ${methods}`);
    }

    if (meta.scores && Object.keys(meta.scores).length > 0) {
      parts.push('\n\n📊 Individual AI Model Verdicts:');
      Object.entries(meta.scores).forEach(([model, score]) => {
        const scoreValue = typeof score === 'number' ? score : 0;
        const verdict = scoreValue > 0.5 ? 'Deepfake' : 'Real';
        const modelName = model.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        parts.push(`  • ${modelName}: ${verdict} (${(scoreValue * 100).toFixed(1)}%)`);
      });
    }

    if (meta.anomalies_detected && meta.anomalies_detected.length > 0) {
      parts.push('\n\n⚠️ Suspicious Indicators Found:');
      meta.anomalies_detected.forEach((anomaly: string) => {
        const readable = anomaly
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
          .replace('Ela', 'Image Manipulation Evidence')
          .replace('High Temporal Variance', 'Inconsistent quality across frames')
          .replace('Frequent Verdict Flips', 'Unstable predictions (sign of manipulation)');
        parts.push(`  • ${readable}`);
      });
    }
  }

  parts.push(`\n\n⏱️ Analysis completed in ${log.processing_time_ms}ms`);
  parts.push(`📅 Analyzed on: ${new Date(log.created_at).toLocaleString()}`);

  return parts.join('\n');
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const AuditLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        auditLogger.getLogs({ ...filters, user_id: user.id }),
        auditLogger.getStats(user.id, filters.start_date, filters.end_date),
      ]);
      
      setLogs(logsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading audit data:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      toast.info('Preparing export...');
      const date = new Date().toISOString().split('T')[0];
      if (format === 'csv') {
        await auditLogger.downloadLogsAsCSV(
          { ...filters, user_id: user?.id },
          `audit_logs_${date}.csv`
        );
      } else {
        await auditLogger.downloadLogsAsJSON(
          { ...filters, user_id: user?.id },
          `audit_logs_${date}.json`
        );
      }
      toast.success(`Audit logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Failed to export audit logs');
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'deepfake':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'real':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'uncertain':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'webcam':
        return <Webcam className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleCopyExplanation = (log: AuditLog) => {
    const explanation = generateReadableExplanation(log);
    navigator.clipboard.writeText(explanation);
    toast.success('Human-readable explanation copied to clipboard!');
  };

  if (!user) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>Please log in to view audit logs</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_detections}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deepfakes Found</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.deepfake_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_detections > 0 
                  ? `${((stats.deepfake_count / stats.total_detections) * 100).toFixed(1)}% of total`
                  : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Real Content</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.real_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_detections > 0 
                  ? `${((stats.real_count / stats.total_detections) * 100).toFixed(1)}% of total`
                  : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.avg_confidence * 100).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg. time: {stats.avg_processing_time.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Audit Logs Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detection Audit Logs</CardTitle>
              <CardDescription>
                Complete history of all deepfake detection operations
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters Panel */}
          {showFilters && (
            <div className="mb-6 p-4 border rounded-lg space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="detection-type">Detection Type</Label>
                  <Select
                    value={filters.detection_type || 'all'}
                    onValueChange={(value) => 
                      setFilters({ ...filters, detection_type: value === 'all' ? undefined : value as 'image' | 'video' | 'webcam' })
                    }
                  >
                    <SelectTrigger id="detection-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="webcam">Webcam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="result-filter">Result</Label>
                  <Select
                    value={filters.detection_result || 'all'}
                    onValueChange={(value) => 
                      setFilters({ ...filters, detection_result: value === 'all' ? undefined : value as 'deepfake' | 'real' | 'uncertain' })
                    }
                  >
                    <SelectTrigger id="result-filter">
                      <SelectValue placeholder="All results" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All results</SelectItem>
                      <SelectItem value="deepfake">Deepfake</SelectItem>
                      <SelectItem value="real">Real</SelectItem>
                      <SelectItem value="uncertain">Uncertain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.start_date || ''}
                    onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({})}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Logs Table */}
          <Tabs defaultValue="table" className="w-full">
            <TabsList>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="detailed">Detailed View</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading audit logs...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(log.detection_type)}
                            {getResultIcon(log.detection_result)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">
                                {log.file_name || 'Unnamed file'}
                              </span>
                              <Badge variant={
                                log.detection_result === 'deepfake' ? 'destructive' :
                                log.detection_result === 'real' ? 'default' : 'secondary'
                              }>
                                {log.detection_result}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(log.created_at)} • {formatFileSize(log.file_size)} • 
                              Confidence: {(log.confidence_score * 100).toFixed(1)}% • 
                              {log.processing_time_ms}ms
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="detailed" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading audit logs...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </div>
                  ) : (
                    logs.map((log) => (
                      <Card key={log.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(log.detection_type)}
                              <CardTitle className="text-base">
                                {log.file_name || 'Unnamed file'}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                log.detection_result === 'deepfake' ? 'destructive' :
                                log.detection_result === 'real' ? 'default' : 'secondary'
                              }>
                                {log.detection_result}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyExplanation(log)}
                                title="Copy human-readable explanation"
                              >
                                Copy Report
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Human-Readable Summary */}
                          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm leading-relaxed">
                              {log.detection_result === 'deepfake' ? (
                                <>
                                  <span className="font-semibold text-red-600">⚠ This content appears to be AI-generated or manipulated.</span>
                                  {' '}Our AI detected it as a deepfake with {(log.confidence_score * 100).toFixed(0)}% confidence.
                                  {log.metadata?.anomalies_detected?.length > 0 && (
                                    <> We found {log.metadata.anomalies_detected.length} suspicious indicator(s).</>
                                  )}
                                </>
                              ) : log.detection_result === 'real' ? (
                                <>
                                  <span className="font-semibold text-green-600">✓ This content appears to be authentic.</span>
                                  {' '}Our AI analyzed it and found no signs of manipulation ({(log.confidence_score * 100).toFixed(0)}% confidence).
                                </>
                              ) : (
                                <>
                                  <span className="font-semibold text-yellow-600">? Unable to determine authenticity.</span>
                                  {' '}The AI models gave mixed results. Manual verification may be needed.
                                </>
                              )}
                            </p>
                          </div>

                          <div className="grid gap-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-muted-foreground">Detection Type:</span>
                                <span className="ml-2 font-medium">{log.detection_type}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Media Type:</span>
                                <span className="ml-2 font-medium">{log.media_type}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Confidence:</span>
                                <span className="ml-2 font-medium">
                                  {(log.confidence_score * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Processing Time:</span>
                                <span className="ml-2 font-medium">{log.processing_time_ms}ms</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">File Size:</span>
                                <span className="ml-2 font-medium">{formatFileSize(log.file_size)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Timestamp:</span>
                                <span className="ml-2 font-medium">{formatDate(log.created_at)}</span>
                              </div>
                            </div>

                            {log.metadata && (
                              <div className="mt-4 pt-4 border-t">
                                <div className="text-muted-foreground mb-2 font-semibold">Analysis Details:</div>
                                <div className="space-y-3">
                                  {/* Face Detection Status */}
                                  {log.metadata.face_detected !== undefined && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Face Detected:</span>
                                      <span className="font-medium">
                                        {log.metadata.face_detected ? '✓ Yes' : '✗ No'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Resolution */}
                                  {log.metadata.resolution && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Image Resolution:</span>
                                      <span className="font-medium">{log.metadata.resolution}</span>
                                    </div>
                                  )}

                                  {/* Frame Count (Video) */}
                                  {log.metadata.frame_count && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Total Frames:</span>
                                      <span className="font-medium">{log.metadata.frame_count} frames</span>
                                    </div>
                                  )}

                                  {/* Duration (Video) */}
                                  {log.metadata.duration_seconds && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Video Duration:</span>
                                      <span className="font-medium">{log.metadata.duration_seconds.toFixed(1)} seconds</span>
                                    </div>
                                  )}

                                  {/* Frames Analyzed (Video) */}
                                  {log.metadata.frames_analyzed && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Frames Analyzed:</span>
                                      <span className="font-medium">{log.metadata.frames_analyzed} frames</span>
                                    </div>
                                  )}

                                  {/* Real/Deepfake Frame Counts (Video) */}
                                  {(log.metadata.real_frames !== undefined || log.metadata.deepfake_frames !== undefined) && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Frame Breakdown:</span>
                                      <div className="flex flex-col gap-1">
                                        {log.metadata.real_frames !== undefined && (
                                          <span className="font-medium text-green-600">Real: {log.metadata.real_frames} frames</span>
                                        )}
                                        {log.metadata.deepfake_frames !== undefined && (
                                          <span className="font-medium text-red-600">Deepfake: {log.metadata.deepfake_frames} frames</span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Suspicious Segments (Video) */}
                                  {log.metadata.suspicious_segments && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Suspicious Segments:</span>
                                      <span className="font-medium text-orange-600">{log.metadata.suspicious_segments} segments found</span>
                                    </div>
                                  )}

                                  {/* AI Models Used */}
                                  {log.metadata.features_analyzed && log.metadata.features_analyzed.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Detection Methods:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {log.metadata.features_analyzed.map((feature: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Individual Model Scores */}
                                  {log.metadata.scores && Object.keys(log.metadata.scores).length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">AI Model Scores:</span>
                                      <div className="flex flex-col gap-1 flex-1">
                                        {Object.entries(log.metadata.scores).map(([model, score]) => {
                                          const scoreValue = typeof score === 'number' ? score : 0;
                                          const isDeepfake = scoreValue > 0.5;
                                          return (
                                            <div key={model} className="flex items-center justify-between text-sm">
                                              <span className="font-medium">
                                                {model.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                                  <div 
                                                    className={`h-full ${isDeepfake ? 'bg-red-500' : 'bg-green-500'}`}
                                                    style={{ width: `${scoreValue * 100}%` }}
                                                  />
                                                </div>
                                                <span className={`font-bold ${isDeepfake ? 'text-red-600' : 'text-green-600'}`}>
                                                  {(scoreValue * 100).toFixed(1)}%
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Anomalies Detected */}
                                  {log.metadata.anomalies_detected && log.metadata.anomalies_detected.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-[140px]">Warning Signs:</span>
                                      <div className="flex flex-col gap-1 flex-1">
                                        {log.metadata.anomalies_detected.map((anomaly: string, idx: number) => {
                                          const humanReadable = anomaly
                                            .replace(/_/g, ' ')
                                            .replace(/\b\w/g, c => c.toUpperCase())
                                            .replace('Ela', 'Image Manipulation')
                                            .replace('High Temporal Variance', 'Inconsistent frame quality')
                                            .replace('Frequent Verdict Flips', 'Unstable detection across frames')
                                            .replace('No Face Detected', 'No human face found in image');
                                          return (
                                            <Badge key={idx} variant="destructive" className="text-xs w-fit">
                                              ⚠ {humanReadable}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Raw JSON Toggle for Advanced Users */}
                                  <details className="mt-4">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                      View Raw Technical Data
                                    </summary>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-auto mt-2">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;
