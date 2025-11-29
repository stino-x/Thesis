import { useState, useEffect } from 'react';
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

const AuditLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, filters]);

  const loadData = async () => {
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
  };

  const handleExport = async () => {
    try {
      toast.info('Preparing export...');
      await auditLogger.downloadLogsAsCSV(
        { ...filters, user_id: user?.id },
        `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
      );
      toast.success('Audit logs exported successfully');
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
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
                      setFilters({ ...filters, detection_type: value === 'all' ? undefined : value as any })
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
                      setFilters({ ...filters, detection_result: value === 'all' ? undefined : value as any })
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
                            <Badge variant={
                              log.detection_result === 'deepfake' ? 'destructive' :
                              log.detection_result === 'real' ? 'default' : 'secondary'
                            }>
                              {log.detection_result}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
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
                                <div className="text-muted-foreground mb-2">Metadata:</div>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
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
